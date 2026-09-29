import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUp } from "@/components/navigation/SignUp";

export const metadata: Metadata = { title: "Sign up" };

export default function Page() {
  return (
    <Suspense>
      <SignUp />
    </Suspense>
  );
}
