import Papa from 'papaparse';
import { supabase } from './supabase';
import type { QuestionItem } from './types';

// ============================================
// 설문 문항 관리 API (Supabase 기반)
// ============================================

export type PreSurveyQuestion = {
  q_id: string;
  category?: string;
  text_ko: string;
  options?: string;
  purpose?: string;
  required?: string;
  answer_type?: string;
  sort_order?: number;
};

export type MainSurveyQuestion = {
  type: string;
  type_name?: string;
  q_id: string;
  text_ko: string;
};

// CSV 파싱 함수 (PapaParse 사용 - 쉼표 포함 필드 정상 처리)
export const parseQuestionsCsv = (file: File, config: {
  idColumn: string;
  textColumn: string;
  optionsColumn?: string;
  categoryColumn?: string;
  purposeColumn?: string;
  typeColumn?: string;
  typeNameColumn?: string;
  requiredColumn?: string;
  answerTypeColumn?: string;
}): Promise<QuestionItem[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        try {
          const rows = result.data as Record<string, string>[];
          const data: QuestionItem[] = rows
            .filter(row => row[config.idColumn] && row[config.textColumn])
            .map(row => {
              const optionsRaw = config.optionsColumn ? row[config.optionsColumn] : '';
              const options = optionsRaw
                ? optionsRaw.split('/').map(o => o.trim()).filter(Boolean)
                : [];
              return {
                id: String(row[config.idColumn]).trim(),
                text: String(row[config.textColumn]).trim(),
                options: options.length > 0 ? options : undefined,
                category: config.categoryColumn ? row[config.categoryColumn] : undefined,
                purpose: config.purposeColumn ? row[config.purposeColumn] : undefined,
                type: config.typeColumn ? row[config.typeColumn] : undefined,
                typeName: config.typeNameColumn ? row[config.typeNameColumn] : undefined,
                required: config.requiredColumn ? (row[config.requiredColumn] || 'y') : 'y',
                answerType: config.answerTypeColumn ? (row[config.answerTypeColumn] || '객관식-단일선택') : '객관식-단일선택',
              } as QuestionItem;
            });
          resolve(data);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => reject(new Error(`CSV 파싱 오류: ${error.message}`)),
    });
  });
};

// 사전 설문 문항 저장 (upsert)
export const savePreSurveyQuestions = async (questions: PreSurveyQuestion[]): Promise<void> => {
  try {
    // 기존 데이터 삭제
    const { error: deleteError } = await supabase
      .from('pre_survey_questions')
      .delete()
      .neq('id', 0); // 모든 데이터 삭제
    
    if (deleteError) throw deleteError;
    
    // 새 데이터 삽입 (sort_order를 CSV 순서로 지정)
    const questionsWithOrder = questions.map((q, index) => ({
      ...q,
      sort_order: index,
    }));
    const { error: insertError } = await supabase
      .from('pre_survey_questions')
      .insert(questionsWithOrder);

    if (insertError) throw insertError;
    
    console.log(`Saved ${questions.length} pre-survey questions to Supabase`);
  } catch (error) {
    console.error('Error saving pre-survey questions:', error);
    throw error;
  }
};

// 본 설문 문항 저장 (upsert)
export const saveMainSurveyQuestions = async (questions: MainSurveyQuestion[]): Promise<void> => {
  try {
    // 기존 데이터 삭제
    const { error: deleteError } = await supabase
      .from('main_survey_questions')
      .delete()
      .neq('id', 0); // 모든 데이터 삭제
    
    if (deleteError) throw deleteError;
    
    // 새 데이터 삽입
    const { error: insertError } = await supabase
      .from('main_survey_questions')
      .insert(questions);
    
    if (insertError) throw insertError;
    
    console.log(`Saved ${questions.length} main-survey questions to Supabase`);
  } catch (error) {
    console.error('Error saving main-survey questions:', error);
    throw error;
  }
};

// 사전 설문 문항 로드
export const getPreSurveyQuestions = async (): Promise<QuestionItem[]> => {
  try {
    const { data, error } = await supabase
      .from('pre_survey_questions')
      .select('*')
      .order('sort_order', { ascending: true });
    
    if (error) throw error;
    
    return (data || []).map(item => ({
      id: item.q_id,
      text: item.text_ko,
      options: item.options ? item.options.split('/').map((o: string) => o.trim()).filter((o: string) => o) : undefined,
      required: item.required ?? 'y',
      answerType: item.answer_type ?? '객관식-단일선택',
    }));
  } catch (error) {
    console.error('Error loading pre-survey questions:', error);
    // 폴백: localStorage에서 로드
    return getPreQuestionsFromStorage([]);
  }
};

// 본 설문 문항 로드
export const getMainSurveyQuestions = async (): Promise<QuestionItem[]> => {
  try {
    const { data, error } = await supabase
      .from('main_survey_questions')
      .select('*')
      .order('type, q_id');
    
    if (error) throw error;
    
    return (data || []).map(item => ({
      id: item.q_id,
      text: item.text_ko,
    }));
  } catch (error) {
    console.error('Error loading main-survey questions:', error);
    // 폴백: localStorage에서 로드
    return getMainQuestionsFromStorage([]);
  }
};

// localStorage 폴백 함수들 (기존 코드와 호환성 유지)
import { getPreQuestionsFromStorage, getMainQuestionsFromStorage } from './dynamic-questions';

// 사전 설문 문항 개수 조회
export const getPreSurveyQuestionsCount = async (): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('pre_survey_questions')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error getting pre-survey questions count:', error);
    return 0;
  }
};

// 본 설문 문항 개수 조회
export const getMainSurveyQuestionsCount = async (): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('main_survey_questions')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error getting main-survey questions count:', error);
    return 0;
  }
};
