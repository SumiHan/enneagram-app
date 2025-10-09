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

export async function apiGetPreResponse(userId: string): Promise<{ status: 'in_progress' | 'completed' | null, answers: Record<string, number> }> {
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

    const parsedAnswers = (data.answers as Record<string, number>) || {};
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
    console.log('[apiGetReportStatus] Checking for userId:', userId);
    
    const { data, error } = await supabase
      .from('reports')
      .select('id, enneagram_type, user_id')
      .eq('user_id', userId)
      .maybeSingle();

    console.log('[apiGetReportStatus] Query result:', { data, error });

    if (error) {
      console.error('[apiGetReportStatus] Error:', error);
      throw error;
    }

    // Check if report exists AND has meaningful data
    const hasReport = data && data.id && data.enneagram_type;
    console.log('[apiGetReportStatus] Has report:', hasReport, 'Data:', data);
    
    return hasReport ? 'completed' : 'not_started';
  } catch (error) {
    console.error('Error getting report status:', error);
    return 'not_started';
  }
}

export async function apiGenerateReport(userId: string) {
  try {
    // 1. Get user's pre-survey and main-survey responses
    const { data: preResponse, error: preError } = await supabase
      .from('responses')
      .select('answers')
      .eq('user_id', userId)
      .eq('survey_type', 'pre')
      .maybeSingle();
    
    if (preError) {
      console.error('Error fetching pre-survey:', preError);
      throw new Error('사전 설문 데이터를 불러올 수 없습니다.');
    }

    const { data: mainResponse, error: mainError } = await supabase
      .from('responses')
      .select('answers')
      .eq('user_id', userId)
      .eq('survey_type', 'main')
      .maybeSingle();
    
    if (mainError) {
      console.error('Error fetching main-survey:', mainError);
      throw new Error('본 설문 데이터를 불러올 수 없습니다.');
    }

    if (!preResponse || !mainResponse) {
      throw new Error('설문 응답이 완료되지 않았습니다.');
    }

    // Convert answers object to array format
    const preAnswers = Object.entries(preResponse.answers || {}).map(([q_id, value]) => ({
      q_id,
      value: Number(value),
      ts: Date.now()
    }));

    const mainAnswers = Object.entries(mainResponse.answers || {}).map(([q_id, value]) => ({
      q_id,
      value: Number(value),
      ts: Date.now()
    }));

    // 2. Generate report using OpenAI
    const { generateReportWithOpenAI } = await import('./openai');
    const aiResult = await generateReportWithOpenAI(userId, preAnswers, mainAnswers);

    // 3. Save report to database
    const reportData = {
      user_id: userId,
      enneagram_type: aiResult.enneagram_type,
      characteristics: aiResult.characteristics,
      job_recommendations: aiResult.job_recommendations,
      career_guidance: aiResult.career_guidance,
      growth_advice: aiResult.growth_advice,
    };

    // Upsert report (only one report per user)
    const { data, error } = await supabase
      .from('reports')
      .upsert(reportData, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving report:', error);
      throw error;
    }

    // 4. Update progress
    const { error: progressError } = await supabase
      .from('user_progress')
      .update({
        report_status: 'COMPLETED',
        report_id: data.id,
      })
      .eq('user_id', userId);

    if (progressError) {
      console.error('Error updating progress:', progressError);
      throw progressError;
    }

    // 5. Emit event to notify UI components
    eventBus.emit(EVENTS.REPORT_GENERATED, {
      userId,
      reportId: data.id,
      reportData: {
        id: data.id,
        type: data.enneagram_type,
        characteristics: data.characteristics,
        job_recommendations: data.job_recommendations,
        career_guidance: data.career_guidance,
        growth_advice: data.growth_advice,
        generated_at: data.generated_at,
      }
    });

    return {
      id: data.id,
      type: data.enneagram_type,
      characteristics: data.characteristics,
      job_recommendations: data.job_recommendations,
      career_guidance: data.career_guidance,
      growth_advice: data.growth_advice,
      generated_at: data.generated_at,
    };
  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
}

export async function apiGetLatestReport(userId: string) {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      type: data.enneagram_type,
      characteristics: data.characteristics,
      job_recommendations: data.job_recommendations,
      career_guidance: data.career_guidance,
      growth_advice: data.growth_advice,
      generated_at: data.generated_at,
    };
  } catch (error) {
    console.error('Error getting latest report:', error);
    return null;
  }
}
