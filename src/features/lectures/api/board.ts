// PATH: src/features/lectures/api/board.ts
import api from "@/shared/api/axios";

/**
 * ✅ Board 관련 API
 * /api/v1/interactions/*
 */
const PREFIX = "/interactions";

/* =========================
 * TYPES
 * ========================= */
export interface BoardCategory {
  id: number;
  lecture: number;
  name: string;
  order: number;
}

export interface BoardAttachment {
  id: number;
  post: number;
  file: string;
}

export interface BoardPost {
  id: number;
  lecture: number;
  category: number;
  title: string;
  content: string;
  created_by: number | null;
  created_at: string;
  attachments: BoardAttachment[];
}

export interface BoardReadStatus {
  id: number;
  post: number;
  enrollment: number;
  checked_at: string;
  student_name?: string;
}

/* =========================
 * UTILS
 * ========================= */
function unwrap<T>(data: any): T[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

/* =========================
 * CATEGORY
 * ========================= */
export async function fetchBoardCategories(
  lectureId: number
): Promise<BoardCategory[]> {
  const res = await api.get(`${PREFIX}/board-categories/`, {
    params: { lecture: lectureId },
  });
  return unwrap<BoardCategory>(res.data);
}

export async function createBoardCategory(payload: {
  lecture: number;
  name: string;
}): Promise<BoardCategory> {
  const res = await api.post(`${PREFIX}/board-categories/`, payload);
  return res.data;
}

/* =========================
 * POSTS
 * ========================= */
export async function fetchBoardPosts(params: {
  lecture: number;
  category?: number;
}): Promise<BoardPost[]> {
  const res = await api.get(`${PREFIX}/board-posts/`, { params });
  return unwrap<BoardPost>(res.data);
}

export async function createBoardPost(formData: FormData): Promise<BoardPost> {
  const res = await api.post(`${PREFIX}/board-posts/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

/* =========================
 * READ STATUS
 * ========================= */
export async function fetchBoardReadStatus(
  postId: number
): Promise<BoardReadStatus[]> {
  const res = await api.get(`${PREFIX}/board-read-status/`, {
    params: { post: postId },
  });
  return unwrap<BoardReadStatus>(res.data);
}
