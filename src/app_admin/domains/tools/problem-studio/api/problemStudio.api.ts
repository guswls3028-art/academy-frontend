import api from "@/shared/api/axios";

export type ProblemStudioSourceFile = {
  name: string;
  kind: string;
  sizeLabel: string;
  extractedChars: number;
  warning?: string | null;
};

export type ProblemStudioGeneratedQuestion = {
  prompt: string;
  choices: string[];
  answer: string;
  explanation: string;
  source_index?: number;
  variant_index?: number;
};

export type ProblemStudioGenerateResponse = {
  generation_engine: "ai" | "rule_fallback" | string;
  mode: string;
  mode_label: string;
  variant_count: number;
  questions: ProblemStudioGeneratedQuestion[];
  source_files: ProblemStudioSourceFile[];
  warnings: string[];
  source_text_chars: number;
};

export type ProblemStudioJobCreateResponse = {
  job_id: string;
  status: string;
  source_files: ProblemStudioSourceFile[];
  warnings: string[];
  source_text_chars: number;
};

export type ProblemStudioJobStatusResponse = {
  job_id: string;
  status: string;
  error: string;
  result: ProblemStudioGenerateResponse | null;
};

export type ProblemStudioGeneratePayload = {
  title: string;
  class_name: string;
  subject: string;
  template_name: string;
  variant_mode: string;
  variant_count: number;
  note_policy: string;
  use_ai: boolean;
  transfer_only?: boolean;
  questions: Array<{
    prompt: string;
    choices: string;
    answer: string;
    explanation: string;
  }>;
};

export async function generateProblemStudioDraft(
  payload: ProblemStudioGeneratePayload,
  sourceFiles: File[],
): Promise<ProblemStudioGenerateResponse> {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  sourceFiles.forEach((file) => form.append("source_files", file));

  const { data } = await api.post<ProblemStudioGenerateResponse>(
    "/tools/problem-studio/generate/",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120_000,
    },
  );
  return data;
}

export async function createProblemStudioJob(
  payload: ProblemStudioGeneratePayload,
  sourceFiles: File[],
): Promise<ProblemStudioJobCreateResponse> {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  sourceFiles.forEach((file) => form.append("source_files", file));

  const { data } = await api.post<ProblemStudioJobCreateResponse>(
    "/tools/problem-studio/jobs/",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120_000,
    },
  );
  return data;
}

export async function getProblemStudioJob(jobId: string): Promise<ProblemStudioJobStatusResponse> {
  const { data } = await api.get<ProblemStudioJobStatusResponse>(
    `/tools/problem-studio/jobs/${encodeURIComponent(jobId)}/`,
  );
  return data;
}
