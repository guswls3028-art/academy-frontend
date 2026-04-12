// PATH: src/app_admin/domains/tools/ppt/components/ImageUploadArea.tsx
// 다중 이미지 업로드 영역 — 드래그 앤 드롭 + 클릭

import { useRef, useState, useCallback } from "react";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp", "image/tiff"];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

interface ImageUploadAreaProps {
  onFilesAdd: (files: File[]) => void;
  disabled?: boolean;
}

export default function ImageUploadArea({ onFilesAdd, disabled }: ImageUploadAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragover, setDragover] = useState(false);

  const validate = useCallback((files: FileList | File[]) => {
    const valid: File[] = [];
    for (const f of Array.from(files)) {
      if (!ACCEPTED_TYPES.includes(f.type)) continue;
      if (f.size > MAX_FILE_SIZE) continue;
      valid.push(f);
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
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        style={{ display: "none" }}
        onChange={handleChange}
      />
      <svg
        width="36" height="36" viewBox="0 0 24 24" fill="none"
        stroke="var(--color-text-muted)" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"
        style={{ margin: "0 auto 16px", opacity: 0.7 }}
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
      <div style={{ fontWeight: 700, fontSize: 16, color: "var(--color-text-primary)", lineHeight: 1.3 }}>
        이미지 업로드
      </div>
      <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6, lineHeight: 1.5 }}>
        드래그하거나 클릭하여 이미지를 추가하세요
        <br />
        <span style={{ fontSize: 12, opacity: 0.8 }}>
          JPG, PNG, GIF, WebP, BMP, TIFF · 최대 20MB/장 · 50장
        </span>
      </div>
    </div>
  );
}
