// PATH: src/app_admin/domains/storage/api/storage.api.ts
// Compatibility facade. Canonical storage/inventory API contract lives in shared.
export {
  createFolder,
  deleteFile,
  deleteFolder,
  fetchInventoryList,
  fetchStorageQuota,
  getPresignedUrl,
  moveInventoryItem,
  renameFile,
  renameFolder,
  uploadFile,
  type InventoryFile,
  type InventoryFileMatchupInfo,
  type InventoryFolder,
  type InventoryListResponse,
  type MoveConflictError,
  type MoveParams,
  type RecursiveDeleteResult,
  type StorageQuota,
  type UploadFilePayload,
  type UploadFileResponse,
} from "@/shared/api/contracts/storage";
