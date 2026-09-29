"use client";

import { useSession } from "@/lib/session";
import { RealResults } from "@/components/results/RealResults";

export default function Page() {
  const { user } = useSession();
  return user ? <RealResults user={user} /> : null;
}
