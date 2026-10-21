import { CircleDot, CloudCheck, PencilLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Practice } from "@/lib/types";

/** Visual status of a practice's slideshow relative to what's live. */
export function StatusBadge({ practice }: { practice: Practice }) {
  if (practice.publishedVersion === 0) {
    return (
      <Badge variant="muted">
        <PencilLine className="size-3" />
        Draft
      </Badge>
    );
  }
  if (practice.hasUnpublishedChanges) {
    return (
      <Badge variant="warning">
        <CircleDot className="size-3" />
        Unpublished changes
      </Badge>
    );
  }
  return (
    <Badge variant="success">
      <CloudCheck className="size-3" />
      Live · v{practice.publishedVersion}
    </Badge>
  );
}
