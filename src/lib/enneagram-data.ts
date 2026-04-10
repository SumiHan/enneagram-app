export type Triad = "gut" | "heart" | "head";

export type TypeData = {
  number: number;
  name: string;
  subtitle: string;
  triad: Triad;
  coreDesire: string;
  coreFear: string;
  keywords: string[];
  growth: number;
  stress: number;
  wings: [number, number];
};

export const TYPES: TypeData[] = [
  { number: 1, name: "개혁가", subtitle: "The Reformer", triad: "gut", coreDesire: "올바르고 선한 사람이 되는 것", coreFear: "부도덕하거나 결함 있는 사람이 되는 것", keywords: ["원칙", "완벽주의", "정직", "책임감", "개선"], growth: 7, stress: 4, wings: [9, 2] },
  { number: 2, name: "조력가", subtitle: "The Helper", triad: "heart", coreDesire: "사랑받고 필요한 존재가 되는 것", coreFear: "사랑받지 못하거나 필요 없는 존재가 되는 것", keywords: ["배려", "공감", "관계", "헌신", "따뜻함"], growth: 4, stress: 8, wings: [1, 3] },
  { number: 3, name: "성취가", subtitle: "The Achiever", triad: "heart", coreDesire: "가치 있고 성공한 사람이 되는 것", coreFear: "무가치하거나 실패한 사람이 되는 것", keywords: ["목표", "효율", "성공", "이미지", "리더십"], growth: 6, stress: 9, wings: [2, 4] },
  { number: 4, name: "예술가", subtitle: "The Individualist", triad: "heart", coreDesire: "자신만의 정체성과 의미를 찾는 것", coreFear: "평범하거나 정체성이 없는 것", keywords: ["감성", "창의성", "독창성", "깊이", "자기표현"], growth: 1, stress: 2, wings: [3, 5] },
  { number: 5, name: "탐구가", subtitle: "The Investigator", triad: "head", coreDesire: "유능하고 지식을 갖춘 사람이 되는 것", coreFear: "무능하고 공허한 존재가 되는 것", keywords: ["분석", "지식", "독립", "관찰", "집중"], growth: 8, stress: 7, wings: [4, 6] },
  { number: 6, name: "충성가", subtitle: "The Loyalist", triad: "head", coreDesire: "믿고 기댈 수 있는 것을 갖는 것", coreFear: "지지와 확신을 잃는 것", keywords: ["신뢰", "안전", "충성", "책임감", "팀워크"], growth: 9, stress: 3, wings: [5, 7] },
  { number: 7, name: "열정가", subtitle: "The Enthusiast", triad: "head", coreDesire: "행복하고 만족스러운 삶을 사는 것", coreFear: "고통받거나 박탈당하는 것", keywords: ["자유", "모험", "낙관", "다양성", "창의성"], growth: 5, stress: 1, wings: [6, 8] },
  { number: 8, name: "도전가", subtitle: "The Challenger", triad: "gut", coreDesire: "자신과 타인을 보호하는 것", coreFear: "타인에게 통제당하거나 상처받는 것", keywords: ["주도성", "강인함", "정의", "보호", "직설"], growth: 2, stress: 5, wings: [7, 9] },
  { number: 9, name: "중재자", subtitle: "The Peacemaker", triad: "gut", coreDesire: "내면의 평화와 조화를 유지하는 것", coreFear: "단절되거나 갈등에 빠지는 것", keywords: ["평화", "조화", "수용", "인내", "안정"], growth: 3, stress: 6, wings: [8, 1] },
];

export const TRIADS = [
  { key: "gut",   name: "본능 중심", subtitle: "본능 · 분노",   types: [1, 8, 9], color: "text-red-600",   bg: "bg-red-50",   border: "border-red-200",   desc: "몸의 감각과 본능으로 세상에 반응해요. 핵심 감정은 분노예요." },
  { key: "heart", name: "감정 중심", subtitle: "감정 · 수치심", types: [2, 3, 4], color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", desc: "감정과 관계로 세상에 반응해요. 핵심 감정은 수치심이에요." },
  { key: "head",  name: "사고 중심", subtitle: "사고 · 두려움", types: [5, 6, 7], color: "text-blue-600",  bg: "bg-blue-50",  border: "border-blue-200",  desc: "생각과 분석으로 세상에 반응해요. 핵심 감정은 두려움이에요." },
];

export const TRIAD_STYLE: Record<Triad, {
  nodeActive: string;
  textColor: string;
  tag: string;
}> = {
  gut:   { nodeActive: "#ef4444", textColor: "#dc2626", tag: "bg-red-100 text-red-700" },
  heart: { nodeActive: "#f59e0b", textColor: "#d97706", tag: "bg-amber-100 text-amber-700" },
  head:  { nodeActive: "#3b82f6", textColor: "#2563eb", tag: "bg-blue-100 text-blue-700" },
};

// SVG 다이어그램 상수
export const SVG_SIZE = 300;
export const CX = SVG_SIZE / 2;
export const CY = SVG_SIZE / 2;
export const R = 108;
export const NODE_R = 16;

export const INNER_LINES: [number, number][] = [
  [3, 6], [6, 9], [9, 3],
  [1, 4], [4, 2], [2, 8], [8, 5], [5, 7], [7, 1],
];

export function typePos(n: number) {
  const idx = n === 9 ? 0 : n;
  const rad = ((-90 + idx * 40) * Math.PI) / 180;
  return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
}
