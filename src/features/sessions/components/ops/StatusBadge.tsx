/**
 * 상태 배지 — 시험/과제 상태 표시
 */
import type { ExamStatus } from "../../utils/examStatus";
import { EXAM_STATUS_LABEL, EXAM_STATUS_COLOR } from "../../utils/examStatus";

const badgeClass: Record<string, string> = {
  gray: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600",
  blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
  yellow: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700",
};

type Props = {
  status: ExamStatus;
  className?: string;
};

export function ExamStatusBadge({ status, className = "" }: Props) {
  const color = EXAM_STATUS_COLOR[status];
  const label = EXAM_STATUS_LABEL[status];
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${badgeClass[color]} ${className}`}
    >
      {label}
    </span>
  );
}

/** 과제 상태: DRAFT | OPEN | CLOSED */
const HW_LABEL: Record<string, string> = {
  DRAFT: "초안",
  OPEN: "진행중",
  CLOSED: "완료",
};
const HW_CLASS: Record<string, string> = {
  DRAFT: badgeClass.gray,
  OPEN: badgeClass.blue,
  CLOSED: badgeClass.green,
};

type HWProps = {
  status: string;
  className?: string;
};

export function HomeworkStatusBadge({ status, className = "" }: HWProps) {
  const label = HW_LABEL[status] ?? status;
  const c = HW_CLASS[status] ?? badgeClass.gray;
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${c} ${className}`}
    >
      {label}
    </span>
  );
}
