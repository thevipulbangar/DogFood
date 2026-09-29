"use client";

import { useSession } from "@/lib/session";
import { Results } from "@/components/results/Results";

export default function Page() {
  const { user } = useSession();
  return user ? <Results user={user} /> : null;
}
