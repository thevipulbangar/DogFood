import type { Metadata } from "next";
import { LandingNav, Footer } from "@/components/landing/Sections";
import { RealGallery } from "@/components/projects/RealGallery";

export const metadata: Metadata = { title: "Projects" };

export default function Page() {
  return (
    <>
      <LandingNav />
      <main id="main" className="mx-auto max-w-[1600px] px-4 pb-24 pt-24 md:px-10 md:pt-28">
        <RealGallery />
      </main>
      <Footer />
    </>
  );
}
