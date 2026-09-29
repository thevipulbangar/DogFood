"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { PROJECTS, PROJECT_SCORES, TRACKS, teamById, type Project } from "@/lib/data";
import { useHotkeys, useSimulatedLoad } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Button, Kbd, Skeleton, fieldClass } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { ProjectCard } from "./ProjectCard";

type Sort = "newest" | "oldest" | "name" | "score";
const ALL_TECH = [...new Set(PROJECTS.flatMap((p) => p.stack))].sort();

function Select({ label, value, onChange, children, id }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode; id: string }) {
  return (
    <label htmlFor={id} className="relative flex h-9 shrink-0 items-center rounded-sm border border-line-strong bg-bg/60 pl-3 transition-colors focus-within:border-accent hover:border-fg/25">
      <span className="label mr-2">{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
        className="h-full cursor-pointer appearance-none bg-transparent pr-7 text-[13px] text-fg focus:outline-none focus-visible:outline-none">
        {children}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-2.5 text-[9px] text-muted">▼</span>
    </label>
  );
}

export function Gallery({ staff = false, hrefBase = "/projects", compactHeader }: { staff?: boolean; hrefBase?: string; compactHeader?: boolean }) {
  const loading = useSimulatedLoad(500);
  const searchRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [track, setTrack] = useState("all");
  const [status, setStatus] = useState(staff ? "all" : "submitted");
  const [tech, setTech] = useState("all");
  const [size, setSize] = useState("any");
  const [minScore, setMinScore] = useState("0");
  const [sort, setSort] = useState<Sort>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useHotkeys({ "/": () => searchRef.current?.focus() });

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = PROJECTS.filter((p) => {
      if (!staff && p.status !== "submitted") return false;
      if (status !== "all" && p.status !== status) return false;
      if (track !== "all" && p.trackId !== track) return false;
      if (tech !== "all" && !p.stack.includes(tech)) return false;
      const n = teamById(p.teamId).members.length;
      if (size === "2" && n > 2) return false;
      if (size === "3" && n !== 3) return false;
      if (size === "4" && n < 4) return false;
      if (staff && +minScore > 0 && (PROJECT_SCORES.get(p.id)?.normalized ?? 0) < +minScore) return false;
      if (!s) return true;
      return `${p.name} ${p.tagline} ${p.stack.join(" ")} ${teamById(p.teamId).name} ${p.code}`.toLowerCase().includes(s);
    });
    const t = (p: Project) => p.submittedAt ?? p.updatedAt;
    return list.sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name)
      : sort === "oldest" ? t(a).localeCompare(t(b))
      : sort === "score" ? (PROJECT_SCORES.get(b.id)?.normalized ?? 0) - (PROJECT_SCORES.get(a.id)?.normalized ?? 0)
      : t(b).localeCompare(t(a)));
  }, [q, track, status, tech, size, minScore, sort, staff]);

  const active = [track !== "all", staff && status !== "all", tech !== "all", size !== "any", +minScore > 0].filter(Boolean).length;
  const reset = () => { setQ(""); setTrack("all"); setStatus(staff ? "all" : "submitted"); setTech("all"); setSize("any"); setMinScore("0"); };
  const total = staff ? PROJECTS.length : PROJECTS.filter((p) => p.status === "submitted").length;

  return (
    <div>
      {!compactHeader && (
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="label">Public gallery · {total} {staff ? "projects" : "submissions"}</p>
            <h1 className="mt-2 text-[clamp(3rem,8vw,6.5rem)] font-semibold leading-[0.85] tracking-[-0.055em]">PROJECTS</h1>
          </div>
          <p className="font-mono text-[12px] tabular text-muted" aria-live="polite">
            SHOWING <span className="text-fg">{visible.length}</span> / {total}
          </p>
        </header>
      )}

      <div className="sticky top-14 z-30 -mx-4 mb-6 border-b border-line bg-bg/85 px-4 py-3 backdrop-blur-xl md:mx-0 md:rounded-md md:border md:px-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input ref={searchRef} type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search projects"
              placeholder="Search projects, teams, technologies…" className={cn(fieldClass, "h-9 pl-9 pr-10")} />
            <Kbd className="absolute right-2.5 top-1/2 hidden -translate-y-1/2 sm:inline-flex">/</Kbd>
          </div>
          <Button className="lg:hidden" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
            <SlidersHorizontal className="size-3.5" />{active ? active : ""}
          </Button>
        </div>
        <div className={cn("no-scrollbar mt-2 gap-2 overflow-x-auto lg:flex", filtersOpen ? "flex flex-wrap" : "hidden")}>
          <Select id="f-track" label="Track" value={track} onChange={setTrack}>
            <option value="all">All</option>
            {TRACKS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          {staff && (
            <Select id="f-status" label="Status" value={status} onChange={setStatus}>
              <option value="all">All</option><option value="submitted">Submitted</option><option value="draft">Draft</option>
            </Select>
          )}
          <Select id="f-tech" label="Tech" value={tech} onChange={setTech}>
            <option value="all">All</option>
            {ALL_TECH.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Select id="f-size" label="Team" value={size} onChange={setSize}>
            <option value="any">Any size</option><option value="2">1–2</option><option value="3">3</option><option value="4">4+</option>
          </Select>
          {staff && (
            <Select id="f-score" label="Score ≥" value={minScore} onChange={setMinScore}>
              {["0", "6", "7", "7.5", "8", "8.5"].map((v) => <option key={v} value={v}>{v === "0" ? "Any" : v}</option>)}
            </Select>
          )}
          <Select id="f-sort" label="Sort" value={sort} onChange={(v) => setSort(v as Sort)}>
            <option value="newest">Newest</option><option value="oldest">Oldest</option><option value="name">Name A–Z</option>
            {staff && <option value="score">Score</option>}
          </Select>
          {active > 0 && <Button variant="ghost" onClick={reset}><X className="size-3" />Clear {active}</Button>}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4" aria-busy="true" aria-label="Loading projects">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[430px]" />)}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState code="0 MATCHES" title="No projects match these filters" body="Try a broader search, or clear filters to see every submission."
          action={<Button onClick={reset}>Clear filters</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {visible.map((p, i) => <ProjectCard key={p.id} project={p} index={i} href={`${hrefBase}/${p.id}`} />)}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
