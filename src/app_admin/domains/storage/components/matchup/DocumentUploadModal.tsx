// PATH: src/app_admin/domains/storage/components/matchup/DocumentUploadModal.tsx

import { useState, useRef } from "react";
import { Upload, X, Image as ImageIcon, FileText } from "lucide-react";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { imagesToPdf } from "./imagesToPdf";

type Props = {
  onClose: () => void;
  onUpload: (payload: { file: File; title: string; subject: string; grade_level: string }) => Promise<void>;
};

const ACCEPT = ".pdf,.png,.jpg,.jpeg";
const MAX_SIZE = 50 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg"];

export default function DocumentUploadModal({ onClose, onUpload }: Props) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [mergingPdf, setMergingPdf] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isImagesMode = files.length > 0 && files.every((f) => IMAGE_TYPES.includes(f.type));
  const totalSize = files.reduce((s, f) => s + f.size, 0);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    if (selected.length > 1) {
      // 여러 개면 전부 이미지여야 함
      if (!selected.every((f) => IMAGE_TYPES.includes(f.type))) {
        feedback.error("여러 장 업로드는 이미지만 가능합니다 (PDF는 1개만)");
        return;
      }
    }

    // PDF는 1개만
    if (selected.some((f) => f.type === "application/pdf") && selected.length > 1) {
      feedback.error("PDF는 1개만 업로드 가능합니다");
      return;
    }

    const totalSz = selected.reduce((s, f) => s + f.size, 0);
    if (totalSz > MAX_SIZE) {
      feedback.error("전체 크기가 50MB를 초과합니다");
      return;
    }

    setFiles(selected);
    if (!title) {
      const baseName = selected[0].name.replace(/\.[^.]+$/, "");
      setTitle(baseName);
    }
  };

  const removeFile = (idx: number) => {
    setFiles(files.filter((_, i) => i !== idx));
  };

  const moveFile = (idx: number, dir: -1 | 1) => {
    const next = [...files];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setFiles(next);
  };

  const handleSubmit = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      let finalFile: File;
      if (files.length === 1) {
        finalFile = files[0];
      } else {
        // 여러 이미지 → PDF 병합
        setMergingPdf(true);
        const pdfName = (title || "scan").replace(/[^\w가-힣\-]/g, "_") + ".pdf";
        finalFile = await imagesToPdf(files, pdfName);
        setMergingPdf(false);
      }

      await onUpload({
        file: finalFile,
        title: title || finalFile.name,
        subject,
        grade_level: gradeLevel,
      });
      onClose();
    } catch (e) {
      console.error(e);
      feedback.error(mergingPdf ? "PDF 병합에 실패했습니다" : "업로드에 실패했습니다");
    } finally {
      setUploading(false);
      setMergingPdf(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
      }}
      onClick={uploading ? undefined : onClose}
    >
      <div
        style={{
          background: "var(--color-bg-surface)", borderRadius: "var(--radius-xl)",
          width: 480, maxWidth: "90vw", maxHeight: "90vh",
          padding: "var(--space-6)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-5)" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>문서 업로드</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        {/* 파일 선택 */}
        <div
          style={{
            border: "2px dashed var(--color-border-divider)", borderRadius: "var(--radius-lg)",
            padding: "var(--space-6)", textAlign: "center", cursor: "pointer",
            marginBottom: "var(--space-3)",
            background: files.length > 0 ? "color-mix(in srgb, var(--color-brand-primary) 5%, var(--color-bg-surface))" : undefined,
          }}
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={24} style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-2)" }} />
          <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-secondary)" }}>
            {files.length === 0
              ? "PDF 1개 또는 이미지 여러 장 선택"
              : files.length === 1
                ? files[0].name
                : `이미지 ${files.length}장 선택됨`}
          </p>
          <p style={{ margin: "var(--space-1) 0 0", fontSize: 12, color: "var(--color-text-muted)" }}>
            {files.length === 0
              ? "여러 장은 자동으로 PDF로 합쳐집니다 · 최대 50MB"
              : `${(totalSize / 1024 / 1024).toFixed(1)}MB`}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            onChange={handleFiles}
            style={{ display: "none" }}
          />
        </div>

        {/* 여러 이미지 목록 + 순서 변경 */}
        {files.length > 1 && isImagesMode && (
          <div style={{
            marginBottom: "var(--space-4)",
            border: "1px solid var(--color-border-divider)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-2)",
            maxHeight: 200, overflow: "auto",
          }}>
            <p style={{ margin: "0 0 var(--space-2)", fontSize: 11, color: "var(--color-text-muted)" }}>
              업로드 순서 (위→아래가 1페이지→끝페이지). ↑↓ 버튼으로 순서 변경.
            </p>
            {files.map((f, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: "var(--space-2)",
                padding: "var(--space-1) var(--space-2)",
                fontSize: 12,
              }}>
                <ImageIcon size={14} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {i + 1}. {f.name}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); moveFile(i, -1); }}
                  disabled={i === 0}
                  style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.3 : 1, fontSize: 12 }}
                  title="위로"
                >↑</button>
                <button
                  onClick={(e) => { e.stopPropagation(); moveFile(i, 1); }}
                  disabled={i === files.length - 1}
                  style={{ background: "none", border: "none", cursor: i === files.length - 1 ? "default" : "pointer", opacity: i === files.length - 1 ? 0.3 : 1, fontSize: 12 }}
                  title="아래로"
                >↓</button>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}
                  title="제거"
                ><X size={12} /></button>
              </div>
            ))}
            <div style={{
              padding: "var(--space-2)",
              background: "color-mix(in srgb, var(--color-brand-primary) 5%, transparent)",
              borderRadius: "var(--radius-sm)",
              fontSize: 11, color: "var(--color-brand-primary)",
              display: "flex", alignItems: "center", gap: "var(--space-2)",
            }}>
              <FileText size={12} />
              <span>자동으로 {files.length}장 PDF로 합쳐서 업로드됩니다</span>
            </div>
          </div>
        )}

        {/* 메타데이터 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)" }}>
            제목
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="문서 제목"
              style={{
                display: "block", width: "100%", marginTop: "var(--space-1)",
                padding: "var(--space-2) var(--space-3)", border: "1px solid var(--color-border-divider)",
                borderRadius: "var(--radius-md)", fontSize: 14, background: "var(--color-bg-surface)",
              }}
            />
          </label>

          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <label style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)" }}>
              과목
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="예: 수학"
                style={{
                  display: "block", width: "100%", marginTop: "var(--space-1)",
                  padding: "var(--space-2) var(--space-3)", border: "1px solid var(--color-border-divider)",
                  borderRadius: "var(--radius-md)", fontSize: 14, background: "var(--color-bg-surface)",
                }}
              />
            </label>
            <label style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)" }}>
              학년
              <input
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                placeholder="예: 고1"
                style={{
                  display: "block", width: "100%", marginTop: "var(--space-1)",
                  padding: "var(--space-2) var(--space-3)", border: "1px solid var(--color-border-divider)",
                  borderRadius: "var(--radius-md)", fontSize: 14, background: "var(--color-bg-surface)",
                }}
              />
            </label>
          </div>
        </div>

        {/* 버튼 */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)", marginTop: "var(--space-5)" }}>
          <Button intent="ghost" size="sm" onClick={onClose} disabled={uploading}>
            취소
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={files.length === 0 || uploading}>
            {mergingPdf
              ? "PDF 병합 중..."
              : uploading
                ? "업로드 중..."
                : files.length > 1
                  ? `${files.length}장 합쳐서 업로드`
                  : "업로드"}
          </Button>
        </div>
      </div>
    </div>
  );
}
