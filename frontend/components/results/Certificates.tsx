"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Download, Link2, ShieldCheck } from "lucide-react";
import { EVENT, JUDGES, LEADERBOARD, TEAMS, judgeStats, projectById, teamById, type User } from "@/lib/data";
import { cn, fmtUTC } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { Certificate, verificationId, type CertData } from "./Certificate";

const ISSUED = fmtUTC(EVENT.resultsAt, "date");

function certsFor(user: User): CertData[] {
  if (user.role === "participant") {
    const team = teamById(user.teamId!);
    const p = projectById(team.projectId)!;
    return [{ kind: "PARTICIPATION", title: "Certificate of Participation", name: user.name, forLine: p.name, detail: `Built with ${team.name} during the 72-hour Dogfood 2026 hackathon.`, id: verificationId(user.id + "part"), issued: ISSUED }];
  }
  if (user.role === "judge") {
    const s = judgeStats(user.judgeId!);
    return [{ kind: "JUDGE RECORD", title: "Certificate of Service", name: user.name, forLine: "Judging Dogfood 2026", detail: `${s.assigned} projects reviewed against a weighted four-criterion rubric. Verifiable judge record.`, id: verificationId(user.id + "judge"), issued: ISSUED }];
  }
  const top = LEADERBOARD.slice(0, 3).map((r, i) => {
    const team = teamById(r.project.teamId);
    return { kind: "ACHIEVEMENT", title: "Certificate of Achievement", name: team.name, forLine: r.project.name, detail: `${["First", "Second", "Third"][i]} place overall · normalized score ${r.normalized.toFixed(2)}`, id: verificationId(r.project.slug), issued: ISSUED };
  });
  const judge = JUDGES[0];
  return [...top, { kind: "JUDGE RECORD", title: "Certificate of Service", name: judge.name, forLine: "Judging Dogfood 2026", detail: "Verifiable judge record.", id: verificationId(judge.id), issued: ISSUED }];
}

export function Certificates({ user }: { user: User }) {
  const toast = useToast();
  const certs = certsFor(user);
  const [sel, setSel] = useState(0);
  const [verified, setVerified] = useState<string | null>(null);
  const c = certs[sel];
  const staff = user.role === "organizer" || user.role === "admin";

  return (
    <>
      <PageHeader eyebrow="T4 · Verifiable certificates" title="Certificates"
        meta={<><span>{staff ? `${TEAMS.reduce((s, t) => s + t.members.length, 0) + JUDGES.length} to issue` : "Your certificates"}</span><span>Ed25519 signed</span><span>Issue on {ISSUED}</span></>} />

      <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
        <div>
          <AnimatePresence mode="wait">
            <motion.div key={c.id} initial={{ opacity: 0, y: 12, rotateX: 6 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} style={{ perspective: 1200 }}>
              <Certificate c={c} />
            </motion.div>
          </AnimatePresence>
          <p className="mt-4 flex items-center gap-2 font-mono text-[11px] text-muted"><Badge tone="warn">Preview</Badge>Certificates are signed and issued when results publish.</p>
        </div>

        <aside className="space-y-4">
          <div className="space-y-2">
            <Button variant="primary" size="lg" className="w-full" onClick={() => window.print()}><Download className="size-3.5" />Download PDF</Button>
            <Button size="lg" className="w-full" onClick={async () => {
              const url = `http://${EVENT.instance}/verify/${c.id}`;
              try { await navigator.clipboard.writeText(url); toast({ tone: "ok", title: "Verification link copied", body: url }); }
              catch { toast({ tone: "warn", title: "Clipboard unavailable", body: url }); }
            }}><Link2 className="size-3.5" />Copy verification link</Button>
            <Button size="lg" variant="ghost" className="w-full" onClick={() => setVerified(c.id)}><ShieldCheck className="size-3.5" />Verify signature</Button>
          </div>

          <AnimatePresence>
            {verified === c.id && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="rounded-md border border-ok/30 bg-ok/[0.05] p-4 font-mono text-[11px]" role="status">
                  <p className="flex items-center gap-2 text-ok"><ShieldCheck className="size-3.5" />SIGNATURE VALID</p>
                  <dl className="mt-3 space-y-1 text-muted">
                    <div className="flex justify-between"><dt>ALG</dt><dd className="text-fg-2">Ed25519</dd></div>
                    <div className="flex justify-between"><dt>ISSUER</dt><dd className="text-fg-2">{EVENT.instance}</dd></div>
                    <div className="flex justify-between"><dt>ID</dt><dd className="text-fg-2">{c.id}</dd></div>
                    <div className="flex justify-between"><dt>CHECKED</dt><dd className="text-fg-2">OFFLINE</dd></div>
                  </dl>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {certs.length > 1 && (
            <div>
              <p className="label mb-2">{staff ? "Issuance queue" : "Your certificates"}</p>
              <ul className="space-y-1.5" role="listbox" aria-label="Certificates">
                {certs.map((x, i) => (
                  <li key={x.id} role="option" aria-selected={i === sel}>
                    <button onClick={() => setSel(i)} className={cn("w-full rounded-sm border p-3 text-left transition-colors", i === sel ? "border-accent/50 bg-accent/[0.04]" : "border-line hover:border-line-strong")}>
                      <span className="block text-[13.5px]">{x.name}</span>
                      <span className="block font-mono text-[10.5px] text-muted">{x.kind} · {x.id}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
