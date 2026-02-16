// PATH: src/shared/ui/excel/ExcelUploadZone.tsx
// 엑셀 업로드 드래그 영역 SSOT — 전역 통일: "Drag or Click" + 업로드(아이콘) (docs/DESIGN_SSOT.md §8)

import { useRef, useState } from "react";
import { feedback } from "@/shared/ui/feedback/feedback";

const DEFAULT_ACCEPT = ".xlsx,.xls";
const INVALID_FILE_MSG = "엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.";

function ExcelIcon({ className, size = 24 }: { className?: string; size?: number }) {
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

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

export interface ExcelUploadZoneProps {
  /** 부모에서 전달한 file input ref (제어 불필요 시 내부 ref 사용) */
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /** 파일 선택 시 (유효한 파일만 호출) */
  onFileSelect: (file: File) => void;
  /** accept (기본 .xlsx,.xls) */
  accept?: string;
  /** 하단 보조 안내 (선택, 미지정 시 .xlsx, .xls만 표시) */
  hintText?: string;
  /** 비활성화 */
  disabled?: boolean;
  /** 잘못된 파일 시 (미지정 시 feedback.error) */
  onInvalidFile?: (message: string) => void;
}

export default function ExcelUploadZone({
  inputRef: externalRef,
  onFileSelect,
  accept = DEFAULT_ACCEPT,
  hintText = ".xlsx, .xls",
  disabled = false,
  onInvalidFile = (msg) => feedback.error(msg),
}: ExcelUploadZoneProps) {
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = externalRef ?? internalRef;
  const [dragover, setDragover] = useState(false);

  const handleFile = (file: File | null) => {
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      onInvalidFile(INVALID_FILE_MSG);
      return;
    }
    onFileSelect(file);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && !disabled && inputRef.current?.click()}
      className={`excel-upload-zone ${dragover ? "excel-upload-zone--dragover" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setDragover(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragover(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragover(false);
        if (disabled) return;
        const file = e.dataTransfer.files[0];
        handleFile(file ?? null);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <div className="excel-upload-zone__head">
        <ExcelIcon size={22} style={{ color: "var(--color-text-secondary)" }} />
        <span className="excel-upload-zone__title">Excel</span>
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
    </div>
  );
}
