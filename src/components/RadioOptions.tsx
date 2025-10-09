"use client";
import React, { useMemo } from "react";

type OptionItem = {
  label: string;
  value: string;
};

type Props = {
  name: string;
  options: (string | OptionItem)[];
  selected: string | null;
  onSelect: (value: string | null) => void;
};

export function RadioOptions({ name, options, selected, onSelect }: Props) {
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
    const normalizedSelected = selected?.trim() ?? null;
    
    console.log(`RadioOptions.handleClick: value="${normalizedValue}", selected="${normalizedSelected}"`);
    
    // If clicking the same option, deselect (pass null)
    if (normalizedSelected === normalizedValue) {
      console.log('Same option clicked → deselecting');
      onSelect(null);
    } else {
      // Select new option
      console.log('Different option clicked → selecting');
      onSelect(normalizedValue);
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      {normalizedOptions.map((opt, i) => {
        const isSelected = selected?.trim() === opt.value.trim();
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
  );
}