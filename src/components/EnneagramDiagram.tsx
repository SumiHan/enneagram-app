import React from "react";
import { TYPES, TRIAD_STYLE, typePos, SVG_SIZE, CX, CY, NODE_R, INNER_LINES } from "@/lib/enneagram-data";

type Props = {
  selected: number;
  highlightTriad?: string | null;
  onSelect?: (n: number) => void;
};

export function EnneagramDiagram({ selected, highlightTriad = null, onSelect }: Props) {
  return (
    <svg viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} className="w-full max-w-[280px] mx-auto select-none">
      <circle cx={CX} cy={CY} r={NODE_R + 20 + 88} fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
      {INNER_LINES.map(([a, b], i) => {
        const pa = typePos(a);
        const pb = typePos(b);
        return <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#e2e8f0" strokeWidth="1" />;
      })}
      {TYPES.map((t) => {
        const pos = typePos(t.number);
        const ts = TRIAD_STYLE[t.triad];
        const isSelected = t.number === selected;
        const dimmed = highlightTriad !== null && highlightTriad !== t.triad;
        return (
          <g
            key={t.number}
            style={{ opacity: dimmed ? 0.2 : 1, cursor: onSelect ? "pointer" : "default" }}
            onClick={() => onSelect?.(t.number)}
          >
            <circle
              cx={pos.x} cy={pos.y}
              r={isSelected ? NODE_R + 3 : NODE_R}
              fill={isSelected ? ts.nodeActive : "#f8fafc"}
              stroke={isSelected ? ts.nodeActive : "#cbd5e1"}
              strokeWidth="1.5"
            />
            <text
              x={pos.x} y={pos.y}
              textAnchor="middle" dominantBaseline="central"
              fontSize="12" fontWeight={isSelected ? "700" : "500"}
              fill={isSelected ? "#fff" : "#475569"}
            >
              {t.number}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
