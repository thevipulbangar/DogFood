import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPassword } from "@/components/navigation/ForgotPassword";

export const metadata: Metadata = { title: "Forgot password" };

export default function Page() {
  return (
    <Suspense>
      <ForgotPassword />
    </Suspense>
  );
}
