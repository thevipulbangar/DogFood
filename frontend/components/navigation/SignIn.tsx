"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { EVENT } from "@/lib/data";
import { useSession } from "@/lib/session";
import { Logo } from "@/components/ui/Logo";
import { EventGrid } from "@/components/ui/EventGrid";
import { Button, Field, StatusDot, fieldClass } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function SignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      await signIn(email, password);
      const next = params.get("next");
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
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
            Welcome to<br />the control<br />room<span className="text-accent">.</span>
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
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Sign in to Dogfood</h2>
          <p className="mt-2 text-[14px] text-muted">Accounts are stored on this instance. Nothing leaves your network.</p>

          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            <Field label="Email" htmlFor="email" error={error}>
              <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!error} aria-describedby={error ? "email-error" : undefined}
                className={cn(fieldClass, "h-11")} placeholder="you@team.dev" />
            </Field>
            <Field label="Password" htmlFor="password">
              <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
                className={cn(fieldClass, "h-11")} placeholder="••••••••" />
            </Field>
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-[13px] text-muted underline underline-offset-4 hover:text-accent">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : <>Sign in <ArrowRight className="size-3.5" /></>}
            </Button>
          </form>

          <p className="mt-6 text-[14px] text-muted">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-fg underline underline-offset-4 hover:text-accent">Create one</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
