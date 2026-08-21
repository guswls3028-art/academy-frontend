import api from "@/shared/api/axios";

export type SegmentationReviewItem = {
  id: number;
  position: number;
  number: number;
  detected_number: number | null;
  page_index: number;
  included: boolean;
  engine: string;
  problem_crop_ratio: number;
  crop_adjustable: boolean;
  problem_image_url: string;
  explanation_text: string;
  explanation_image_url: string;
  source_render_mode: string;
  source_attachment_image_url: string;
  source_attachment_requires_review: boolean;
  has_teacher_explanation: boolean;
  answer: string;
  answer_source_image_url: string;
  answer_missing: boolean;
  explanation_missing: boolean;
};

export type SegmentationReview = {
  exam_id: number;
  status: string;
  source_filename: string;
  paired_source_status: "" | "complete" | "partial";
  source_issues: string[];
  answer_source_requested: boolean;
  explanation_source_requested: boolean;
  items: SegmentationReviewItem[];
};

export async function fetchSegmentationReview(examId: number) {
  const response = await api.get(`/exams/${examId}/segmentation-review/`);
  const data = response.data as Partial<SegmentationReview> & {
    items?: Array<Partial<SegmentationReviewItem>>;
  };
  return {
    ...data,
    exam_id: Number(data.exam_id ?? examId),
    status: String(data.status ?? ""),
    source_filename: String(data.source_filename ?? ""),
    paired_source_status: data.paired_source_status === "partial"
      ? "partial"
      : data.paired_source_status === "complete"
        ? "complete"
        : "",
    source_issues: Array.isArray(data.source_issues)
      ? data.source_issues.filter((issue): issue is string => typeof issue === "string")
      : [],
    answer_source_requested: data.answer_source_requested === true,
    explanation_source_requested: data.explanation_source_requested === true,
    items: (data.items ?? []).map((item) => ({
      ...item,
      id: Number(item.id),
      position: Number(item.position),
      number: Number(item.number),
      detected_number: item.detected_number == null ? null : Number(item.detected_number),
      page_index: Number(item.page_index ?? 0),
      included: item.included !== false,
      engine: String(item.engine ?? ""),
      problem_crop_ratio: Number(item.problem_crop_ratio ?? 1),
      crop_adjustable: item.crop_adjustable === true,
      problem_image_url: String(item.problem_image_url ?? ""),
      explanation_text: String(item.explanation_text ?? ""),
      explanation_image_url: String(item.explanation_image_url ?? ""),
      source_render_mode: String(item.source_render_mode ?? ""),
      source_attachment_image_url: String(item.source_attachment_image_url ?? ""),
      source_attachment_requires_review: item.source_attachment_requires_review === true,
      has_teacher_explanation: item.has_teacher_explanation === true,
      answer: String(item.answer ?? ""),
      answer_source_image_url: String(item.answer_source_image_url ?? ""),
      answer_missing: item.answer_missing === true,
      explanation_missing: item.explanation_missing === true,
    })),
  } satisfies SegmentationReview;
}

export async function approveSegmentationReview(
  examId: number,
  items: Array<{
    id: number;
    number: number;
    included: boolean;
    problem_crop_ratio?: number;
    explanation_variant?: "reconstructed" | "source_attachment";
    answer?: string;
  }>,
) {
  const response = await api.post(
    `/exams/${examId}/segmentation-review/approve/`,
    { items },
  );
  return response.data as { exam_id: number; status: string; total_questions: number };
}
