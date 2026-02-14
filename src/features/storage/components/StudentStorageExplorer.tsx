// PATH: src/features/storage/components/StudentStorageExplorer.tsx
// 학생 인벤토리 — 동일한 파일 탐색기 UI, scope=student

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, FileText, Image, FilePlus, FolderPlus } from "lucide-react";
import { Button, CloseButton } from "@/shared/ui/ds";
import {
  fetchInventoryList,
  createFolder,
  uploadFile,
  deleteFolder,
  deleteFile,
  getPresignedUrl,
  moveInventoryItem,
  type InventoryFolder,
  type InventoryFile,
  type MoveConflictError,
} from "../api/storage.api";
import Breadcrumb from "./Breadcrumb";
import FolderTree from "./FolderTree";
import UploadModal from "./UploadModal";
import MoveDuplicateModal from "./MoveDuplicateModal";
import styles from "./MyStorageExplorer.module.css";

const DRAG_TYPE = "application/x-storage-move";

function getDragPayload(e: React.DragEvent): { type: "file" | "folder"; sourceId: string } | null {
  try {
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    return raw ? (JSON.parse(raw) as { type: "file" | "folder"; sourceId: string }) : null;
  } catch {
    return null;
  }
}

const SCOPE = "student" as const;

type StudentStorageExplorerProps = {
  studentPs: string;
};

