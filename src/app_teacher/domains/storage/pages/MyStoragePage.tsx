// PATH: src/app_teacher/domains/storage/pages/MyStoragePage.tsx
// 내 자료 — admin scope 인벤토리 조회/업로드/다운로드/삭제
import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { setPreferAdmin } from "@/core/router/MobileTeacherRedirect";
import { Card, SectionTitle, BackButton } from "@teacher/shared/ui/Card";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import {
  ChevronRight, Upload, Trash2, FolderPlus, Download, Search, Monitor,
} from "@teacher/shared/ui/Icons";
import {
  fetchInventoryList,
  fetchStorageQuota,
  uploadFile,
  deleteFile,
  deleteFolder,
  createFolder,
  getPresignedUrl,
  type InventoryFile,
  type InventoryFolder,
} from "../api";

function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export default function MyStoragePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderStack, setFolderStack] = useState<InventoryFolder[]>([]);
  const [search, setSearch] = useState("");
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [uploadMeta, setUploadMeta] = useState<{ file: File; displayName: string; description: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["teacher-storage-admin"],
    queryFn: () => fetchInventoryList("admin"),
  });

  const { data: quota } = useQuery({
    queryKey: ["teacher-storage-quota"],
    queryFn: fetchStorageQuota,
  });

  const items = useMemo(() => {
    const folders = (data?.folders ?? []).filter((f) => f.parentId === currentFolderId);
    const files = (data?.files ?? []).filter((f) => f.folderId === currentFolderId);
    const q = search.trim().toLowerCase();
    if (!q) return { folders, files };
    return {
      folders: folders.filter((f) => f.name.toLowerCase().includes(q)),
      files: files.filter((f) => f.displayName.toLowerCase().includes(q)),
    };
  }, [data, currentFolderId, search]);

  const uploadMut = useMutation({
    mutationFn: (u: { file: File; displayName: string; description: string }) =>
      uploadFile({
        scope: "admin",
        folderId: currentFolderId,
        displayName: u.displayName,
        description: u.description,
        icon: "file",
        file: u.file,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-storage-admin"] });
      qc.invalidateQueries({ queryKey: ["teacher-storage-quota"] });
      teacherToast.success("업로드 완료");
      setUploadMeta(null);
    },
    onError: () => teacherToast.error("업로드에 실패했습니다."),
  });

  const deleteFileMut = useMutation({
    mutationFn: (id: string) => deleteFile("admin", id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-storage-admin"] });
      qc.invalidateQueries({ queryKey: ["teacher-storage-quota"] });
      teacherToast.success("삭제됨");
    },
    onError: () => teacherToast.error("삭제에 실패했습니다."),
  });

  const deleteFolderMut = useMutation({
    mutationFn: (id: string) => deleteFolder("admin", id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-storage-admin"] });
      teacherToast.success("폴더 삭제됨");
    },
    onError: () => teacherToast.error("폴더 삭제에 실패했습니다. (내용이 있으면 먼저 비워 주세요)"),
  });

  const createFolderMut = useMutation({
    mutationFn: (name: string) => createFolder("admin", currentFolderId, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-storage-admin"] });
      teacherToast.success("폴더 생성됨");
      setCreateFolderOpen(false);
      setFolderName("");
    },
    onError: () => teacherToast.error("폴더 생성에 실패했습니다."),
  });

  const handleDownload = async (file: InventoryFile) => {
    try {
      const { url } = await getPresignedUrl(file.r2Key);
      window.open(url, "_blank");
    } catch {
      teacherToast.error("다운로드 URL을 가져올 수 없습니다.");
    }
  };

  const enterFolder = (f: InventoryFolder) => {
    setFolderStack((s) => [...s, f]);
    setCurrentFolderId(f.id);
  };
  const goUp = () => {
    setFolderStack((s) => {
      const next = s.slice(0, -1);
      setCurrentFolderId(next.length > 0 ? next[next.length - 1].id : null);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <BackButton onClick={() => (folderStack.length > 0 ? goUp() : navigate(-1))} />
        <h1 className="text-[17px] font-bold flex-1 truncate" style={{ color: "var(--tc-text)" }}>
          {folderStack.length === 0 ? "내 자료" : folderStack[folderStack.length - 1].name}
        </h1>
        <button
          onClick={() => setCreateFolderOpen(true)}
          className="text-[12px] font-semibold cursor-pointer flex items-center gap-1"
          style={{
            padding: "8px 10px",
            minHeight: "var(--tc-touch-min)",
            borderRadius: "var(--tc-radius-sm)",
            border: "1px solid var(--tc-border)",
            background: "var(--tc-surface)",
            color: "var(--tc-text-secondary)",
          }}
        >
          <FolderPlus size={14} /> 폴더
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-[12px] font-bold cursor-pointer flex items-center gap-1"
          style={{
            padding: "8px 12px",
            minHeight: "var(--tc-touch-min)",
            borderRadius: "var(--tc-radius)",
            border: "none",
            background: "var(--tc-primary)",
            color: "#fff",
          }}
        >
          <Upload size={14} /> 업로드
        </button>
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploadMeta({ file, displayName: file.name, description: "" });
            e.target.value = "";
          }}
        />
      </div>

      {/* Quota bar */}
      {quota && (
        <Card>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[12px]" style={{ color: "var(--tc-text-muted)" }}>
              사용 공간 · {quota.plan.toUpperCase()}
            </span>
            <span className="text-[12px] tabular-nums" style={{ color: "var(--tc-text)" }}>
              {formatBytes(quota.usedBytes)} / {formatBytes(quota.limitBytes)}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "var(--tc-surface-soft)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, (quota.usedBytes / Math.max(1, quota.limitBytes)) * 100)}%`,
                background: quota.usedBytes / quota.limitBytes > 0.9 ? "var(--tc-danger)" : "var(--tc-primary)",
                transition: "width 200ms",
              }}
            />
          </div>
        </Card>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 rounded-xl"
        style={{ padding: "8px 12px", background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}>
        <Search size={16} style={{ color: "var(--tc-text-muted)", flexShrink: 0 }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름으로 검색"
          className="flex-1 text-sm"
          style={{ border: "none", background: "transparent", color: "var(--tc-text)", outline: "none" }}
        />
      </div>

      {/* Breadcrumb */}
      {folderStack.length > 0 && (
        <div className="text-[12px] flex items-center gap-1 flex-wrap" style={{ color: "var(--tc-text-muted)" }}>
          <button onClick={() => { setFolderStack([]); setCurrentFolderId(null); }}
            className="cursor-pointer" style={{ background: "none", border: "none", padding: 0, color: "var(--tc-primary)" }}>
            내 자료
          </button>
          {folderStack.map((f, i) => (
            <span key={f.id}>
              <span> / </span>
              <button
                onClick={() => {
                  const next = folderStack.slice(0, i + 1);
                  setFolderStack(next);
                  setCurrentFolderId(f.id);
                }}
                className="cursor-pointer"
                style={{ background: "none", border: "none", padding: 0, color: i === folderStack.length - 1 ? "var(--tc-text)" : "var(--tc-primary)", fontWeight: i === folderStack.length - 1 ? 600 : 400 }}
              >
                {f.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {isLoading && <EmptyState scope="panel" tone="loading" title="불러오는 중…" />}

      {!isLoading && items.folders.length === 0 && items.files.length === 0 && (
        <EmptyState scope="panel" tone="empty" title="자료가 없습니다" />
      )}

      {items.folders.length > 0 && (
        <>
          <SectionTitle>폴더 ({items.folders.length})</SectionTitle>
          <div className="flex flex-col gap-1.5">
            {items.folders.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl"
                style={{
                  padding: "var(--tc-space-3) var(--tc-space-4)",
                  minHeight: "var(--tc-touch-min)",
                  background: "var(--tc-surface)",
                  border: "1px solid var(--tc-border)",
                }}>
                <button
                  onClick={() => enterFolder(f)}
                  className="flex-1 flex items-center gap-2 text-left cursor-pointer"
                  style={{ background: "none", border: "none", minWidth: 0 }}
                >
                  <span style={{ fontSize: 18 }}>📁</span>
                  <span className="text-sm font-semibold truncate" style={{ color: "var(--tc-text)" }}>
                    {f.name}
                  </span>
                </button>
                <button
                  onClick={() => { if (confirm("폴더를 삭제하시겠습니까?")) deleteFolderMut.mutate(f.id); }}
                  className="cursor-pointer shrink-0"
                  style={{ padding: 8, minWidth: 36, minHeight: 36, background: "none", border: "none", color: "var(--tc-text-muted)" }}
                >
                  <Trash2 size={14} />
                </button>
                <ChevronRight size={14} style={{ color: "var(--tc-text-muted)" }} />
              </div>
            ))}
          </div>
        </>
      )}

      {items.files.length > 0 && (
        <>
          <SectionTitle>파일 ({items.files.length})</SectionTitle>
          <div className="flex flex-col gap-1.5">
            {items.files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl"
                style={{
                  padding: "var(--tc-space-3) var(--tc-space-4)",
                  minHeight: "var(--tc-touch-min)",
                  background: "var(--tc-surface)",
                  border: "1px solid var(--tc-border)",
                }}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: "var(--tc-text)" }}>
                    {f.displayName || f.name}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                    {formatBytes(f.sizeBytes)} · {new Date(f.createdAt).toLocaleDateString("ko-KR")}
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(f)}
                  className="cursor-pointer shrink-0"
                  style={{ padding: 8, minWidth: 36, minHeight: 36, background: "none", border: "none", color: "var(--tc-primary)" }}
                >
                  <Download size={14} />
                </button>
                <button
                  onClick={() => { if (confirm("파일을 삭제하시겠습니까?")) deleteFileMut.mutate(f.id); }}
                  className="cursor-pointer shrink-0"
                  style={{ padding: 8, minWidth: 36, minHeight: 36, background: "none", border: "none", color: "var(--tc-text-muted)" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 매치업은 PC 전용 안내 */}
      <SectionTitle>매치업</SectionTitle>
      <Card>
        <div className="text-[12px] leading-relaxed mb-2" style={{ color: "var(--tc-text-muted)" }}>
          OCR 기반 문제 매치업은 큰 화면이 필요해 PC에서 진행합니다.
        </div>
        <button
          onClick={() => { setPreferAdmin(true); navigate("/admin/storage/matchup"); }}
          className="flex items-center justify-center gap-2 w-full text-sm font-semibold cursor-pointer"
          style={{
            padding: "10px",
            minHeight: "var(--tc-touch-min)",
            borderRadius: "var(--tc-radius)",
            border: "1px solid var(--tc-border-strong)",
            background: "var(--tc-surface)",
            color: "var(--tc-text)",
          }}
        >
          <Monitor size={14} /> PC에서 매치업 열기
        </button>
      </Card>

      {/* Upload meta sheet */}
      <BottomSheet open={uploadMeta != null} onClose={() => setUploadMeta(null)} title="업로드 정보">
        {uploadMeta && (
          <div className="flex flex-col gap-2 pb-3">
            <Field label="표시 이름">
              <input
                type="text"
                value={uploadMeta.displayName}
                onChange={(e) => setUploadMeta({ ...uploadMeta, displayName: e.target.value })}
                className="w-full text-sm"
                style={fieldStyle}
              />
            </Field>
            <Field label="설명 (선택)">
              <input
                type="text"
                value={uploadMeta.description}
                onChange={(e) => setUploadMeta({ ...uploadMeta, description: e.target.value })}
                className="w-full text-sm"
                style={fieldStyle}
              />
            </Field>
            <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
              {uploadMeta.file.name} · {formatBytes(uploadMeta.file.size)}
            </div>
            <button
              onClick={() => uploadMut.mutate(uploadMeta)}
              disabled={uploadMut.isPending || !uploadMeta.displayName.trim()}
              className="text-sm font-bold cursor-pointer w-full disabled:opacity-50 mt-1"
              style={{
                padding: "14px",
                minHeight: "var(--tc-touch-min)",
                borderRadius: "var(--tc-radius)",
                border: "none",
                background: "var(--tc-primary)",
                color: "#fff",
              }}
            >
              {uploadMut.isPending ? "업로드 중…" : "업로드"}
            </button>
          </div>
        )}
      </BottomSheet>

      {/* Create folder sheet */}
      <BottomSheet open={createFolderOpen} onClose={() => setCreateFolderOpen(false)} title="새 폴더">
        <div className="flex flex-col gap-2 pb-3">
          <Field label="폴더 이름">
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className="w-full text-sm"
              style={fieldStyle}
              autoFocus
            />
          </Field>
          <button
            onClick={() => folderName.trim() && createFolderMut.mutate(folderName.trim())}
            disabled={createFolderMut.isPending || !folderName.trim()}
            className="text-sm font-bold cursor-pointer w-full disabled:opacity-50 mt-1"
            style={{
              padding: "14px",
              minHeight: "var(--tc-touch-min)",
              borderRadius: "var(--tc-radius)",
              border: "none",
              background: "var(--tc-primary)",
              color: "#fff",
            }}
          >
            생성
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  padding: "10px 12px",
  minHeight: "var(--tc-touch-min)",
  borderRadius: "var(--tc-radius-sm)",
  border: "1px solid var(--tc-border-strong)",
  background: "var(--tc-surface)",
  color: "var(--tc-text)",
  outline: "none",
};
