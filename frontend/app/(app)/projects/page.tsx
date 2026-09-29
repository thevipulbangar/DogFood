import { redirect } from "next/navigation";

// The in-app "/projects" route used to render a mock-data gallery
// (components/projects/Gallery.tsx, backed by lib/data.ts). The real,
// backend-backed gallery lives at the public "/gallery" route — redirect
// here instead of keeping a second, fake copy of the same page alive.
export default function Page() {
  redirect("/gallery");
}
