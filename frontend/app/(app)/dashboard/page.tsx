"use client";

import { useSession } from "@/lib/session";
import { Dashboard } from "@/components/dashboard/Dashboards";

export default function Page() {
  const { user } = useSession();
  return user ? <Dashboard user={user} /> : null;
}
