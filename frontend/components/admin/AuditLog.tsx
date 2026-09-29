"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Pause, Play } from "lucide-react";
import { AUDIT, SUBMITTED, JUDGES, type AuditEvent } from "@/lib/data";
import { cn, downloadCSV, fmtUTC, pad } from "@/lib/utils";
import { useSimulatedLoad } from "@/lib/hooks";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, Skeleton, StatusDot, fieldClass } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";

const ACTIONS = [...new Set(AUDIT.map((e) => e.action))].sort();
const ACTOR_KINDS = ["JUDGE", "PARTICIPANT", "VOTER", "ORGANIZER", "ADMIN", "SYSTEM"];

function tone(action: string) {
  if (action.includes("REJECT") || action.includes("RATE_LIMIT")) return "text-warn";
  if (action.includes("GRANTED") || action.includes("RUBRIC") || action.includes("ASSIGNED")) return "text-steel";
  if (action.startsWith("SCORE")) return "text-accent";
  return "text-fg";
}

/** The event ledger: append-only, monospace, filterable. */
export function AuditLog() {
  const loading = useSimulatedLoad(400);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("all");
  const [actor, setActor] = useState("all");
  const [live, setLive] = useState(true);
  const [fresh, setFresh] = useState<AuditEvent[]>([]);

  // Live tail: new events stream in while unpaused (simulated feed from the local API).
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      const vote = Math.random() < 0.6;
      const p = SUBMITTED[Math.floor(Math.random() * SUBMITTED.length)];
      setFresh((f) => [{
        id: `evt_${Date.now().toString(16).slice(-6)}`, at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
        actor: vote ? `VOTER_${pad(Math.floor(Math.random() * 900), 4)}` : JUDGES[Math.floor(Math.random() * JUDGES.length)].id,
        action: vote ? "VOTE_CAST" : "SCORE_DRAFT_SAVED", object: `PROJECT_${pad(p.id)}`, ip: `10.0.${Math.floor(Math.random() * 8)}.${Math.floor(Math.random() * 254) + 1}`,
        detail: vote ? "Community vote accepted" : "Draft autosaved",
      }, ...f].slice(0, 50));
    }, 3500);
    return () => clearInterval(id);
  }, [live]);

  const rows = useMemo(() => [...fresh, ...AUDIT].filter((e) =>
    (action === "all" || e.action === action) &&
    (actor === "all" || e.actor.startsWith(actor)) &&
    (!q || `${e.actor} ${e.action} ${e.object} ${e.detail} ${e.id}`.toLowerCase().includes(q.toLowerCase())),
  ), [q, action, actor, fresh]);

  const sel = cn(fieldClass, "h-8 w-auto cursor-pointer pr-8 font-mono text-[11.5px]");

  return (
    <>
      <PageHeader eyebrow="T3 · Audit trail · append-only" title="Audit log"
        meta={<><span className="flex items-center gap-2"><StatusDot tone="ok" pulse={live} />{live ? "Streaming" : "Paused"}</span><span>{AUDIT.length + fresh.length} events · 24h</span><span>Hash-chained</span></>}
        actions={<>
          <Button onClick={() => setLive((l) => !l)} aria-pressed={!live}>{live ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}{live ? "Pause" : "Resume"}</Button>
          <Button onClick={() => downloadCSV("dogfood-2026-audit.csv", rows.map(({ id, at, actor, action, object, ip, detail }) => ({ id, at, actor, action, object, ip, detail })))}><Download className="size-3.5" />Export</Button>
        </>} />

      <div className="mb-3 flex flex-wrap gap-2">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actor, action, object, event id…" aria-label="Search audit log" className={cn(fieldClass, "h-8 max-w-sm font-mono text-[12px]")} />
        <select aria-label="Filter by actor" value={actor} onChange={(e) => setActor(e.target.value)} className={sel}>
          <option value="all">ALL ACTORS</option>
          {ACTOR_KINDS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select aria-label="Filter by action" value={action} onChange={(e) => setAction(e.target.value)} className={sel}>
          <option value="all">ALL ACTIONS</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="ml-auto self-center font-mono text-[10.5px] text-muted">{rows.length} / {AUDIT.length + fresh.length}</span>
      </div>

      {loading ? (
        <div className="space-y-1.5" aria-busy="true">{Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-9" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState code="0 EVENTS" title="No events match" body="The ledger has no events for this combination of filters." />
      ) : (
        <div className="overflow-x-auto rounded-md border border-line bg-[#0c0c0d]">
          <table className="w-full min-w-[820px] font-mono text-[11.5px]">
            <caption className="sr-only">Audit events</caption>
            <thead>
              <tr className="border-b border-line text-left text-muted">
                {["Timestamp", "Actor", "Action", "Object", "Detail", "Source", "Event"].map((h) => <th key={h} scope="col" className="px-4 py-2.5 font-normal uppercase tracking-[0.08em]">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className={cn("border-b border-line/60 last:border-0 hover:bg-white/[0.025]", fresh[0]?.id === e.id && "animate-[pulse-dot_1.6s_ease-out_1] bg-accent/[0.04]")}>
                  <td className="whitespace-nowrap px-4 py-2 text-muted"><span className="text-fg-2">{fmtUTC(e.at, "clock")}</span> <span className="text-[10px]">{fmtUTC(e.at, "date").slice(0, 6)}</span></td>
                  <td className="px-4 py-2 text-fg-2">{e.actor}</td>
                  <td className={cn("px-4 py-2", tone(e.action))}>{e.action}</td>
                  <td className="px-4 py-2 text-fg-2">{e.object}</td>
                  <td className="px-4 py-2 text-muted">{e.detail}</td>
                  <td className="px-4 py-2 text-muted">{e.ip}</td>
                  <td className="px-4 py-2 text-muted">{e.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
