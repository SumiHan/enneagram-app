import { supabase } from "./supabase";
import type { SurveyAnswer, UserProgress } from "./types";
import { getPreQuestionsFromStorage, getMainQuestionsFromStorage } from "./dynamic-questions";
import { PRE_QUESTIONS, MAIN_QUESTIONS_POOL } from "@/data/questions";

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
    // Upsert answers (insert or update)
    const answersToUpsert = answers.map(a => ({
      user_id: userId,
      survey_type: 'PRE' as const,
      q_id: a.q_id,
      value: a.value,
    }));

    const { error } = await supabase
      .from('survey_answers')
      .upsert(answersToUpsert, {
        onConflict: 'user_id,survey_type,q_id'
      });

    if (error) throw error;

    // Update progress
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

export async function apiCompletePre(userId: string) {
  try {
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

export async function apiPatchMainAnswers(
  userId: string,
  answers: SurveyAnswer[],
  lastPointer?: UserProgress["main_survey"]["last_pointer"]
) {
  try {
    // Upsert answers
    const answersToUpsert = answers.map(a => ({
      user_id: userId,
      survey_type: 'MAIN' as const,
      q_id: a.q_id,
      value: a.value,
    }));

    const { error } = await supabase
      .from('survey_answers')
      .upsert(answersToUpsert, {
        onConflict: 'user_id,survey_type,q_id'
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

export async function apiGenerateReport(userId: string) {
  try {
    // Get user progress for seed
    const progress = await apiGetProgress(userId);
    const typeIndex = (progress.main_survey.seed ?? 7) % 9;
    const types = ["1 개혁가", "2 조력가", "3 성취가", "4 개인주의자", "5 탐구자", "6 충성가", "7 낙천가", "8 도전자", "9 평화주의자"];
    
    const reportData = {
      user_id: userId,
      enneagram_type: types[typeIndex],
      characteristics: "이 유형은 정확성과 책임감을 중시하며, 항상 성장을 추구합니다. 완벽주의 성향이 강하고, 높은 기준을 유지하려고 노력합니다.",
      job_recommendations: ["프로덕트 매니저", "데이터 분석가", "UX 리서처"],
    };

    // Upsert report (only one report per user)
    const { data, error } = await supabase
      .from('reports')
      .upsert(reportData, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) throw error;

    // Update progress
    const { error: progressError } = await supabase
      .from('user_progress')
      .update({
        report_status: 'COMPLETED',
        report_id: data.id,
      })
      .eq('user_id', userId);

    if (progressError) throw progressError;

    return {
      id: data.id,
      type: data.enneagram_type,
      characteristics: data.characteristics,
      job_recommendations: data.job_recommendations,
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
      generated_at: data.generated_at,
    };
  } catch (error) {
    console.error('Error getting latest report:', error);
    return null;
  }
}
