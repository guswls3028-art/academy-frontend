import api, { type ApiRequestConfig } from "@/shared/api/axios";

export type ResourceCategory = "matchup" | "analysis";
export type ReaderStatus = "unprepared" | "pending" | "ready" | "failed" | "unsupported";
export interface ResourceFile { id: string; filename: string; extension: string; size: number; reader_status: ReaderStatus }
export type ReaderBlock = { kind: "paragraph" | "formula"; text: string } | { kind: "image"; url: string; width: number; height: number } | { kind: "table"; rows: ReaderBlock[][][] };
export interface ResourceReader { status: ReaderStatus; message?: string; mode?: "article" | "pages"; blocks?: ReaderBlock[]; pdf_url?: string; pages?: number }
export async function readResourceFile(id: string, preview = false): Promise<ResourceReader> {
  return (await api.get<ResourceReader>(`/landing-public/resource-files/${id}/reader/`, { skipAuth: !preview } as ApiRequestConfig)).data;
}
export async function prepareResourceReader(id: string): Promise<ResourceReader> {
  return (await api.post<ResourceReader>(`/landing-public/resource-files/${id}/reader/`)).data;
}
export interface ResourcePost {
  id: number; category: ResourceCategory; title: string; content: string;
  author_display_name: string; created_at: string; updated_at: string; files: ResourceFile[];
}
export interface ResourceWrite {
  request_id?: string; expected_updated_at?: string; title: string; category: ResourceCategory; content: string; file_ids: string[];
}
export interface ResourcePage { count: number; results: ResourcePost[]; next: string | null }
const base = "/landing-public/resources/";

export async function listResources(category?: ResourceCategory, page = 1): Promise<ResourcePage> {
  const { data } = await api.get<ResourcePage | ResourcePost[]>(base, { params: { category, page }, skipAuth: true } as ApiRequestConfig);
  return Array.isArray(data) ? { count: data.length, results: data, next: null } : data;
}
export async function getResource(id: string): Promise<ResourcePost> {
  return (await api.get<ResourcePost>(`${base}${id}/`, { skipAuth: true } as ApiRequestConfig)).data;
}
export async function resourceCapability(): Promise<boolean> {
  return (await api.get<{ can_publish: boolean }>(`${base}capabilities/`)).data.can_publish;
}
export async function uploadResource(file: File, onProgress?: (percent: number) => void): Promise<ResourceFile> {
  const form = new FormData(); form.append("file", file);
  return (await api.post<ResourceFile>("/landing-public/uploads/resource/", form, { timeout: 120_000, onUploadProgress: (event) => { if (event.total) onProgress?.(Math.round(event.loaded * 100 / event.total)); } })).data;
}
export async function discardResourceFile(id: string): Promise<void> {
  try { await api.delete(`/landing-public/resource-files/${id}/`); }
  catch (error) {
    // A lost delete response, or an already-published upload, leaves no pending
    // object available for cleanup. Never attempt to remove an attached original.
    if ((error as { response?: { status?: number } })?.response?.status !== 404) throw error;
  }
}
export async function resourceFileLink(id: string): Promise<string> {
  return (await api.get<{ url: string }>(`/landing-public/resource-files/${id}/`, { skipAuth: true } as ApiRequestConfig)).data.url;
}
export async function saveResource(data: ResourceWrite, id?: string): Promise<ResourcePost> {
  return (id ? await api.patch<ResourcePost>(`${base}${id}/`, data) : await api.post<ResourcePost>(base, data)).data;
}
export async function deleteResource(id: number): Promise<void> {
  try { await api.delete(`${base}${id}/`); }
  catch (error) {
    // The original DELETE may have completed before its response was lost.
    if ((error as { response?: { status?: number } })?.response?.status !== 404) throw error;
  }
}

export function resourceError(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (typeof data === "object" && data !== null) {
    if ("detail" in data && typeof data.detail === "string") return data.detail;
    const values = Object.values(data).flat().filter((value): value is string => typeof value === "string");
    if (values.length) return values.slice(0, 3).join(" ");
  }
  return fallback;
}
export function resourceSize(size: number): string {
  return size < 1024 * 1024 ? `${Math.max(1, Math.ceil(size / 1024))}KB` : `${(size / (1024 * 1024)).toFixed(1)}MB`;
}
