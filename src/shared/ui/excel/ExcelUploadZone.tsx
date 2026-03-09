// PATH: src/shared/ui/excel/ExcelUploadZone.tsx
// 엑셀 업로드 — FileUploadZone SSOT 사용 (드래그 or 클릭 전역 동일 디자인)

import { feedback } from "@/shared/ui/feedback/feedback";
import FileUploadZone from "@/shared/ui/upload/FileUploadZone";

const DEFAULT_ACCEPT = ".xlsx,.xls";
const INVALID_FILE_MSG = "엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.";

export interface ExcelUploadZoneProps {
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (file: File) => void;
  selectedFile?: File | null;
  onClearFile?: () => void;
  accept?: string;
  hintText?: string;
  disabled?: boolean;
  onInvalidFile?: (message: string) => void;
}

export default function ExcelUploadZone({
  onFileSelect,
  selectedFile = null,
  onClearFile,
  accept = DEFAULT_ACCEPT,
  hintText = ".xlsx, .xls",
  disabled = false,
  onInvalidFile = (msg) => feedback.error(msg),
}: ExcelUploadZoneProps) {
  return (
    <FileUploadZone
      titleLabel="Excel"
      accept={accept}
      hintText={hintText}
      disabled={disabled}
      selectedFile={selectedFile}
      onClearFile={onClearFile}
      onFilesSelect={(files) => files[0] && onFileSelect(files[0])}
      validateFile={(file) => /\.(xlsx|xls)$/i.test(file.name)}
      onInvalidFile={(msg) => onInvalidFile(INVALID_FILE_MSG)}
    />
  );
}
