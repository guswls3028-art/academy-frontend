// PATH: src/app_admin/domains/tools/ppt/components/PdfUploadArea.tsx
// PDF 단일 파일 업로드 영역 — 드래그 앤 드롭 + 클릭

import { useRef, useState, useCallback } from "react";

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

export default function PdfUploadArea({ file, onFileSelect, disabled }: PdfUploadAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragover, setDragover] = useState(false);

  const validate = useCallback((f: File): boolean => {
    if (f.type !== "application/pdf") return false;
    if (f.size > MAX_FILE_SIZE) return false;
    return true;
  }, []);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      const pdf = arr.find((f) => validate(f));
      if (pdf) onFileSelect(pdf);
    },
    [validate, onFileSelect],
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
        style={{
          border: "2px solid var(--color-primary)",
          borderRadius: "var(--radius-lg, 12px)",
          padding: "24px",
          background: "color-mix(in srgb, var(--color-primary) 4%, var(--bg-surface))",
          display: "flex",
          alignItems: "center",
          gap: 16,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {/* PDF icon */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            background: "var(--color-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 700,
            fontSize: 14,
            color: "var(--color-text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {file.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
            {formatBytes(file.size)}
          </div>
        </div>

        {!disabled && (
          <button
            type="button"
            onClick={handleRemove}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "1px solid var(--color-border-divider)",
              background: "var(--bg-surface)",
              color: "var(--color-text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: 16,
              fontWeight: 700,
            }}
            title="파일 변경"
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
      role="button"
      tabIndex={0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragover(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDragover(false); }}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${dragover ? "var(--color-primary)" : "var(--color-border-divider-strong)"}`,
        borderRadius: "var(--radius-lg, 12px)",
        padding: "32px 24px",
        textAlign: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        background: dragover
          ? "color-mix(in srgb, var(--color-primary) 6%, var(--bg-surface))"
          : "var(--bg-surface)",
        transition: "all 0.2s ease",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        style={{ display: "none" }}
        onChange={handleChange}
      />
      <svg
        width="36" height="36" viewBox="0 0 24 24" fill="none"
        stroke="var(--color-text-muted)" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"
        style={{ margin: "0 auto 16px", opacity: 0.7 }}
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
      <div style={{ fontWeight: 700, fontSize: 16, color: "var(--color-text-primary)", lineHeight: 1.3 }}>
        PDF 파일 업로드
      </div>
      <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6, lineHeight: 1.5 }}>
        드래그하거나 클릭하여 PDF를 선택하세요
        <br />
        <span style={{ fontSize: 12, opacity: 0.8 }}>
          PDF 파일 1개 · 최대 100MB
        </span>
      </div>
    </div>
  );
}
