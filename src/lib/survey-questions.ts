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
};

export type MainSurveyQuestion = {
  type: string;
  type_name?: string;
  q_id: string;
  text_ko: string;
};

// CSV 파싱 함수
export const parseQuestionsCsv = (file: File, config: {
  idColumn: string;
  textColumn: string;
  optionsColumn?: string;
  categoryColumn?: string;
  purposeColumn?: string;
  typeColumn?: string;
  typeNameColumn?: string;
}): Promise<QuestionItem[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string;
        const lines = csv.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          throw new Error('CSV 파일에 헤더와 데이터가 필요합니다.');
        }
        
        const headers = lines[0].split(',').map(h => h.trim());
        console.log('CSV Headers:', headers);
        const data: QuestionItem[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          
          // 빈 행 건너뛰기 (모든 값이 비어있으면)
          if (values.every(v => !v || v === '')) {
            continue;
          }
          
          // q_id가 없으면 건너뛰기 (필수 필드)
          if (!values[0] || values[0] === '') {
            continue;
          }
          
          const row: Record<string, string> = {};
          
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          
          // options 처리 (슬래시 구분)
          let options: string[] = [];
          if (config.optionsColumn && row[config.optionsColumn]) {
            options = row[config.optionsColumn].split('/').map(o => o.trim()).filter(o => o);
          }
          
          const item = {
            id: row[config.idColumn],
            text: row[config.textColumn],
            options: options.length > 0 ? options : undefined,
            // 추가 필드들 (필요시 사용)
            category: config.categoryColumn ? row[config.categoryColumn] : undefined,
            purpose: config.purposeColumn ? row[config.purposeColumn] : undefined,
            type: config.typeColumn ? row[config.typeColumn] : undefined,
            typeName: config.typeNameColumn ? row[config.typeNameColumn] : undefined,
          } as QuestionItem;
          
          console.log(`Row ${i}:`, row);
          console.log(`Parsed item:`, item);
          
          data.push(item);
        }
        
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsText(file);
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
    
    // 새 데이터 삽입
    const { error: insertError } = await supabase
      .from('pre_survey_questions')
      .insert(questions);
    
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
      .order('q_id');
    
    if (error) throw error;
    
    return (data || []).map(item => ({
      id: item.q_id,
      text: item.text_ko,
      options: item.options ? item.options.split('/').map((o: string) => o.trim()).filter((o: string) => o) : undefined,
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
