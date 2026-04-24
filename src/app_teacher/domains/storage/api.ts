// PATH: src/app_teacher/domains/storage/api.ts
// 자료실 API — 데스크톱 admin API 경로 그대로 재사용
export {
  type StorageQuota,
  type InventoryFolder,
  type InventoryFile,
  type InventoryListResponse,
  type UploadFilePayload,
  fetchStorageQuota,
  fetchInventoryList,
  createFolder,
  uploadFile,
  deleteFile,
  deleteFolder,
  renameFolder,
  renameFile,
  getPresignedUrl,
} from "@admin/domains/storage/api/storage.api";
