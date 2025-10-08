import React from "react";

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div className="h-full bg-primary-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}


