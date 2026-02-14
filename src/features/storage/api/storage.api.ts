// PATH: src/features/storage/api/storage.api.ts
// 저장소 API (멀티테넌트 인벤토리)

import api from "@/shared/api/axios";

export type StorageQuota = {
  usedBytes: number;
  limitBytes: number;
  plan: "lite" | "basic" | "premium";
};

export async function fetchStorageQuota(): Promise<StorageQuota> {
  try {
    const { data } = await api.get<StorageQuota>("/storage/quota/");
    return data;
  } catch {
    return { usedBytes: 0, limitBytes: 10 * 1e9, plan: "basic" };
  }
}

export type InventoryFolder = {
  id: string;
  name: string;
  parentId: string | null;
};

export type InventoryFile = {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon: string;
  folderId: string | null;
  sizeBytes: number;
  r2Key: string;
  contentType: string;
  createdAt: string;
};

export type InventoryListResponse = {
  folders: InventoryFolder[];
  files: InventoryFile[];
};

export async function fetchInventoryList(
  scope: "admin" | "student",
  studentPs?: string
): Promise<InventoryListResponse> {
  const params: Record<string, string> = { scope };
  if (studentPs) params.student_ps = studentPs;
  try {
    const { data } = await api.get<InventoryListResponse>("/storage/inventory/", { params });
    return data;
  } catch {
    return { folders: [], files: [] };
  }
}

export async function createFolder(
  scope: "admin" | "student",
  parentId: string | null,
  name: string,
  studentPs?: string
): Promise<InventoryFolder> {
  const body: Record<string, unknown> = { scope, parent_id: parentId, name };
  if (studentPs) body.student_ps = studentPs;
  const { data } = await api.post<InventoryFolder>("/storage/inventory/folders/", body);
  return data;
}

export type UploadFilePayload = {
  scope: "admin" | "student";
  folderId: string | null;
  displayName: string;
  description: string;
  icon: string;
  file: File;
  studentPs?: string;
};

export async function uploadFile(payload: UploadFilePayload): Promise<InventoryFile> {
  const form = new FormData();
  form.append("file", payload.file);
  form.append("display_name", payload.displayName);
  form.append("description", payload.description);
  form.append("icon", payload.icon);
  form.append("scope", payload.scope);
  if (payload.folderId) form.append("folder_id", payload.folderId);
  if (payload.studentPs) form.append("student_ps", payload.studentPs);

  const { data } = await api.post<InventoryFile>("/storage/inventory/upload/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteFile(scope: "admin" | "student", fileId: string, studentPs?: string): Promise<void> {
  const params: Record<string, string> = { scope };
  if (studentPs) params.student_ps = studentPs;
  await api.delete(`/storage/inventory/files/${fileId}/`, { params });
}

export async function deleteFolder(
  scope: "admin" | "student",
  folderId: string,
  studentPs?: string
): Promise<void> {
  const params: Record<string, string> = { scope };
  if (studentPs) params.student_ps = studentPs;
  await api.delete(`/storage/inventory/folders/${folderId}/`, { params });
}

export async function getPresignedUrl(r2Key: string, expiresIn?: number): Promise<{ url: string }> {
  const { data } = await api.post<{ url: string }>("/storage/inventory/presign/", {
    r2_key: r2Key,
    expires_in: expiresIn ?? 3600,
  });
  return data;
}
