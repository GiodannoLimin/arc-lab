import type { Candidate } from "../science/statistics";
export default function ProbabilityChart({
  data,
  baseline,
  compact = false,
}: {
  data: Candidate[];
  baseline: number;
  compact?: boolean;
}) {
  const w = compact ? 350 : 660,
    h = 190,
    pad = 38;
  const x = (a: number) => pad + ((a - 38) / 30) * (w - pad * 2),
    y = (p: number) => h - 30 - p * (h - 50);
  return (
    <svg
      className="prob-chart"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="Exploratory scoring probability versus angle, with 95 percent pointwise Wilson intervals"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((p) => (
        <g key={p}>
          <line
            x1={pad}
            x2={w - 15}
            y1={y(p)}
            y2={y(p)}
            stroke="#e8eae3"
            strokeDasharray="3 4"
          />
          <text x={pad - 9} y={y(p) + 4} textAnchor="end">
            {p * 100}%
          </text>
        </g>
      ))}
      {[38, 44, 50, 56, 62, 68].map((a) => (
        <text key={a} x={x(a)} y={h - 8} textAnchor="middle">
          {a}°
        </text>
      ))}
      <line
        x1={x(baseline)}
        x2={x(baseline)}
        y1={16}
        y2={h - 30}
        stroke="#be8b5a"
        strokeDasharray="4 4"
      />
      {data.length > 0 ? (
        <>
          <polygon
            points={[
              ...data.map((d) => `${x(d.angle)},${y(d.hi)}`),
              ...[...data].reverse().map((d) => `${x(d.angle)},${y(d.lo)}`),
            ].join(" ")}
            fill="#d8ebd3"
          />
          <polyline
            points={data.map((d) => `${x(d.angle)},${y(d.p)}`).join(" ")}
            fill="none"
            stroke="#487d4e"
            strokeWidth="2.5"
          />
          {data.map((d) => (
            <circle
              key={d.angle}
              cx={x(d.angle)}
              cy={y(d.p)}
              r={3.5}
              fill="#487d4e"
            />
          ))}
        </>
      ) : (
        <text x={w / 2} y={h / 2} textAnchor="middle" className="empty-chart">
          Run an experiment to reveal the curve
        </text>
      )}
    </svg>
  );
}
