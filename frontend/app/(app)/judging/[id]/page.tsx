"use client";

import { use } from "react";
import { useSession } from "@/lib/session";
import { RealJudgingSession } from "@/components/judging/RealJudgingSession";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, ready } = useSession();
  if (!ready) return null;
  return user?.role === "judge" ? (
    <RealJudgingSession key={id} assignmentId={Number(id)} user={user} />
  ) : null;
}
