"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

// Restrained, dependency-free SVG charts. One axis, thin marks, recessive grid,
// hover tooltip on every mark, and a screen-reader table for every chart.

type Datum = { label: string; value: number };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return ([1, 2, 3, 4, 5, 6, 8, 10].find((s) => n <= s) ?? 10) * p;
}

function SrTable({ caption, rows, cols }: { caption: string; rows: (string | number)[][]; cols: string[] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead><tr>{cols.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
    </table>
  );
}

function Tip({ x, y, children, width }: { x: number; y: number; children: React.ReactNode; width: number }) {
  const left = Math.min(Math.max(x, 60), width - 60);
  return (
    <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-sm border border-line-strong bg-surface-3 px-2 py-1.5 shadow-xl" style={{ left, top: y - 8 }}>
      {children}
    </div>
  );
}

const PAD = { l: 34, r: 8, t: 12, b: 24 };

export function AreaChart({ data, height = 200, format = (v) => String(v), caption }: { data: Datum[]; height?: number; format?: (v: number) => string; caption: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const iw = Math.max(0, width - PAD.l - PAD.r);
  const ih = height - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (data.length < 2 ? 0 : (i / (data.length - 1)) * iw);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join("");
  const area = `${line}L${x(data.length - 1)},${PAD.t + ih}L${x(0)},${PAD.t + ih}Z`;

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} aria-hidden
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const i = Math.round(((e.clientX - r.left - PAD.l) / iw) * (data.length - 1));
            setHover(Math.max(0, Math.min(data.length - 1, i)));
          }}
          onPointerLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={width - PAD.r} y1={y(max * t)} y2={y(max * t)} stroke="var(--color-line)" />
              <text x={PAD.l - 8} y={y(max * t) + 3} textAnchor="end" className="fill-muted font-mono text-[9.5px]">{format(max * t)}</text>
            </g>
          ))}
          {data.map((d, i) => (i % Math.ceil(data.length / 6) === 0 || i === data.length - 1) && (
            <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} className="fill-muted font-mono text-[9.5px]">{d.label}</text>
          ))}
          <motion.path d={area} fill="url(#area-fill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
          <motion.path d={line} fill="none" stroke="var(--color-chart-1)" strokeWidth="2" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} />
          {hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--color-line-strong)" strokeDasharray="2 3" />
              <circle cx={x(hover)} cy={y(data[hover].value)} r="4.5" fill="var(--color-chart-1)" stroke="var(--color-surface)" strokeWidth="2" />
            </g>
          )}
        </svg>
      )}
      {hover != null && (
        <Tip x={x(hover)} y={y(data[hover].value)} width={width}>
          <p className="font-mono text-[10px] text-muted">{data[hover].label}</p>
          <p className="font-mono text-[12px] text-fg">{format(data[hover].value)}</p>
        </Tip>
      )}
      <SrTable caption={caption} cols={["Label", "Value"]} rows={data.map((d) => [d.label, format(d.value)])} />
    </div>
  );
}

