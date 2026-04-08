"use client";
import React, { useMemo } from "react";

type OptionItem = {
  label: string;
  value: string;
};

type Props = {
  name: string;
  options: (string | OptionItem)[];
  selected: string[];
  maxSelections?: number; // 최대 선택 개수 (미설정 시 제한 없음)
  onSelect: (values: string[]) => void;
};

export function CheckboxOptions({ name, options, selected, maxSelections, onSelect }: Props) {
  // Normalize all options to {label, value} format
  const normalizedOptions = useMemo(() => {
    return options.map(opt => {
      if (typeof opt === 'string') {
        const normalized = opt.trim();
        return { label: normalized, value: normalized };
      }
      return { 
        label: opt.label.trim(), 
        value: opt.value.trim() 
      };
    });
  }, [options]);

  const handleClick = (optValue: string) => {
    // Normalize for comparison
    const normalizedValue = optValue.trim();
    const currentSelected = selected.map(s => s.trim());
    const index = currentSelected.indexOf(normalizedValue);
    
    console.log(`CheckboxOptions.handleClick: value="${normalizedValue}", selected=[${currentSelected.join(', ')}]`);
    
    let newSelected: string[];
    
    if (index >= 0) {
      newSelected = currentSelected.filter(s => s !== normalizedValue);
    } else {
      if (maxSelections !== undefined && currentSelected.length >= maxSelections) {
        alert(`${maxSelections}개까지만 선택할 수 있습니다.`);
        return;
      }
      newSelected = [...currentSelected, normalizedValue];
    }
    
    onSelect(newSelected);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {normalizedOptions.map((opt, i) => {
          const isSelected = selected.some(s => s.trim() === opt.value.trim());
          return (
            <button
              key={`${name}-${opt.value}-${i}`}
              type="button"
              className={`px-5 py-3 rounded-lg border text-sm font-medium transition-all min-w-[120px] ${
                isSelected 
                  ? "bg-blue-500 border-blue-500 text-white shadow-md" 
                  : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 hover:shadow-sm"
              }`}
              onClick={() => handleClick(opt.value)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div className="text-sm text-slate-600">
          선택된 항목: {selected.length}개{maxSelections !== undefined ? ` / 최대 ${maxSelections}개` : ''}
        </div>
      )}
    </div>
  );
}


