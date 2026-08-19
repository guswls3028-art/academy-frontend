import type { ClinicTarget } from "../../api/clinicTargets";

export function formatNextAttempt(latestIndex?: number): string {
  const next = (latestIndex ?? 1) + 1;
  return `${next}차`;
}

export function formatScoreDisplay(item: ClinicTarget): string {
  if (item.reason === "missing") {
    return item.source_type === "homework" ? "미제출" : "미응시";
  }
  const score = item.source_type === "homework" ? item.homework_score : item.exam_score;
  const cutline = item.source_type === "homework" ? item.homework_cutline : item.cutline_score;
  if (score == null) return "-";
  return `${score}/${cutline ?? "-"}`;
}
