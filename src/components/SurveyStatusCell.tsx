import React from "react";

type SurveyStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

type Props = {
  status: SurveyStatus;
  answered: number;
  total: number;
};

export function SurveyStatusCell({ status, answered, total }: Props) {
  // 상태별 스타일 매핑
  const getStatusStyle = () => {
    switch (status) {
      case 'NOT_STARTED':
        return {
          badgeClass: 'text-gray-500 bg-gray-100',
          label: 'Not Started'
        };
      case 'IN_PROGRESS':
        return {
          badgeClass: 'text-blue-600 bg-blue-50',
          label: 'In Progress'
        };
      case 'COMPLETED':
        return {
          badgeClass: 'text-green-600 bg-green-50',
          label: 'Completed'
        };
      default:
        return {
          badgeClass: 'text-gray-500 bg-gray-100',
          label: 'Not Started'
        };
    }
  };

  const { badgeClass, label } = getStatusStyle();

  return (
    <div className="flex flex-col gap-1">
      {/* 상태 배지 */}
      <div className={`inline-flex items-center rounded-full px-3 h-7 text-sm font-semibold ${badgeClass}`}>
        {label}
      </div>
      
      {/* 진행도 텍스트 */}
      <div className="text-xs text-gray-400">
        {answered} / {total} 문항
      </div>
    </div>
  );
}
