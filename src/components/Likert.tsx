"use client";
import React from "react";

type Props = {
  value?: number;
  onChange: (v: number) => void;
  labels?: [string, string, string, string, string, string];
};

type LikertLabels = [string, string, string, string, string, string];

const defaultLabels: LikertLabels = [
  "전혀 그렇지 않다",
  "그렇지 않다",
  "약간 그렇지 않다",
  "약간 그렇다",
  "그렇다",
  "매우 그렇다"
];

// 색상 정의 (부정 → 긍정)
const colors = [
  { bg: '#F87171', border: '#EF4444', text: '#991B1B' },     // 1: 붉은색
  { bg: '#FB923C', border: '#F97316', text: '#9A3412' },     // 2: 주황색
  { bg: '#FBBF24', border: '#F59E0B', text: '#92400E' },     // 3: 연주황색
  { bg: '#86EFAC', border: '#4ADE80', text: '#14532D' },     // 4: 연초록
  { bg: '#34D399', border: '#10B981', text: '#064E3B' },     // 5: 초록색
  { bg: '#10B981', border: '#059669', text: '#022C22' },     // 6: 진한 초록
];

export function Likert({ value, onChange, labels = defaultLabels }: Props) {
  const finalLabels: LikertLabels = labels || defaultLabels;
  
  return (
    <div className="flex flex-col gap-2">
      {/* 버튼들 */}
      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: 6 }, (_, i) => i + 1).map((n) => {
          const isSelected = value === n;
          const color = colors[n - 1];
          
          return (
            <button
              key={n}
              type="button"
              className="flex flex-col items-center justify-center transition-all duration-200"
              onClick={() => onChange(n)}
              aria-label={finalLabels[n - 1]}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: isSelected ? '#3B82F6' : color.bg, // 선택 시 파란색
                border: isSelected ? '2px solid #2563EB' : `2px solid ${color.border}`,
                opacity: isSelected ? 1 : 0.3, // 미선택 시 30% 투명도
                transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                boxShadow: isSelected ? '0 4px 12px rgba(59, 130, 246, 0.4)' : 'none',
              }}
            >
              <span 
                className="text-xs font-bold" 
                style={{ color: isSelected ? '#FFFFFF' : color.text }}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>
      
      {/* 모바일용 레이블 (선택된 항목만 표시) */}
      {value && (
        <div className="sm:hidden text-center text-sm font-medium text-blue-600">
          {finalLabels[value - 1]}
        </div>
      )}
    </div>
  );
}


