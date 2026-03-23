// PATH: src/shared/ui/upload/FileUploadZone.tsx
// 드래그 or 클릭 업로드 영역 SSOT — 엑셀/OMR 등 전역 동일 디자인 (modal.css .excel-upload-zone)

import { useRef, useState } from "react";

function UploadIcon({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CheckCircleIcon({ className, size = 48 }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

export interface FileUploadZoneProps {
  /** 영역 상단 라벨 (예: "Excel", "OMR") */
  titleLabel: string;
  /** 파일 선택 시 (여러 파일이면 모두 전달) */
  onFilesSelect: (files: File[]) => void;
  /** 단일 파일 모드: 선택된 파일 (있으면 filled 상태) */
  selectedFile?: File | null;
  /** 단일 파일 모드: 파일 취소/변경 */
  onClearFile?: () => void;
  /** multiple 여부 (true면 항상 빈 영역 표시, 목록은 부모에서) */
  multiple?: boolean;
  accept?: string;
  hintText?: string;
  disabled?: boolean;
  /** 단일 파일일 때 잘못된 파일 처리 (미지정 시 무시) */
  onInvalidFile?: (message: string) => void;
  /** 단일 파일 모드에서 파일 유효성 검사 (통과 시 true) */
  validateFile?: (file: File) => boolean;
}

export default function FileUploadZone({
  titleLabel,
  onFilesSelect,
  selectedFile = null,
  onClearFile,
  multiple = false,
  accept,
  hintText,
  disabled = false,
  onInvalidFile,
  validateFile,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragover, setDragover] = useState(false);

  const isFilled = !multiple && Boolean(selectedFile);

  const processFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    let list = Array.from(files);
    // accept 기반 파일 타입 필터링 (드래그앤드롭 포함 — input.accept는 파일 선택기만 필터)
    if (accept) {
      const patterns = accept.split(",").map((s) => s.trim().toLowerCase());
      list = list.filter((f) => {
        const mime = (f.type || "").toLowerCase();
        return patterns.some((p) => {
          if (p.endsWith("/*")) return mime.startsWith(p.slice(0, -1));
          return mime === p;
        });
      });
      if (list.length === 0) {
        onInvalidFile?.("허용된 형식의 파일만 업로드할 수 있습니다.");
        return;
      }
    }
    if (multiple) {
      onFilesSelect(list);
    } else {
      const file = list[0];
      if (validateFile && !validateFile(file)) {
        onInvalidFile?.("허용된 형식의 파일만 업로드할 수 있습니다.");
        return;
      }
      onFilesSelect([file]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragover(false);
    if (disabled || isFilled) return;
    processFiles(e.dataTransfer.files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) processFiles(files);
    e.target.value = "";
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (isFilled) return;
        if (!disabled) inputRef.current?.click();
      }}
      onKeyDown={(e) => {
        if (isFilled) return;
        if (e.key === "Enter" && !disabled) inputRef.current?.click();
      }}
      className={`excel-upload-zone ${dragover ? "excel-upload-zone--dragover" : ""} ${isFilled ? "excel-upload-zone--filled" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled && !isFilled) setDragover(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragover(false);
      }}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: "none" }}
        onChange={handleChange}
      />
      {isFilled ? (
        <div className="excel-upload-zone__filled">
          <CheckCircleIcon size={56} className="text-[var(--color-status-success,#10b981)]" />
          <span className="excel-upload-zone__filled-filename">{selectedFile!.name}</span>
          {onClearFile && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClearFile(); }}
              disabled={disabled}
              className="excel-upload-zone__filled-clear"
            >
              파일 변경
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="excel-upload-zone__head">
            <UploadIcon size={22} className="text-[var(--color-text-secondary)]" />
            <span className="excel-upload-zone__title">{titleLabel}</span>
          </div>
          <div className="excel-upload-zone__drag-label">Drag or Click</div>
          <div className="excel-upload-zone__upload" style={{ marginBottom: hintText ? undefined : 0 }}>
            <UploadIcon size={16} className="excel-upload-zone__upload-icon" />
            <span className="excel-upload-zone__upload-label">업로드</span>
          </div>
          {hintText ? (
            <div className="modal-hint" style={{ marginTop: "var(--space-1)" }}>
              {hintText}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
