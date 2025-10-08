import type { QuestionItem } from "@/lib/types";

export const PRE_QUESTIONS: QuestionItem[] = [
  { id: "pre_1", text: "나는 모든 작업에서 정확성과 정밀함을 추구한다." },
  { id: "pre_2", text: "나는 작업에서 가장 작은 불일치와 오류도 발견한다." },
  { id: "pre_3", text: "나는 급한 마감일이 있어도 높은 기준을 유지할 수 있다." },
  { id: "pre_4", text: "나는 필요한 기준을 충족하는지 확인하기 위해 자주 작업을 점검한다." },
  { id: "pre_5", text: "나는 생산성을 극대화하기 위해 하루를 계획한다." },
  { id: "pre_6", text: "나는 정보를 체계적으로 정리하는 경향이 있다." },
  { id: "pre_7", text: "나는 자신에게 명확한 목표를 설정한다." },
  { id: "pre_8", text: "나는 즉흥성보다는 구조를 선호한다." },
  { id: "pre_9", text: "나는 개선하기 위해 실수를 반성한다." },
  { id: "pre_10", text: "나는 피드백을 받는 것에 편안함을 느낀다." },
  { id: "pre_11", text: "나는 기대사항을 명확하게 전달한다." },
  { id: "pre_12", text: "나는 다른 사람들과 효과적으로 협력한다." },
];

// Minimal main survey pool; in real app, many more and grouped by sets
export const MAIN_QUESTIONS_POOL: QuestionItem[] = Array.from({ length: 30 }, (_, i) => ({
  id: `main_${i + 1}`,
  text: `나는 문항 #${i + 1}에 공감한다.`,
}));


