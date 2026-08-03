import api from "@/shared/api/axios";

export const STUDENT_GRADE_REPORT_SECTION_IDS = [
  "score_trend",
  "score_comparison",
  "lecture_average",
  "improvement_priority",
  "exam_summary",
  "rank_position",
  "weakest_lecture",
  "homework_summary",
] as const;

export type StudentGradeReportSectionId = typeof STUDENT_GRADE_REPORT_SECTION_IDS[number];
export type StudentGradeReportSection = {
  id: StudentGradeReportSectionId;
  visible: boolean;
};
export const STUDENT_GRADE_REPORT_SCORE_COMPARISON_METRIC_IDS = [
  "average_score",
  "pass_rate",
  "status",
] as const;
export type StudentGradeReportScoreComparisonMetricId =
  typeof STUDENT_GRADE_REPORT_SCORE_COMPARISON_METRIC_IDS[number];
export type StudentGradeReportLayout = {
  version: 2;
  sections: StudentGradeReportSection[];
  score_comparison_metrics: Record<StudentGradeReportScoreComparisonMetricId, boolean>;
};

export const STUDENT_GRADE_REPORT_ANALYTICS_SECTION_IDS: readonly StudentGradeReportSectionId[] = [
  "score_comparison",
  "lecture_average",
  "improvement_priority",
];

const SECTION_ID_SET = new Set<string>(STUDENT_GRADE_REPORT_SECTION_IDS);

export function defaultStudentGradeReportLayout(): StudentGradeReportLayout {
  return {
    version: 2,
    sections: STUDENT_GRADE_REPORT_SECTION_IDS.map((id) => ({ id, visible: true })),
    score_comparison_metrics: {
      average_score: true,
      pass_rate: true,
      status: true,
    },
  };
}

export function normalizeStudentGradeReportLayout(value: unknown): StudentGradeReportLayout {
  const defaults = defaultStudentGradeReportLayout();
  if (!value || typeof value !== "object" || !Array.isArray((value as { sections?: unknown }).sections)) {
    return defaults;
  }

  const seen = new Set<StudentGradeReportSectionId>();
  const sections: StudentGradeReportSection[] = [];
  for (const raw of (value as { sections: unknown[] }).sections) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as { id?: unknown; visible?: unknown };
    if (typeof candidate.id !== "string" || !SECTION_ID_SET.has(candidate.id)) continue;
    const id = candidate.id as StudentGradeReportSectionId;
    if (seen.has(id)) continue;
    seen.add(id);
    sections.push({ id, visible: candidate.visible !== false });
  }

  for (const section of defaults.sections) {
    if (!seen.has(section.id)) sections.push(section);
  }
  const rawMetrics = (value as { score_comparison_metrics?: unknown }).score_comparison_metrics;
  const scoreComparisonMetrics = { ...defaults.score_comparison_metrics };
  if (rawMetrics && typeof rawMetrics === "object") {
    for (const id of STUDENT_GRADE_REPORT_SCORE_COMPARISON_METRIC_IDS) {
      scoreComparisonMetrics[id] = (rawMetrics as Record<string, unknown>)[id] !== false;
    }
  }
  return {
    version: 2,
    sections,
    score_comparison_metrics: scoreComparisonMetrics,
  };
}

export async function fetchStudentGradeReportLayout(): Promise<StudentGradeReportLayout> {
  const { data } = await api.get<StudentGradeReportLayout>("/core/student-grade-report-layout/");
  return normalizeStudentGradeReportLayout(data);
}

export async function updateStudentGradeReportLayout(
  layout: StudentGradeReportLayout,
): Promise<StudentGradeReportLayout> {
  const { data } = await api.patch<StudentGradeReportLayout>(
    "/core/student-grade-report-layout/",
    layout,
  );
  return normalizeStudentGradeReportLayout(data);
}
