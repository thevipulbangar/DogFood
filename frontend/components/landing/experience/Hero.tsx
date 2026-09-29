"use client";

import { memo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { EVENT } from "@/lib/data";
import { useNow } from "@/lib/hooks";
import { fmtUTC } from "@/lib/utils";
import { Magnetic, buttonClass } from "@/components/ui/primitives";
import { PIPELINE } from "./story";
import { EASE, Scene, useEnv, useSize } from "./runtime";
import { Portal } from "./Portal";

// ── The board ─────────────────────────────────────────────────
// A split-flap display, 12 × 4. Like the real thing, every tile can only
// advance through its drum in order, so tiles settle at different moments.

const DRUM = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.·#-";
const COLS = 12;
const ROWS = 4;
type Frame = { rows: string[]; accent?: [number, number][] };

const fit = (s: string) => s.toUpperCase().slice(0, COLS).padEnd(COLS, " ");
const right = (a: string, b: string) => fit(a.padEnd(COLS - b.length, " ") + b);

const [first, second] = PIPELINE;
const FRAMES: Record<"blank" | "results" | "headline", Frame> = {
  blank: { rows: ["", "", "", ""] },
  // Real standings from the seed event — the board is live before it speaks.
  results: { rows: [first.name, right("#01", first.score.toFixed(2)), second.name, right("#02", second.score.toFixed(2))], accent: [[1, 8], [1, 9], [1, 10], [1, 11]] },
  headline: { rows: ["RUN THE", "HACKATHON.", "REDEFINE THE", "JUDGING."], accent: [[3, 7]] },
};

export function HeroScene() {
  return (
    <Scene id="system" nav="01 / THE BOARD" rest={0}>
      {() => <Hero />}
    </Scene>
  );
}

function Hero() {
  const { ready, still, compact } = useEnv();
  const stage = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(stage);
  const now = useNow();
  const [intro, setIntro] = useState<"blank" | "results" | "headline">("blank");
  const [bornAt, setBornAt] = useState<number | null>(null);
  useEffect(() => { if (ready) setBornAt(performance.now()); }, [ready]);

  // blank → a glimpse of the live standings → the headline. Then it stops.
  useEffect(() => {
    if (!ready) return;
    if (still) { setIntro("headline"); return; }
    const t = [setTimeout(() => setIntro("results"), 900), setTimeout(() => setIntro("headline"), 2600)];
    return () => t.forEach(clearTimeout);
  }, [ready, still]);

  const frame = FRAMES[intro];

  // Tiles as large as the viewport allows while leaving room for the copy.
  const gap = compact ? 3 : 6;
  const tw = Math.max(18, Math.min((w - (compact ? 32 : 120) - gap * (COLS - 1)) / COLS, (h * (compact ? 0.5 : 0.56) - gap * (ROWS - 1)) / ROWS / 1.36));
  const th = tw * 1.36;

  const introShown = intro === "headline";

  return (
    <div ref={stage} className="relative h-full w-full">
      {/* the loader's ring, grown into a portal of light */}
      <Portal cy={compact ? 0.46 : 0.45} bornAt={bornAt} />
      {/* masthead */}
      <div className="absolute inset-x-0 top-[72px] z-20 mx-auto flex max-w-[1600px] items-baseline justify-between px-5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted md:top-[84px] md:px-10">
        <span className="text-fg-2">{EVENT.name} · Results board</span>
        <span className="tabular">{now ? fmtUTC(new Date(now).toISOString(), "clock") : "--:--:--"} UTC</span>
      </div>

      {/* the board */}
      <div className="absolute inset-x-0 top-[46%] -translate-y-1/2 md:top-[45%]">
        <div className="flex justify-center">
          {w > 0 && (
            <div role="img" aria-label={frame.rows.join(" ").replace(/\s+/g, " ").trim()} className="grid" style={{ gridTemplateColumns: `repeat(${COLS}, ${tw}px)`, gap }}>
              {Array.from({ length: ROWS * COLS }, (_, i) => {
                const r = Math.floor(i / COLS), c = i % COLS;
                const ch = fit(frame.rows[r] ?? "")[c];
                const accent = !!frame.accent?.some(([ar, ac]) => ar === r && ac === c);
                return <Tile key={i} char={DRUM.includes(ch) ? ch : " "} accent={accent} w={tw} h={th} delay={c * 38 + r * 70} still={still} />;
              })}
            </div>
          )}
        </div>
        <p className="mt-7 hidden text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted md:block">Hover the board</p>
      </div>

      {/* copy + calls to action */}
      <div className="absolute inset-x-0 bottom-0 z-30 mx-auto flex max-w-[1600px] flex-col gap-5 px-5 pb-16 md:flex-row md:items-end md:justify-between md:px-10 md:pb-16">
        <motion.p initial={{ opacity: 0, y: 12 }} animate={introShown ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8, delay: 1.2, ease: EASE }}
          className="max-w-md text-[15px] leading-relaxed text-fg-2 md:text-[16px]">
          {EVENT.tagline} An open-source, self-hostable hackathon submission and judging platform — from first commit to final score.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={introShown ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8, delay: 1.35, ease: EASE }} className="flex flex-wrap gap-3">
          <Magnetic><Link href="/signin" className={buttonClass("primary", "lg", "xp-btn")}>Enter Dogfood <ArrowRight className="size-4" /></Link></Magnetic>
          <Magnetic><Link href="/gallery" className={buttonClass("outline", "lg", "xp-btn")}>Explore projects</Link></Magnetic>
        </motion.div>
      </div>
    </div>
  );
}

