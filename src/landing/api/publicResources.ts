import api, { type ApiRequestConfig } from "@/shared/api/axios";

export type ResourceCategory = "matchup" | "analysis";
export interface ResourceFile { id: string; filename: string; extension: "pdf" | "hwp" | "hwpx"; size: number }
export interface ResourcePost {
  id: number; category: ResourceCategory; title: string; content: string;
  author_display_name: string; created_at: string; updated_at: string; files: ResourceFile[];
}
export interface ResourceWrite {
  request_id?: string; title: string; category: ResourceCategory; content: string; file_ids: string[];
}
export interface ResourcePage { count: number; results: ResourcePost[]; next: string | null }
const base = "/landing-public/resources/";

export async function listResources(category: ResourceCategory, page = 1): Promise<ResourcePage> {
  const { data } = await api.get<ResourcePage | ResourcePost[]>(base, { params: { category, page }, skipAuth: true } as ApiRequestConfig);
  return Array.isArray(data) ? { count: data.length, results: data, next: null } : data;
}
export async function getResource(id: string): Promise<ResourcePost> {
  return (await api.get<ResourcePost>(`${base}${id}/`, { skipAuth: true } as ApiRequestConfig)).data;
}
export async function resourceCapability(): Promise<boolean> {
  return (await api.get<{ can_publish: boolean }>(`${base}capabilities/`)).data.can_publish;
}
export async function uploadResource(file: File): Promise<ResourceFile> {
  const form = new FormData(); form.append("file", file);
  return (await api.post<ResourceFile>("/landing-public/uploads/resource/", form, { timeout: 120_000 })).data;
}
export async function discardResourceFile(id: string): Promise<void> {
  await api.delete(`/landing-public/resource-files/${id}/`);
}
export async function resourceFileLink(id: string): Promise<string> {
  return (await api.get<{ url: string }>(`/landing-public/resource-files/${id}/`, { skipAuth: true } as ApiRequestConfig)).data.url;
}
export async function saveResource(data: ResourceWrite, id?: string): Promise<ResourcePost> {
  return (id ? await api.patch<ResourcePost>(`${base}${id}/`, data) : await api.post<ResourcePost>(base, data)).data;
}
export async function deleteResource(id: number): Promise<void> { await api.delete(`${base}${id}/`); }

export function resourceError(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (typeof data === "object" && data !== null) {
    const values = Object.values(data).flat().filter((value): value is string => typeof value === "string");
    if (values.length) return values.slice(0, 3).join(" ");
  }
  return fallback;
}
export function resourceSize(size: number): string {
  return size < 1024 * 1024 ? `${Math.max(1, Math.ceil(size / 1024))}KB` : `${(size / (1024 * 1024)).toFixed(1)}MB`;
}
