"use client";

import { MotionConfig } from "motion/react";
import { SessionProvider } from "@/lib/session";
import { ToastProvider } from "./ui/Toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <SessionProvider>
        <ToastProvider>{children}</ToastProvider>
      </SessionProvider>
    </MotionConfig>
  );
}
