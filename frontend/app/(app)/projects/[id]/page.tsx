"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { RealProjectDetail } from "@/components/projects/RealProjectDetail";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number(use(params).id);
  if (!Number.isFinite(id)) notFound();
  return <RealProjectDetail id={id} base="/projects" />;
}
