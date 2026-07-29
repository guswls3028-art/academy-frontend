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
  source_evidence?: number[];
  answer_check?: string;
  confidence?: "high" | "medium" | "low";
  review_status?: "teacher_review_required" | string;
  voice_profile_version?: number;
  quality_checks?: {
    has_answer: boolean;
    has_explanation: boolean;
    has_source_evidence: boolean;
    verbatim_similarity_risk: boolean;
  };
};

export type ProblemStudioGenerateResponse = {
  generation_engine: "ai" | "rule_fallback" | "source_transfer" | string;
  mode: ProblemStudioVariantMode | string;
  mode_label: string;
  variant_count: number;
  questions: ProblemStudioGeneratedQuestion[];
  source_files: ProblemStudioSourceFile[];
  warnings: string[];
  source_text_chars: number;
  review_required?: boolean;
  voice_profile?: {
    id: string;
    name: string;
    version: number;
    style_sample_count: number;
    reference_sample_count: number;
  } | null;
};

export type ProblemStudioJobCreateResponse = {
  job_id: string;
  status: string;
  source_files: ProblemStudioSourceFile[];
  warnings: string[];
  source_text_chars: number;
};

export type ProblemStudioTransferJobCreateResponse = ProblemStudioJobCreateResponse;

export type ProblemStudioJobStatusResponse = {
  job_id: string;
  status: string;
  error: string;
  result: ProblemStudioGenerateResponse | null;
};

export type ProblemStudioTransferJobResult = {
  download_url: string;
  filename: string;
  r2_key?: string;
  size_bytes: number;
  document_count: number;
  warning_count: number;
  review_file_count: number;
  structured_item_count: number;
  ocr_candidate_count: number;
  quality_level: string;
  structure_limit_reached?: boolean;
  sha256?: string;
  transcription_engine?: string;
  ai_transcribed_units?: number;
  fallback_ocr_units?: number;
  generated_explanation_count?: number;
  explanation_engine?: string;
  explanation_ai_calls?: number;
  detected_layout?: {
    mode: string;
    page_width_mm: number;
    page_height_mm: number;
    column_count: number;
    source_column_count: number;
    center_line: boolean;
    column_gap_mm: number;
    source_dimension_name?: string;
  };
  reconstruction_quality?: {
    gate: "benchmark_candidate" | "hybrid_review_required" | "source_review_required" | string;
    source_page_count: number;
    source_page_preserved_count: number;
    source_page_coverage: number;
    question_crop_count: number;
    question_crop_coverage: number;
    embedded_visual_question_count: number;
    visual_fragment_coverage: number;
    native_equations: boolean;
    teacher_review_required: boolean;
  };
};

export type ProblemStudioTransferJobStatusResponse = {
  job_id: string;
  job_type?: string;
  status: string;
  progress?: {
    percent?: number;
    step_index?: number;
    step_total?: number;
    step_name?: string;
    step_name_display?: string;
    step_percent?: number;
  } | null;
  result?: ProblemStudioTransferJobResult | null;
  error_message?: string | null;
  message?: string;
};

export type ProblemStudioHangulCompanionDownload = {
  download_url: string;
  filename: string;
  version: string;
  sha256: string;
  size_bytes: number;
};

export type ProblemStudioBuiltInFont = {
  key: string;
  label: string;
  family_name: string;
};

export type ProblemStudioFontAsset = {
  id: string;
  display_name: string;
  family_name: string;
  subfamily_name: string;
  full_name: string;
  original_name: string;
  file_format: "ttf" | "otf";
  size_bytes: number;
  sha256: string;
  supports_hangul: boolean;
  supports_latin: boolean;
  embedding_permission: "installable" | "editable" | "preview_print" | "restricted" | string;
  redistribution_allowed: boolean;
  license_basis: "purchased" | "free" | "academy" | "other";
  status: "ready" | "disabled";
  preview_url?: string;
};

export type ProblemStudioFontCatalog = {
  built_in_fonts: ProblemStudioBuiltInFont[];
  custom_fonts: ProblemStudioFontAsset[];
};

export type ProblemStudioDocumentStyle = {
  title_font: string;
  body_font: string;
  title_size_pt: number;
  body_size_pt: number;
  body_width_ratio_percent: number;
  body_letter_spacing_percent: number;
  line_spacing_percent: number;
  question_spacing_pt: number;
  match_source_style: boolean;
};

