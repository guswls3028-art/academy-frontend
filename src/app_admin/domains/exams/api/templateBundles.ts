// PATH: src/app_admin/domains/exams/api/templateBundles.ts
// Template Bundle (시험/과제 묶음) API

import api from "@/shared/api/axios";

export type BundleItem = {
  id: number;
  item_type: "exam" | "homework";
  exam_template: number | null;
  homework_template: number | null;
  title_override: string;
  display_order: number;
  config: Record<string, any> | null;
  template_title: string;
};

export type TemplateBundle = {
  id: number;
  name: string;
  description: string;
  items: BundleItem[];
  exam_count: number;
  homework_count: number;
  created_at: string;
  updated_at: string;
};

export type BundleItemInput = {
  item_type: "exam" | "homework";
  exam_template_id?: number;
  homework_template_id?: number;
  title_override?: string;
  display_order?: number;
  config?: Record<string, any>;
};

export type BundleCreateInput = {
  name: string;
  description?: string;
  items: BundleItemInput[];
};

export type ApplyBundleResult = {
  created_exams: { id: number; title: string }[];
  created_homeworks: { id: number; title: string }[];
  total: number;
};

export async function fetchBundles(): Promise<TemplateBundle[]> {
  const res = await api.get("/exams/bundles/");
  return res.data?.results ?? res.data ?? [];
}

export async function fetchBundle(id: number): Promise<TemplateBundle> {
  const res = await api.get(`/exams/bundles/${id}/`);
  return res.data;
}

export async function createBundle(data: BundleCreateInput): Promise<TemplateBundle> {
  const res = await api.post("/exams/bundles/", data);
  return res.data;
}

export async function updateBundle(id: number, data: BundleCreateInput): Promise<TemplateBundle> {
  const res = await api.put(`/exams/bundles/${id}/`, data);
  return res.data;
}

export async function deleteBundle(id: number): Promise<void> {
  await api.delete(`/exams/bundles/${id}/`);
}

export async function applyBundle(bundleId: number, sessionId: number): Promise<ApplyBundleResult> {
  const res = await api.post(`/exams/bundles/${bundleId}/apply/`, { session_id: sessionId });
  return res.data;
}
