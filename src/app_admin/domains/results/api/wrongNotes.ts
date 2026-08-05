// PATH: src/app_admin/domains/results/api/wrongNotes.ts
import api from "@/shared/api/axios";
import type {
  WrongNoteListResponse as WrongNoteResponse,
  WrongNotePdfCreateResponse as WrongNotePDFCreateResponse,
  WrongNotePdfStatusResponse as WrongNotePDFStatusResponse,
} from "../types/results.types";

export const MAX_WRONG_NOTE_PDF_ITEMS = 100;
export const WRONG_NOTE_PDF_CREATE_TIMEOUT_MS = 30_000;

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
  to_session_order?: number;
  offset?: number;
  limit?: number;
}) {
  const res = await api.get("/results/wrong-notes", { params });
  return res.data as WrongNoteResponse;
}

export async function createWrongNotePDF(payload: {
  enrollment_id?: number;
  student_id?: number;
  source_selection?: WrongNoteSourceSelection[];
  exam_id?: number;
  lecture_id?: number;
  from_session_order?: number;
  to_session_order?: number;
  output_format?: "pdf" | "hwpx";
  source_fingerprint?: string;
}) {
  const res = await api.post("/results/wrong-notes/documents/", payload, {
    timeout: WRONG_NOTE_PDF_CREATE_TIMEOUT_MS,
  });
  return res.data as WrongNotePDFCreateResponse;
}

export type WrongNoteSourceSelection = {
  type: "exam" | "homework";
  id: number;
  enrollment_id: number;
};

export type WrongNoteSource = WrongNoteSourceSelection & {
  lecture_id: number;
  lecture_title: string;
  title: string;
  session_order: number | null;
  wrong_note_count: number;
  ready: boolean;
};

export async function fetchWrongNoteSources(studentId: number) {
  const res = await api.get("/results/wrong-notes/sources/", {
    params: { student_id: studentId },
  });
  return res.data as { student_id: number; sources: WrongNoteSource[] };
}

export async function previewSelectedWrongNotes(payload: {
  student_id: number;
  source_selection: WrongNoteSourceSelection[];
}) {
  const res = await api.post("/results/wrong-notes/preview/", payload);
  return res.data as WrongNoteResponse & { source_selection: WrongNoteSourceSelection[] };
}

export async function fetchWrongNotePDFStatus(jobId: number) {
  // ✅ 보완: polling 전용 API
  const res = await api.get(`/results/wrong-notes/documents/${jobId}/`);
  return res.data as WrongNotePDFStatusResponse;
}