/**
 * One split-flap tile. When `char` changes it advances through the drum until it
 * lands. Hovering an idle tile sends it round one full revolution.
 */
const Tile = memo(function Tile({ char, accent, w, h, delay, still }: { char: string; accent: boolean; w: number; h: number; delay: number; still: boolean }) {
  const [shown, setShown] = useState(" ");
  const [prev, setPrev] = useState(" ");
  const [flip, setFlip] = useState(0);
  const cur = useRef(" ");
  const target = useRef(char);
  const timer = useRef<number | undefined>(undefined);
  const spinning = useRef(false);
  const lap = useRef(false);

  const run = (startDelay: number) => {
    window.clearTimeout(timer.current);
    const step = () => {
      if (cur.current === target.current && !lap.current) { spinning.current = false; return; }
      lap.current = false;
      const next = DRUM[(DRUM.indexOf(cur.current) + 1) % DRUM.length];
      setPrev(cur.current);
      cur.current = next;
      setShown(next);
      setFlip((f) => f + 1);
      timer.current = window.setTimeout(step, 30 + Math.random() * 16);
    };
    spinning.current = true;
    timer.current = window.setTimeout(step, startDelay);
  };

  useEffect(() => {
    target.current = char;
    if (still) { cur.current = char; setShown(char); setPrev(char); return; }
    if (cur.current !== char) run(delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char, still]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onEnter = () => {
    if (still || spinning.current) return;
    lap.current = true;
    run(0);
  };

  const size = { fontSize: w * 0.8 };
  return (
    <div className="flap" data-accent={accent && shown === char ? "1" : "0"} style={{ width: w, height: h }} onPointerEnter={onEnter} aria-hidden>
      <span className="flap-half top"><span className="flap-glyph" style={size}>{shown}</span></span>
      <span className={`flap-half bottom ${flip ? "stale" : ""}`}><span className="flap-glyph" style={size}>{flip ? prev : shown}</span></span>
      {flip > 0 && (
        <>
          <span key={`f${flip}`} className="flap-half top fall"><span className="flap-glyph" style={size}>{prev}</span></span>
          <span key={`d${flip}`} className="flap-half bottom drop"><span className="flap-glyph" style={size}>{shown}</span></span>
        </>
      )}
    </div>
  );
});
