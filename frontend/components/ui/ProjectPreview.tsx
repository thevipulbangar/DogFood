import { mulberry32, hash, cn } from "@/lib/utils";

const ACCENT = "#ff5a1f";
const W = (a: number) => `rgb(255 255 255 / ${a})`;

/**
 * Generative, deterministic interface preview for a project.
 * No screenshots or stock imagery — every project gets a unique wireframe
 * drawn on the event grid.
 */
export function ProjectPreview({ seed, className, animated }: { seed: string; className?: string; animated?: boolean }) {
  const r = mulberry32(hash(seed));
  const layout = Math.floor(r() * 3);
  const bars = Array.from({ length: 7 }, () => 0.25 + r() * 0.75);
  const rows = Array.from({ length: 5 }, () => 0.35 + r() * 0.6);
  const hot = Math.floor(r() * 5);
  const pid = `g-${hash(seed).toString(36)}`;

  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" className={cn("h-full w-full", className)} role="img" aria-label="Generated interface preview">
      <defs>
        <pattern id={pid} width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M16 0H0V16" fill="none" stroke={W(0.05)} strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="320" height="180" fill="#0d0d0f" />
      <rect width="320" height="180" fill={`url(#${pid})`} />
      <rect x="16" y="14" width="288" height="152" rx="3" fill="#131316" stroke={W(0.1)} />
      <line x1="16" y1="30" x2="304" y2="30" stroke={W(0.08)} />
      {[0, 1, 2].map((i) => <circle key={i} cx={26 + i * 8} cy="22" r="2" fill={W(0.18)} />)}
      <rect x="120" y="19" width="80" height="6" rx="1" fill={W(0.06)} />

      {layout === 0 && (
        <g>
          <rect x="24" y="38" width="56" height="120" fill={W(0.03)} />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x="30" y={46 + i * 12} width={30 + (i % 2) * 14} height="4" rx="1" fill={i === 1 ? ACCENT : W(0.14)} />
          ))}
          {bars.map((b, i) => (
            <rect key={i} x={96 + i * 28} y={150 - b * 90} width="16" height={b * 90} rx="1" fill={i === 3 ? ACCENT : W(0.16)}>
              {animated && <animate attributeName="opacity" values="1;0.55;1" dur={`${1.6 + i * 0.25}s`} repeatCount="indefinite" />}
            </rect>
          ))}
        </g>
      )}

      {layout === 1 && (
        <g>
          {rows.map((w, i) => (
            <g key={i}>
              <rect x="28" y={44 + i * 22} width="264" height="16" fill={i === hot ? "rgb(255 90 31 / 0.1)" : "transparent"} stroke={W(0.06)} />
              <rect x="36" y={50 + i * 22} width="22" height="4" rx="1" fill={W(0.25)} />
              <rect x="70" y={50 + i * 22} width={w * 140} height="4" rx="1" fill={i === hot ? ACCENT : W(0.12)}>
                {animated && i === hot && <animate attributeName="width" values={`${w * 140};${w * 100};${w * 140}`} dur="2.4s" repeatCount="indefinite" />}
              </rect>
              <rect x="256" y={50 + i * 22} width="28" height="4" rx="1" fill={W(0.2)} />
            </g>
          ))}
        </g>
      )}

      {layout === 2 && (
        <g>
          {Array.from({ length: 6 }, (_, i) => {
            const x = 28 + (i % 3) * 90;
            const y = 42 + Math.floor(i / 3) * 60;
            return (
              <g key={i}>
                <rect x={x} y={y} width="80" height="52" fill={W(0.025)} stroke={i === hot ? ACCENT : W(0.08)} />
                <rect x={x + 8} y={y + 8} width="24" height="4" rx="1" fill={W(0.3)} />
                <rect x={x + 8} y={y + 18} width={bars[i] * 60} height="3" rx="1" fill={W(0.12)} />
                <rect x={x + 8} y={y + 38} width={bars[i] * 60} height="4" rx="1" fill={i === hot ? ACCENT : W(0.18)}>
                  {animated && <animate attributeName="width" values={`${bars[i] * 60};${bars[(i + 2) % 7] * 60};${bars[i] * 60}`} dur="3s" repeatCount="indefinite" />}
                </rect>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}
