// PATH: src/app_student/domains/inventory/api/inventory.ts
// 학생 인벤토리 API — 학생 scope 전용, ps_number 기반 격리

import {
  fetchInventoryList,
  uploadFile,
  deleteFile,
  createFolder,
  deleteFolder,
  getPresignedUrl,
  type InventoryFile,
  type InventoryFolder,
  type InventoryListResponse,
} from "@admin/domains/storage/api/storage.api";

export type { InventoryFile, InventoryFolder, InventoryListResponse };

/** 내 인벤토리 목록 조회 */
export function fetchMyInventory(studentPs: string): Promise<InventoryListResponse> {
  return fetchInventoryList("student", studentPs);
}

/** 내 인벤토리에 파일 업로드 */
export function uploadMyFile(
  studentPs: string,
  file: File,
  opts?: { folderId?: string | null; displayName?: string; description?: string; icon?: string }
): Promise<InventoryFile> {
  return uploadFile({
    scope: "student",
    studentPs,
    folderId: opts?.folderId ?? null,
    displayName: opts?.displayName || file.name,
    description: opts?.description || "",
    icon: opts?.icon || inferIcon(file),
    file,
  });
}

/** 내 인벤토리 파일 삭제 */
export function deleteMyFile(studentPs: string, fileId: string): Promise<void> {
  return deleteFile("student", fileId, studentPs);
}

/** 내 인벤토리 폴더 생성 */
export function createMyFolder(
  studentPs: string,
  name: string,
  parentId?: string | null
): Promise<InventoryFolder> {
  return createFolder("student", parentId ?? null, name, studentPs);
}

/** 내 인벤토리 폴더 삭제 */
export function deleteMyFolder(studentPs: string, folderId: string): Promise<void> {
  return deleteFolder("student", folderId, studentPs);
}

/** presigned URL (다운로드/미리보기) */
export function getMyFileUrl(r2Key: string): Promise<{ url: string }> {
  return getPresignedUrl(r2Key);
}

/** 파일 타입에서 아이콘 추론 */
function inferIcon(file: File): string {
  const ct = file.type || "";
  if (ct.startsWith("video/")) return "video";
  if (ct.startsWith("image/")) return "image";
  if (ct.includes("pdf")) return "file-text";
  return "file-text";
}
