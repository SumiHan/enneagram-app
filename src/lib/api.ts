import { supabase } from "./supabase";
import type { SurveyAnswer, UserProgress } from "./types";
import { getPreQuestionsFromStorage, getMainQuestionsFromStorage } from "./dynamic-questions";
import { PRE_QUESTIONS, MAIN_QUESTIONS_POOL } from "@/data/questions";
import { eventBus, EVENTS } from "./event-bus";

function defaultProgress(userId: string): UserProgress {
  return {
    user_id: userId,
    pre_survey: { status: "NOT_STARTED", answered_count: 0, total_count: 12, last_pointer: null },
    main_survey: { status: "NOT_STARTED", sets: 0, total_sets: 3, last_pointer: null, seed: undefined },
    report: { status: "NOT_STARTED", report_id: null },
  };
}

export async function apiGetProgress(userId: string): Promise<UserProgress> {
  try {
    // Get from Supabase
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Create default progress if not exists
      const defaultProg = defaultProgress(userId);
      
      const { error: insertError } = await supabase
        .from('user_progress')
        .insert({
          user_id: userId,
          pre_survey_status: defaultProg.pre_survey.status,
          pre_survey_answered_count: defaultProg.pre_survey.answered_count,
          pre_survey_total_count: defaultProg.pre_survey.total_count,
          main_survey_status: defaultProg.main_survey.status,
          main_survey_sets: defaultProg.main_survey.sets,
          main_survey_total_sets: defaultProg.main_survey.total_sets,
          main_survey_seed: defaultProg.main_survey.seed,
          main_survey_current_page: 0,
          report_status: defaultProg.report.status,
          report_id: defaultProg.report.report_id,
        });

      if (insertError) console.error('Error creating progress:', insertError);
      return defaultProg;
    }

    // Convert DB format to app format
    const progress: UserProgress = {
      user_id: userId,
      pre_survey: {
        status: data.pre_survey_status as any,
        answered_count: data.pre_survey_answered_count,
        total_count: data.pre_survey_total_count,
        last_pointer: null,
      },
      main_survey: {
        status: data.main_survey_status as any,
        sets: data.main_survey_sets,
        total_sets: data.main_survey_total_sets,
        last_pointer: { page: data.main_survey_current_page, index: 0 },
        seed: data.main_survey_seed ?? undefined,
      },
      report: {
        status: data.report_status as any,
        report_id: data.report_id,
      },
    };

    // Sync dynamic counts
    try {
      const preLen = getPreQuestionsFromStorage(PRE_QUESTIONS).length;
      if (preLen > 0) progress.pre_survey.total_count = preLen;
      const mainLen = getMainQuestionsFromStorage(MAIN_QUESTIONS_POOL).length;
      if (mainLen > 0) progress.main_survey.total_sets = Math.max(1, Math.ceil(mainLen / 30));
    } catch {}

    return progress;
  } catch (error) {
    console.error('Error getting progress:', error);
    return defaultProgress(userId);
  }
}

export async function apiPatchPreAnswers(
  userId: string,
  answers: SurveyAnswer[],
  lastPointer?: UserProgress["pre_survey"]["last_pointer"]
) {
  try {
    // Convert answers array to JSON object
    const answersJson: Record<string, number | number[] | string> = {};
    answers.forEach(a => {
      // 주관식 텍스트 답변
      if (a.text_value !== undefined) {
        answersJson[a.q_id] = a.text_value;
        return;
      }
      if (answersJson[a.q_id] === undefined) {
        answersJson[a.q_id] = a.value;
      } else {
        // 같은 q_id에 이미 답변이 있는 경우 (다중 선택)
        const existing = answersJson[a.q_id];
        if (Array.isArray(existing)) {
          if (!existing.includes(a.value)) {
            existing.push(a.value);
          }
        } else if (typeof existing === 'number') {
          if (existing !== a.value) {
            answersJson[a.q_id] = [existing, a.value];
          }
        }
      }
    });

    // Upsert to responses table
    const { error } = await supabase
      .from('responses')
      .upsert({
        user_id: userId,
        survey_type: 'pre',
        status: 'in_progress',
        answers: answersJson,
      }, {
        onConflict: 'user_id,survey_type'
      });

    if (error) throw error;

    // Update progress count
    const { error: progressError } = await supabase
      .from('user_progress')
      .update({
        pre_survey_status: 'IN_PROGRESS',
        pre_survey_answered_count: answers.length,
      })
      .eq('user_id', userId);

    if (progressError) throw progressError;

    return { success: true };
  } catch (error) {
    console.error('Error patching pre answers:', error);
    throw error;
  }
}

