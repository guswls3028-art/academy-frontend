/**
 * 성적표 제출 — 이미지·PDF 업로드 → 학생 인벤토리
 */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import { fetchMyProfile } from "@/student/domains/profile/api/profile";
import { uploadMyFile, fetchMyInventory, getMyFileUrl, type InventoryFile } from "@/student/domains/inventory/api/inventory";
import { IconFileText, IconImage, IconDownload } from "@/student/shared/ui/icons/Icons";
import { studentToast } from "@/student/shared/ui/feedback/studentToast";

const ACCEPT = "image/*,.pdf";
const MAX_SIZE_MB = 20;

function FileIcon({ file }: { file: InventoryFile }) {
  const ct = file.contentType || "";
  const s = { width: 16, height: 16, color: "var(--stu-text-muted)", flexShrink: 0 } as const;
  if (ct.startsWith("image/")) return <IconImage style={s} />;
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
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function SubmitScorePage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["student", "me"],
    queryFn: fetchMyProfile,
  });

  const ps = profile?.ps_number || "";

  const { data: inventory } = useQuery({
    queryKey: ["student-inventory", ps],
    queryFn: () => fetchMyInventory(ps),
    enabled: !!ps,
  });

  // 최근 성적표 제출 (description에 "성적표" 포함 or icon=file-text, 최근 5개)
  const recentScores = (inventory?.files ?? [])
    .filter((f) => f.description?.includes("성적표") || (f.icon === "file-text" && f.folderId === null))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 5);

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!ps) throw new Error("프로필을 불러오는 중입니다.");
      if (!selectedFile) throw new Error("파일을 선택해 주세요.");
      if (selectedFile.size > MAX_SIZE_MB * 1024 * 1024) {
        throw new Error(`파일 크기는 ${MAX_SIZE_MB}MB 이하여야 합니다.`);
      }
      return uploadMyFile(ps, selectedFile, {
        displayName: selectedFile.name,
        description: "성적표 제출",
        icon: "file-text",
      });
    },
    onSuccess: () => {
      setSelectedFile(null);
      setError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["student-inventory", ps] });
    },
    onError: (e: Error) => {
      setError(e.message || "업로드에 실패했습니다.");
    },
  });

  const handleDownload = async (file: InventoryFile) => {
    try {
      const { url } = await getMyFileUrl(file.r2Key);
      if (url) window.open(url, "_blank", "noopener");
    } catch { studentToast.error("다운로드에 실패했습니다."); }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);
    if (!file) { setSelectedFile(null); return; }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`파일 크기는 ${MAX_SIZE_MB}MB 이하여야 합니다.`);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const canSubmit = !profileLoading && !!ps && !!selectedFile;

  return (
    <StudentPageShell
      title="성적표 제출"
      description="성적표 이미지 또는 PDF를 올리면 인벤토리에 저장됩니다."
      onBack={() => window.history.back()}
    >
      <div className="stu-section stu-section--nested" style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
        {profileLoading && <div className="stu-muted">프로필 불러오는 중…</div>}
        {!profileLoading && profile?.isParentReadOnly && (
          <div role="alert" style={{ padding: "var(--stu-space-4)", background: "var(--stu-surface-soft)", border: "1px solid var(--stu-border)", borderRadius: "var(--stu-radius)", fontSize: 14, color: "var(--stu-text-muted)" }}>
            학부모 계정은 성적표를 제출할 수 없습니다. 자녀(학생) 계정으로 로그인해 주세요.
          </div>
        )}
        {!profileLoading && profile && !ps && !profile.isParentReadOnly && (
          <div role="alert" style={{ padding: "var(--stu-space-3)", background: "var(--stu-surface)", border: "1px solid var(--stu-border)", borderRadius: "var(--stu-radius)", fontSize: 14 }}>
            제출 기능을 사용할 수 없습니다. 관리자에게 문의해 주세요.
          </div>
        )}
        {uploadMut.isError && (
          <div role="alert" style={{ padding: "var(--stu-space-3)", background: "var(--stu-danger-bg)", border: "1px solid var(--stu-danger-border)", borderRadius: "var(--stu-radius)", fontSize: 14, color: "var(--stu-danger-text)", fontWeight: 600 }}>
            {error || (uploadMut.error instanceof Error ? uploadMut.error.message : "업로드에 실패했습니다.")}
          </div>
        )}
        {uploadMut.isSuccess && (
          <div style={{ padding: "var(--stu-space-3)", background: "var(--stu-success-bg)", borderRadius: "var(--stu-radius)", fontSize: 14, color: "var(--stu-success-text)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>성적표가 제출되었습니다.</span>
            <Link to="/student/inventory" style={{ fontSize: 13, fontWeight: 600, color: "var(--stu-primary)" }}>인벤토리 보기 →</Link>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          onChange={onFileChange}
          style={{ display: "none" }}
        />
        {!profile?.isParentReadOnly && (
        <>
        <button
          type="button"
          className="stu-btn stu-btn--secondary"
          disabled={profileLoading}
          onClick={() => fileInputRef.current?.click()}
          style={{ alignSelf: "flex-start" }}
        >
          파일 선택 (이미지·PDF, 최대 {MAX_SIZE_MB}MB)
        </button>
        {selectedFile && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--stu-space-2) var(--stu-space-3)", background: "var(--stu-surface)", border: "1px solid var(--stu-border)", borderRadius: "var(--stu-radius)", fontSize: 14 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedFile.name} ({formatBytes(selectedFile.size)})</span>
            <button type="button" className="stu-btn stu-btn--ghost stu-btn--sm" onClick={() => { setSelectedFile(null); setError(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
              삭제
            </button>
          </div>
        )}
        <button
          type="button"
          className="stu-btn stu-btn--primary"
          disabled={!canSubmit || uploadMut.isPending}
          onClick={() => uploadMut.mutate()}
          style={{ alignSelf: "flex-end", minHeight: 44 }}
        >
          {uploadMut.isPending ? "업로드 중…" : "제출하기"}
        </button>
        </>
        )}

        {/* 최근 제출 내역 */}
        {recentScores.length > 0 && (
          <div style={{ marginTop: "var(--stu-space-2)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--stu-text-muted)", marginBottom: 8 }}>
              최근 제출
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {recentScores.map((f) => (
                <div
                  key={f.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    background: "var(--stu-surface)",
                    border: "1px solid var(--stu-border)",
                    borderRadius: "var(--stu-radius)",
                    fontSize: 13,
                  }}
                >
                  <FileIcon file={f} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.displayName || f.name}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--stu-text-muted)", flexShrink: 0 }}>
                    {formatBytes(f.sizeBytes)} · {formatDate(f.createdAt)}
                  </span>
                  <button
                    type="button"
                    className="stu-btn stu-btn--ghost stu-btn--sm"
                    style={{ padding: 4 }}
                    onClick={() => handleDownload(f)}
                    title="보기"
                  >
                    <IconDownload style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </StudentPageShell>
  );
}
