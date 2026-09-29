"use client";

import { useSession } from "@/lib/session";
import { RealJudgeDashboard } from "@/components/judging/RealJudgeDashboard";
import { RealJudgingOps } from "@/components/judging/RealJudgingOps";

export default function Page() {
  const { user } = useSession();
  if (!user) return null;
  return user.role === "judge" ? <RealJudgeDashboard user={user} /> : <RealJudgingOps />;
}
