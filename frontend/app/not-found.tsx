import Link from "next/link";
import { EventGrid } from "@/components/ui/EventGrid";
import { buttonClass } from "@/components/ui/button-class";

export default function NotFound() {
  return (
    <main id="main" className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <EventGrid cells={14} seed={404} />
      <p className="label relative">404 · Record not found</p>
      <h1 className="relative mt-3 text-[clamp(4rem,14vw,10rem)] font-semibold leading-[0.85] tracking-[-0.06em]">Off grid<span className="text-accent">.</span></h1>
      <p className="relative mt-5 max-w-sm text-[15px] text-fg-2">This project, page or record doesn&apos;t exist on this instance — or it isn&apos;t public yet.</p>
      <div className="relative mt-8 flex gap-2">
        <Link href="/" className={buttonClass("primary")}>Home</Link>
        <Link href="/gallery" className={buttonClass("outline")}>Projects</Link>
      </div>
    </main>
  );
}
