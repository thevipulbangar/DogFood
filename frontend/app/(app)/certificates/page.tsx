"use client";

import { useSession } from "@/lib/session";
import { Certificates } from "@/components/results/Certificates";

export default function Page() {
  const { user } = useSession();
  return user ? <Certificates user={user} /> : null;
}
