import api, { type ApiRequestConfig } from "@/shared/api/axios";

export interface VideoContent { title: string; summary: string; category: "interview" | "lesson" | "news"; category_label?: string; format: "landscape" | "vertical" }
export interface VideoSource { youtube_video_id: string; canonical_url: string; source_title: string; channel_title: string; thumbnail_url: string }
export interface PublicVideo extends VideoSource, VideoContent { id: string; published_at: string }
export interface ManagedVideo extends VideoSource {
  id: string; draft_content: VideoContent; published_content: VideoContent | null;
  status: "draft" | "published" | "unpublished"; revision: number; metadata_ready: boolean;
}
export interface VideoPage<T> { count: number; results: T[]; next: string | null }
export interface VideoPresentation { title: string; description: string }
export interface VideoShowcase extends VideoPresentation { hero_video_id: string | null; revision: number }
export const defaultVideoPresentation: VideoPresentation = { title: "영상", description: "" };
const base = "/landing-public/videos/";
const publicRequest = { skipAuth: true } as ApiRequestConfig;
export const videoStatuses = { draft: "임시저장", published: "공개 중", unpublished: "비공개" };

export async function listVideos(page = 1) { return (await api.get<VideoPage<PublicVideo>>(base, { ...publicRequest, params: { page } })).data; }
export async function getVideo(id: string) { return (await api.get<PublicVideo>(`${base}${id}/`, publicRequest)).data; }
export async function getVideoShowcase() { return (await api.get<VideoPresentation & { hero: PublicVideo | null }>(`${base}showcase/`, publicRequest)).data; }
export async function getVideoHero() { return (await getVideoShowcase()).hero; }
export async function videoCapability() { return (await api.get<{ can_publish: boolean }>(`${base}capabilities/`)).data.can_publish; }
export async function resolveVideo(url: string) { return (await api.post<VideoSource & { format: VideoContent["format"] }>(`${base}resolve/`, { url })).data; }
export async function listManagedVideos(page = 1) { return (await api.get<VideoPage<ManagedVideo>>(`${base}manage/`, { params: { page } })).data; }
export async function getManagedVideo(id: string) { return (await api.get<ManagedVideo>(`${base}manage/${id}/`)).data; }
export async function getManagedShowcase() { return (await api.get<VideoShowcase>(`${base}manage/showcase/`)).data; }
export async function saveVideoPresentation(showcase: VideoShowcase, content: VideoPresentation) {
  return (await api.patch<VideoShowcase>(`${base}manage/showcase/`, { expected_revision: showcase.revision, ...content })).data;
}
export async function deleteVideo(row: ManagedVideo, showcase: VideoShowcase) {
  await api.delete(`${base}manage/${row.id}/`, { params: { expected_revision: row.revision, expected_showcase_revision: showcase.revision } });
}
export async function createVideo(url: string, request_id: string, draft_content: VideoContent) { return (await api.post<ManagedVideo>(`${base}manage/`, { url, request_id, draft_content })).data; }
export async function saveVideo(row: ManagedVideo, draft_content: VideoContent) { return (await api.patch<ManagedVideo>(`${base}manage/${row.id}/`, { expected_revision: row.revision, draft_content })).data; }
export async function publishVideo(row: ManagedVideo, showcase: VideoShowcase, set_as_hero: boolean, action: "publish" | "unpublish" = "publish") {
  return (await api.post<{ video: ManagedVideo; showcase_revision: number }>(`${base}manage/${row.id}/${action}/`, {
    expected_revision: row.revision, expected_showcase_revision: showcase.revision, set_as_hero,
  })).data;
}
