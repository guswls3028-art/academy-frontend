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
  config: Record<string, unknown> | null;
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
  config?: Record<string, unknown>;
};

export type BundleCreateInput = {
  name: string;
  description?: string;
  items: BundleItemInput[];
};

export type ApplyBundleResult = {
  created_exams: { id: number; title: string }[];
  created_homeworks: { id: number; title: string }[];
  skipped_items: {
    item_id: number;
    item_type: "exam" | "homework";
    reason: string;
  }[];
  total: number;
  enrolled_students: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringValue(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function toItemType(value: unknown): "exam" | "homework" {
  return value === "homework" ? "homework" : "exam";
}

function toRecordOrNull(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function listPayload(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.results)) return value.results;
  return [];
}

function normalizeBundleItem(value: unknown): BundleItem {
  const row = isRecord(value) ? value : {};
  return {
    id: toNumber(row.id),
    item_type: toItemType(row.item_type),
    exam_template: toNullableNumber(row.exam_template),
    homework_template: toNullableNumber(row.homework_template),
    title_override: toStringValue(row.title_override),
    display_order: toNumber(row.display_order),
    config: toRecordOrNull(row.config),
    template_title: toStringValue(row.template_title),
  };
}

function normalizeBundle(value: unknown): TemplateBundle {
  const row = isRecord(value) ? value : {};
  return {
    id: toNumber(row.id),
    name: toStringValue(row.name),
    description: toStringValue(row.description),
    items: listPayload(row.items).map(normalizeBundleItem),
    exam_count: toNumber(row.exam_count),
    homework_count: toNumber(row.homework_count),
    created_at: toStringValue(row.created_at),
    updated_at: toStringValue(row.updated_at),
  };
}

function normalizeAppliedItem(value: unknown): { id: number; title: string } {
  const row = isRecord(value) ? value : {};
  return {
    id: toNumber(row.id),
    title: toStringValue(row.title),
  };
}

function normalizeSkippedItem(value: unknown): ApplyBundleResult["skipped_items"][number] {
  const row = isRecord(value) ? value : {};
  return {
    item_id: toNumber(row.item_id),
    item_type: toItemType(row.item_type),
    reason: toStringValue(row.reason),
  };
}

function normalizeApplyBundleResult(value: unknown): ApplyBundleResult {
  const row = isRecord(value) ? value : {};
  return {
    created_exams: listPayload(row.created_exams).map(normalizeAppliedItem),
    created_homeworks: listPayload(row.created_homeworks).map(normalizeAppliedItem),
    skipped_items: listPayload(row.skipped_items).map(normalizeSkippedItem),
    total: toNumber(row.total),
    enrolled_students: toNumber(row.enrolled_students),
  };
}

export async function fetchBundles(): Promise<TemplateBundle[]> {
  const res = await api.get("/exams/bundles/");
  return listPayload(res.data).map(normalizeBundle);
}

export async function fetchBundle(id: number): Promise<TemplateBundle> {
  const res = await api.get(`/exams/bundles/${id}/`);
  return normalizeBundle(res.data);
}

export async function createBundle(data: BundleCreateInput): Promise<TemplateBundle> {
  const res = await api.post("/exams/bundles/", data);
  return normalizeBundle(res.data);
}

export async function updateBundle(id: number, data: BundleCreateInput): Promise<TemplateBundle> {
  const res = await api.put(`/exams/bundles/${id}/`, data);
  return normalizeBundle(res.data);
}

export async function deleteBundle(id: number): Promise<void> {
  await api.delete(`/exams/bundles/${id}/`);
}

export async function applyBundle(bundleId: number, sessionId: number): Promise<ApplyBundleResult> {
  const res = await api.post(`/exams/bundles/${bundleId}/apply/`, { session_id: sessionId });
  return normalizeApplyBundleResult(res.data);
}
