import { cn } from "@/lib/utils";

/** Mark: a 3×3 event grid with one lit cell — the project under review. */
export function LogoMark({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={className} aria-hidden>
      {Array.from({ length: 9 }, (_, i) => {
        const x = (i % 3) * 7;
        const y = Math.floor(i / 3) * 7;
        return <rect key={i} x={x} y={y} width="6" height="6" rx="0.5" fill={i === 5 ? "var(--color-accent)" : "currentColor"} opacity={i === 5 ? 1 : i % 2 ? 0.35 : 0.8} />;
      })}
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-fg", className)}>
      <LogoMark />
      <span className="font-mono text-[13px] font-semibold tracking-[0.18em]">DOGFOOD</span>
    </span>
  );
}
