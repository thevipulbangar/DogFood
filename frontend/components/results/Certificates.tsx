import { EmptyState } from "@/components/ui/States";
import type { User } from "@/lib/session";

/**
 * T4 stretch: "certificate and record generation, signed and publicly
 * verifiable judge participation records." Not implemented — this used to
 * render fabricated certificate previews. Honest placeholder instead; see
 * acceptance-report.txt for the full T4 status.
 */
export function Certificates({ user: _user }: { user: User }) {
  return (
    <div className="py-12">
      <EmptyState
        code="T4 · NOT IMPLEMENTED"
        title="Certificates aren't built yet"
        body="This is a T4 stretch goal (signed, verifiable certificate generation) that hasn't been implemented. See acceptance-report.txt for the current tier status."
      />
    </div>
  );
}