export type ProblemStudioPageLayout = {
  mode: "source" | "korean_two_column" | "single_column";
  margin_top_mm: number;
  margin_bottom_mm: number;
  margin_left_mm: number;
  margin_right_mm: number;
  column_gap_mm: number;
  center_line: boolean;
  center_line_style: "SOLID" | "DASH" | "DOT";
};

export type ProblemStudioVoiceSample = {
  id: string;
  usage_scope: "style" | "content_reference";
  origin:
    | "teacher_authored"
    | "approved_output"
    | "matchup_comment"
    | "publisher_reference"
    | "other_reference";
  source_label: string;
  problem_text: string;
  answer: string;
  explanation: string;
  rights_confirmed: boolean;
  created_at: string | null;
};

export type ProblemStudioVoiceProfile = {
  id: string;
  name: string;
  subject: string;
  style_instructions: string;
  is_default: boolean;
  status: "active" | "archived";
  version: number;
  style_sample_count: number;
  reference_sample_count: number;
  updated_at: string | null;
  samples?: ProblemStudioVoiceSample[];
};

export type ProblemStudioVariantMode = "copy" | "same-type" | "trap" | "concept";

export type ProblemStudioGeneratePayload = {
  title: string;
  class_name: string;
  subject: string;
  template_name: string;
  variant_mode: ProblemStudioVariantMode;
  variant_count: number;
  note_policy: string;
  use_ai: boolean;
  transfer_only?: boolean;
  ai_transcription?: boolean;
  auto_explanations?: boolean;
  learn_source_explanation_style?: boolean;
  source_style_rights_confirmed?: boolean;
  document_style?: ProblemStudioDocumentStyle;
  page_layout?: ProblemStudioPageLayout;
  voice_profile_id?: string;
  questions: Array<{
    prompt: string;
    choices: string;
    answer: string;
    explanation: string;
  }>;
};

export async function getProblemStudioVoiceProfiles(): Promise<ProblemStudioVoiceProfile[]> {
  const { data } = await api.get<{ profiles: ProblemStudioVoiceProfile[] }>(
    "/tools/problem-studio/voice-profiles/",
  );
  return data.profiles;
}

export async function createProblemStudioVoiceProfile(payload: {
  name: string;
  subject?: string;
  style_instructions?: string;
  is_default?: boolean;
}): Promise<ProblemStudioVoiceProfile> {
  const { data } = await api.post<ProblemStudioVoiceProfile>(
    "/tools/problem-studio/voice-profiles/",
    payload,
  );
  return data;
}

export async function addProblemStudioVoiceSample(
  profileId: string,
  payload: {
    usage_scope: "style" | "content_reference";
    origin: "teacher_authored" | "publisher_reference" | "other_reference";
    source_label?: string;
    problem_text?: string;
    answer?: string;
    explanation?: string;
    rights_confirmed: boolean;
    rights_note?: string;
  },
): Promise<{ sample: ProblemStudioVoiceSample; profile: ProblemStudioVoiceProfile; created: boolean }> {
  const { data } = await api.post<{
    sample: ProblemStudioVoiceSample;
    profile: ProblemStudioVoiceProfile;
    created: boolean;
  }>(
    `/tools/problem-studio/voice-profiles/${encodeURIComponent(profileId)}/samples/`,
    payload,
  );
  return data;
}

export async function reviewProblemStudioGeneration(
  jobId: string,
  payload: {
    question_index: number;
    outcome: "approved" | "edited" | "rejected";
    final_question: {
      prompt: string;
      choices: string[];
      answer: string;
      explanation: string;
    };
    feedback_note?: string;
    learn_from_this: boolean;
    rights_confirmed: boolean;
  },
): Promise<{
  review_id: string;
  created: boolean;
  learned: boolean;
  profile: ProblemStudioVoiceProfile;
}> {
  const { data } = await api.post(
    `/tools/problem-studio/jobs/${encodeURIComponent(jobId)}/reviews/`,
    payload,
  );
  return data;
}

export async function getProblemStudioFonts(): Promise<ProblemStudioFontCatalog> {
  const { data } = await api.get<ProblemStudioFontCatalog>("/tools/problem-studio/fonts/");
  return data;
}

