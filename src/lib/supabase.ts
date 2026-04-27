import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export type DbUser = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
};

export type DbUserProgress = {
  id: string;
  user_id: string;
  pre_survey_status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  pre_survey_answered_count: number;
  pre_survey_total_count: number;
  main_survey_status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  main_survey_sets: number;
  main_survey_total_sets: number;
  main_survey_seed: number | null;
  main_survey_current_page: number;
  report_status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  report_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DbSurveyAnswer = {
  id: string;
  user_id: string;
  survey_type: 'PRE' | 'MAIN';
  q_id: string;
  value: number;
  answered_at: string;
};

export type DbReport = {
  id: string;
  user_id: string;
  enneagram_type: string;
  wing?: string | null;
  characteristics: string;
  integration_disintegration?: string | null;
  famous_examples?: string[] | null;
  major_based_career_path?: string | null;
  career_guidance?: string | null;
  growth_advice?: string | null;
  job_recommendations?: string[] | null;
  generated_at: string;
};

export type DbQuestionVersion = {
  id: string;
  survey_type: 'PRE' | 'MAIN';
  version_name: string;
  filename: string;
  description: string | null;
  question_count: number;
  is_active: boolean;
  questions_data: any[];
  uploaded_at: string;
  uploaded_by: string | null;
};

export type DbAIPrompt = {
  id: string;
  title: string;
  description: string | null;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type SubKey = { key: string; label: string };

export type DbAISetting = {
  id: string;
  setting_key: string;
  setting_value: string | null;
  updated_at: string;
};
