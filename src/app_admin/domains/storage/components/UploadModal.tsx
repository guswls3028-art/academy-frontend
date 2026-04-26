// PATH: src/app_admin/domains/storage/components/UploadModal.tsx
// 파일 업로드 모달 — 단일/다중 파일 지원, 매치업 토글

import { useState } from "react";
import { FileText, Image, File, Sparkles, X } from "lucide-react";
import { Button, CloseButton } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import FileUploadZone from "@/shared/ui/upload/FileUploadZone";
import { compressImageToWebP } from "../utils/imageCompress";
import styles from "./UploadModal.module.css";

const ICON_OPTIONS = [
  { id: "file-text", label: "문서", Icon: FileText },
  { id: "image", label: "이미지", Icon: Image },
  { id: "file", label: "파일", Icon: File },
] as const;

const MATCHUP_SUPPORTED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

type UploadPayload = {
  displayName: string;
  description: string;
  icon: string;
  file: File;
  promoteToMatchup?: boolean;
};

type UploadModalProps = {
  onClose: () => void;
  onUpload: (payload: UploadPayload) => Promise<void>;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

function defaultDisplayName(name: string): string {
  return name.replace(/\.[^.]+$/, "") || name;
}

export default function UploadModal({ onClose, onUpload }: UploadModalProps) {
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<string>("file-text");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [promoteToMatchup, setPromoteToMatchup] = useState(false);

  const isMulti = files.length > 1;
  const matchupEligibleCount = files.filter((f) => MATCHUP_SUPPORTED_TYPES.has(f.type)).length;
  const hasMatchupEligible = matchupEligibleCount > 0;
  const totalSize = files.reduce((s, f) => s + f.size, 0);

  // FileUploadZone callback — 드래그&드롭 또는 클릭 선택
  const handleFilesSelect = async (fs: File[]) => {
    if (!fs.length) return;
    // 이미지는 WebP 압축 (저장소는 일반 파일도 받지만 이미지면 압축)
    const processed: File[] = [];
    for (const f of fs) {
      if (f.type.startsWith("image/")) {
        try {
          processed.push(await compressImageToWebP(f));
        } catch {
          processed.push(f);
        }
      } else {
        processed.push(f);
      }
    }
    // 기존 선택에 추가 (드래그로 여러 번 가능)
    setFiles((prev) => [...prev, ...processed]);
    // 단일이고 displayName 비었을 때만 자동 채움
    if (processed.length === 1 && files.length === 0 && !displayName) {
      setDisplayName(defaultDisplayName(processed[0].name));
    }
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      feedback.warning("파일을 선택해 주세요.");
      return;
    }
    setUploading(true);
    setProgress({ current: 0, total: files.length });
    try {
      let succeeded = 0;
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setProgress({ current: i, total: files.length });
        const filePromote = promoteToMatchup && MATCHUP_SUPPORTED_TYPES.has(f.type);
        try {
          await onUpload({
            displayName: isMulti ? defaultDisplayName(f.name) : (displayName.trim() || f.name),
            description: isMulti ? "" : description,
            icon: isMulti ? "file-text" : icon,
            file: f,
            promoteToMatchup: filePromote,
          });
          succeeded++;
        } catch (err) {
          feedback.error(`${f.name}: ${(err as Error).message}`);
        }
      }
      setProgress({ current: files.length, total: files.length });
      if (isMulti && succeeded > 0) {
        feedback.success(`${succeeded} / ${files.length}개 업로드 완료`);
      }
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span>파일 업로드</span>
          <CloseButton onClick={onClose} />
        </div>
        <div className={styles.body}>
          {/* 드래그&드롭 + 클릭 업로드 영역 (SSOT: FileUploadZone) */}
          <div className={styles.field}>
            <label>
              파일
              {files.length > 0 && (
                <span style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 400, marginLeft: 6 }}>
                  · {files.length}개 · {formatBytes(totalSize)}
                </span>
              )}
            </label>
            <FileUploadZone
              titleLabel="파일 업로드"
              multiple
              onFilesSelect={handleFilesSelect}
              hintText="여러 파일을 한 번에 드래그하거나 클릭으로 선택할 수 있습니다."
              disabled={uploading}
              onInvalidFile={(msg) => feedback.warning(msg)}
            />
            {files.length > 0 && (
              <div
                data-testid="upload-modal-file-list"
                style={{
                  marginTop: 8, display: "flex", flexDirection: "column", gap: 4,
                  maxHeight: 140, overflowY: "auto",
                  fontSize: 12,
                }}
              >
                {files.map((f, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "4px 8px", borderRadius: 4,
                    background: "var(--color-bg-surface-soft)",
                  }}>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.name}
                    </span>
                    <span style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>{formatBytes(f.size)}</span>
                    {!uploading && (
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "grid", placeItems: "center", color: "var(--color-text-muted)" }}
                        title="제거"
                        aria-label={`${f.name} 제거`}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 단일 파일 메타 입력 — 다중 모드에서는 hidden (각 파일은 원본명/기본 아이콘) */}
          {!isMulti && files.length === 1 && (
            <>
              <div className={styles.field}>
                <label>제목</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="제목"
                />
              </div>
              <div className={styles.field}>
                <label>설명</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="설명 (선택)"
                  rows={2}
                />
              </div>
              <div className={styles.field}>
                <label>아이콘</label>
                <div className={styles.iconGrid}>
                  {ICON_OPTIONS.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      className={styles.iconBtn + (icon === id ? " " + styles.iconBtnActive : "")}
                      onClick={() => setIcon(id)}
                      title={label}
                    >
                      <Icon size={24} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 매치업 토글 — 매치업 가능 파일이 1개 이상일 때 노출 */}
          {hasMatchupEligible && (
            <div className={styles.field}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <input
                  type="checkbox"
                  data-testid="upload-modal-promote-matchup"
                  checked={promoteToMatchup}
                  onChange={(e) => setPromoteToMatchup(e.target.checked)}
                />
                <Sparkles size={14} style={{ color: "var(--color-brand-primary)" }} />
                <span>
                  매치업 자료로도 등록 (AI 분석)
                  {isMulti && matchupEligibleCount < files.length && (
                    <span style={{ fontWeight: 400, color: "var(--color-text-muted)", marginLeft: 6, fontSize: 11 }}>
                      · PDF/PNG/JPG {matchupEligibleCount}개만
                    </span>
                  )}
                </span>
              </label>
              {promoteToMatchup && (
                <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4, marginLeft: 24 }}>
                  저장 후 매치업 페이지에서 분석 진행률을 확인할 수 있습니다.
                </span>
              )}
            </div>
          )}
        </div>
        <div className={styles.footer}>
          <Button size="sm" intent="secondary" onClick={onClose} disabled={uploading}>
            취소
          </Button>
          <Button
            size="sm"
            intent="primary"
            onClick={handleSubmit}
            disabled={files.length === 0 || uploading}
          >
            {uploading
              ? (progress ? `업로드 중… ${progress.current}/${progress.total}` : "업로드 중…")
              : (files.length <= 1 ? "업로드" : `${files.length}개 업로드`)}
          </Button>
        </div>
      </div>
    </div>
  );
}
