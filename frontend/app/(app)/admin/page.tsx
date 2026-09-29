"use client";

import { useSession } from "@/lib/session";
import { RealEventManager } from "@/components/admin/RealEventManager";
import { RealUserManagement } from "@/components/admin/RealUserManagement";

export default function Page() {
  const { user } = useSession();
  if (!user) return null;
  // Real, backend-backed for both roles: event creation/editing
  // (organizer + admin), and account creation for judges/organizers
  // (admin only, its own single-admin rule — see JUDGING.md).
  return (
    <div className="space-y-10">
      <RealEventManager />
      {user.role === "admin" && <RealUserManagement />}
    </div>
  );
}
