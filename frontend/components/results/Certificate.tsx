import { EVENT } from "@/lib/data";
import { cn, hash, mulberry32 } from "@/lib/utils";

export type CertData = { kind: string; title: string; name: string; forLine: string; detail: string; id: string; issued: string };

export function verificationId(seed: string) {
  const h = hash(seed).toString(16).toUpperCase().padStart(8, "0");
  const h2 = hash(seed + "salt").toString(16).toUpperCase().padStart(8, "0");
  return `VRF-${h.slice(0, 4)}-${h.slice(4, 8)}-${h2.slice(0, 4)}`;
}

/** Deterministic 21×21 verification matrix with QR-style finder patterns. */
function VerifyMatrix({ seed, className }: { seed: string; className?: string }) {
  const r = mulberry32(hash(seed));
  const N = 21;
  const finder = (x: number, y: number) => {
    for (const [fx, fy] of [[0, 0], [N - 7, 0], [0, N - 7]]) {
      const dx = x - fx, dy = y - fy;
      if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
        const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
        return ring === 3 || ring <= 1 ? 1 : 0;
      }
      if (dx >= -1 && dx <= 7 && dy >= -1 && dy <= 7) return 0;
    }
    return null;
  };
  const cells: [number, number][] = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const f = finder(x, y);
    if (f === 1 || (f === null && r() < 0.48)) cells.push([x, y]);
  }
  return (
    <svg viewBox={`-1 -1 ${N + 2} ${N + 2}`} className={className} role="img" aria-label="Verification code">
      <rect x="-1" y="-1" width={N + 2} height={N + 2} fill="var(--color-paper)" />
      {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill="var(--color-ink)" />)}
    </svg>
  );
}

export function Certificate({ c, className }: { c: CertData; className?: string }) {
  return (
    <div className={cn("print-area relative aspect-[1.414] w-full overflow-hidden bg-paper text-ink shadow-[0_40px_100px_-30px_rgb(0_0_0/0.8)]", className)} style={{ containerType: "inline-size" }}>
      {/* grid motif */}
      <div aria-hidden className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(to right, #151412 1px, transparent 1px), linear-gradient(to bottom, #151412 1px, transparent 1px)", backgroundSize: "4cqw 4cqw" }} />
      <div aria-hidden className="absolute inset-[2.4cqw] border border-ink/25" />
      <div aria-hidden className="absolute right-[2.4cqw] top-[2.4cqw] h-[1.2cqw] w-[12cqw] bg-accent" />

      <div className="relative flex h-full flex-col justify-between p-[6cqw]">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[1.5cqw] font-semibold tracking-[0.3em]">DOGFOOD 2026</p>
            <p className="mt-[0.6cqw] font-mono text-[1.1cqw] tracking-[0.15em] text-ink/50">{EVENT.id} · {c.kind}</p>
          </div>
        </div>

        <div>
          <p className="text-[4.6cqw] font-semibold leading-none tracking-[-0.04em]">{c.title}</p>
          <p className="mt-[3cqw] font-mono text-[1.2cqw] uppercase tracking-[0.2em] text-ink/50">Awarded to</p>
          <p className="mt-[0.8cqw] text-[6.2cqw] font-semibold leading-none tracking-[-0.045em]">{c.name}</p>
          <p className="mt-[2.4cqw] font-mono text-[1.2cqw] uppercase tracking-[0.2em] text-ink/50">For</p>
          <p className="mt-[0.6cqw] text-[2.4cqw] font-medium tracking-[-0.02em]">{c.forLine}</p>
          <p className="mt-[0.4cqw] text-[1.5cqw] text-ink/60">{c.detail}</p>
        </div>

        <div className="flex items-end justify-between gap-[3cqw]">
          <div className="flex gap-[5cqw]">
            <div>
              <p className="mb-[0.6cqw] text-[1.8cqw] italic">Theo Marchetti</p>
              <p className="border-t border-ink/30 pt-[0.6cqw] font-mono text-[1cqw] uppercase tracking-[0.15em] text-ink/50">Lead organizer</p>
            </div>
            <div>
              <p className="mb-[0.6cqw] font-mono text-[1.6cqw]">{c.issued}</p>
              <p className="border-t border-ink/30 pt-[0.6cqw] font-mono text-[1cqw] uppercase tracking-[0.15em] text-ink/50">Issued</p>
            </div>
          </div>
          <div className="flex items-end gap-[1.4cqw]">
            <div className="text-right font-mono text-[1cqw] uppercase tracking-[0.12em] text-ink/60">
              <p>Verification ID</p>
              <p className="mt-[0.3cqw] text-[1.3cqw] text-ink">{c.id}</p>
              <p className="mt-[0.3cqw]">{EVENT.instance}/verify</p>
            </div>
            <VerifyMatrix seed={c.id} className="size-[10cqw]" />
          </div>
        </div>
      </div>
    </div>
  );
}
