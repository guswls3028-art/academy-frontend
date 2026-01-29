// PATH: src/features/homework/api/adminHomework.ts
import api from "@/shared/api/axios";

export type AdminHomeworkDetail = {
  id: number;
  session_id?: number;

  title: string;
  description?: string;

  status: "DRAFT" | "OPEN" | "CLOSED";

  created_at: string;
  updated_at: string;
};

function normalize(raw: any): AdminHomeworkDetail {
  const rawSession = raw?.session_id ?? raw?.session ?? raw?.sessionId;

  return {
    id: Number(raw?.id),
    session_id:
      typeof rawSession === "number" && rawSession > 0 ? rawSession : undefined,

    title: String(raw?.title ?? ""),
    description: raw?.description ?? undefined,

    status: (raw?.status ?? "DRAFT") as any,

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
