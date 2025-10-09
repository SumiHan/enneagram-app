export type SurveyStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export type SurveyType = "PRE" | "MAIN";

export interface ProgressPointer {
  page: number; // page index within flow
  index: number; // question index within current set/page
  setId?: string; // for main survey sets
}

export interface UserProgress {
  user_id: string;
  pre_survey: {
    status: SurveyStatus;
    answered_count: number;
    total_count: number;
    last_pointer?: ProgressPointer | null;
  };
  main_survey: {
    status: SurveyStatus;
    sets: number; // completed sets
    total_sets: number;
    last_pointer?: ProgressPointer | null;
    seed?: number; // RNG seed for stability
  };
  report: {
    status: SurveyStatus;
    report_id?: string | null;
  };
}

export interface SurveyAnswer {
  q_id: string;
  value: number; // 1..6 Likert
  ts: number; // epoch ms
}

export interface SurveyResponse {
  user_id: string;
  survey_type: SurveyType;
  answers: SurveyAnswer[];
  meta: { seed?: number; set_id?: string };
  status: "IN_PROGRESS" | "COMPLETED";
}

export interface QuestionItem {
  id: string;
  text: string;
  options?: string[]; // for pre survey variable options
  // 추가 필드들 (CSV에서 사용)
  category?: string;
  purpose?: string;
  type?: string;
  typeName?: string;
}


