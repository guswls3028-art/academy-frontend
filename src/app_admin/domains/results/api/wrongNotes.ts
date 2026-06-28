// PATH: src/app_admin/domains/results/api/wrongNotes.ts
import api from "@/shared/api/axios";
import type {
  WrongNoteListResponse as WrongNoteResponse,
  WrongNotePdfCreateResponse as WrongNotePDFCreateResponse,
  WrongNotePdfStatusResponse as WrongNotePDFStatusResponse,
} from "../types/results.types";

export type {
  WrongNoteItem,
  WrongNoteListResponse as WrongNoteResponse,
  WrongNotePdfCreateResponse as WrongNotePDFCreateResponse,
  WrongNotePdfStatusResponse as WrongNotePDFStatusResponse,
} from "../types/results.types";

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

export async function createWrongNotePDF(payload: {
  enrollment_id: number;
  exam_id?: number;
  lecture_id?: number;
  from_session_order?: number;
}) {
  const res = await api.post("/results/wrong-notes/pdf/", payload);
  return res.data as WrongNotePDFCreateResponse;
}

export async function fetchWrongNotePDFStatus(jobId: number) {
  // ✅ 보완: polling 전용 API
  const res = await api.get(`/results/wrong-notes/pdf/${jobId}/`);
  return res.data as WrongNotePDFStatusResponse;
}
