"use client";

import { ErrorState } from "@/components/ui/States";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState className="mt-10" onRetry={reset} />;
}
