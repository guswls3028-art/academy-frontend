// PATH: src/app_admin/domains/storage/components/MyStorageExplorer.tsx
// 내 저장소(선생님) — 좌측 폴더 트리, 상단 브레드크럼, 우측 아이콘 그리드 (파일 탐색기형)
// 다중선택: Ctrl/Cmd+Click, 일괄삭제 지원

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FolderOpen, FileText, Image, FilePlus, FolderPlus, X, Download, Trash2, Pencil, Sparkles } from "lucide-react";
import { Button, CloseButton } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import {
  fetchInventoryList,
  fetchStorageQuota,
  createFolder,
  uploadFile,
  deleteFolder,
  deleteFile,
  renameFolder,
  renameFile,
  getPresignedUrl,
  moveInventoryItem,
  type InventoryFolder,
  type InventoryFile,
  type MoveConflictError,
} from "../api/storage.api";
import { promoteInventoryToMatchup } from "../api/matchup.api";

const MATCHUP_SUPPORTED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

function isMatchupSupported(file: InventoryFile): boolean {
  return MATCHUP_SUPPORTED_TYPES.has(file.contentType ?? "");
}
import Breadcrumb from "./Breadcrumb";
import FolderTree from "./FolderTree";
import UploadModal from "./UploadModal";
import MoveDuplicateModal from "./MoveDuplicateModal";
import panelStyles from "@/shared/ui/domain/PanelWithTreeLayout.module.css";
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
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [addChoiceOpen, setAddChoiceOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  // 다중 선택: 파일 ID Set + 폴더 ID Set (동시 선택 가능)
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [fileActionTarget, setFileActionTarget] = useState<InventoryFile | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{
    type: "file" | "folder";
    sourceId: string;
    targetFolderId: string | null;
    existingName: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [renamingId, setRenamingId] = useState<{ type: "folder" | "file"; id: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["storage-inventory", SCOPE],
    queryFn: () => fetchInventoryList(SCOPE),
  });
  const { data: quota } = useQuery({
    queryKey: ["storage-quota"],
    queryFn: fetchStorageQuota,
  });
  const isLocked = quota?.plan === "standard";

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
      feedback.error((e as Error).message);
    }
  }, [currentFolderId, newFolderName, qc]);

  const handleUpload = useCallback(
    async (payload: {
      displayName: string;
      description: string;
      icon: string;
      file: File;
      promoteToMatchup?: boolean;
    }) => {
      try {
        const res = await uploadFile({
          scope: SCOPE,
          folderId: currentFolderId,
          displayName: payload.displayName,
          description: payload.description,
          icon: payload.icon,
          file: payload.file,
          promoteToMatchup: payload.promoteToMatchup,
        });
        qc.invalidateQueries({ queryKey: ["storage-inventory", SCOPE] });
        if (payload.promoteToMatchup) {
          qc.invalidateQueries({ queryKey: ["matchup-documents"] });
        }
        setUploadModalOpen(false);
        if (payload.promoteToMatchup && res.matchupDocumentId) {
          feedback.success("저장 + 매치업 등록 완료. 매치업 페이지에서 분석 진행률 확인하세요.");
        }
      } catch (e) {
        feedback.error((e as Error).message);
      }
    },
    [currentFolderId, qc]
  );

  const selectionCount = selectedFolderIds.size + selectedFileIds.size;
  const hasSelection = selectionCount > 0;

  // 선택 토글 (Ctrl/Cmd+Click = 추가/제거, 일반 Click = 단일 선택)
  const toggleFolderSelect = useCallback((folderId: string, multi: boolean) => {
    if (multi) {
      setSelectedFolderIds((prev) => {
        const next = new Set(prev);
        if (next.has(folderId)) next.delete(folderId);
        else next.add(folderId);
        return next;
      });
    } else {
      setSelectedFolderIds(new Set([folderId]));
      setSelectedFileIds(new Set());
    }
  }, []);

  const toggleFileSelect = useCallback((fileId: string, multi: boolean) => {
    if (multi) {
      setSelectedFileIds((prev) => {
        const next = new Set(prev);
        if (next.has(fileId)) next.delete(fileId);
        else next.add(fileId);
        return next;
      });
    } else {
      setSelectedFileIds(new Set([fileId]));
      setSelectedFolderIds(new Set());
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedFolderIds(new Set());
    setSelectedFileIds(new Set());
  }, []);

  // 전체 선택
  const handleSelectAll = useCallback(() => {
    setSelectedFolderIds(new Set(subFolders.map((f) => f.id)));
    setSelectedFileIds(new Set(subFiles.map((f) => f.id)));
  }, [subFolders, subFiles]);

  const isAllSelected = subFolders.length + subFiles.length > 0 &&
    subFolders.every((f) => selectedFolderIds.has(f.id)) &&
    subFiles.every((f) => selectedFileIds.has(f.id));

  // 일괄 삭제
  const handleDeleteSelected = useCallback(async () => {
    const folderCount = selectedFolderIds.size;
    const fileCount = selectedFileIds.size;
    const parts: string[] = [];
    if (folderCount > 0) parts.push(`폴더 ${folderCount}개`);
    if (fileCount > 0) parts.push(`파일 ${fileCount}개`);
    const ok = await confirm({
      title: "선택 항목 삭제",
      message: `${parts.join(", ")}를 삭제하시겠습니까?`,
      confirmText: "삭제",
      danger: true,
    });
    if (!ok) return;

    setIsDeleting(true);
    let errorCount = 0;
    for (const id of selectedFolderIds) {
      try {
        await deleteFolder(SCOPE, id);
      } catch (e) {
        errorCount++;
        feedback.error((e as Error).message);
      }
    }
    for (const id of selectedFileIds) {
      try {
        await deleteFile(SCOPE, id);
      } catch (e) {
        errorCount++;
        feedback.error((e as Error).message);
      }
    }
    qc.invalidateQueries({ queryKey: ["storage-inventory", SCOPE] });
    clearSelection();
    setIsDeleting(false);
    if (errorCount === 0) {
      feedback.success(`${parts.join(", ")} 삭제 완료`);
    }
  }, [selectedFolderIds, selectedFileIds, qc, confirm, clearSelection]);

  const startRename = useCallback((type: "folder" | "file", id: string, currentName: string) => {
    setRenamingId({ type, id });
    setRenameValue(currentName);
  }, []);

  const submitRename = useCallback(async () => {
    if (!renamingId || !renameValue.trim()) { setRenamingId(null); return; }
    try {
      if (renamingId.type === "folder") {
        await renameFolder(SCOPE, renamingId.id, renameValue.trim());
      } else {
        await renameFile(SCOPE, renamingId.id, renameValue.trim());
      }
      qc.invalidateQueries({ queryKey: ["storage-inventory", SCOPE] });
    } catch (e) {
      feedback.error((e as Error).message);
    }
    setRenamingId(null);
  }, [renamingId, renameValue, qc]);

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
          feedback.error(ce?.message ?? "이동에 실패했습니다.");
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
      const { targetFolderId, type, sourceId } = conflict;
      setConflict(null);
      handleMove(targetFolderId, type, sourceId, choice);
    },
    [conflict, handleMove]
  );

  const handlePromoteToMatchup = useCallback(async (file: InventoryFile) => {
    if (!isMatchupSupported(file)) {
      feedback.error("매치업은 PDF/PNG/JPG만 지원합니다.");
      return;
    }
    try {
      const doc = await promoteInventoryToMatchup({
        inventoryFileId: file.id,
        title: file.displayName,
      });
      qc.invalidateQueries({ queryKey: ["storage-inventory", SCOPE] });
      qc.invalidateQueries({ queryKey: ["matchup-documents"] });
      feedback.success("매치업 자료로 등록했습니다. 분석을 시작합니다.");
      navigate(`/admin/storage/matchup?docId=${doc.id}`);
    } catch (e) {
      const err = e as { status?: number; code?: string; documentId?: number; message?: string };
      if (err.status === 409 && err.code === "already_promoted" && err.documentId) {
        feedback.info("이미 매치업 자료로 등록되어 있습니다.");
        navigate(`/admin/storage/matchup?docId=${err.documentId}`);
        return;
      }
      feedback.error(err.message ?? "매치업 등록에 실패했습니다.");
    }
  }, [qc, navigate]);

  const openFileUrl = async (r2Key: string) => {
    try {
      const { url } = await getPresignedUrl(r2Key);
      if (url) window.open(url, "_blank");
    } catch {
      window.open(r2Key, "_blank");
    }
  };

  return (
    <div className={panelStyles.root}>
      <div className={panelStyles.toolbar}>
        <Breadcrumb path={breadcrumbPath} onSelect={setCurrentFolderId} />
        <div className={panelStyles.actions}>
          {hasSelection && (
            <>
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)", marginRight: 4 }}>
                {selectionCount}개 선택
              </span>
              <Button type="button" intent="ghost" size="sm" onClick={clearSelection}>
                선택 해제
              </Button>
              <Button type="button" intent="danger" size="sm" onClick={handleDeleteSelected} disabled={isDeleting}>
                {isDeleting ? "삭제 중…" : "삭제"}
              </Button>
            </>
          )}
          {!hasSelection && (subFolders.length + subFiles.length > 0) && (
            <Button type="button" intent="ghost" size="sm" onClick={handleSelectAll}>
              전체 선택
            </Button>
          )}
          <Button
            type="button"
            intent="primary"
            size="sm"
            onClick={() => !isLocked && setAddChoiceOpen(true)}
            disabled={isLocked}
            title={isLocked ? "Standard 플랜에서는 인벤토리를 사용할 수 없습니다." : undefined}
            leftIcon={<FilePlus size={16} />}
          >
            추가
          </Button>
        </div>
      </div>

      <div className={panelStyles.body}>
        <aside className={panelStyles.tree}>
          <div className={panelStyles.treeNavHeader}>
            <span className={panelStyles.treeNavTitle}>폴더</span>
          </div>
          <div className={panelStyles.treeScroll}>
            <FolderTree
              folders={allFoldersForTree}
              currentFolderId={currentFolderId}
              onSelect={setCurrentFolderId}
            />
          </div>
        </aside>
        <div className={panelStyles.gridWrap}>
          {isLoading ? (
            <div className={panelStyles.placeholder}>로딩 중...</div>
          ) : (
            <div
              className={styles.grid}
              onClick={() => clearSelection()}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDropTargetFolderId(currentFolderId);
              }}
              onDragLeave={() => setDropTargetFolderId(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDropTargetFolderId(null);
                const payload = getDragPayload(e);
                if (payload && payload.sourceId) {
                  handleMove(currentFolderId, payload.type, payload.sourceId);
                }
              }}
            >
              {subFolders.map((f) => (
                <div
                  key={f.id}
                  draggable
                  className={
                    styles.item +
                    (selectedFolderIds.has(f.id) ? " " + styles.itemSelected : "") +
                    (dropTargetFolderId === f.id ? " " + styles.dropTarget : "") +
                    (movingId === f.id ? " " + styles.itemMoving : "")
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolderSelect(f.id, e.ctrlKey || e.metaKey);
                  }}
                  title={f.name}
                  onDoubleClick={() => { clearSelection(); setCurrentFolderId(f.id); }}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ type: "folder" as const, sourceId: f.id }));
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDropTargetFolderId(f.id);
                  }}
                  onDragLeave={() => setDropTargetFolderId((id) => (id === f.id ? null : id))}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDropTargetFolderId(null);
                    const payload = getDragPayload(e);
                    if (payload && payload.sourceId && payload.sourceId !== f.id) {
                      handleMove(f.id, payload.type, payload.sourceId);
                    }
                  }}
                >
                  <FolderOpen size={36} />
                  {renamingId?.type === "folder" && renamingId.id === f.id ? (
                    <input
                      className={styles.renameInput}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={submitRename}
                      onKeyDown={(e) => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setRenamingId(null); }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span onDoubleClick={(e) => { e.stopPropagation(); startRename("folder", f.id, f.name); }}>{f.name}</span>
                  )}
                  {movingId === f.id && <span className={styles.movingLabel}>이동 중...</span>}
                </div>
              ))}
              {subFiles.map((file) => (
                <div
                  key={file.id}
                  draggable
                  className={
                    styles.item +
                    (selectedFileIds.has(file.id) ? " " + styles.itemSelected : "") +
                    (movingId === file.id ? " " + styles.itemMoving : "")
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    if (e.ctrlKey || e.metaKey) {
                      toggleFileSelect(file.id, true);
                    } else {
                      toggleFileSelect(file.id, false);
                      setFileActionTarget(file);
                    }
                  }}
                  title={file.description || file.displayName}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ type: "file" as const, sourceId: file.id }));
                    e.dataTransfer.effectAllowed = "move";
                  }}
                >
                  <div style={{ position: "relative", display: "grid", placeItems: "center" }}>
                    {file.contentType?.startsWith("image/") ? (
                      <Image size={36} />
                    ) : (
                      <FileText size={36} />
                    )}
                    {file.matchup && (
                      <span
                        title={`매치업 자료 (${file.matchup.status === "done" ? `${file.matchup.problemCount}문제` : file.matchup.status})`}
                        data-testid={`storage-file-matchup-badge-${file.id}`}
                        style={{
                          position: "absolute",
                          top: -4,
                          right: -8,
                          background: "var(--color-brand-primary)",
                          color: "#fff",
                          borderRadius: 999,
                          fontSize: 10,
                          padding: "2px 6px",
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 2,
                          boxShadow: "0 1px 2px rgba(0,0,0,.2)",
                        }}
                      >
                        <Sparkles size={10} />
                        매치업
                      </span>
                    )}
                  </div>
                  {renamingId?.type === "file" && renamingId.id === file.id ? (
                    <input
                      className={styles.renameInput}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={submitRename}
                      onKeyDown={(e) => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setRenamingId(null); }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span>{file.displayName}</span>
                  )}
                  {movingId === file.id && <span className={styles.movingLabel}>이동 중...</span>}
                </div>
              ))}
              <div
                className={styles.item + " " + styles.itemAdd + (isLocked ? " " + styles.itemLocked : "")}
                onClick={(e) => { e.stopPropagation(); if (!isLocked) setAddChoiceOpen(true); }}
                title={isLocked ? "Standard 플랜에서는 사용 불가" : "폴더 또는 파일 추가"}
              >
                <FilePlus size={32} />
                <span>추가</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {addChoiceOpen && (
        <div className={styles.addPopupBackdrop} onClick={() => setAddChoiceOpen(false)}>
          <div className={styles.addPopup} onClick={(e) => e.stopPropagation()}>
            <div className={styles.addPopupHeader}>
              <span>추가</span>
              <button type="button" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "grid", placeItems: "center" }} onClick={() => setAddChoiceOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.addPopupBody}>
              <button
                type="button"
                className={styles.addPopupBtn}
                onClick={() => { setAddChoiceOpen(false); setNewFolderOpen(true); }}
              >
                <div className={styles.addPopupBtnIcon}>
                  <FolderPlus size={20} style={{ color: "var(--color-brand-primary)" }} />
                </div>
                <div className={styles.addPopupBtnText}>
                  <span className={styles.addPopupBtnLabel}>폴더 생성</span>
                  <span className={styles.addPopupBtnDesc}>새 폴더를 만듭니다</span>
                </div>
              </button>
              <button
                type="button"
                className={styles.addPopupBtn}
                onClick={() => { setAddChoiceOpen(false); setUploadModalOpen(true); }}
              >
                <div className={styles.addPopupBtnIcon}>
                  <FilePlus size={20} style={{ color: "var(--color-brand-primary)" }} />
                </div>
                <div className={styles.addPopupBtnText}>
                  <span className={styles.addPopupBtnLabel}>파일 업로드</span>
                  <span className={styles.addPopupBtnDesc}>파일을 선택하여 업로드합니다</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {fileActionTarget && !selectedFileIds.has(fileActionTarget.id) && (
        <div className={styles.addPopupBackdrop} onClick={() => setFileActionTarget(null)}>
          <div className={styles.addPopup} onClick={(e) => e.stopPropagation()}>
            <div className={styles.addPopupHeader}>
              <span>파일</span>
              <button type="button" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "grid", placeItems: "center" }} onClick={() => setFileActionTarget(null)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.fileActionFileName}>{fileActionTarget.displayName}</div>
            <div className={styles.addPopupBody}>
              <button
                type="button"
                className={styles.fileActionBtn}
                onClick={() => {
                  openFileUrl(fileActionTarget.r2Key);
                  setFileActionTarget(null);
                }}
              >
                <Download size={18} style={{ color: "var(--color-brand-primary)", flexShrink: 0 }} />
                저장하기
              </button>
              {fileActionTarget.matchup ? (
                <button
                  type="button"
                  className={styles.fileActionBtn}
                  data-testid="storage-file-action-matchup-open"
                  onClick={() => {
                    const docId = fileActionTarget.matchup?.documentId;
                    setFileActionTarget(null);
                    if (docId) navigate(`/admin/storage/matchup?docId=${docId}`);
                  }}
                >
                  <Sparkles size={18} style={{ color: "var(--color-brand-primary)", flexShrink: 0 }} />
                  매치업 보기
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.fileActionBtn}
                  data-testid="storage-file-action-matchup-promote"
                  disabled={!isMatchupSupported(fileActionTarget)}
                  title={isMatchupSupported(fileActionTarget) ? undefined : "PDF/PNG/JPG만 매치업 가능"}
                  onClick={() => {
                    const target = fileActionTarget;
                    setFileActionTarget(null);
                    handlePromoteToMatchup(target);
                  }}
                >
                  <Sparkles size={18} style={{ color: "var(--color-brand-primary)", flexShrink: 0 }} />
                  매치업으로 등록
                </button>
              )}
              <button
                type="button"
                className={styles.fileActionBtn}
                onClick={() => {
                  startRename("file", fileActionTarget.id, fileActionTarget.displayName);
                  setFileActionTarget(null);
                }}
              >
                <Pencil size={18} style={{ color: "var(--color-brand-primary)", flexShrink: 0 }} />
                이름 수정
              </button>
              <button
                type="button"
                className={styles.fileActionBtnDanger}
                onClick={async () => {
                  const id = fileActionTarget.id;
                  setFileActionTarget(null);
                  const ok = await confirm({ title: "파일 삭제", message: "정말 삭제하시겠습니까?", confirmText: "삭제", danger: true });
                  if (!ok) return;
                  try {
                    await deleteFile(SCOPE, id);
                    qc.invalidateQueries({ queryKey: ["storage-inventory", SCOPE] });
                  } catch (e) {
                    feedback.error((e as Error).message);
                  }
                }}
              >
                <Trash2 size={18} style={{ flexShrink: 0 }} />
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}

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
                onKeyDown={(e) => { if (e.key === "Enter" && newFolderName.trim()) handleCreateFolder(); }}
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

      {conflict && (
        <MoveDuplicateModal
          existingName={conflict.existingName}
          itemType={conflict.type}
          onOverwrite={() => resolveConflict("overwrite")}
          onRename={() => resolveConflict("rename")}
          onCancel={() => setConflict(null)}
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
