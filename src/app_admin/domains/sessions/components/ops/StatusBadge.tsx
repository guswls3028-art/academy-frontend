/**
 * 상태 배지 — 시험/과제 상태 표시 (DS Badge SSOT)
 */
import { Badge, type BadgeTone } from "@/shared/ui/ds";
import {
  ASSESSMENT_PHASE_LABEL,
  normalizeAssessmentPhaseStatus,
  type AssessmentPhaseStatus,
} from "@/shared/api/contracts/assessmentStatus";
import type { ExamStatus } from "../../utils/examStatus";
import { EXAM_STATUS_LABEL, EXAM_STATUS_COLOR } from "../../utils/examStatus";

const COLOR_TO_TONE: Record<string, BadgeTone> = {
  gray: "neutral",
  blue: "info",
  yellow: "warning",
  green: "success",
};

type Props = {
  status: ExamStatus;
  className?: string;
};

export function ExamStatusBadge({ status, className }: Props) {
  const color = EXAM_STATUS_COLOR[status];
  const label = EXAM_STATUS_LABEL[status];
  const tone = COLOR_TO_TONE[color] ?? "neutral";
  return (
    <Badge tone={tone} className={className}>
      {label}
    </Badge>
  );
}

const PHASE_TONE: Record<AssessmentPhaseStatus, BadgeTone> = {
  DRAFT: "neutral",
  OPEN: "info",
  CLOSED: "success",
};

type HWProps = {
  status: AssessmentPhaseStatus | string;
  className?: string;
};

export function HomeworkStatusBadge({ status, className }: HWProps) {
  const normalized = normalizeAssessmentPhaseStatus(status);
  const label = ASSESSMENT_PHASE_LABEL[normalized];
  const tone = PHASE_TONE[normalized] ?? "neutral";
  return (
    <Badge tone={tone} className={className}>
      {label}
    </Badge>
  );
}
