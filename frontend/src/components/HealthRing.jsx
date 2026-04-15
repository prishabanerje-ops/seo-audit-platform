/**
 * HealthRing — SVG donut chart displaying a 0–100 health score.
 * Colours: green ≥80, amber 50–79, red <50, grey = no score.
 */
export function HealthRing({ score, size = 96, strokeWidth = 6, showLabel = true, className = '' }) {
  const radius       = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset       = score == null ? circumference : circumference - (score / 100) * circumference;
  const cx           = size / 2;
  const cy           = size / 2;

  const color =
    score == null   ? 'var(--border-default)' :
    score >= 80     ? 'var(--severity-pass)' :
    score >= 50     ? 'var(--severity-warning)' :
                      'var(--severity-critical)';

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx={cx} cy={cy} r={radius} fill="none"
          stroke="var(--border-default)" strokeWidth={strokeWidth} />
        {/* Progress */}
        <circle cx={cx} cy={cy} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
        />
        {/* Score text */}
        <text
          x="50%" y="50%"
          textAnchor="middle" dominantBaseline="central"
          style={{
            fill: 'var(--text-primary)',
            fontWeight: 700,
            fontSize: size >= 100 ? '22px' : size >= 72 ? '16px' : '12px',
            transform: `rotate(90deg)`,
            transformOrigin: `${cx}px ${cy}px`,
          }}
        >
          {score == null ? '—' : Math.round(score)}
        </text>
      </svg>
      {showLabel && (
        <span className="mt-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Health Score
        </span>
      )}
    </div>
  );
}
