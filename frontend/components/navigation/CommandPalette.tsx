"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CornerDownLeft, Download, FolderKanban, LogOut, Plus, Repeat, ScrollText, Search } from "lucide-react";
import { navFor } from "@/lib/rbac";
import { PROJECTS, SUBMITTED, teamById, trackById } from "@/lib/data";
import type { User } from "@/lib/session";
import { useSession } from "@/lib/session";
import { cn, downloadCSV, pad } from "@/lib/utils";
import { Kbd } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";

type Cmd = { id: string; group: string; label: string; hint?: string; icon: React.ElementType; run: () => void; keywords?: string };

export function CommandPalette({ open, onClose, user }: { open: boolean; onClose: () => void; user: User }) {
  const router = useRouter();
  const toast = useToast();
  const { signOut } = useSession();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const staff = user.role === "organizer" || user.role === "admin";

  const commands = useMemo<Cmd[]>(() => {
    const go = (href: string) => () => router.push(href);
    const nav: Cmd[] = navFor(user.role).map((n) => ({
      id: n.href, group: "Navigate", label: `Go to ${n.label.toLowerCase()}`, hint: n.shortcut, icon: n.icon, run: go(n.href),
    }));
    const visible = staff ? PROJECTS : SUBMITTED;
    const projects: Cmd[] = visible.map((p) => ({
      id: `p${p.id}`, group: "Projects", label: p.name, hint: `P-${pad(p.id)}`, icon: FolderKanban, run: go(`/projects/${p.id}`),
      keywords: `${p.tagline} ${p.stack.join(" ")} ${teamById(p.teamId).name} ${trackById(p.trackId).name}`,
    }));
    const actions: Cmd[] = [
      ...(user.role === "participant" ? [{ id: "a-team", group: "Actions", label: "Open team", icon: ArrowRight, run: go("/teams") }] : []),
      ...(user.role === "judge" ? [{ id: "a-judge", group: "Actions", label: "Resume judging session", icon: ArrowRight, run: go("/judging") }] : []),
      ...(staff
        ? [
            { id: "a-create", group: "Actions", label: "Create event…", icon: Plus, run: go("/admin") },
            { id: "a-audit", group: "Actions", label: "Open audit log", icon: ScrollText, run: go("/audit") },
            {
              id: "a-export", group: "Actions", label: "Export submissions (CSV)", icon: Download,
              run: () => {
                downloadCSV("dogfood-2026-submissions.csv", SUBMITTED.map((p) => ({
                  id: p.id, name: p.name, team: teamById(p.teamId).name, track: trackById(p.trackId).name, stack: p.stack.join(" · "), submitted_at: p.submittedAt,
                })));
                toast({ tone: "ok", title: "Export generated", body: `dogfood-2026-submissions.csv · ${SUBMITTED.length} rows` });
              },
            },
          ]
        : []),
      { id: "a-switch", group: "Actions", label: "Switch account", icon: Repeat, run: () => { signOut(); router.push("/signin"); } },
      { id: "a-out", group: "Actions", label: "Sign out", icon: LogOut, run: () => { signOut(); router.push("/"); } },
    ];
    return [...nav, ...actions, ...projects];
  }, [user.role, staff, router, signOut, toast]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands.filter((c) => c.group !== "Projects").concat(commands.filter((c) => c.group === "Projects").slice(0, 4));
    return commands.filter((c) => `${c.label} ${c.keywords ?? ""} ${c.hint ?? ""}`.toLowerCase().includes(s)).slice(0, 14);
  }, [q, commands]);

  useEffect(() => { setIdx(0); }, [q]);
  useEffect(() => {
    if (open) { setQ(""); setTimeout(() => inputRef.current?.focus(), 10); }
  }, [open]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${idx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  const run = (c: Cmd | undefined) => { if (!c) return; onClose(); c.run(); };

  let lastGroup = "";
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog" aria-modal aria-label="Command palette"
            initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[620px] overflow-hidden rounded-lg border border-line-strong bg-surface/95 shadow-[0_40px_120px_-20px_rgb(0_0_0/0.9)] backdrop-blur-xl"
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); run(results[idx]); }
            }}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-4 text-muted" />
              <input
                ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Type a command or search projects…"
                role="combobox" aria-expanded aria-controls="cmd-list" aria-activedescendant={results[idx] ? `cmd-${results[idx].id}` : undefined}
                className="h-14 flex-1 bg-transparent text-[15px] text-fg placeholder:text-muted focus:outline-none focus-visible:outline-none"
              />
              <Kbd>ESC</Kbd>
            </div>
            <ul id="cmd-list" ref={listRef} role="listbox" className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
              {results.length === 0 && (
                <li className="px-3 py-10 text-center">
                  <p className="label">No matches</p>
                  <p className="mt-1 text-[13px] text-muted">Try a project name, technology or team.</p>
                </li>
              )}
              {results.map((c, i) => {
                const header = c.group !== lastGroup ? (lastGroup = c.group) : null;
                const Icon = c.icon;
                return (
                  <li key={c.id} role="presentation">
                    {header && <p className="label px-3 pb-1.5 pt-3 first:pt-1">{header}</p>}
                    <button
                      id={`cmd-${c.id}`} data-idx={i} role="option" aria-selected={i === idx}
                      onMouseMove={() => setIdx(i)} onClick={() => run(c)}
                      className={cn("flex h-10 w-full items-center gap-3 rounded-sm px-3 text-left text-[13.5px] transition-colors",
                        i === idx ? "bg-white/[0.06] text-fg" : "text-fg-2")}
                    >
                      <Icon className={cn("size-4", i === idx ? "text-accent" : "text-muted")} strokeWidth={1.75} />
                      <span className="flex-1 truncate">{c.label}</span>
                      {c.hint && <span className="font-mono text-[10.5px] text-muted">{c.hint}</span>}
                      {i === idx && <CornerDownLeft className="size-3.5 text-muted" />}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-between border-t border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
              <span className="flex items-center gap-3"><span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd>Navigate</span><span className="flex items-center gap-1"><Kbd>↵</Kbd>Run</span></span>
              <span>{results.length} results</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
