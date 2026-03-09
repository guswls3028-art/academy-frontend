import api from "@/shared/api/axios";

export type TemplateWithUsage = {
  id: number;
  title: string;
  subject: string;
  used_lectures: { lecture_id: number; lecture_title: string }[];
};

export async function fetchTemplatesWithUsage(): Promise<TemplateWithUsage[]> {
  const res = await api.get(`/exams/templates/with-usage/`);
  const data = res.data;
  return Array.isArray(data) ? (data as TemplateWithUsage[]) : [];
}

