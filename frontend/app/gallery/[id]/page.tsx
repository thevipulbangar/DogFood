"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { projectById } from "@/lib/data";
import { useSession } from "@/lib/session";
import { LandingNav, Footer } from "@/components/landing/Sections";
import { ProjectDetail } from "@/components/projects/ProjectDetail";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useSession();
  const project = projectById(Number(id));
  // The public gallery only ever exposes submitted projects.
  if (!project || project.status !== "submitted") notFound();
  return (
    <>
      <LandingNav />
      <main id="main" className="mx-auto max-w-[1480px] px-4 pb-24 pt-24 md:px-10 md:pt-28">
        <ProjectDetail project={project} user={user} publicView />
      </main>
      <Footer />
    </>
  );
}
