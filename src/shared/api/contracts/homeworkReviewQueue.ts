import api from "@/shared/api/axios";

export type HomeworkReviewItem = {
  homework_id: number; enrollment_id: number; student_name: string; homework_title: string;
  lecture_title: string; session_title: string; file_count: number; submitted_at: string;
};
type ReviewPage = { count: number; page: number; pages: number; results: HomeworkReviewItem[] };

export async function fetchHomeworkReviewQueue(page: number, signal: AbortSignal): Promise<ReviewPage> {
  const { data } = await api.get<ReviewPage>("/submissions/submissions/homework/review-queue/", {
    params: { page, page_size: 30 }, signal,
  });
  if (!Number.isInteger(data?.count) || data.count < 0 || !Number.isInteger(data.page) || data.page < 1
    || !Number.isInteger(data.pages) || data.pages < data.page || !Array.isArray(data.results)
    || !data.results.every(row => row?.homework_id > 0 && row.enrollment_id > 0 && typeof row.student_name === "string"
      && Number.isFinite(Date.parse(row.submitted_at)))) {
    throw new Error("제출 목록을 확인할 수 없습니다.");
  }
  return data;
}
