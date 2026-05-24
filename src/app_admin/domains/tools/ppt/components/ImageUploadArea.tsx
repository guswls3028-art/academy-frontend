// PATH: src/app_admin/domains/tools/ppt/components/ImageUploadArea.tsx
// 다중 이미지 업로드 영역 — 드래그 앤 드롭 + 클릭

import { useRef, useState, useCallback } from "react";
import { feedback } from "@/shared/ui/feedback/feedback";
import styles from "./ImageUploadArea.module.css";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp", "image/tiff"];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_FILES = 500;

interface ImageUploadAreaProps {
  onFilesAdd: (files: File[]) => void;
  disabled?: boolean;
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function ImageUploadArea({ onFilesAdd, disabled }: ImageUploadAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragover, setDragover] = useState(false);

  // 거절 사유를 모아 사용자에게 노출 — silent reject 금지.
  const validate = useCallback((files: FileList | File[]) => {
    const valid: File[] = [];
    const rejectedType: string[] = [];
    const rejectedSize: string[] = [];
    for (const f of Array.from(files)) {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        rejectedType.push(f.name || "(이름 없음)");
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        rejectedSize.push(`${f.name} (${formatMb(f.size)})`);
        continue;
      }
      valid.push(f);
    }
    if (rejectedType.length) {
      feedback.warning(
        `지원하지 않는 형식: ${rejectedType.slice(0, 3).join(", ")}` +
          (rejectedType.length > 3 ? ` 외 ${rejectedType.length - 3}개` : "") +
          " · JPG/PNG/GIF/WebP/BMP/TIFF만 가능합니다.",
      );
    }
    if (rejectedSize.length) {
      feedback.warning(
        `용량 초과(20MB): ${rejectedSize.slice(0, 3).join(", ")}` +
          (rejectedSize.length > 3 ? ` 외 ${rejectedSize.length - 3}개` : ""),
      );
    }
    return valid;
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragover(false);
    if (disabled) return;
    const valid = validate(e.dataTransfer.files);
    if (valid.length) onFilesAdd(valid);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const valid = validate(e.target.files);
      if (valid.length) onFilesAdd(valid);
    }
    e.target.value = "";
  };

  return (
    <div
      aria-disabled={disabled ? true : undefined}
      className={`${styles.dropzone} ${dragover ? styles.dropzoneActive : ""} ${disabled ? styles.dropzoneDisabled : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragover(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDragover(false); }}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        className={styles.fileInput}
        onChange={handleChange}
      />
      <svg
        aria-hidden="true"
        className={styles.icon}
        viewBox="0 0 24 24" fill="none"
        stroke="var(--color-text-muted)" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
      <div className={styles.title}>
        이미지 업로드
      </div>
      <div className={styles.description}>
        드래그하거나 클릭하여 이미지를 추가하세요
        <br />
        <span className={styles.hint}>
          JPG, PNG, GIF, WebP, BMP, TIFF · 최대 20MB/장 · {MAX_FILES}장
        </span>
      </div>
    </div>
  );
}
