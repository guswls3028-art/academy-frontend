export type AssessmentKind = "exam" | "homework";

const ASSESSMENT_QUERY_KEYS: Record<AssessmentKind, { primary: string; legacy: string }> = {
  exam: { primary: "examId", legacy: "exam_id" },
  homework: { primary: "homeworkId", legacy: "homework_id" },
};

function readPositiveNumber(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function readAssessmentItemId(
  searchParams: URLSearchParams,
  kind: AssessmentKind,
): number | null {
  const keys = ASSESSMENT_QUERY_KEYS[kind];
  return (
    readPositiveNumber(searchParams.get(keys.primary)) ??
    readPositiveNumber(searchParams.get(keys.legacy))
  );
}

export function buildAssessmentSearch(kind: AssessmentKind, id: number): string {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `?${ASSESSMENT_QUERY_KEYS[kind].primary}=${encodeURIComponent(String(n))}`;
}
