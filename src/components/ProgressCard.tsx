import React from "react";

type Props = {
  title: string;
  description: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  progressText?: string; // 예: "(15/20)" or "(0/0)"
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
};

export function ProgressCard({ title, description, status, progressText, actionLabel, onAction, disabled }: Props) {
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        {progressText && (
          <span className="text-sm font-medium text-slate-600">{progressText}</span>
        )}
      </div>
      <p className="text-slate-600 text-sm">{description}</p>
      <div className="flex justify-end mt-2">
        <button className="btn btn-primary" onClick={onAction} disabled={disabled}>
          {actionLabel}
        </button>
      </div>
    </div>
  );
}


