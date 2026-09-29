"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useSession } from "@/lib/session";
import { canView, navFor, ROLE_LABEL } from "@/lib/rbac";
import { Restricted } from "@/components/ui/States";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileNav } from "./MobileNav";
import { CommandPalette } from "./CommandPalette";
import { BootSequence } from "./BootSequence";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, ready } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [palette, setPalette] = useState(false);
  const [booting, setBooting] = useState<boolean | null>(null);
  const gPending = useRef(0);

  useEffect(() => {
    if (ready && !user) router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
  }, [ready, user, router, pathname]);

  useEffect(() => {
    let booted = false;
    try { booted = sessionStorage.getItem("dogfood.booted") === "1"; } catch {}
    setBooting(!booted);
  }, []);

  const endBoot = useCallback(() => {
    try { sessionStorage.setItem("dogfood.booted", "1"); } catch {}
    setBooting(false);
  }, []);

  // ⌘K / Ctrl K palette, and "G then X" navigation chords.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || !user) return;
      if (e.key.toLowerCase() === "g") { gPending.current = Date.now(); return; }
      if (Date.now() - gPending.current < 1000) {
        const item = navFor(user.role).find((n) => n.shortcut === `G ${e.key.toUpperCase()}`);
        if (item) { e.preventDefault(); router.push(item.href); }
        gPending.current = 0;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [user, router]);

  if (!ready || !user || booting === null) return <div className="min-h-dvh bg-bg" />;

  const allowed = canView(user.role, pathname);

  return (
    <>
      <AnimatePresence>{booting && <BootSequence key="boot" onDone={endBoot} />}</AnimatePresence>
      <div className="flex min-h-dvh">
        <Sidebar user={user} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar user={user} onOpenPalette={() => setPalette(true)} />
          <motion.main
            id="main"
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: booting ? 0.25 : 0 }}
            className="mx-auto w-full max-w-[1480px] flex-1 px-4 pb-28 pt-8 md:px-8 md:pb-16 md:pt-10 xl:px-12"
          >
            {allowed ? children : <Restricted role={ROLE_LABEL[user.role]} className="mt-10" />}
          </motion.main>
        </div>
      </div>
      <MobileNav user={user} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} user={user} />
    </>
  );
}
