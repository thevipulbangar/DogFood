"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { LandingNav, Footer } from "@/components/landing/Sections";
import { RealProjectDetail } from "@/components/projects/RealProjectDetail";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();
  return (
    <>
      <LandingNav />
      <main id="main" className="mx-auto max-w-[1480px] px-4 pb-24 pt-24 md:px-10 md:pt-28">
        <RealProjectDetail id={numericId} />
      </main>
      <Footer />
    </>
  );
}
