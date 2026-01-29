// PATH: src/features/results/api/wrongNotes.ts
import api from "@/shared/api/axios";

export type WrongNoteItem = {
  exam_id: number;
  attempt_id: number;

  // ✅ 보완: 백엔드 응답에 존재 (표시/정렬/attempt 비교 UX에 유용)
  attempt_created_at?: string | null;

  question_id: number;
  question_number?: number | null;

  // ✅ 보완: 객관식/주관식 구분 및 UI 분기용
  answer_type?: string;

  student_answer: string;
  correct_answer: string;

  // ✅ 보완: 백엔드가 내려주는 is_correct/메타 기반 UI 처리 가능
  is_correct?: boolean;

  score: number;
  max_score: number;

  // ✅ 핵심: bbox 하이라이트, invalid_reason(LOW_CONFIDENCE 등) 표시용
  meta?: any;

  // ✅ 확장 포인트 (해설/지문 등)
  extra?: any;
};

export type WrongNoteResponse = {
  count: number;
  next: number | null;
  prev: number | null;
  results: WrongNoteItem[];
};

export async function fetchWrongNotes(params: {
  enrollment_id: number;
  exam_id?: number;
  lecture_id?: number;
  from_session_order?: number;
  offset?: number;
  limit?: number;
}) {
  const res = await api.get("/results/wrong-notes", { params });
  return res.data as WrongNoteResponse;
}

export type WrongNotePDFCreateResponse = {
  job_id: number;
  status: string; // PENDING/RUNNING/DONE/FAILED
  status_url: string; // absolute url (backend provides)
};

export async function createWrongNotePDF(payload: {
  enrollment_id: number;
  exam_id?: number;
  lecture_id?: number;
  from_session_order?: number;
}) {
  const res = await api.post("/results/wrong-notes/pdf/", payload);
  return res.data as WrongNotePDFCreateResponse;
}

export type WrongNotePDFStatusResponse = {
  job_id: number;
  status: string; // PENDING/RUNNING/DONE/FAILED
  file_path: string;
  file_url: string | null;
  error_message: string;
  created_at: string;
  updated_at: string;
};

export async function fetchWrongNotePDFStatus(jobId: number) {
  // ✅ 보완: polling 전용 API
  const res = await api.get(`/results/wrong-notes/pdf/${jobId}/`);
  return res.data as WrongNotePDFStatusResponse;
}
