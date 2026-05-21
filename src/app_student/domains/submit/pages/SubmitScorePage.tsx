/**
 * 성적표 제출 — 이미지·PDF 업로드 → 학생 인벤토리
 */
import { useMemo, useState, useRef, type ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import { fetchMyProfile } from "@student/domains/profile/api/profile.api";
import { uploadMyFile, fetchMyInventory, getMyFileUrl, type InventoryFile } from "@student/domains/inventory/api/inventory.api";
import { IconFileText, IconImage, IconDownload, IconChevronRight } from "@student/shared/ui/icons/Icons";
import { studentToast } from "@student/shared/ui/feedback/studentToast";
import styles from "./SubmitScorePage.module.css";

const ACCEPT = "image/*,.pdf";
const MAX_SIZE_MB = 20;

function FileIcon({ file }: { file: InventoryFile }) {
  const ct = file.contentType || "";
  if (ct.startsWith("image/")) return <IconImage className={styles.fileIcon} />;
  return <IconFileText className={styles.fileIcon} />;
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
  const recentScores = useMemo(
    () => (inventory?.files ?? [])
      .filter((file) => file.description?.includes("성적표") || (file.icon === "file-text" && file.folderId === null))
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, 5),
    [inventory?.files],
  );

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
      clearSelectedFile();
      qc.invalidateQueries({ queryKey: ["student-inventory", ps] });
      studentToast.success("성적표가 제출되었습니다.");
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

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
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
      <div className={`stu-section stu-section--nested ${styles.sectionStack}`}>
        {profileLoading && <div className="stu-muted">프로필 불러오는 중…</div>}
        {!profileLoading && profile?.isParentReadOnly && (
          <div role="alert" className={`${styles.alert} ${styles.alertMuted}`}>
            학부모 계정은 성적표를 제출할 수 없습니다. 자녀(학생) 계정으로 로그인해 주세요.
          </div>
        )}
        {!profileLoading && profile && !ps && !profile.isParentReadOnly && (
          <div role="alert" className={`${styles.alert} ${styles.alertPlain}`}>
            제출 기능을 사용할 수 없습니다. 관리자에게 문의해 주세요.
          </div>
        )}
        {uploadMut.isError && (
          <div role="alert" className={`${styles.alert} ${styles.alertDanger}`}>
            {error || (uploadMut.error instanceof Error ? uploadMut.error.message : "업로드에 실패했습니다.")}
          </div>
        )}
        {uploadMut.isSuccess && (
          <div className={styles.successBanner}>
            <span>성적표가 제출되었습니다.</span>
            <Link to="/student/inventory" className={styles.successLink}>
              인벤토리 보기
              <IconChevronRight className={styles.successLinkIcon} aria-hidden="true" />
            </Link>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          onChange={onFileChange}
          className={styles.hiddenInput}
        />
        {!profile?.isParentReadOnly && (
        <>
        <button
          type="button"
          disabled={profileLoading}
          onClick={() => fileInputRef.current?.click()}
          className={`stu-btn stu-btn--secondary ${styles.chooseButton}`}
        >
          파일 선택 (이미지·PDF, 최대 {MAX_SIZE_MB}MB)
        </button>
        {selectedFile && (
          <div className={styles.selectedFile}>
            <span className={styles.selectedFileName}>{selectedFile.name} ({formatBytes(selectedFile.size)})</span>
            <button type="button" className="stu-btn stu-btn--ghost stu-btn--sm" onClick={clearSelectedFile}>
              삭제
            </button>
          </div>
        )}
        <button
          type="button"
          disabled={!canSubmit || uploadMut.isPending}
          onClick={() => uploadMut.mutate()}
          className={`stu-btn stu-btn--primary ${styles.submitButton}`}
        >
          {uploadMut.isPending ? "업로드 중…" : "제출하기"}
        </button>
        </>
        )}

        {/* 최근 제출 내역 */}
        {recentScores.length > 0 && (
          <div className={styles.recent}>
            <div className={styles.recentTitle}>
              최근 제출
            </div>
            <div className={styles.recentList}>
              {recentScores.map((f) => (
                <div
                  key={f.id}
                  className={styles.recentItem}
                >
                  <FileIcon file={f} />
                  <span className={styles.fileName}>
                    {f.displayName || f.name}
                  </span>
                  <span className={styles.fileMeta}>
                    {formatBytes(f.sizeBytes)} · {formatDate(f.createdAt)}
                  </span>
                  <button
                    type="button"
                    className={`stu-btn stu-btn--ghost stu-btn--sm ${styles.iconButton}`}
                    onClick={() => handleDownload(f)}
                    title="보기"
                  >
                    <IconDownload className={styles.downloadIcon} />
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
