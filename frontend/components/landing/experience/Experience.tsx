"use client";

import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import { Capabilities, FinalCTA, Footer, SelfHosted } from "@/components/landing/Sections";
import { ExperienceProvider, useEnv } from "./runtime";
import { Loader } from "./Loader";
import { SystemNav } from "./SystemNav";
import { HeroScene } from "./Hero";
import { DatasetScene } from "./Dataset";
import { JudgingScene } from "./Judging";
import { PanelScene } from "./Panel";
import { CollisionScene } from "./Collision";
import { AnalyticsScene } from "./Analytics";
import { RevealScene } from "./Reveal";
import "./experience.css";

/**
 * The landing experience: one continuous, scroll-driven piece of printed
 * matter about the product's own pipeline — submission → evaluation →
 * normalization → results — ending on the real (dark) interface.
 */
export function Experience() {
  return (
    <ExperienceProvider>
      <Stage />
    </ExperienceProvider>
  );
}

/**
 * Inertial smooth scrolling. Paused while the loader holds the page, handles
 * in-page anchors, and switched off entirely for reduced motion.
 */
function useSmoothScroll() {
  const { ready, still } = useEnv();
  const lenis = useRef<Lenis | null>(null);
  useEffect(() => {
    if (still) return;
    const l = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, anchors: true });
    lenis.current = l;
    let raf = 0;
    const loop = (t: number) => { l.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); l.destroy(); lenis.current = null; };
  }, [still]);
  useEffect(() => {
    const l = lenis.current;
    if (!l) return;
    if (ready) l.start(); else l.stop();
  }, [ready, still]);
}

function Stage() {
  const [active, setActive] = useState("01 / THE BOARD");
  useSmoothScroll();

  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>("[data-nav]")];
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive((e.target as HTMLElement).dataset.nav!)),
      { rootMargin: "-50% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="ink min-h-dvh bg-bg">
      <Loader />
      <SystemNav active={active} />
      <main id="main" className="relative [overflow-x:clip]">
        <HeroScene />
        <DatasetScene />
        <JudgingScene />
        <PanelScene />
        <CollisionScene />
        <AnalyticsScene />
        <RevealScene />
        <div data-nav="08 / SPECIFICATION" className="relative border-t border-line bg-bg"><Capabilities /></div>
        <div data-nav="09 / SELF-HOSTED" className="relative border-t border-line [--color-paper:#0a0a0b] [--color-paper-2:#111113] [--color-ink:#edece8] [&>section]:after:hidden"><SelfHosted /></div>
        <div data-nav="10 / ENTER" className="ink xp-cta relative bg-bg"><FinalCTA /></div>
      </main>
      <div className="ink relative bg-bg"><Footer /></div>
    </div>
  );
}
