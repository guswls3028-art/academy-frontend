import api, { type ApiRequestConfig } from "@/shared/api/axios";

export type PublicProblemReviewSnapshot = {
  schema_version?: string;
  metadata: {
    title?: string;
    school?: string;
    subject?: string;
    grade?: string;
    exam_name?: string;
    exam_date?: string;
    duration?: string;
    total_score?: string;
  };
  summary: {
    one_line?: string;
    character?: string;
    total_questions?: number;
    total_points?: string;
    student_burden?: string;
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
      label: string;
      question_numbers: string[];
      points: string;
      note: string;
    }>;
    grade_estimate_note?: string;
  };
  questions: Array<{
    number: number;
    source_number?: number;
    unit: string;
    answer: string;
    points: string;
    difficulty: string;
    key_point: string;
    trap: string;
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
};

export type ProblemReviewShowcaseCard = {
  id: number;
  title: string;
  description: string;
  status: "published" | "hidden";
  published_at: string | null;
  snapshot_at: string | null;
  view_count: number;
  pdf_url: string | null;
  metadata: PublicProblemReviewSnapshot["metadata"];
  summary: PublicProblemReviewSnapshot["summary"];
  difficulty: PublicProblemReviewSnapshot["difficulty"];
  snapshot?: PublicProblemReviewSnapshot;
};

const BASE = "/landing-public/problem-review-showcase";

function publicConfig(skipAuth = true): ApiRequestConfig | undefined {
  return skipAuth ? ({ skipAuth: true } as ApiRequestConfig) : undefined;
}

export async function fetchProblemReviewShowcaseList(opts?: { skipAuth?: boolean }) {
  const { data } = await api.get<{ results: ProblemReviewShowcaseCard[]; count: number }>(
    `${BASE}/`,
    publicConfig(opts?.skipAuth ?? true),
  );
  return data;
}

export async function fetchProblemReviewShowcaseDetail(id: number, opts?: { skipAuth?: boolean }) {
  const { data } = await api.get<ProblemReviewShowcaseCard>(
    `${BASE}/${id}/`,
    publicConfig(opts?.skipAuth ?? true),
  );
  try {
    const view = await api.post<{ view_count: number }>(
      `${BASE}/${id}/view/`,
      undefined,
      publicConfig(opts?.skipAuth ?? true),
    );
    return { ...data, view_count: view.data.view_count };
  } catch {
    return data;
  }
}
