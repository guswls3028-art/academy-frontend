// PATH: src/app_admin/domains/landing/api/index.ts

import api from "@/shared/api/axios";
import type {
  LandingPublicResponse,
  LandingAdminResponse,
  LandingConfig,
  TemplateKey,
  TemplateMeta,
} from "../types";

/** 공개 랜딩 데이터 조회 (인증 불필요) */
export async function fetchLandingPublic(): Promise<LandingPublicResponse> {
  const { data } = await api.get("/core/landing/public/", { skipAuth: true } as any);
  return data;
}

/** 랜딩 게시 여부만 빠르게 확인 */
export async function fetchLandingHasPublished(): Promise<boolean> {
  const { data } = await api.get("/core/landing/has-published/", { skipAuth: true } as any);
  return data.has_published;
}

/** Admin: 전체 랜딩 설정 조회 */
export async function fetchLandingAdmin(): Promise<LandingAdminResponse> {
  const { data } = await api.get("/core/landing/admin/");
  return data;
}

/** Admin: draft 저장 */
export async function updateLandingDraft(params: {
  template_key?: TemplateKey;
  draft_config?: LandingConfig;
}): Promise<LandingAdminResponse> {
  const { data } = await api.put("/core/landing/admin/", params);
  return data;
}

/** Admin: 게시 */
export async function publishLanding(): Promise<{ is_published: boolean }> {
  const { data } = await api.post("/core/landing/publish/");
  return data;
}

/** Admin: 게시 중단 */
export async function unpublishLanding(): Promise<{ is_published: boolean }> {
  const { data } = await api.post("/core/landing/unpublish/");
  return data;
}

/** Admin: 이미지 업로드 */
export async function uploadLandingImage(
  file: File,
  field: "hero" | "logo"
): Promise<{ key: string; url: string; field: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("field", field);
  const { data } = await api.post("/core/landing/upload-image/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/** 템플릿 목록 조회 */
export async function fetchLandingTemplates(): Promise<TemplateMeta[]> {
  const { data } = await api.get("/core/landing/templates/", { skipAuth: true } as any);
  return data.templates;
}
