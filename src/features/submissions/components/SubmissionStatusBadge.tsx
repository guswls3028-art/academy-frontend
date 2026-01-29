// src/features/submissions/components/SubmissionStatusBadge.tsx

import type { SubmissionStatus } from "@/features/submissions/types";
import {
  SUBMISSION_STATUS_COLOR,
  SUBMISSION_STATUS_LABEL,
} from "@/features/submissions/statusMaps";

const COLOR_CLASS: Record<string, string> = {
  gray: "bg-neutral-800 text-neutral-200 border-neutral-700",
  blue: "bg-blue-950 text-blue-200 border-blue-800",
  indigo: "bg-indigo-950 text-indigo-200 border-indigo-800",
  yellow: "bg-yellow-950 text-yellow-200 border-yellow-800",
  green: "bg-emerald-950 text-emerald-200 border-emerald-800",
  red: "bg-red-950 text-red-200 border-red-800",
};

export default function SubmissionStatusBadge({
  status,
}: {
  status: SubmissionStatus | null;
}) {
  if (!status) {
    return (
      <span className="inline-flex items-center rounded-full border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-300">
        -
      </span>
    );
  }

  const key = SUBMISSION_STATUS_COLOR[status];
  const cls = COLOR_CLASS[key] ?? COLOR_CLASS.gray;

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${cls}`}>
      {SUBMISSION_STATUS_LABEL[status]}
    </span>
  );
}
