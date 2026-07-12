const SIZE = 96;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Donut showing the coverage fraction. Neutral/accent by design: the ring
 * states a fact; the recommendation badge carries the judgment. The
 * accessible reading comes from the adjacent visible copy lines
 * (copy.coverageLine / copy.coverageSub), so the SVG stays presentation-only.
 */
export function CoverageRing({ coverage }: { coverage: number }) {
  const clamped = Math.min(1, Math.max(0, coverage));
  const percent = Math.round(clamped * 100);
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden="true"
      className="shrink-0"
    >
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke="var(--color-hairline-soft)"
        strokeWidth={STROKE}
      />
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={STROKE}
        strokeLinecap={clamped > 0 ? "round" : "butt"}
        strokeDasharray={`${clamped * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-ink text-xl font-semibold"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {percent}%
      </text>
    </svg>
  );
}
