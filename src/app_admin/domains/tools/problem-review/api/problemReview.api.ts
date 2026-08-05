import api from "@/shared/api/axios";

export type ProblemReviewDifficulty = "하" | "중" | "중상" | "상" | "최상" | "검수 필요";

export type ProblemReviewMetadata = {
  title: string;
  school: string;
  subject: string;
  grade: string;
  exam_name: string;
  exam_date: string;
  duration: string;
  total_score: string;
  instructor_name: string;
  audience: string;
};

export type ProblemReviewDraft = {
  schema_version: string;
  metadata: ProblemReviewMetadata;
  summary: {
    one_line: string;
    character: string;
    total_questions: number;
    total_points: string;
    student_burden: string;
  };
  assessment_axes: Array<{ title: string; description: string }>;
  domains: Array<{
    name: string;
    question_numbers: string[];
    points: string;
    ratio: string;
    insight: string;
  }>;
  difficulty: {
    distribution: Array<{
      label: ProblemReviewDifficulty;
      question_numbers: string[];
      points: string;
      note: string;
    }>;
    grade_estimate_note: string;
  };
  questions: Array<{
    number: number;
    source_number: number;
    unit: string;
    answer: string;
    points: string;
    difficulty: ProblemReviewDifficulty;
    key_point: string;
    trap: string;
    validity: string;
    review_note: string;
    source_excerpt: string;
    confidence: "high" | "medium" | "low";
  }>;
  key_items: Array<{
    rank: number;
    title: string;
    question_numbers: string[];
    reason: string;
    collapse_point: string;
    prescription: string;
  }>;
  failure_patterns: Array<{
    title: string;
    symptom: string;
    cause: string;
    prescription: string;
  }>;
  parent_guidance: { avoid: string[]; recommended: string[] };
  conclusion: { headline: string; actions: string[] };
  warnings: string[];
};

export type ProblemReviewReport = {
  id: string;
  status: "analyzing" | "draft" | "failed" | string;
  title: string;
  source_name: string;
  source_summary: {
    file_count?: number;
    question_count?: number;
    files?: Array<{ name: string; size_bytes: number }>;
    warnings?: string[];
  };
  version: number;
  last_error: string;
  draft?: ProblemReviewDraft;
  created_at: string;
  updated_at: string;
};

export type ProblemReviewExportStatus = {
  job_id: string;
  status: string;
  progress?: { percent?: number; step_name_display?: string } | null;
  result?: { download_url: string; filename: string; size_bytes: number; output_format: string } | null;
  error_message?: string | null;
};

export type ProblemReviewPublication = {
  id: number;
  title: string;
  status: "published";
  published_at: string;
  public_url: string;
  pdf_url: string;
};

export async function listProblemReviewReports(): Promise<ProblemReviewReport[]> {
  const { data } = await api.get<{ reports: ProblemReviewReport[] }>(
    "/tools/problem-review/reports/",
  );
  return data.reports;
}

export async function createProblemReviewReport(
  metadata: Partial<ProblemReviewMetadata>,
  sourceFiles: File[],
): Promise<ProblemReviewReport> {
  const form = new FormData();
  form.append("metadata", JSON.stringify(metadata));
  form.append("external_ai_confirmed", "true");
  sourceFiles.forEach((file) => form.append("source_files", file));
  const { data } = await api.post<ProblemReviewReport>(
    "/tools/problem-review/reports/",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120_000,
    },
  );
  return data;
}

export async function getProblemReviewReport(reportId: string): Promise<ProblemReviewReport> {
  const { data } = await api.get<ProblemReviewReport>(
    `/tools/problem-review/reports/${encodeURIComponent(reportId)}/`,
  );
  return data;
}

export async function saveProblemReviewReport(
  reportId: string,
  payload: { version: number; title: string; draft: ProblemReviewDraft },
): Promise<ProblemReviewReport> {
  const { data } = await api.patch<ProblemReviewReport>(
    `/tools/problem-review/reports/${encodeURIComponent(reportId)}/`,
    payload,
  );
  return data;
}

export async function createProblemReviewExport(
  reportId: string,
  outputFormat: "pdf" | "pptx",
): Promise<{ job_id: string; status: string; output_format: string }> {
  const { data } = await api.post(
    `/tools/problem-review/reports/${encodeURIComponent(reportId)}/exports/`,
    { output_format: outputFormat },
  );
  return data;
}

export async function getProblemReviewExport(
  reportId: string,
  jobId: string,
): Promise<ProblemReviewExportStatus> {
  const { data } = await api.get<ProblemReviewExportStatus>(
    `/tools/problem-review/reports/${encodeURIComponent(reportId)}/exports/${encodeURIComponent(jobId)}/`,
  );
  return data;
}

export async function publishProblemReviewReport(
  reportId: string,
  version: number,
): Promise<ProblemReviewPublication> {
  const { data } = await api.post<ProblemReviewPublication>(
    `/tools/problem-review/reports/${encodeURIComponent(reportId)}/publication/`,
    { version },
  );
  return data;
}
