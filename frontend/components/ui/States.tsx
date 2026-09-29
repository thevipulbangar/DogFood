import { AlertTriangle, Inbox, Lock, RotateCw } from "lucide-react";
import { Button } from "./primitives";
import { cn } from "@/lib/utils";

function Frame({ icon, code, title, body, action, className }: {
  icon: React.ReactNode; code: string; title: string; body: React.ReactNode; action?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("relative flex flex-col items-center justify-center overflow-hidden rounded-md border border-dashed border-line-strong px-6 py-14 text-center", className)}>
      <div className="event-grid-fine fade-mask-radial absolute inset-0" aria-hidden />
      <div className="relative flex size-10 items-center justify-center rounded-sm border border-line-strong bg-surface-2 text-fg-2">{icon}</div>
      <p className="label relative mt-5">{code}</p>
      <h3 className="relative mt-2 text-lg font-medium tracking-tight text-fg">{title}</h3>
      <div className="relative mt-2 max-w-sm text-[13.5px] leading-relaxed text-muted">{body}</div>
      {action && <div className="relative mt-6">{action}</div>}
    </div>
  );
}

export function EmptyState({ code = "EMPTY · 0 RECORDS", ...p }: { title: string; body: React.ReactNode; action?: React.ReactNode; code?: string; className?: string }) {
  return <Frame icon={<Inbox className="size-4" />} code={code} {...p} />;
}

export function ErrorState({ title = "Could not load this view", body, onRetry, className }: {
  title?: string; body?: React.ReactNode; onRetry?: () => void; className?: string;
}) {
  return (
    <Frame
      icon={<AlertTriangle className="size-4 text-danger" />}
      code="ERR · LOCAL API UNREACHABLE"
      title={title}
      className={className}
      body={body ?? "The local instance did not respond. Your data is safe on disk — check that the Dogfood service is running, then retry."}
      action={onRetry && <Button onClick={onRetry}><RotateCw className="size-3" />Retry</Button>}
    />
  );
}

export function Restricted({ role, className }: { role: string; className?: string }) {
  return (
    <Frame
      icon={<Lock className="size-4" />}
      code="403 · FORBIDDEN"
      title="This area is restricted"
      className={className}
      body={<>Your role (<span className="font-mono text-fg-2">{role}</span>) does not grant access. Permissions are enforced by the server — this page would receive no data even if it rendered.</>}
    />
  );
}
