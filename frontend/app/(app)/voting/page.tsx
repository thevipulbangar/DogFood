"use client";

import { useSession } from "@/lib/session";
import { RealVotingBoard } from "@/components/voting/RealVotingBoard";

export default function Page() {
  const { user } = useSession();
  return user ? <RealVotingBoard user={user} /> : null;
}
