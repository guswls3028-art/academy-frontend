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

export function clinicTargetKey(target: ClinicTarget): string {
  if (isPositiveClinicIdentifier(target.clinic_link_id)) {
    return `link:${target.clinic_link_id}`;
  }
  return [
    "source",
    target.session_id ?? "none",
    target.enrollment_id ?? "none",
    target.source_type ?? target.clinic_reason ?? "unknown",
    target.source_id ?? target.exam_id ?? "none",
    target.created_at ?? "none",
  ].join(":");
}

export function requiresManualHomeworkCompletion(target: ClinicTarget): boolean {
  return target.source_type === "homework" && (
    target.reason === "missing" ||
    (target.reason === "score" && target.homework_score == null)
  );
}

export function isMissingExamTarget(target: ClinicTarget): boolean {
  return target.reason === "missing" && target.source_type === "exam";
}

export function canWaiveMissingExamWithoutLink(target: ClinicTarget): boolean {
  return (
    !target.resolved_at &&
    isMissingExamTarget(target) &&
    target.meta_status === "NOT_SUBMITTED" &&
    isPositiveClinicIdentifier(target.session_id) &&
    isPositiveClinicIdentifier(target.enrollment_id) &&
    isPositiveClinicIdentifier(target.exam_id) &&
    isPositiveClinicIdentifier(target.source_id) &&
    target.exam_id === target.source_id
  );
}

export function canWaiveMissingExam(target: ClinicTarget): boolean {
  return (
    !target.resolved_at &&
    isMissingExamTarget(target) &&
    (
      isPositiveClinicIdentifier(target.clinic_link_id) ||
      canWaiveMissingExamWithoutLink(target)
    )
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
