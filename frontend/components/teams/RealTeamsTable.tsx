"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { api, type TeamWithDetail } from "@/lib/api";
import { Badge, Panel, Skeleton } from "@/components/ui/primitives";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

/**
 * The real, backend-backed organizer view of every team
 * (GET /api/teams). Organizer/admin only, enforced server-side.
 * Replaces the mock TeamsTable that used fabricated team data.
 */
export function RealTeamsTable() {
  const toast = useToast();
  const [teams, setTeams] = useState<TeamWithDetail[] | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    api.getTeams().then(setTeams).catch((err: Error) => setError(err.message));
  }, []);

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code).then(() => toast({ tone: "ok", title: "Invite code copied", body: code }));
  };

  if (error) return <ErrorState onRetry={() => setError(undefined)} />;
  if (teams === null) return <div className="space-y-6"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-64" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
        <p className="mt-1 text-sm text-white/60">Every team formed for this event, their members, and submission status.</p>
      </div>

      <Panel className="overflow-x-auto p-0">
        {teams.length === 0 ? (
          <EmptyState code="0 TEAMS" title="No teams yet" body="Teams appear here once participants form them via an invite code." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/50">
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Invite code</th>
                <th className="px-4 py-3 font-medium">Members</th>
                <th className="px-4 py-3 font-medium">Submission</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id} className="border-b border-white/5 last:border-0 align-top">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3">
                    <button
                      className="inline-flex items-center gap-1.5 font-mono text-xs text-white/70 hover:text-white"
                      onClick={() => copyCode(t.invite_code)}
                      title="Copy invite code"
                    >
                      {t.invite_code} <Copy size={11} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    {t.members.map((m) => m.name).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {!t.submission && <Badge tone="neutral">No submission</Badge>}
                    {t.submission?.is_draft && <Badge tone="warn">Draft</Badge>}
                    {t.submission && !t.submission.is_draft && <Badge tone="ok">Submitted</Badge>}
                    {t.submission?.title && <span className="ml-2 text-white/60">{t.submission.title}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
