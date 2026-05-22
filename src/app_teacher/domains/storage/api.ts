// PATH: src/app_teacher/domains/storage/api.ts
// 자료실 API — shared storage contract facade
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
} from "@/shared/api/contracts/storage";
