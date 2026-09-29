"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, Pencil, Plus, Save, X } from "lucide-react";
import { api, type EventItem } from "@/lib/api";
import { Badge, Button, Field, Panel, Skeleton, fieldClass } from "@/components/ui/primitives";
import { ErrorState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { cn, fmtUTC } from "@/lib/utils";

const toLocalInput = (iso?: string | null) => (iso ? iso.slice(0, 16) : "");
const toLocalDate = (iso?: string | null) => (iso ? iso.slice(0, 10) : "");

type FormState = {
  name: string; description: string; start_date: string; end_date: string;
  submission_deadline: string; tracks: string[]; prizes: string;
};

const EMPTY_FORM: FormState = {
  name: "", description: "", start_date: "", end_date: "",
  submission_deadline: "", tracks: [], prizes: "",
};

function eventToForm(e: EventItem): FormState {
  return {
    name: e.name, description: e.description ?? "",
    start_date: toLocalDate(e.start_date), end_date: toLocalDate(e.end_date),
    submission_deadline: toLocalInput(e.submission_deadline),
    tracks: e.tracks ?? [], prizes: e.prizes ?? "",
  };
}

function TrackInput({ tracks, onChange }: { tracks: string[]; onChange: (t: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !tracks.includes(v)) onChange([...tracks, v]);
    setDraft("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {tracks.map((t) => (
          <Badge key={t} tone="steel" className="gap-1">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(tracks.filter((x) => x !== t))}>
              <X size={11} />
            </button>
          </Badge>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className={cn(fieldClass, "h-9 flex-1")}
          placeholder="e.g. AI/ML"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <Button type="button" variant="secondary" onClick={add}>
          <Plus size={14} /> Add
        </Button>
      </div>
    </div>
  );
}

function EventForm({ initial, onSubmit, onCancel, submitting }: {
  initial: FormState; onSubmit: (f: FormState) => void; onCancel?: () => void; submitting: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
    >
      <Field label="Event name" htmlFor="ev-name" required>
        <input id="ev-name" className={cn(fieldClass, "h-10")} value={form.name} onChange={(e) => set("name", e.target.value)} required />
      </Field>
      <Field label="Description" htmlFor="ev-desc">
        <textarea id="ev-desc" rows={3} className={cn(fieldClass, "py-2")} value={form.description} onChange={(e) => set("description", e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Start date" htmlFor="ev-start">
          <input id="ev-start" type="date" className={cn(fieldClass, "h-10")} value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
        </Field>
        <Field label="End date" htmlFor="ev-end">
          <input id="ev-end" type="date" className={cn(fieldClass, "h-10")} value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
        </Field>
      </div>
      <Field label="Submission deadline" htmlFor="ev-deadline" hint="enforced server-side on every draft/submit" required>
        <input id="ev-deadline" type="datetime-local" className={cn(fieldClass, "h-10")} value={form.submission_deadline} onChange={(e) => set("submission_deadline", e.target.value)} required />
      </Field>
      <Field label="Tracks" htmlFor="ev-tracks" hint="shown as options on the submission form">
        <TrackInput tracks={form.tracks} onChange={(t) => set("tracks", t)} />
      </Field>
      <Field label="Prizes" htmlFor="ev-prizes">
        <textarea id="ev-prizes" rows={2} className={cn(fieldClass, "py-2")} value={form.prizes} onChange={(e) => set("prizes", e.target.value)} />
      </Field>
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={submitting}>
          <Save size={16} className="mr-1.5" /> {submitting ? "Saving…" : "Save"}
        </Button>
        {onCancel && (
          <button type="button" className={cn(fieldClass, "h-9 w-auto border-none bg-transparent px-3 text-sm text-white/60 hover:text-white")} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * The real, backend-backed event manager (POST/PUT /api/events).
 * Organizer/admin only, enforced server-side. Covers the T1 requirement
 * "event creation with configurable dates, tracks and prizes," which had
 * a working API but no UI until now.
 */
export function RealEventManager() {
  const toast = useToast();
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.getEvents().then(setEvents).catch((err: Error) => setError(err.message));
  };
  useEffect(load, []);

  const create = async (form: FormState) => {
    setSaving(true);
    try {
      await api.createEvent({
        name: form.name,
        description: form.description || undefined,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        submission_deadline: new Date(form.submission_deadline).toISOString(),
        tracks: form.tracks,
        prizes: form.prizes || undefined,
      });
      toast({ tone: "ok", title: "Event created", body: form.name });
      setShowCreate(false);
      load();
    } catch (err) {
      toast({ tone: "warn", title: "Couldn't create event", body: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const update = async (id: number, form: FormState) => {
    setSaving(true);
    try {
      await api.updateEvent(id, {
        name: form.name,
        description: form.description,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        submission_deadline: new Date(form.submission_deadline).toISOString(),
        tracks: form.tracks,
        prizes: form.prizes,
      });
      toast({ tone: "ok", title: "Event updated" });
      setEditingId(null);
      load();
    } catch (err) {
      toast({ tone: "warn", title: "Couldn't update event", body: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  if (error) return <ErrorState onRetry={() => { setError(undefined); load(); }} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
          <p className="mt-1 text-sm text-white/60">Dates, submission deadline, tracks and prizes — enforced server-side.</p>
        </div>
        {!showCreate && (
          <Button onClick={() => setShowCreate(true)}>
            <CalendarPlus size={16} className="mr-1.5" /> New event
          </Button>
        )}
      </div>

      {showCreate && (
        <Panel title="Create event" className="max-w-xl">
          <EventForm initial={EMPTY_FORM} submitting={creating} onSubmit={create} onCancel={() => setShowCreate(false)} />
        </Panel>
      )}

      {events === null ? (
        <Skeleton className="h-40" />
      ) : events.length === 0 ? (
        <EmptyState code="0 EVENTS" title="No events yet" body="Create one above to get started." />
      ) : (
        <div className="space-y-4">
          {events.map((e) => (
            <Panel key={e.id} title={e.name} meta={`Deadline · ${fmtUTC(e.submission_deadline)}`}>
              {editingId === e.id ? (
                <EventForm initial={eventToForm(e)} submitting={saving} onSubmit={(f) => update(e.id, f)} onCancel={() => setEditingId(null)} />
              ) : (
                <div className="space-y-3">
                  {e.description && <p className="text-sm text-white/70">{e.description}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {(e.tracks ?? []).map((t) => <Badge key={t} tone="steel">{t}</Badge>)}
                    {(e.tracks ?? []).length === 0 && <span className="text-xs text-white/40">No tracks configured</span>}
                  </div>
                  {e.prizes && <p className="whitespace-pre-line text-sm text-white/60">{e.prizes}</p>}
                  <button className={cn(fieldClass, "h-8 w-auto border-none bg-transparent px-0 text-sm text-accent")} onClick={() => setEditingId(e.id)}>
                    <Pencil size={13} className="mr-1 inline" /> Edit
                  </button>
                </div>
              )}
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
