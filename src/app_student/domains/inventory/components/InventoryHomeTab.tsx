/**
 * 인벤토리 홈 탭 — 파일 브라우저 (MyInventoryPage에서 추출)
 * 폴더/파일 조회, 업로드, 다운로드, 삭제 + 브레드크럼
 */
import { useState, useRef, useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  uploadMyFile,
  deleteMyFile,
  getMyFileUrl,
  createMyFolder,
  deleteMyFolder,
  type InventoryFile,
  type InventoryFolder,
} from "../api/inventory.api";
import {
  IconFolder,
  IconFileText,
  IconImage,
  IconVideo,
  IconUpload,
  IconDownload,
  IconTrash,
  IconPlus,
  IconChevronRight,
} from "@student/shared/ui/icons/Icons";

const MAX_SIZE_MB = 100;

type Props = {
  ps: string;
  folders: InventoryFolder[];
  files: InventoryFile[];
  isParentReadOnly: boolean;
  queryKey: readonly unknown[];
};

function FileIcon({ file }: { file: InventoryFile }) {
  const ct = file.contentType || "";
  const icon = file.icon || "";
  const s = { width: 20, height: 20, color: "var(--stu-text-muted)", flexShrink: 0 } as const;
  if (ct.startsWith("video/") || icon === "video") return <IconVideo style={s} />;
  if (ct.startsWith("image/") || icon === "image") return <IconImage style={s} />;
  return <IconFileText style={s} />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function InventoryHomeTab({ ps, folders, files, isParentReadOnly, queryKey }: Props) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderStack, setFolderStack] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: "내 인벤토리" },
  ]);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{ type: "file" | "folder"; id: string; name: string } | null>(null);
  const [uploadQueue, setUploadQueue] = useState<{ name: string; done: boolean; error: boolean }[]>([]);

  const currentFolders = useMemo(
    () => folders.filter((f) => f.parentId === currentFolderId),
    [folders, currentFolderId],
  );
  const currentFiles = useMemo(
    () => files.filter((f) => f.folderId === currentFolderId),
    [files, currentFolderId],
  );

  const navigateToFolder = useCallback((folder: InventoryFolder) => {
    setCurrentFolderId(folder.id);
    setFolderStack((prev) => [...prev, { id: folder.id, name: folder.name }]);
  }, []);

  const navigateToBreadcrumb = useCallback((index: number) => {
    setCurrentFolderId(folderStack[index].id);
    setFolderStack((prev) => prev.slice(0, index + 1));
  }, [folderStack]);

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) throw new Error(`파일 크기는 ${MAX_SIZE_MB}MB 이하여야 합니다.`);
      return uploadMyFile(ps, file, { folderId: currentFolderId });
    },
    onSuccess: async () => { qc.invalidateQueries({ queryKey }); if (fileInputRef.current) fileInputRef.current.value = ""; const { studentToast } = await import("@student/shared/ui/feedback/studentToast"); studentToast.success("파일이 업로드되었습니다."); },
    onError: async (e: Error) => { const { studentToast } = await import("@student/shared/ui/feedback/studentToast"); studentToast.error(e.message || "파일 업로드에 실패했습니다."); },
  });

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files ? Array.from(e.target.files) : [];
    if (!fileList.length) return;
    e.target.value = "";
    const queue = fileList.map((f) => ({ name: f.name, done: false, error: false }));
    setUploadQueue(queue);
    for (let i = 0; i < fileList.length; i++) {
      try {
        await uploadMut.mutateAsync(fileList[i]);
        setUploadQueue((prev) => prev.map((q, idx) => idx === i ? { ...q, done: true } : q));
      } catch {
        setUploadQueue((prev) => prev.map((q, idx) => idx === i ? { ...q, done: true, error: true } : q));
      }
    }
    setTimeout(() => setUploadQueue([]), 3000);
  };

  const deleteMut = useMutation({
    mutationFn: async ({ type, id }: { type: "file" | "folder"; id: string }) => {
      if (type === "file") return deleteMyFile(ps, id);
      return deleteMyFolder(ps, id);
    },
    onSuccess: async () => { qc.invalidateQueries({ queryKey }); setConfirmDelete(null); const { studentToast } = await import("@student/shared/ui/feedback/studentToast"); studentToast.success("삭제되었습니다."); },
    onError: async () => { const { studentToast } = await import("@student/shared/ui/feedback/studentToast"); studentToast.error("삭제에 실패했습니다."); },
  });

  const createFolderMut = useMutation({
    mutationFn: (name: string) => createMyFolder(ps, name, currentFolderId),
    onSuccess: async () => { qc.invalidateQueries({ queryKey }); setShowNewFolder(false); const { studentToast } = await import("@student/shared/ui/feedback/studentToast"); studentToast.success(`${newFolderName} 폴더가 생성되었습니다.`); setNewFolderName(""); },
    onError: async () => { const { studentToast } = await import("@student/shared/ui/feedback/studentToast"); studentToast.error("폴더 생성에 실패했습니다."); },
  });

  const handleDownload = async (file: InventoryFile) => {
    try {
      const { url } = await getMyFileUrl(file.r2Key);
      if (url) {
        const { downloadPresignedUrl } = await import("@/shared/utils/safeDownload");
        downloadPresignedUrl(url, file.name || "download");
      }
    } catch {
      const { studentToast } = await import("@student/shared/ui/feedback/studentToast");
      studentToast.error("파일 다운로드에 실패했습니다.");
    }
  };

  const isEmpty = currentFolders.length === 0 && currentFiles.length === 0;

  return (
    <div>
      {/* 액션 버튼 */}
      {!isParentReadOnly && (
        <div style={{ display: "flex", gap: 8, marginBottom: "var(--stu-space-4)" }}>
          <button type="button" className="stu-btn stu-btn--secondary stu-btn--sm" onClick={() => setShowNewFolder(true)}
            style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <IconPlus style={{ width: 14, height: 14, flexShrink: 0 }} /> 새 폴더
          </button>
          <button type="button" className="stu-btn stu-btn--primary stu-btn--sm" onClick={() => fileInputRef.current?.click()}
            disabled={uploadMut.isPending} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {uploadMut.isPending ? "업로드 중…" : "파일 업로드"}
          </button>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.hwp,.hwpx,.xlsx,.xls" multiple onChange={onFileChange} style={{ display: "none" }} />

      {/* 브레드크럼 */}
      {folderStack.length > 1 && (
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 2, marginBottom: "var(--stu-space-3)", fontSize: 13, color: "var(--stu-text-muted)" }}>
          {folderStack.map((crumb, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 2 }}>
              {i > 0 && <IconChevronRight style={{ width: 12, height: 12, opacity: 0.5 }} />}
              <button type="button" className="stu-btn stu-btn--ghost stu-btn--sm"
                style={{ padding: "2px 6px", fontSize: 13, fontWeight: i === folderStack.length - 1 ? 700 : 400, color: i === folderStack.length - 1 ? "var(--stu-text)" : "var(--stu-text-muted)" }}
                onClick={() => navigateToBreadcrumb(i)}>
                {crumb.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 새 폴더 생성 */}
      {showNewFolder && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: "var(--stu-space-3)", padding: "var(--stu-space-2) var(--stu-space-3)", background: "var(--stu-surface)", border: "1px solid var(--stu-border)", borderRadius: "var(--stu-radius)" }}>
          <IconFolder style={{ width: 18, height: 18, color: "var(--stu-primary)", flexShrink: 0 }} />
          <input className="stu-input" placeholder="폴더 이름" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && newFolderName.trim()) createFolderMut.mutate(newFolderName.trim()); if (e.key === "Escape") { setShowNewFolder(false); setNewFolderName(""); } }}
            autoFocus style={{ flex: 1, fontSize: 14, padding: "6px 8px" }} />
          <button type="button" className="stu-btn stu-btn--primary stu-btn--sm" disabled={!newFolderName.trim() || createFolderMut.isPending}
            onClick={() => newFolderName.trim() && createFolderMut.mutate(newFolderName.trim())}>생성</button>
          <button type="button" className="stu-btn stu-btn--ghost stu-btn--sm"
            onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}>취소</button>
        </div>
      )}

      {/* 업로드 에러 */}
      {uploadMut.isError && (
        <div role="alert" style={{ padding: "var(--stu-space-3)", background: "var(--stu-danger-bg)", border: "1px solid var(--stu-danger-border)", borderRadius: "var(--stu-radius)", fontSize: 14, color: "var(--stu-danger-text)", fontWeight: 600, marginBottom: "var(--stu-space-3)" }}>
          {uploadMut.error instanceof Error ? uploadMut.error.message : "업로드에 실패했습니다."}
        </div>
      )}

      {/* 업로드 큐 */}
      {uploadQueue.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: "var(--stu-space-3)", padding: "var(--stu-space-3)", background: "var(--stu-surface)", border: "1px solid var(--stu-border)", borderRadius: "var(--stu-radius)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--stu-text-muted)", marginBottom: 4 }}>
            업로드 중... ({uploadQueue.filter((q) => q.done).length}/{uploadQueue.length})
          </div>
          {uploadQueue.map((q, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <span style={{ color: q.error ? "var(--stu-danger-text)" : q.done ? "var(--stu-success-text)" : "var(--stu-text-muted)" }}>
                {q.error ? "X" : q.done ? "V" : "..."}
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* 학부모 안내 */}
      {isParentReadOnly && (
        <div style={{ padding: "var(--stu-space-3)", background: "var(--stu-surface-soft)", border: "1px solid var(--stu-border)", borderRadius: "var(--stu-radius)", fontSize: 14, color: "var(--stu-text-muted)", marginBottom: "var(--stu-space-3)" }}>
          학부모 계정은 열람만 가능합니다. 파일 업로드·삭제는 학생 계정으로 로그인해 주세요.
        </div>
      )}

      {/* 빈 상태 */}
      {isEmpty && (
        <div style={{ textAlign: "center", padding: "var(--stu-space-8) var(--stu-space-4)", color: "var(--stu-text-muted)" }}>
          <IconFolder style={{ width: 48, height: 48, opacity: 0.3, margin: "0 auto 12px" }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>파일이 없습니다</div>
          <div style={{ fontSize: 13 }}>{isParentReadOnly ? "학생이 파일을 제출하면 여기에 표시됩니다." : "우측 상단 업로드 버튼으로 파일을 추가하세요."}</div>
        </div>
      )}

      {/* 폴더 목록 */}
      {currentFolders.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: currentFiles.length > 0 ? "var(--stu-space-4)" : 0 }}>
          {currentFolders.map((folder) => (
            <div key={folder.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "var(--stu-space-3)", background: "var(--stu-surface)", border: "1px solid var(--stu-border)", borderRadius: "var(--stu-radius)", cursor: "pointer" }}
              onClick={() => navigateToFolder(folder)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") navigateToFolder(folder); }}>
              <IconFolder style={{ width: 20, height: 20, color: "var(--stu-primary)", flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{folder.name}</span>
              {!isParentReadOnly && (
                <button type="button" className="stu-btn stu-btn--ghost stu-btn--sm" style={{ padding: 4, flexShrink: 0 }}
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: "folder", id: folder.id, name: folder.name }); }} title="폴더 삭제">
                  <IconTrash style={{ width: 14, height: 14, color: "var(--stu-text-muted)" }} />
                </button>
              )}
              <IconChevronRight style={{ width: 16, height: 16, color: "var(--stu-text-muted)", flexShrink: 0 }} />
            </div>
          ))}
        </div>
      )}

      {/* 파일 목록 */}
      {currentFiles.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {currentFiles.map((file) => (
            <div key={file.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "var(--stu-space-3)", background: "var(--stu-surface)", border: "1px solid var(--stu-border)", borderRadius: "var(--stu-radius)" }}>
              <FileIcon file={file} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.displayName || file.name}</div>
                <div style={{ fontSize: 12, color: "var(--stu-text-muted)", marginTop: 2 }}>
                  {formatBytes(file.sizeBytes)}{file.createdAt && <> · {formatDate(file.createdAt)}</>}{file.description && <> · {file.description}</>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button type="button" className="stu-btn stu-btn--ghost stu-btn--sm" style={{ padding: 6 }} onClick={() => handleDownload(file)} title="다운로드">
                  <IconDownload style={{ width: 16, height: 16 }} />
                </button>
                {!isParentReadOnly && (
                  <button type="button" className="stu-btn stu-btn--ghost stu-btn--sm" style={{ padding: 6 }}
                    onClick={() => setConfirmDelete({ type: "file", id: file.id, name: file.displayName || file.name })} title="삭제">
                    <IconTrash style={{ width: 16, height: 16, color: "var(--stu-text-muted)" }} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "grid", placeItems: "center", padding: 16 }} onClick={() => setConfirmDelete(null)}>
          <div style={{ background: "var(--stu-bg)", borderRadius: "var(--stu-radius-md)", padding: "var(--stu-space-5)", maxWidth: 340, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{confirmDelete.type === "folder" ? "폴더 삭제" : "파일 삭제"}</div>
            <div style={{ fontSize: 14, color: "var(--stu-text-muted)", marginBottom: 16 }}>
              <strong>{confirmDelete.name}</strong>을(를) 삭제하시겠습니까?
              {confirmDelete.type === "folder" && <div style={{ fontSize: 13, marginTop: 4 }}>비어있는 폴더만 삭제할 수 있습니다.</div>}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="stu-btn stu-btn--secondary stu-btn--sm" onClick={() => setConfirmDelete(null)}>취소</button>
              <button type="button" className="stu-btn stu-btn--danger stu-btn--sm" disabled={deleteMut.isPending}
                onClick={() => deleteMut.mutate({ type: confirmDelete.type, id: confirmDelete.id })}>
                {deleteMut.isPending ? "삭제 중…" : "삭제"}
              </button>
            </div>
            {deleteMut.isError && (
              <div style={{ marginTop: 8, fontSize: 13, color: "var(--stu-danger-text)", fontWeight: 600 }}>
                {deleteMut.error instanceof Error ? deleteMut.error.message : "삭제에 실패했습니다."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
