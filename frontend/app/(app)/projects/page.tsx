"use client";

import { useSession } from "@/lib/session";
import { Gallery } from "@/components/projects/Gallery";

export default function Page() {
  const { user } = useSession();
  return <Gallery staff={user?.role === "organizer" || user?.role === "admin"} />;
}
