// PATH: src/features/homework/api/homeworks.ts
/**
 * Homework List/Create API
 *
 * ✅ 목표
 * - SessionAssessmentSidePanel(세션 공용탭)에서 생성/삭제/선택 흐름을 시험과 동일하게 유지
 * - 백엔드 endpoint/필드명이 약간 달라도 프론트가 흡수 (session vs session_id)
 */

import api from "@/shared/api/axios";

export type HomeworkListItem = {
  id: number;
  title: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  session_id?: number;
};

function normalizeListItem(raw: any): HomeworkListItem {
  const sid = raw?.session_id ?? raw?.session ?? raw?.sessionId;

  return {
    id: Number(raw?.id),
    title: String(raw?.title ?? ""),
    status: (raw?.status ?? "OPEN") as any,
    session_id: typeof sid === "number" && sid > 0 ? sid : undefined,
  };
}

export async function fetchHomeworks(params?: { session_id?: number }) {
  const res = await api.get("/homeworks/", { params });
  const d = res.data;

  const list = Array.isArray(d?.results)
    ? d.results
    : Array.isArray(d?.items)
    ? d.items
    : Array.isArray(d)
    ? d
    : [];

  return list.map(normalizeListItem);
}

/**
 * ✅ POST /homeworks/
 * - 상태는 서버 기본값(DRAFT) 사용.
 * - template_homework_id 있으면 해당 템플릿을 불러와 이 차시에 적용.
 */
export async function createHomework(payload: {
  session_id: number;
  title: string;
  template_homework_id?: number;
}) {
  const res = await api.post("/homeworks/", {
    session_id: payload.session_id,
    session: payload.session_id,
    title: payload.title,
    ...(payload.template_homework_id != null ? { template_homework_id: payload.template_homework_id } : {}),
  });

  return res.data;
}

/**
 * ✅ DELETE /homeworks/{id}/
 */
export async function deleteHomework(homeworkId: number) {
  const res = await api.delete(`/homeworks/${homeworkId}/`);
  return res.data;
}
