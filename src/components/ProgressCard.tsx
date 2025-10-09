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
  // 상태별 색상과 텍스트 설정
  const getStatusInfo = () => {
    switch (status) {
      case 'NOT_STARTED':
        return { color: 'text-gray-400', text: 'Not Started' };
      case 'IN_PROGRESS':
        return { color: 'text-blue-500', text: 'In Progress' };
      case 'COMPLETED':
        return { color: 'text-green-600', text: 'Completed' };
      default:
        return { color: 'text-gray-400', text: 'Not Started' };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="card p-5 flex flex-col justify-between min-h-[160px]">
      {/* 상단: 제목과 상태 */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
        <div className="text-right">
          <div className={`text-xs font-medium ${statusInfo.color}`}>
            {statusInfo.text}
          </div>
          {progressText && (
            <div className={`text-sm font-medium ${statusInfo.color}`}>
              {progressText}
            </div>
          )}
        </div>
      </div>
      
      {/* 중간: 설명 */}
      <div className="flex-1 mb-5">
        <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
      </div>
      
      {/* 하단: 버튼 (오른쪽 정렬) */}
      <div className="flex justify-end">
        <button className="btn btn-primary" onClick={onAction} disabled={disabled}>
          {actionLabel}
        </button>
      </div>
    </div>
  );
}


