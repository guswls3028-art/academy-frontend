// PATH: src/app_admin/domains/tools/ppt/components/PdfUploadArea.tsx
// PDF 단일 파일 업로드 영역 — 드래그 앤 드롭 + 클릭

import { useRef, useState, useCallback } from "react";
import { feedback } from "@/shared/ui/feedback/feedback";
import styles from "./PdfUploadArea.module.css";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

interface PdfUploadAreaProps {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export default function PdfUploadArea({ file, onFileSelect, disabled }: PdfUploadAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragover, setDragover] = useState(false);

  // 거절 사유를 모아 사용자에게 노출 — silent reject 금지.
  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      if (arr.length === 0) return;
      const pdf = arr.find((f) => isPdfFile(f) && f.size <= MAX_FILE_SIZE);
      if (pdf) {
        onFileSelect(pdf);
        return;
      }
      const wrongType = arr.find((f) => !isPdfFile(f));
      if (wrongType) {
        feedback.warning(`PDF 파일만 업로드할 수 있습니다. (${wrongType.name})`);
        return;
      }
      const tooLarge = arr.find((f) => f.size > MAX_FILE_SIZE);
      if (tooLarge) {
        feedback.warning(`PDF가 100MB를 초과합니다. (${tooLarge.name} · ${formatBytes(tooLarge.size)})`);
      }
    },
    [onFileSelect],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragover(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = "";
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
  };

  // File selected state
  if (file) {
    return (
      <div
        className={`${styles.selectedCard} ${disabled ? styles.disabled : ""}`}
      >
        {/* PDF icon */}
        <div className={styles.selectedIcon}>
          <svg aria-hidden="true" className={styles.selectedIconSvg} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>

        <div className={styles.selectedMeta}>
          <div className={styles.selectedName}>
            {file.name}
          </div>
          <div className={styles.selectedSize}>
            {formatBytes(file.size)}
          </div>
        </div>

        {!disabled && (
          <button
            type="button"
            onClick={handleRemove}
            className={styles.removeButton}
            title="파일 변경"
            aria-label="선택한 PDF 제거"
          >
            &times;
          </button>
        )}
      </div>
    );
  }

  // Empty state — drop zone
  return (
    <div
      aria-disabled={disabled ? true : undefined}
      className={`${styles.dropzone} ${dragover ? styles.dropzoneActive : ""} ${disabled ? styles.disabled : ""}`}
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
        accept="application/pdf"
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
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
      <div className={styles.title}>
        PDF 파일 업로드
      </div>
      <div className={styles.description}>
        드래그하거나 클릭하여 PDF를 선택하세요
        <br />
        <span className={styles.hint}>
          PDF 파일 1개 · 최대 100MB
        </span>
      </div>
    </div>
  );
}
