"use client";

import { useEffect, useState } from "react";
import { api, type AuditEntry } from "@/lib/api";
import { Panel, Skeleton } from "@/components/ui/primitives";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { cn } from "@/lib/utils";

const WARN_ACTIONS = new Set(["VOTE_REJECTED_DUPLICATE", "RATE_LIMIT_TRIGGERED"]);

/** Real, backend-backed audit trail (GET /api/audit, organizer/admin only). */
export function RealAuditLog() {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    api.getAuditLog().then(setRows).catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <ErrorState onRetry={() => setError(undefined)} />;
  if (rows === null) return <div className="space-y-6"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-64" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-fg-2">Append-only record of sensitive actions: votes, rejected duplicate votes, rate limits, judge assignment, account creation, and results publishing.</p>
      </div>
      <Panel bodyClassName="p-0">
        {rows.length === 0 ? (
          <EmptyState code="0 ENTRIES" title="Nothing logged yet" body="Actions like casting a vote or assigning judges will appear here." />
        ) : (
          <ol className="divide-y divide-line">
            {rows.map((e) => (
              <li key={e.id} className="grid grid-cols-[110px_1fr] gap-3 px-4 py-2.5 font-mono text-[11px] sm:grid-cols-[140px_140px_1fr_auto]">
                <span className="text-muted tabular">{new Date(e.created_at).toLocaleString()}</span>
                <span className="truncate text-fg-2">{e.actor_name ?? "system"}{e.actor_role ? ` (${e.actor_role})` : ""}</span>
                <span className={cn("col-start-2 truncate sm:col-start-auto", WARN_ACTIONS.has(e.action) ? "text-warn" : "text-fg")}>{e.action}</span>
                <span className="col-start-2 text-muted sm:col-start-auto">{e.object}</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
