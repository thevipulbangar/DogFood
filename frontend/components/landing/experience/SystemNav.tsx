"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { Logo } from "@/components/ui/Logo";
import { StatusDot, buttonClass } from "@/components/ui/primitives";
import { Scramble, useEnv, useRelay } from "./runtime";

/**
 * Near-invisible at rest; firms up once the visitor starts moving. The active
 * section is a system readout, not a highlighted menu item.
 */
export function SystemNav({ active }: { active: string }) {
  const { ready } = useEnv();
  const page = useScroll();
  const scrollY = useRelay(page.scrollY);
  const scrollYProgress = useRelay(page.scrollYProgress);
  const opacity = useTransform(scrollY, [0, 120], [0.45, 1]);
  const bg = useTransform(scrollY, [0, 160], ["rgb(10 10 11 / 0)", "rgb(10 10 11 / 0.78)"]);
  const border = useTransform(scrollY, [0, 160], ["rgb(255 255 255 / 0)", "rgb(255 255 255 / 0.08)"]);

  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-50 border-b backdrop-blur-md"
      style={{ backgroundColor: bg, borderColor: border }}
      initial={{ y: -20, opacity: 0 }}
      animate={ready ? { y: 0, opacity: 1 } : {}}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
    >
      <motion.div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-5 md:px-10" style={{ opacity }}>
        <Link href="/" aria-label="Dogfood home"><Logo /></Link>

        <p className="hidden items-center gap-2.5 font-mono text-[10.5px] tracking-[0.16em] text-fg-2 sm:flex" aria-live="polite">
          <span className="text-line-strong">/</span>
          <StatusDot tone="accent" pulse />
          <Scramble text={active} />
        </p>

        <nav aria-label="Primary" className="ml-auto flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
          <Link href="/gallery" className="hidden transition-colors hover:text-fg md:inline">Projects</Link>
          <a href="#platform" className="hidden transition-colors hover:text-fg md:inline">Platform</a>
          <a href="#self-host" className="hidden transition-colors hover:text-fg md:inline">Self-host</a>
          <Link href="/signin" className={buttonClass("secondary", "sm", "xp-btn")}>Sign in</Link>
        </nav>
      </motion.div>
      <motion.span aria-hidden className="absolute inset-x-0 bottom-[-1px] h-px origin-left bg-accent" style={{ scaleX: scrollYProgress }} />
    </motion.header>
  );
}