export async function apiGetPreResponse(userId: string): Promise<{ status: 'in_progress' | 'completed' | null, answers: Record<string, number | number[] | string> }> {
  try {
    console.log('[apiGetPreResponse] Fetching for userId:', userId);
    
    const { data, error } = await supabase
      .from('responses')
      .select('status, answers')
      .eq('user_id', userId)
      .eq('survey_type', 'pre')
      .maybeSingle();

    console.log('[apiGetPreResponse] Query result:', { data, error });

    if (error) throw error;

    if (!data) {
      console.log('[apiGetPreResponse] No data found, returning empty');
      return { status: null, answers: {} };
    }

    const parsedAnswers = (data.answers as Record<string, number | number[]>) || {};
    console.log('[apiGetPreResponse] Parsed answers:', parsedAnswers);
    console.log('[apiGetPreResponse] Answers count:', Object.keys(parsedAnswers).length);

    return {
      status: data.status as 'in_progress' | 'completed',
      answers: parsedAnswers,
    };
  } catch (error) {
    console.error('[apiGetPreResponse] Error getting pre response:', error);
    return { status: null, answers: {} };
  }
}

export async function apiCompletePre(userId: string) {
  try {
    // Update responses table to 'completed'
    const { error: responseError } = await supabase
      .from('responses')
      .update({
        status: 'completed',
      })
      .eq('user_id', userId)
      .eq('survey_type', 'pre');

    if (responseError) throw responseError;

    // Update progress status
    const { error } = await supabase
      .from('user_progress')
      .update({
        pre_survey_status: 'COMPLETED',
      })
      .eq('user_id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error completing pre survey:', error);
    throw error;
  }
}

export async function apiStartMainSession(userId: string, seed: number) {
  try {
    const { error } = await supabase
      .from('user_progress')
      .update({
        main_survey_status: 'IN_PROGRESS',
        main_survey_seed: seed,
      })
      .eq('user_id', userId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error starting main session:', error);
    throw error;
  }
}

export async function apiGetMainResponse(userId: string): Promise<{ status: 'in_progress' | 'completed' | null, answers: Record<string, number>, currentPage?: number }> {
  try {
    console.log('[apiGetMainResponse] Fetching for userId:', userId);
    
    const { data, error } = await supabase
      .from('responses')
      .select('status, answers')
      .eq('user_id', userId)
      .eq('survey_type', 'main')
      .maybeSingle();

    console.log('[apiGetMainResponse] Query result:', { data, error });

    if (error) throw error;

    if (!data) {
      console.log('[apiGetMainResponse] No data found, returning empty');
      return { status: null, answers: {}, currentPage: 0 };
    }

    // Get current page from user_progress
    const { data: progressData } = await supabase
      .from('user_progress')
      .select('main_survey_current_page')
      .eq('user_id', userId)
      .single();

    const parsedAnswers = (data.answers as Record<string, number>) || {};
    console.log('[apiGetMainResponse] Parsed answers:', parsedAnswers);
    console.log('[apiGetMainResponse] Answers count:', Object.keys(parsedAnswers).length);
    console.log('[apiGetMainResponse] Current page:', progressData?.main_survey_current_page || 0);

    return {
      status: data.status as 'in_progress' | 'completed',
      answers: parsedAnswers,
      currentPage: progressData?.main_survey_current_page || 0,
    };
  } catch (error) {
    console.error('[apiGetMainResponse] Error getting main response:', error);
    return { status: null, answers: {}, currentPage: 0 };
  }
}

export async function apiPatchMainAnswers(
  userId: string,
  answers: SurveyAnswer[],
  lastPointer?: UserProgress["main_survey"]["last_pointer"]
) {
  try {
    // Convert answers array to JSON object { q_id: value }
    const answersJson: Record<string, number> = {};
    answers.forEach(a => {
      answersJson[a.q_id] = a.value;
    });

    // Upsert to responses table
    const { error } = await supabase
      .from('responses')
      .upsert({
        user_id: userId,
        survey_type: 'main',
        status: 'in_progress',
        answers: answersJson,
      }, {
        onConflict: 'user_id,survey_type'
      });

    if (error) throw error;

    // Update progress
    const updateData: any = {
      main_survey_status: 'IN_PROGRESS',
    };
    
    if (lastPointer) {
      updateData.main_survey_current_page = lastPointer.page;
    }

    const { error: progressError } = await supabase
      .from('user_progress')
      .update(updateData)
      .eq('user_id', userId);

    if (progressError) throw progressError;

    return { success: true };
  } catch (error) {
    console.error('Error patching main answers:', error);
    throw error;
  }
}

export async function apiCompleteMain(userId: string) {
  try {
    // Update responses table to 'completed'
    const { error: responseError } = await supabase
      .from('responses')
      .update({
        status: 'completed',
      })
      .eq('user_id', userId)
      .eq('survey_type', 'main');

    if (responseError) throw responseError;

    // Update progress status
    const { error } = await supabase
      .from('user_progress')
      .update({
        main_survey_status: 'COMPLETED',
      })
      .eq('user_id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error completing main survey:', error);
    throw error;
  }
}

export async function apiGetReportStatus(userId: string): Promise<'not_started' | 'completed'> {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('id, report_data')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    const hasReport = data?.id && Array.isArray(data?.report_data) && data.report_data.length > 0;
    return hasReport ? 'completed' : 'not_started';
  } catch (error) {
    console.error('Error getting report status:', error);
    return 'not_started';
  }
}

