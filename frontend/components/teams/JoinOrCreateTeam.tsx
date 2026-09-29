"use client";

import { useEffect, useState } from "react";
import { Plus, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Field, Panel, fieldClass } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

type Event = { id: number; name: string };

/** Shown when the logged-in user isn't on a team yet: create one, or join with a code. */
export function JoinOrCreateTeam({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    api.getEvents().then((rows: Event[]) => {
      setEvents(rows);
      if (rows[0]) setEventId(rows[0].id);
    }).catch(() => {});
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;
    setPending("create");
    setError(undefined);
    try {
      await api.createTeam(eventId, name);
      toast({ tone: "ok", title: "Team created" });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create team.");
    } finally {
      setPending(null);
    }
  };

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending("join");
    setError(undefined);
    try {
      await api.joinTeam(code);
      toast({ tone: "ok", title: "Joined team" });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join team.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Panel title="Create a team">
        <form onSubmit={create} className="space-y-4">
          <Field label="Team name" htmlFor="team-name">
            <input id="team-name" value={name} onChange={(e) => setName(e.target.value)} required
              className={cn(fieldClass, "h-10")} placeholder="Night Owls" />
          </Field>
          <Field label="Event" htmlFor="team-event">
            <select id="team-event" value={eventId ?? ""} onChange={(e) => setEventId(Number(e.target.value))}
              className={cn(fieldClass, "h-10")} required>
              {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
          </Field>
          <Button type="submit" variant="primary" className="w-full" disabled={pending !== null || !events.length}>
            <Plus className="size-3.5" />{pending === "create" ? "Creating…" : "Create team"}
          </Button>
        </form>
      </Panel>

      <Panel title="Join a team">
        <form onSubmit={join} className="space-y-4">
          <Field label="Invite code" htmlFor="join-code" error={error}>
            <input id="join-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required
              className={cn(fieldClass, "h-10 font-mono uppercase")} placeholder="A1B2C3D4" />
          </Field>
          <Button type="submit" variant="secondary" className="w-full" disabled={pending !== null}>
            <Users className="size-3.5" />{pending === "join" ? "Joining…" : "Join team"}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
