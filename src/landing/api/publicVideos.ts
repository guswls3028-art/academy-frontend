import api, { type ApiRequestConfig } from "@/shared/api/axios";

export interface VideoContent { title: string; summary: string; category: "interview" | "lesson" | "news"; format: "landscape" | "vertical" }
export interface VideoSource { youtube_video_id: string; canonical_url: string; source_title: string; channel_title: string; thumbnail_url: string }
export interface PublicVideo extends VideoSource, VideoContent { id: string; published_at: string }
export interface ManagedVideo extends VideoSource {
  id: string; draft_content: VideoContent; published_content: VideoContent | null;
  status: "draft" | "published" | "unpublished"; revision: number; metadata_ready: boolean;
}
export interface VideoPage<T> { count: number; results: T[]; next: string | null }
export interface VideoShowcase { hero_video_id: string | null; revision: number }
const base = "/landing-public/videos/";
const publicRequest = { skipAuth: true } as ApiRequestConfig;
export const videoCategories = { interview: "인터뷰", lesson: "과학 이야기", news: "신민T의 일상" };
export const videoStatuses = { draft: "임시저장", published: "공개 중", unpublished: "비공개" };

export async function listVideos(page = 1) { return (await api.get<VideoPage<PublicVideo>>(base, { ...publicRequest, params: { page } })).data; }
export async function getVideo(id: string) { return (await api.get<PublicVideo>(`${base}${id}/`, publicRequest)).data; }
export async function getVideoHero() { return (await api.get<{ hero: PublicVideo | null }>(`${base}showcase/`, publicRequest)).data.hero; }
export async function videoCapability() { return (await api.get<{ can_publish: boolean }>(`${base}capabilities/`)).data.can_publish; }
export async function resolveVideo(url: string) { return (await api.post<VideoSource & { format: VideoContent["format"] }>(`${base}resolve/`, { url })).data; }
export async function listManagedVideos(page = 1) { return (await api.get<VideoPage<ManagedVideo>>(`${base}manage/`, { params: { page } })).data; }
export async function getManagedVideo(id: string) { return (await api.get<ManagedVideo>(`${base}manage/${id}/`)).data; }
export async function getManagedShowcase() { return (await api.get<VideoShowcase>(`${base}manage/showcase/`)).data; }
export async function createVideo(url: string, request_id: string, draft_content: VideoContent) { return (await api.post<ManagedVideo>(`${base}manage/`, { url, request_id, draft_content })).data; }
export async function saveVideo(row: ManagedVideo, draft_content: VideoContent) { return (await api.patch<ManagedVideo>(`${base}manage/${row.id}/`, { expected_revision: row.revision, draft_content })).data; }
export async function publishVideo(row: ManagedVideo, showcase: VideoShowcase, set_as_hero: boolean, action: "publish" | "unpublish" = "publish") {
  return (await api.post<{ video: ManagedVideo; showcase_revision: number }>(`${base}manage/${row.id}/${action}/`, {
    expected_revision: row.revision, expected_showcase_revision: showcase.revision, set_as_hero,
  })).data;
}
