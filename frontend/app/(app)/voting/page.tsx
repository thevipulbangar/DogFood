"use client";

import { useSession } from "@/lib/session";
import { VotingBoard } from "@/components/voting/VotingBoard";

export default function Page() {
  const { user } = useSession();
  return user ? <VotingBoard user={user} /> : null;
}
