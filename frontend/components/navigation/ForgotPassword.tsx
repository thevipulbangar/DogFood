"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { EVENT } from "@/lib/data";
import { api } from "@/lib/api";
import { Logo } from "@/components/ui/Logo";
import { EventGrid } from "@/components/ui/EventGrid";
import { Button, Field, StatusDot, fieldClass } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-line bg-[#070708] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <EventGrid cells={24} seed={11} />
        <Link href="/" className="relative"><Logo /></Link>
        <div className="relative">
          <p className="label mb-6 flex items-center gap-2"><StatusDot tone="ok" pulse />{EVENT.id} · LIVE</p>
          <h1 className="text-[clamp(3rem,6vw,5.5rem)] font-semibold leading-[0.88] tracking-[-0.045em]">
            Lost your<br />way in<span className="text-accent">?</span>
          </h1>
        </div>
        <dl className="relative grid grid-cols-3 gap-6 border-t border-line pt-6 font-mono text-[11px]">
          <div><dt className="label">Instance</dt><dd className="mt-1 text-fg-2">{EVENT.instance}</dd></div>
          <div><dt className="label">Version</dt><dd className="mt-1 text-fg-2">{EVENT.version}</dd></div>
          <div><dt className="label">Data</dt><dd className="mt-1 text-fg-2">On this machine</dd></div>
        </dl>
      </section>

      <section className="flex flex-col justify-center px-5 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-[440px]">
          <Link href="/" className="mb-12 inline-block lg:hidden"><Logo /></Link>
          <p className="label">Authentication</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Reset your password</h2>
          <p className="mt-2 text-[14px] text-muted">
            This instance has no mail server configured, so the reset link is written to the
            backend&apos;s console log (<code className="text-fg-2">docker compose logs backend</code>)
            instead of emailed.
          </p>

          {sent ? (
            <p className="mt-8 rounded-sm border border-line bg-white/[0.015] p-4 text-[14px] text-fg-2">
              If an account exists for that email, a reset link was just logged on the server.
            </p>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
              <Field label="Email" htmlFor="email" error={error}>
                <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!error} aria-describedby={error ? "email-error" : undefined}
                  className={cn(fieldClass, "h-11")} placeholder="you@team.dev" required />
              </Field>
              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : <>Send reset link <ArrowRight className="size-3.5" /></>}
              </Button>
            </form>
          )}

          <p className="mt-6 text-[14px] text-muted">
            <Link href="/signin" className="text-fg underline underline-offset-4 hover:text-accent">Back to sign in</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
