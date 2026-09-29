"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { projectById } from "@/lib/data";
import { useSession } from "@/lib/session";
import { ProjectDetail } from "@/components/projects/ProjectDetail";
import { Restricted } from "@/components/ui/States";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useSession();
  const project = projectById(Number(id));
  if (!project) notFound();
  const staff = user?.role === "organizer" || user?.role === "admin";
  const own = user?.teamId === project.teamId;
  // Drafts are private to their team and staff.
  if (project.status === "draft" && !staff && !own) return <Restricted role={user?.role ?? "guest"} />;
  return <ProjectDetail project={project} user={user} />;
}