export async function uploadProblemStudioFont(form: FormData): Promise<ProblemStudioFontAsset> {
  const { data } = await api.post<ProblemStudioFontAsset>(
    "/tools/problem-studio/fonts/",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120_000,
    },
  );
  return data;
}

export async function deleteProblemStudioFont(fontId: string): Promise<void> {
  await api.delete(`/tools/problem-studio/fonts/${encodeURIComponent(fontId)}/`);
}

export async function getProblemStudioDocumentStyle(): Promise<ProblemStudioDocumentStyle> {
  const { data } = await api.get<{ preference: ProblemStudioDocumentStyle }>(
    "/tools/problem-studio/document-style/",
  );
  return data.preference;
}

export async function saveProblemStudioDocumentStyle(
  style: ProblemStudioDocumentStyle,
): Promise<ProblemStudioDocumentStyle> {
  const { data } = await api.put<{ preference: ProblemStudioDocumentStyle }>(
    "/tools/problem-studio/document-style/",
    style,
  );
  return data.preference;
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

export async function createProblemStudioTransferJob(
  payload: ProblemStudioGeneratePayload,
  sourceFiles: File[],
): Promise<ProblemStudioTransferJobCreateResponse> {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  sourceFiles.forEach((file) => form.append("source_files", file));

  const { data } = await api.post<ProblemStudioTransferJobCreateResponse>(
    "/tools/problem-studio/transfer-jobs/",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120_000,
    },
  );
  return data;
}

function filenameFromDisposition(disposition: string | undefined): string | null {
  if (!disposition) return null;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ""));
    } catch {
      return utf8Match[1].trim().replace(/^"|"$/g, "");
    }
  }
  const plainMatch = /filename="?([^";]+)"?/i.exec(disposition);
  return plainMatch?.[1]?.trim() || null;
}

export async function downloadProblemStudioTransferPackage(
  payload: ProblemStudioGeneratePayload,
  sourceFiles: File[],
): Promise<{
  blob: Blob;
  filename: string;
  documentCount: number;
  warningCount: number;
  reviewFileCount: number;
  structuredItemCount: number;
  ocrCandidateCount: number;
  qualityLevel: string;
}> {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  sourceFiles.forEach((file) => form.append("source_files", file));

  const res = await api.post<Blob>(
    "/tools/problem-studio/transfer-document/",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      responseType: "blob",
      timeout: 900_000,
    },
  );
  const filename = filenameFromDisposition(res.headers["content-disposition"])
    || `${payload.title || "문제제작"}_원본이관.zip`;
  return {
    blob: res.data,
    filename,
    documentCount: Number(res.headers["x-problem-studio-document-count"] || 0),
    warningCount: Number(res.headers["x-problem-studio-warning-count"] || 0),
    reviewFileCount: Number(res.headers["x-problem-studio-review-file-count"] || 0),
    structuredItemCount: Number(res.headers["x-problem-studio-structured-item-count"] || 0),
    ocrCandidateCount: Number(res.headers["x-problem-studio-ocr-candidate-count"] || 0),
    qualityLevel: String(res.headers["x-problem-studio-quality-level"] || ""),
  };
}

export async function getProblemStudioJob(jobId: string): Promise<ProblemStudioJobStatusResponse> {
  const { data } = await api.get<ProblemStudioJobStatusResponse>(
    `/tools/problem-studio/jobs/${encodeURIComponent(jobId)}/`,
  );
  return data;
}

export async function getProblemStudioTransferJob(
  jobId: string,
): Promise<ProblemStudioTransferJobStatusResponse> {
  const { data } = await api.get<ProblemStudioTransferJobStatusResponse>(
    `/tools/problem-studio/transfer-jobs/${encodeURIComponent(jobId)}/`,
  );
  return data;
}

export async function createProblemStudioHangulHandoff(
  jobId: string,
): Promise<{ protocol_url: string; expires_in: number }> {
  const { data } = await api.post<{ protocol_url: string; expires_in: number }>(
    `/tools/problem-studio/transfer-jobs/${encodeURIComponent(jobId)}/hangul-handoff/`,
  );
  return data;
}

export async function getProblemStudioHangulCompanionDownload(): Promise<ProblemStudioHangulCompanionDownload> {
  const { data } = await api.get<ProblemStudioHangulCompanionDownload>(
    "/tools/problem-studio/hangul-companion/",
  );
  return data;
}
