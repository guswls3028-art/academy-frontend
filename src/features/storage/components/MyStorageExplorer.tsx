// PATH: src/features/storage/components/MyStorageExplorer.tsx
// 내 저장소(선생님) — 좌측 폴더 트리, 상단 브레드크럼, 우측 아이콘 그리드 (파일 탐색기형)

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, FileText, Image, FilePlus, FolderPlus } from "lucide-react";
import { Button, CloseButton } from "@/shared/ui/ds";
import {
  fetchInventoryList,
  fetchStorageQuota,
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

const SCOPE = "admin" as const;

export default function MyStorageExplorer() {
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
    queryKey: ["storage-inventory", SCOPE],
    queryFn: () => fetchInventoryList(SCOPE),
  });
  const { data: quota } = useQuery({
    queryKey: ["storage-quota"],
    queryFn: fetchStorageQuota,
  });
  const isLocked = quota?.plan === "lite";

  const folders = data?.folders ?? [];
  const files = data?.files ?? [];
  const subFolders = folders.filter((f) => f.parentId === currentFolderId);
  const subFiles = files.filter((f) => (f.folderId ?? null) === currentFolderId);

  const allFoldersForTree = folders;
  const breadcrumbPath = useBreadcrumbPath(allFoldersForTree, currentFolderId);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;
    try {
      await createFolder(SCOPE, currentFolderId, newFolderName.trim());
      qc.invalidateQueries({ queryKey: ["storage-inventory", SCOPE] });
      setNewFolderName("");
      setNewFolderOpen(false);
    } catch (e) {
      alert((e as Error).message);
    }
  }, [currentFolderId, newFolderName, qc]);

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
        });
        qc.invalidateQueries({ queryKey: ["storage-inventory", SCOPE] });
        setUploadModalOpen(false);
      } catch (e) {
        alert((e as Error).message);
      }
    },
    [currentFolderId, qc]
  );

  const handleDeleteSelected = useCallback(async () => {
    for (const id of selectedFolderIds) {
      try {
        await deleteFolder(SCOPE, id);
      } catch (e) {
        alert((e as Error).message);
        return;
      }
    }
    if (selectedFileId) {
      try {
        await deleteFile(SCOPE, selectedFileId);
      } catch (e) {
        alert((e as Error).message);
        return;
      }
    }
    qc.invalidateQueries({ queryKey: ["storage-inventory", SCOPE] });
    setSelectedFolderIds(new Set());
    setSelectedFileId(null);
  }, [selectedFolderIds, selectedFileId, qc]);

  const hasSelection = selectedFolderIds.size > 0 || selectedFileId != null;

  const handleMove = useCallback(
    async (
      targetFolderId: string | null,
      type: "file" | "folder",
      sourceId: string,
      onDuplicate?: "overwrite" | "rename"
    ) => {
      setMovingId(sourceId);
      const prev = qc.getQueryData<{ folders: InventoryFolder[]; files: InventoryFile[] }>([
        "storage-inventory",
        SCOPE,
      ]);
      const applyOptimistic = () => {
        if (!prev) return;
        if (type === "file") {
          const files = prev.files.map((f) =>
            f.id === sourceId ? { ...f, folderId: targetFolderId } : f
          );
          qc.setQueryData(["storage-inventory", SCOPE], { ...prev, files });
        } else {
          const folders = prev.folders.map((f) =>
            f.id === sourceId ? { ...f, parentId: targetFolderId } : f
          );
          qc.setQueryData(["storage-inventory", SCOPE], { ...prev, folders });
        }
      };
      applyOptimistic();
      try {
        await moveInventoryItem({
          scope: SCOPE,
          type,
          sourceId,
          targetFolderId,
          onDuplicate,
        });
        await qc.invalidateQueries({ queryKey: ["storage-inventory", SCOPE] });
      } catch (e) {
        if (prev) qc.setQueryData(["storage-inventory", SCOPE], prev);
        const ce = e as MoveConflictError & Error;
        if (ce.status === 409 && ce.code === "duplicate") {
          setConflict({
            type,
            sourceId,
            targetFolderId,
            existingName: ce.existing_name || "항목",
          });
        } else {
          alert(ce?.message ?? "이동에 실패했습니다.");
        }
      } finally {
        setMovingId(null);
      }
    },
    [qc]
  );

  const resolveConflict = useCallback(
    (choice: "overwrite" | "rename") => {
      if (!conflict) return;
      handleMove(conflict.targetFolderId, conflict.type, conflict.sourceId, choice);
      setConflict(null);
    },
    [conflict, handleMove]
  );

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
            <Button
              type="button"
              intent="primary"
              size="sm"
              onClick={() => !isLocked && setAddChoiceOpen(true)}
              disabled={isLocked}
              title={isLocked ? "Lite 플랜에서는 인벤토리를 사용할 수 없습니다." : undefined}
            >
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
            folders={allFoldersForTree}
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
                className={styles.item + " " + styles.itemAdd + (isLocked ? " " + styles.itemLocked : "")}
                onClick={() => !isLocked && setAddChoiceOpen(true)}
                title={isLocked ? "Lite 플랜에서는 사용 불가" : "폴더 또는 파일 추가"}
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
        <UploadModal
          onClose={() => setUploadModalOpen(false)}
          onUpload={handleUpload}
        />
      )}
    </div>
  );
}

function useBreadcrumbPath(
  folders: InventoryFolder[],
  folderId: string | null
): { id: string | null; name: string }[] {
  const path: { id: string | null; name: string }[] = [{ id: null, name: "내 저장소" }];
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
