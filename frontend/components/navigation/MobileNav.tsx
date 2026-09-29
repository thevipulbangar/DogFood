"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { MoreHorizontal, X } from "lucide-react";
import { navFor } from "@/lib/rbac";
import type { User } from "@/lib/session";
import { cn } from "@/lib/utils";
import { EventSwitcher } from "./Sidebar";

/** Mobile: a thumb-reachable bottom bar with the four primary destinations + a sheet. */
export function MobileNav({ user }: { user: User }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = navFor(user.role);
  const primary = items.slice(0, 4);
  const rest = items.slice(4);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <ul className="grid grid-cols-5">
          {primary.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={active ? "page" : undefined}
                  className={cn("relative flex h-14 flex-col items-center justify-center gap-1", active ? "text-fg" : "text-muted")}>
                  {active && <motion.span layoutId="mnav" className="absolute inset-x-5 top-0 h-px bg-accent" />}
                  <Icon className={cn("size-[18px]", active && "text-accent")} strokeWidth={1.75} />
                  <span className="font-mono text-[9px] uppercase tracking-[0.08em]">{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button onClick={() => setOpen(true)} aria-expanded={open} className="flex h-14 w-full flex-col items-center justify-center gap-1 text-muted">
              <MoreHorizontal className="size-[18px]" />
              <span className="font-mono text-[9px] uppercase tracking-[0.08em]">More</span>
            </button>
          </li>
        </ul>
      </nav>

      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-black/60 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.div role="dialog" aria-modal aria-label="More navigation"
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-lg border-t border-line-strong bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:hidden"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 400, damping: 40 }}>
              <div className="mb-4 flex items-center justify-between">
                <p className="label">Navigate</p>
                <button onClick={() => setOpen(false)} aria-label="Close" className="text-muted"><X className="size-4" /></button>
              </div>
              <EventSwitcher user={user} />
              <ul className="mt-3 grid grid-cols-2 gap-2">
                {rest.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link href={item.href} onClick={() => setOpen(false)}
                        className={cn("flex h-12 items-center gap-3 rounded-sm border px-3 text-[13px]", isActive(item.href) ? "border-accent/40 text-fg" : "border-line text-fg-2")}>
                        <Icon className="size-4 text-muted" strokeWidth={1.75} />{item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
