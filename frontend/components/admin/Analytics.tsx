import { EmptyState } from "@/components/ui/States";

/**
 * Analytics doesn't map to any tier in the published spec (T1-T4) — it
 * used to be a fully fabricated dashboard of invented numbers. Rather than
 * keep fake charts around, this is an honest placeholder. Real operational
 * numbers live on the Overview dashboard and Results page instead.
 */
export function Analytics() {
  return (
    <div className="py-12">
      <EmptyState
        code="NOT IN SPEC"
        title="Analytics isn't part of the tier ladder"
        body="This page previously showed fabricated charts. Real numbers (teams, submissions, judging progress) are on the Overview dashboard and the Results page."
      />
    </div>
  );
}
