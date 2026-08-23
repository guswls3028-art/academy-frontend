import { patchAssessmentCorrection } from "@/shared/api/contracts/sessionScores";

import type { ClinicTarget } from "./clinicTargets";

type ManualHomeworkTarget = ClinicTarget & {
  clinic_link_id: number;
  session_id: number;
  enrollment_id: number;
  source_id: number;
  source_type: "homework";
  reason: "missing" | "score";
};

export function isPositiveClinicIdentifier(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function requiresManualHomeworkCompletion(target: ClinicTarget): boolean {
  return target.source_type === "homework" && (
    target.reason === "missing" ||
    (target.reason === "score" && target.homework_score == null)
  );
}

export function canCompleteManualHomework(target: ClinicTarget): target is ManualHomeworkTarget {
  return (
    isPositiveClinicIdentifier(target.clinic_link_id) &&
    isPositiveClinicIdentifier(target.session_id) &&
    isPositiveClinicIdentifier(target.enrollment_id) &&
    isPositiveClinicIdentifier(target.source_id) &&
    !target.resolved_at &&
    requiresManualHomeworkCompletion(target)
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
