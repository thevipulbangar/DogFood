"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { api, type ManagedUser } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Badge, Button, Field, Panel, Skeleton, fieldClass } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

const ROLE_TONE = { admin: "accent", organizer: "steel", judge: "ok", participant: "neutral" } as const;
const ROLES = ["all", "participant", "judge", "organizer", "admin"] as const;
type RoleFilter = (typeof ROLES)[number];

/**
 * The real, backend-backed admin account creation panel
 * (POST/GET /api/users). Admin-only, both here and enforced server-side.
 *
 * There is exactly one admin account, created once by db/seed.js — this
 * screen can only create judge or organizer accounts, matching the
 * database's own `one_admin_only` constraint (see JUDGING.md/README.md).
 * Judges and organizers are never self-registered: public signup
 * (POST /api/auth/signup) always creates a participant, so this is the
 * only way a judge or organizer account comes to exist.
 */
export function RealUserManagement() {
  const toast = useToast();
  const { user: me } = useSession();
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [error, setError] = useState<string>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"judge" | "organizer">("judge");
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = () => {
    api
      .getUsers()
      .then(setUsers)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(load, []);

  const filtered = useMemo(
    () => (users && filter !== "all" ? users.filter((u) => u.role === filter) : users),
    [users, filter]
  );

  const deleteUser = async (u: ManagedUser) => {
    if (confirmingId !== u.id) {
      setConfirmingId(u.id);
      setTimeout(() => setConfirmingId((id) => (id === u.id ? null : id)), 4000);
      return;
    }
    setConfirmingId(null);
    setDeletingId(u.id);
    try {
      await api.deleteUser(u.id);
      toast({ tone: "ok", title: "Account deleted", body: u.email });
      setUsers((prev) => prev?.filter((x) => x.id !== u.id) ?? prev);
    } catch (err) {
      toast({ tone: "warn", title: "Couldn't delete account", body: err instanceof Error ? err.message : undefined });
    } finally {
      setDeletingId(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.createUser(name, email, password, role);
      toast({ tone: "ok", title: `${role === "judge" ? "Judge" : "Organizer"} account created`, body: email });
      setName("");
      setEmail("");
      setPassword("");
      load();
    } catch (err) {
      toast({ tone: "warn", title: "Couldn't create account", body: err instanceof Error ? err.message : undefined });
    } finally {
      setCreating(false);
    }
  };

  if (error) return <ErrorState onRetry={() => { setError(undefined); load(); }} />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-white/60">
          <ShieldCheck size={14} />
          Admin-only. There is one admin account for this instance — this creates judge and organizer accounts only.
        </p>
      </div>

      <Panel title="Create account" className="max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name" htmlFor="new-user-name" required>
            <input id="new-user-name" className={cn(fieldClass, "h-10")} value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Email" htmlFor="new-user-email" required>
            <input id="new-user-email" type="email" className={cn(fieldClass, "h-10")} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Temporary password" htmlFor="new-user-password" hint="min. 8 characters" required>
            <input id="new-user-password" type="text" className={cn(fieldClass, "h-10")} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          </Field>
          <Field label="Role" htmlFor="new-user-role" required>
            <select id="new-user-role" className={cn(fieldClass, "h-10")} value={role} onChange={(e) => setRole(e.target.value as "judge" | "organizer")}>
              <option value="judge">Judge</option>
              <option value="organizer">Organizer</option>
            </select>
          </Field>
          <Button type="submit" disabled={creating}>
            <UserPlus size={16} className="mr-1.5" /> {creating ? "Creating…" : "Create account"}
          </Button>
        </form>
      </Panel>

      <Panel
        title="All accounts"
        className="overflow-x-auto p-0"
        action={
          <div className="flex gap-1">
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => setFilter(r)}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs capitalize transition-colors",
                  filter === r ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        }
      >
        {filtered === null ? (
          <div className="p-6"><Skeleton className="h-48" /></div>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-white/50">No accounts match this filter.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/50">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const isSelf = u.id === me?.id;
                const canDelete = !isSelf && u.role !== "admin";
                return (
                  <tr key={u.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3">{u.name}</td>
                    <td className="px-4 py-3 text-white/70">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {canDelete ? (
                        <Button
                          variant={confirmingId === u.id ? "danger" : "ghost"}
                          size="sm"
                          onClick={() => deleteUser(u)}
                          disabled={deletingId === u.id}
                        >
                          {deletingId === u.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} className="mr-1.5" />
                          )}
                          {deletingId === u.id ? "" : confirmingId === u.id ? "Confirm?" : "Delete"}
                        </Button>
                      ) : (
                        <span className="text-xs text-white/30">{isSelf ? "You" : "—"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
