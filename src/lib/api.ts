import { getLocalStorage, setLocalStorage } from "./storage";
import type { SurveyResponse, SurveyType, UserProgress, SurveyAnswer } from "./types";
import { getPreQuestionsFromStorage, getMainQuestionsFromStorage } from "./dynamic-questions";
import { PRE_QUESTIONS, MAIN_QUESTIONS_POOL } from "@/data/questions";

const LS_PROGRESS = "progress.v1";
const LS_SURVEY_PRE = "survey.pre.v1";
const LS_SURVEY_MAIN = "survey.main.v1";

function defaultProgress(userId: string): UserProgress {
  return {
    user_id: userId,
    pre_survey: { status: "NOT_STARTED", answered_count: 0, total_count: 12, last_pointer: null },
    main_survey: { status: "NOT_STARTED", sets: 0, total_sets: 3, last_pointer: null, seed: undefined },
    report: { status: "NOT_STARTED", report_id: null },
  };
}

export async function apiGetProgress(userId: string): Promise<UserProgress> {
  const progress = getLocalStorage<UserProgress | null>(`${LS_PROGRESS}:${userId}`, null);
  if (!progress) {
    const d = defaultProgress(userId);
    setLocalStorage(`${LS_PROGRESS}:${userId}`, d);
    return d;
  }
  // Sync dynamic counts with uploaded CSV lengths
  try {
    const preLen = getPreQuestionsFromStorage(PRE_QUESTIONS).length;
    if (preLen > 0) progress.pre_survey.total_count = preLen;
    const mainLen = getMainQuestionsFromStorage(MAIN_QUESTIONS_POOL).length;
    if (mainLen > 0) progress.main_survey.total_sets = Math.max(1, Math.ceil(mainLen / 30));
  } catch {}
  return progress;
}

export async function apiPatchPreAnswers(userId: string, answers: SurveyAnswer[], lastPointer?: UserProgress["pre_survey"]["last_pointer"]) {
  const key = `${LS_SURVEY_PRE}:${userId}`;
  const existing = getLocalStorage<SurveyResponse | null>(key, null);
  const merged: SurveyResponse = {
    user_id: userId,
    survey_type: "PRE",
    answers: [...(existing?.answers ?? [])],
    meta: existing?.meta ?? {},
    status: "IN_PROGRESS",
  };

  // merge by q_id (last write wins)
  const map = new Map<string, SurveyAnswer>();
  for (const a of merged.answers) map.set(a.q_id, a);
  for (const a of answers) map.set(a.q_id, a);
  merged.answers = Array.from(map.values());
  setLocalStorage(key, merged);

  // update progress
  const progress = await apiGetProgress(userId);
  progress.pre_survey.status = "IN_PROGRESS";
  progress.pre_survey.answered_count = merged.answers.length;
  if (lastPointer) progress.pre_survey.last_pointer = lastPointer;
  setLocalStorage(`${LS_PROGRESS}:${userId}`, progress);
  return merged;
}

export async function apiCompletePre(userId: string) {
  const progress = await apiGetProgress(userId);
  progress.pre_survey.status = "COMPLETED";
  setLocalStorage(`${LS_PROGRESS}:${userId}`, progress);
}

export async function apiStartMainSession(userId: string, seed: number) {
  const key = `${LS_SURVEY_MAIN}:${userId}`;
  const session: SurveyResponse = { user_id: userId, survey_type: "MAIN", answers: [], meta: { seed }, status: "IN_PROGRESS" };
  setLocalStorage(key, session);
  const progress = await apiGetProgress(userId);
  progress.main_survey.status = "IN_PROGRESS";
  progress.main_survey.seed = seed;
  setLocalStorage(`${LS_PROGRESS}:${userId}`, progress);
  return session;
}

export async function apiPatchMainAnswers(userId: string, answers: SurveyAnswer[], lastPointer?: UserProgress["main_survey"]["last_pointer"]) {
  const key = `${LS_SURVEY_MAIN}:${userId}`;
  const existing = getLocalStorage<SurveyResponse | null>(key, null) ?? { user_id: userId, survey_type: "MAIN", answers: [], meta: {}, status: "IN_PROGRESS" };
  const map = new Map<string, SurveyAnswer>();
  for (const a of existing.answers) map.set(a.q_id, a);
  for (const a of answers) map.set(a.q_id, a);
  existing.answers = Array.from(map.values());
  setLocalStorage(key, existing);

  const progress = await apiGetProgress(userId);
  progress.main_survey.status = "IN_PROGRESS";
  progress.main_survey.sets = Math.min(progress.main_survey.total_sets, Math.floor(existing.answers.length / 10));
  if (lastPointer) progress.main_survey.last_pointer = lastPointer;
  setLocalStorage(`${LS_PROGRESS}:${userId}`, progress);
  return existing;
}

export async function apiCompleteMain(userId: string) {
  const progress = await apiGetProgress(userId);
  progress.main_survey.status = "COMPLETED";
  setLocalStorage(`${LS_PROGRESS}:${userId}`, progress);
}

export async function apiGenerateReport(userId: string) {
  // Fake generation; in real app call OpenAI and persist
  const progress = await apiGetProgress(userId);
  progress.report.status = "COMPLETED";
  progress.report.report_id = `rep_${Date.now()}`;
  setLocalStorage(`${LS_PROGRESS}:${userId}`, progress);
  const typeIndex = (progress.main_survey.seed ?? 7) % 9;
  const types = ["1 개혁가", "2 조력가", "3 성취가", "4 개인주의자", "5 탐구자", "6 충성가", "7 낙천가", "8 도전자", "9 평화주의자"];
  const reportData = {
    id: progress.report.report_id,
    type: types[typeIndex],
    characteristics: "이 유형은 정확성과 책임감을 중시하며, 항상 성장을 추구합니다. 완벽주의 성향이 강하고, 높은 기준을 유지하려고 노력합니다.",
    job_recommendations: ["프로덕트 매니저", "데이터 분석가", "UX 리서처"],
    generated_at: new Date().toISOString(),
  };
  // Save report data to localStorage
  setLocalStorage(`report.v1:${userId}`, reportData);
  return reportData;
}

export async function apiGetLatestReport(userId: string) {
  const progress = await apiGetProgress(userId);
  if (progress.report.report_id) {
    // Try to get existing report from localStorage first
    const existingReport = getLocalStorage(`report.v1:${userId}`, null);
    if (existingReport) {
      return existingReport;
    }
    // If not found, generate new one (shouldn't happen in normal flow)
    return apiGenerateReport(userId);
  }
  return null;
}