export function BarChart({ data, height = 200, format = (v) => String(v), caption, highlight }: {
  data: Datum[]; height?: number; format?: (v: number) => string; caption: string; highlight?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const iw = Math.max(0, width - PAD.l - PAD.r);
  const ih = height - PAD.t - PAD.b;
  const slot = iw / data.length;
  const bw = Math.max(2, Math.min(28, slot - 2));
  const y = (v: number) => PAD.t + ih - (v / max) * ih;

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} aria-hidden onPointerLeave={() => setHover(null)}>
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={width - PAD.r} y1={y(max * t)} y2={y(max * t)} stroke="var(--color-line)" />
              <text x={PAD.l - 8} y={y(max * t) + 3} textAnchor="end" className="fill-muted font-mono text-[9.5px]">{format(max * t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = PAD.l + slot * i + slot / 2;
            const h = (d.value / max) * ih;
            const on = hover === i || highlight === i;
            return (
              <g key={i} onPointerEnter={() => setHover(i)}>
                <rect x={cx - slot / 2} y={PAD.t} width={slot} height={ih} fill="transparent" />
                <motion.rect x={cx - bw / 2} width={bw} rx={Math.min(3, bw / 2)}
                  fill={on ? "var(--color-chart-1)" : "rgb(255 255 255 / 0.22)"}
                  initial={{ height: 0, y: PAD.t + ih }} animate={{ height: h, y: PAD.t + ih - h }}
                  transition={{ duration: 0.8, delay: i * 0.02, ease: [0.16, 1, 0.3, 1] }} />
                {(data.length <= 12 || i % Math.ceil(data.length / 10) === 0) && (
                  <text x={cx} y={height - 6} textAnchor="middle" className="fill-muted font-mono text-[9.5px]">{d.label}</text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hover != null && (
        <Tip x={PAD.l + slot * hover + slot / 2} y={y(data[hover].value)} width={width}>
          <p className="font-mono text-[10px] text-muted">{data[hover].label}</p>
          <p className="font-mono text-[12px] text-fg">{format(data[hover].value)}</p>
        </Tip>
      )}
      <SrTable caption={caption} cols={["Label", "Value"]} rows={data.map((d) => [d.label, format(d.value)])} />
    </div>
  );
}

/** Horizontal bars for ranked categorical values — criterion averages, judge completion. */
export function HBars({ data, max, format = (v) => String(v), caption, className }: {
  data: (Datum & { sub?: string })[]; max: number; format?: (v: number) => string; caption: string; className?: string;
}) {
  return (
    <div className={className}>
      <ul className="space-y-3" aria-hidden>
        {data.map((d, i) => (
          <li key={d.label} className="group" title={`${d.label}: ${format(d.value)}`}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="truncate text-fg-2">{d.label}{d.sub && <span className="ml-2 font-mono text-[10px] text-muted">{d.sub}</span>}</span>
              <span className="font-mono tabular text-fg">{format(d.value)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div className="h-full rounded-full bg-white/30 group-hover:bg-chart-1"
                initial={{ width: 0 }} whileInView={{ width: `${(d.value / max) * 100}%` }} viewport={{ once: true }}
                transition={{ duration: 0.9, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }} />
            </div>
          </li>
        ))}
      </ul>
      <SrTable caption={caption} cols={["Label", "Value"]} rows={data.map((d) => [d.label, format(d.value)])} />
    </div>
  );
}

/** Two series side by side (raw vs normalized). Legend always present. */
export function PairedBars({ data, series, height = 220, caption, domain = [0, 10] }: {
  data: { label: string; a: number; b: number }[]; series: [string, string]; height?: number; caption: string; domain?: [number, number];
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [lo, hi] = domain;
  const iw = Math.max(0, width - PAD.l - PAD.r);
  const ih = height - PAD.t - PAD.b;
  const slot = iw / data.length;
  const bw = Math.max(2, Math.min(10, slot / 2 - 2));
  const y = (v: number) => PAD.t + ih - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * ih;

  return (
    <div>
      <div className="mb-3 flex gap-4 font-mono text-[10.5px] text-fg-2">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-xs bg-chart-2" />{series[0]}</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-xs bg-chart-1" />{series[1]}</span>
      </div>
      <div ref={ref} className="relative" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} aria-hidden onPointerLeave={() => setHover(null)}>
            {[lo, (lo + hi) / 2, hi].map((t) => (
              <g key={t}>
                <line x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
                <text x={PAD.l - 8} y={y(t) + 3} textAnchor="end" className="fill-muted font-mono text-[9.5px]">{t.toFixed(0)}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = PAD.l + slot * i + slot / 2;
              return (
                <g key={i} onPointerEnter={() => setHover(i)} opacity={hover == null || hover === i ? 1 : 0.45}>
                  <rect x={cx - slot / 2} y={PAD.t} width={slot} height={ih} fill="transparent" />
                  <rect x={cx - bw - 1} y={y(d.a)} width={bw} height={PAD.t + ih - y(d.a)} rx="2" fill="var(--color-chart-2)" />
                  <rect x={cx + 1} y={y(d.b)} width={bw} height={PAD.t + ih - y(d.b)} rx="2" fill="var(--color-chart-1)" />
                </g>
              );
            })}
          </svg>
        )}
        {hover != null && (
          <Tip x={PAD.l + slot * hover + slot / 2} y={y(Math.max(data[hover].a, data[hover].b))} width={width}>
            <p className="font-mono text-[10px] text-muted">{data[hover].label}</p>
            <p className="font-mono text-[11px] text-fg">{series[0]} {data[hover].a.toFixed(2)}</p>
            <p className="font-mono text-[11px] text-fg">{series[1]} {data[hover].b.toFixed(2)}</p>
          </Tip>
        )}
      </div>
      <SrTable caption={caption} cols={["Project", ...series]} rows={data.map((d) => [d.label, d.a.toFixed(2), d.b.toFixed(2)])} />
    </div>
  );
}

export function ChartFrame({ title, meta, children, className }: { title: string; meta?: string; children: React.ReactNode; className?: string }) {
  return (
    <figure className={cn("rounded-md border border-line bg-surface/70 p-4 md:p-5", className)}>
      <figcaption className="mb-4 flex items-baseline justify-between gap-3">
        <span className="label text-fg-2">{title}</span>
        {meta && <span className="label">{meta}</span>}
      </figcaption>
      {children}
    </figure>
  );
}
