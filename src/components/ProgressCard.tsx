import React from "react";
import { ProgressBar } from "./ProgressBar";

type Props = {
  title: string;
  description: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  progressPct?: number;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
};

export function ProgressCard({ title, description, status, progressPct = 0, actionLabel, onAction, disabled }: Props) {
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className="text-sm text-slate-500">{status}</span>
      </div>
      <p className="text-slate-600">{description}</p>
      <ProgressBar value={progressPct} />
      <div className="flex justify-end">
        <button className="btn btn-primary" onClick={onAction} disabled={disabled}>
          {actionLabel}
        </button>
      </div>
    </div>
  );
}


