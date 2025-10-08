"use client";
import React from "react";
import clsx from "clsx";

type Props = {
  value?: number;
  onChange: (v: number) => void;
  labels?: [string, string, string, string, string, string];
};

const defaultLabels: Props["labels"] = [
  "전혀 그렇지 않다",
  "그렇지 않다",
  "약간 그렇지 않다",
  "약간 그렇다",
  "그렇다",
  "매우 그렇다"
];

export function Likert({ value, onChange, labels = defaultLabels }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="hidden sm:grid grid-cols-6 text-center text-xs text-slate-500">
        <div>전혀 그렇지 않다</div>
        <div>그렇지 않다</div>
        <div>약간 그렇지 않다</div>
        <div>약간 그렇다</div>
        <div>그렇다</div>
        <div>매우 그렇다</div>
      </div>
      <div className="grid grid-cols-6 gap-3 sm:gap-4">
        {Array.from({ length: 6 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            className={clsx(
              "h-12 rounded-full border transition-colors",
              value === n ? "bg-primary-500 border-primary-500 text-white" : "border-slate-300 hover:bg-slate-50"
            )}
            onClick={() => onChange(n)}
            aria-label={`Likert ${n}`}
          />
        ))}
      </div>
    </div>
  );
}


