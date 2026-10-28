import { RealGallery } from "@/components/projects/RealGallery";

// In-app gallery: same data as public /gallery, but inside the app shell (sidebar).
export default function Page() {
  return <RealGallery base="/projects" />;
}
