"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = { id: number; title: string; body?: string; tone: "ok" | "warn" | "info" };
const Ctx = createContext<(t: Omit<Toast, "id">) => void>(() => {});
let seq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = (id: number) => setToasts((ts) => ts.filter((t) => t.id !== id));
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = ++seq;
    setToasts((ts) => [...ts.slice(-3), { ...t, id }]);
    setTimeout(() => dismiss(id), 4200);
  }, []);

  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-20 z-[70] flex flex-col items-end gap-2 md:bottom-6 md:left-auto md:right-6 md:w-[360px]">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icon = t.tone === "ok" ? Check : t.tone === "warn" ? AlertTriangle : Info;
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="pointer-events-auto flex w-full items-start gap-3 rounded-md border border-line-strong bg-surface-2/95 p-3 shadow-2xl shadow-black/50 backdrop-blur"
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-xs",
                    t.tone === "ok" ? "bg-ok/15 text-ok" : t.tone === "warn" ? "bg-warn/15 text-warn" : "bg-steel-soft text-steel",
                  )}
                >
                  <Icon className="size-3" strokeWidth={2.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-fg">{t.title}</p>
                  {t.body && <p className="mt-0.5 font-mono text-[11px] text-muted">{t.body}</p>}
                </div>
                <button onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="text-muted hover:text-fg">
                  <X className="size-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