export default function StudentStorageExplorer({ studentPs }: StudentStorageExplorerProps) {
  const qc = useQueryClient();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [addChoiceOpen, setAddChoiceOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [movingId, setMovingId] = useState<string | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{
    type: "file" | "folder";
    sourceId: string;
    targetFolderId: string | null;
    existingName: string;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["storage-inventory", SCOPE, studentPs],
    queryFn: () => fetchInventoryList(SCOPE, studentPs),
  });

  const folders = data?.folders ?? [];
  const files = data?.files ?? [];
  const subFolders = folders.filter((f) => f.parentId === currentFolderId);
  const subFiles = files.filter((f) => (f.folderId ?? null) === currentFolderId);
  const breadcrumbPath = useBreadcrumbPath(folders, currentFolderId);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;
    try {
      await createFolder(SCOPE, currentFolderId, newFolderName.trim(), studentPs);
      qc.invalidateQueries({ queryKey: ["storage-inventory", SCOPE, studentPs] });
      setNewFolderName("");
      setNewFolderOpen(false);
    } catch (e) {
      alert((e as Error).message);
    }
  }, [currentFolderId, newFolderName, studentPs, qc]);

  const handleUpload = useCallback(
    async (payload: { displayName: string; description: string; icon: string; file: File }) => {
      try {
        await uploadFile({
          scope: SCOPE,
          folderId: currentFolderId,
          displayName: payload.displayName,
          description: payload.description,
          icon: payload.icon,
          file: payload.file,
          studentPs,
        });
        qc.invalidateQueries({ queryKey: ["storage-inventory", SCOPE, studentPs] });
        setUploadModalOpen(false);
      } catch (e) {
        alert((e as Error).message);
      }
    },
    [currentFolderId, studentPs, qc]
  );

  const handleDeleteSelected = useCallback(async () => {
    for (const id of selectedFolderIds) {
      try {
        await deleteFolder(SCOPE, id, studentPs);
      } catch (e) {
        alert((e as Error).message);
        return;
      }
    }
    if (selectedFileId) {
      try {
        await deleteFile(SCOPE, selectedFileId, studentPs);
      } catch (e) {
        alert((e as Error).message);
        return;
      }
    }
    qc.invalidateQueries({ queryKey: ["storage-inventory", SCOPE, studentPs] });
    setSelectedFolderIds(new Set());
    setSelectedFileId(null);
  }, [selectedFolderIds, selectedFileId, studentPs, qc]);

  const hasSelection = selectedFolderIds.size > 0 || selectedFileId != null;

  const openFileUrl = async (r2Key: string) => {
    try {
      const { url } = await getPresignedUrl(r2Key);
      if (url) window.open(url, "_blank");
    } catch {
      window.open(r2Key, "_blank");
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <Breadcrumb path={breadcrumbPath} onSelect={setCurrentFolderId} />
        <div className={styles.actions}>
          <div className={styles.addWrap}>
            <Button type="button" intent="primary" size="sm" onClick={() => setAddChoiceOpen(true)}>
              <FilePlus size={16} style={{ marginRight: 6 }} />
              추가
            </Button>
            {addChoiceOpen && (
              <>
                <div className={styles.addBackdrop} onClick={() => setAddChoiceOpen(false)} />
                <div className={styles.addMenu}>
                  <button type="button" onClick={() => setAddChoiceOpen(false) || setNewFolderOpen(true)}>
                    <FolderPlus size={18} /> 폴더 생성
                  </button>
                  <button type="button" onClick={() => setAddChoiceOpen(false) || setUploadModalOpen(true)}>
                    <FilePlus size={18} /> 파일 업로드
                  </button>
                </div>
              </>
            )}
          </div>
          {hasSelection && (
            <Button type="button" intent="danger" size="sm" onClick={handleDeleteSelected}>
              삭제
            </Button>
          )}
        </div>
      </div>

      <div className={styles.body}>
        <aside className={styles.tree}>
          <FolderTree
            folders={folders}
            currentFolderId={currentFolderId}
            onSelect={setCurrentFolderId}
          />
        </aside>
        <div className={styles.gridWrap}>
          {isLoading ? (
            <div className={styles.placeholder}>로딩 중...</div>
          ) : (
            <div className={styles.grid}>
              <div
                className={styles.item + " " + styles.itemAdd}
                onClick={() => setAddChoiceOpen(true)}
                title="폴더 또는 파일 추가"
              >
                <FilePlus size={32} />
                <span>추가</span>
              </div>
              {subFolders.map((f) => (
                <div
                  key={f.id}
                  className={
                    styles.item +
                    (selectedFolderIds.has(f.id) ? " " + styles.itemSelected : "")
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFolderIds((prev) => new Set(prev).add(f.id));
                    setSelectedFileId(null);
                  }}
                  onDoubleClick={() => setCurrentFolderId(f.id)}
                >
                  <FolderOpen size={36} />
                  <span>{f.name}</span>
                </div>
              ))}
              {subFiles.map((file) => (
                <div
                  key={file.id}
                  className={
                    styles.item +
                    (selectedFileId === file.id ? " " + styles.itemSelected : "")
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFileId(file.id);
                    setSelectedFolderIds(new Set());
                  }}
                  onDoubleClick={() => openFileUrl(file.r2Key)}
                  title={file.description || file.displayName}
                >
                  {file.contentType?.startsWith("image/") ? (
                    <Image size={36} />
                  ) : (
                    <FileText size={36} />
                  )}
                  <span>{file.displayName}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {newFolderOpen && (
        <div className={styles.modalBackdrop} onClick={() => setNewFolderOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span>폴더 생성</span>
              <CloseButton onClick={() => setNewFolderOpen(false)} />
            </div>
            <div className={styles.modalBody}>
              <label>폴더 이름</label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="이름 입력"
              />
            </div>
            <div className={styles.modalFooter}>
              <Button size="sm" intent="secondary" onClick={() => setNewFolderOpen(false)}>
                취소
              </Button>
              <Button size="sm" intent="primary" onClick={handleCreateFolder}>
                생성
              </Button>
            </div>
          </div>
        </div>
      )}

      {uploadModalOpen && (
        <UploadModal onClose={() => setUploadModalOpen(false)} onUpload={handleUpload} />
      )}
    </div>
  );
}

function useBreadcrumbPath(
  folders: InventoryFolder[],
  folderId: string | null
): { id: string | null; name: string }[] {
  const path: { id: string | null; name: string }[] = [{ id: null, name: "인벤토리" }];
  let currentId: string | null = folderId;
  const seen = new Set<string>();
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const folder = folders.find((f) => f.id === currentId);
    if (!folder) break;
    path.push({ id: folder.id, name: folder.name });
    currentId = folder.parentId;
  }
  path.reverse();
  return path;
}
