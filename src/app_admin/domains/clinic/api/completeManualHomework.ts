import { patchAssessmentCorrection } from "@/shared/api/contracts/sessionScores";

import type { ClinicTarget } from "./clinicTargets";

type ManualHomeworkTarget = ClinicTarget & {
  clinic_link_id: number;
  session_id: number;
  enrollment_id: number;
  source_id: number;
  source_type: "homework";
  reason: "missing";
};

export function canCompleteManualHomework(target: ClinicTarget): target is ManualHomeworkTarget {
  return Boolean(
    target.clinic_link_id &&
    target.session_id &&
    target.enrollment_id &&
    target.source_id &&
    !target.resolved_at &&
    target.reason === "missing" &&
    target.source_type === "homework"
  );
}

export function completeManualHomework(target: ClinicTarget, memo: string) {
  const note = memo.trim();
  if (!canCompleteManualHomework(target) || note.length < 2) {
    throw new Error("homework_completion_target_invalid");
  }

  return patchAssessmentCorrection(target.session_id, {
    enrollment_id: target.enrollment_id,
    source_type: "homework",
    source_id: target.source_id,
    completed: true,
    note,
  });
}
