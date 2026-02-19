/**
 * 과제 제출 — 동영상·사진 업로드 → 학생 인벤토리(선생 인벤토리와 동일)
 */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import { fetchMyProfile } from "@/student/domains/profile/api/profile";
import { uploadFile } from "@/features/storage/api/storage.api";

const ACCEPT = "image/*,video/*";
const MAX_SIZE_MB = 100;

export default function SubmitAssignmentPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["student-profile"],
    queryFn: fetchMyProfile,
  });

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!profile?.ps_number) throw new Error("프로필을 불러오는 중입니다.");
      if (!selectedFile) throw new Error("파일을 선택해 주세요.");
      if (selectedFile.size > MAX_SIZE_MB * 1024 * 1024) {
        throw new Error(`파일 크기는 ${MAX_SIZE_MB}MB 이하여야 합니다.`);
      }
      return uploadFile({
        scope: "student",
        studentPs: profile.ps_number,
        folderId: null,
        displayName: selectedFile.name,
        description: "과제 제출",
        icon: selectedFile.type.startsWith("video/") ? "video" : "image",
        file: selectedFile,
      });
    },
    onSuccess: () => {
      setSelectedFile(null);
      setError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["storage-inventory", "student", profile?.ps_number] });
    },
    onError: (e: Error) => {
      setError(e.message || "업로드에 실패했습니다.");
    },
  });

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`파일 크기는 ${MAX_SIZE_MB}MB 이하여야 합니다.`);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const canSubmit = !profileLoading && !!profile?.ps_number && !!selectedFile;

  return (
    <StudentPageShell
      title="과제 제출"
      description="동영상 또는 사진을 올리면 선생님 인벤토리에 저장됩니다."
      onBack={() => window.history.back()}
    >
      <div className="stu-section stu-section--nested" style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
        {profileLoading && <div className="stu-muted">프로필 불러오는 중…</div>}
        {!profileLoading && profile && !profile.ps_number && (
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
          <div style={{ padding: "var(--stu-space-3)", background: "var(--stu-success-bg)", borderRadius: "var(--stu-radius)", fontSize: 14, color: "var(--stu-success-text)" }}>
            과제가 제출되었습니다. 선생님이 확인하실 수 있습니다.
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          onChange={onFileChange}
          style={{ display: "none" }}
        />
        <button
          type="button"
          className="stu-btn stu-btn--secondary"
          disabled={profileLoading}
          onClick={() => fileInputRef.current?.click()}
          style={{ alignSelf: "flex-start" }}
        >
          파일 선택 (동영상·사진, 최대 {MAX_SIZE_MB}MB)
        </button>
        {selectedFile && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--stu-space-2) var(--stu-space-3)", background: "var(--stu-surface)", border: "1px solid var(--stu-border)", borderRadius: "var(--stu-radius)", fontSize: 14 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)}MB)</span>
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
      </div>
    </StudentPageShell>
  );
}
