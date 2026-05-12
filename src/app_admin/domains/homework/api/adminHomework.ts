// PATH: src/app_admin/domains/homework/api/adminHomework.ts
import api from "@/shared/api/axios";

export type AdminHomeworkDetail = {
  id: number;
  session_id?: number;
  homework_type?: "template" | "regular";
  template_homework_id?: number | null;

  title: string;
  description?: string;

  status: "DRAFT" | "OPEN" | "CLOSED";

  /** Homework.meta JSON. default_max_score 등 추가 설정 보관. */
  meta?: Record<string, any> | null;
  /** meta.default_max_score 편의 접근자 */
  default_max_score?: number | null;

  created_at: string;
  updated_at: string;
};

function normalize(raw: any): AdminHomeworkDetail {
  const rawSession = raw?.session_id ?? raw?.session ?? raw?.sessionId;
  const meta = raw?.meta && typeof raw.meta === "object" ? raw.meta : null;
  const _dms = meta?.default_max_score;
  const defaultMaxScore = typeof _dms === "number" && _dms > 0 ? _dms : null;

  return {
    id: Number(raw?.id),
    session_id:
      typeof rawSession === "number" && rawSession > 0 ? rawSession : undefined,
    homework_type: raw?.homework_type ?? "regular",
    template_homework_id:
      raw?.template_homework != null ? Number(raw.template_homework) : raw?.template_homework_id ?? null,

    title: String(raw?.title ?? ""),
    description: raw?.description ?? undefined,

    status: (raw?.status ?? "OPEN") as any,

    meta,
    default_max_score: defaultMaxScore,

    created_at: String(raw?.created_at ?? ""),
    updated_at: String(raw?.updated_at ?? ""),
  };
}

export async function fetchAdminHomework(homeworkId: number) {
  const res = await api.get(`/homeworks/${homeworkId}/`);
  return normalize(res.data);
}

export async function updateAdminHomework(
  homeworkId: number,
  payload: Partial<AdminHomeworkDetail>
) {
  const res = await api.patch(`/homeworks/${homeworkId}/`, payload);
  return normalize(res.data);
}

/** POST /homeworks/<id>/save-as-template/ — 시험과 동일 */
export async function saveHomeworkAsTemplate(homeworkId: number) {
  const res = await api.post(`/homeworks/${homeworkId}/save-as-template/`);
  return res.data;
}

export type HomeworkTemplateWithUsage = {
  id: number;
  title: string;
  last_used_date: string | null;
  used_lectures: Array<{
    lecture_id: number;
    lecture_title: string;
    chip_label: string;
    color: string;
    last_used_date: string | null;
  }>;
};

export async function fetchHomeworkTemplatesWithUsage(): Promise<HomeworkTemplateWithUsage[]> {
  const res = await api.get("/homeworks/templates/with-usage/");
  return Array.isArray(res.data) ? res.data : [];
}
