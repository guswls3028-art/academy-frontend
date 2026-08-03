import api from "@/shared/api/axios";

export type SegmentationReviewItem = {
  id: number;
  position: number;
  number: number;
  detected_number: number | null;
  page_index: number;
  included: boolean;
  engine: string;
  problem_image_url: string;
  explanation_text: string;
  explanation_image_url: string;
  has_teacher_explanation: boolean;
};

export type SegmentationReview = {
  exam_id: number;
  status: string;
  source_filename: string;
  items: SegmentationReviewItem[];
};

export async function fetchSegmentationReview(examId: number) {
  const response = await api.get(`/exams/${examId}/segmentation-review/`);
  return response.data as SegmentationReview;
}

export async function approveSegmentationReview(
  examId: number,
  items: Array<{ id: number; number: number; included: boolean }>,
) {
  const response = await api.post(
    `/exams/${examId}/segmentation-review/approve/`,
    { items },
  );
  return response.data as { exam_id: number; status: string; total_questions: number };
}
