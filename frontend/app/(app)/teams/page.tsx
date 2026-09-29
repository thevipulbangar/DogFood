"use client";

import { useSession } from "@/lib/session";
import { TeamWorkspace } from "@/components/teams/TeamWorkspace";
import { RealTeamsTable } from "@/components/teams/RealTeamsTable";

export default function Page() {
  const { user } = useSession();
  if (!user) return null;
  return user.role === "participant" ? <TeamWorkspace user={user} /> : <RealTeamsTable />;
}