export async function apiGenerateReport(userId: string) {
  try {
    // 1. 설문 응답 로드
    const { data: preResponse, error: preError } = await supabase
      .from('responses')
      .select('answers')
      .eq('user_id', userId)
      .eq('survey_type', 'pre')
      .maybeSingle();

    if (preError) throw new Error('사전 설문 데이터를 불러올 수 없습니다.');

    const { data: mainResponse, error: mainError } = await supabase
      .from('responses')
      .select('answers')
      .eq('user_id', userId)
      .eq('survey_type', 'main')
      .maybeSingle();

    if (mainError) throw new Error('본 설문 데이터를 불러올 수 없습니다.');
    if (!preResponse || !mainResponse) throw new Error('설문 응답이 완료되지 않았습니다.');

    // answers 객체 → 배열 변환 (주관식 text_value 포함)
    const rawPre = preResponse.answers || {};
    const preAnswers = Object.entries(rawPre).map(([q_id, value]) => ({
      q_id,
      value: typeof value === 'number' ? value : 0,
      text_value: typeof value === 'string' ? value : undefined,
      ts: Date.now(),
    }));

    const mainAnswers = Object.entries(mainResponse.answers || {}).map(([q_id, value]) => ({
      q_id,
      value: Number(value),
      ts: Date.now(),
    }));

    // 2. OpenAI 호출
    const { generateReportWithOpenAI } = await import('./openai');
    const aiResult = await generateReportWithOpenAI(userId, preAnswers, mainAnswers);

    console.log('[apiGenerateReport] sections:', aiResult.sections.map(s => s.key));

    // 3. DB 저장
    const firstContent = aiResult.sections[0]?.content ?? '';
    const enneagramType = (typeof firstContent === 'string' ? firstContent : '').substring(0, 30) || '분석 완료';

    const { data, error } = await supabase
      .from('reports')
      .upsert(
        {
          user_id: userId,
          enneagram_type: enneagramType,
          report_data: aiResult.sections,
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) throw error;

    // 4. 진행 상태 업데이트
    await supabase
      .from('user_progress')
      .update({ report_status: 'COMPLETED', report_id: data.id })
      .eq('user_id', userId);

    // 5. 이벤트 발행
    eventBus.emit(EVENTS.REPORT_GENERATED, {
      userId,
      reportId: data.id,
      report: { id: data.id, report_data: data.report_data, generated_at: data.generated_at },
    });

    return {
      id: data.id,
      report_data: aiResult.sections,
      generated_at: data.generated_at,
    };
  } catch (error) {
    console.error('[apiGenerateReport] Error:', error);
    throw error;
  }
}

export async function apiPreviewPrompts(email: string) {
  // 이메일로 userId 조회
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (userError) throw new Error('사용자 조회 실패');
  if (!userRow) throw new Error(`이메일 "${email}"에 해당하는 사용자가 없습니다.`);

  const userId = userRow.id;

  // 설문 응답 로드
  const { data: preResponse } = await supabase
    .from('responses')
    .select('answers')
    .eq('user_id', userId)
    .eq('survey_type', 'pre')
    .maybeSingle();

  const { data: mainResponse } = await supabase
    .from('responses')
    .select('answers')
    .eq('user_id', userId)
    .eq('survey_type', 'main')
    .maybeSingle();

  const rawPre = preResponse?.answers || {};
  const preAnswers = Object.entries(rawPre).map(([q_id, value]) => ({
    q_id,
    value: typeof value === 'number' ? value : 0,
    text_value: typeof value === 'string' ? value : undefined,
    ts: Date.now(),
  }));

  const mainAnswers = Object.entries(mainResponse?.answers || {}).map(([q_id, value]) => ({
    q_id,
    value: Number(value),
    ts: Date.now(),
  }));

  const { previewPrompts } = await import('./openai');
  return previewPrompts(preAnswers, mainAnswers);
}

export async function apiGetLatestReport(userId: string) {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('id, report_data, generated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      report_data: data.report_data ?? [],
      generated_at: data.generated_at,
    };
  } catch (error) {
    console.error('Error getting latest report:', error);
    return null;
  }
}
