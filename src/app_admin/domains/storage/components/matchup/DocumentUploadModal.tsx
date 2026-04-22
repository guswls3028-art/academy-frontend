// PATH: src/app_admin/domains/storage/components/matchup/DocumentUploadModal.tsx

import { useState, useRef, useEffect, useMemo } from "react";
import { Upload, X, Image as ImageIcon, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { filesToPdf, isImage, isPdf } from "./filesToPdf";

type Props = {
  onClose: () => void;
  onUpload: (payload: { file: File; title: string; subject: string; grade_level: string }) => Promise<void>;
};

const ACCEPT = ".pdf,.png,.jpg,.jpeg";
const MAX_SIZE = 50 * 1024 * 1024;

type Entry = {
  file: File;
  thumbUrl: string | null; // 이미지만 생성, PDF는 null
};

export default function DocumentUploadModal({ onClose, onUpload }: Props) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [mergingPdf, setMergingPdf] = useState(false);
  // 드롭존 에러 플래시 — 잘못된 파일 넣으면 빨강 깜빡임 (토스트만으로는 인지가 약함)
  const [dropError, setDropError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalSize = useMemo(
    () => entries.reduce((s, e) => s + e.file.size, 0),
    [entries],
  );

  // 썸네일 URL 정리
  useEffect(() => {
    return () => {
      entries.forEach((e) => {
        if (e.thumbUrl) URL.revokeObjectURL(e.thumbUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // dropError 자동 초기화 (2초 후)
  useEffect(() => {
    if (!dropError) return;
    const t = setTimeout(() => setDropError(null), 2200);
    return () => clearTimeout(t);
  }, [dropError]);

  const showDropError = (msg: string) => {
    setDropError(msg);
    feedback.error(msg);
  };

  const addFiles = (selected: File[]) => {
    if (selected.length === 0) return;

    const invalid = selected.filter((f) => !isPdf(f) && !isImage(f));
    if (invalid.length > 0) {
      showDropError(`지원하지 않는 형식: ${invalid[0].name}`);
      return;
    }

    const nextTotal = totalSize + selected.reduce((s, f) => s + f.size, 0);
    if (nextTotal > MAX_SIZE) {
      showDropError(`전체 크기가 50MB를 초과합니다 (현재 ${(nextTotal / 1024 / 1024).toFixed(1)}MB)`);
      return;
    }

    const newEntries: Entry[] = selected.map((file) => ({
      file,
      thumbUrl: isImage(file) ? URL.createObjectURL(file) : null,
    }));
    setEntries([...entries, ...newEntries]);

    if (!title) {
      const baseName = selected[0].name.replace(/\.[^.]+$/, "");
      setTitle(baseName);
    }
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    addFiles(selected);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const selected = Array.from(e.dataTransfer.files || []);
    addFiles(selected);
  };

  const removeEntry = (idx: number) => {
    const target = entries[idx];
    if (target?.thumbUrl) URL.revokeObjectURL(target.thumbUrl);
    setEntries(entries.filter((_, i) => i !== idx));
  };

  const moveEntry = (idx: number, dir: -1 | 1) => {
    const next = [...entries];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setEntries(next);
  };

  const handleSubmit = async () => {
    if (entries.length === 0) return;
    setUploading(true);
    try {
      const files = entries.map((e) => e.file);
      let finalFile: File;
      if (files.length === 1 && isPdf(files[0])) {
        finalFile = files[0];
      } else {
        setMergingPdf(true);
        const pdfName = (title || "scan").replace(/[^\w가-힣\-]/g, "_") + ".pdf";
        finalFile = await filesToPdf(files, pdfName);
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
      let msg: string;
      if (mergingPdf && e instanceof Error && e.message) {
        msg = e.message;
      } else if (typeof e === "object" && e !== null && "response" in e) {
        const resp = (e as { response?: { data?: { detail?: string } } }).response;
        msg = resp?.data?.detail || "업로드에 실패했습니다";
      } else {
        msg = "업로드에 실패했습니다";
      }
      feedback.error(msg);
    } finally {
      setUploading(false);
      setMergingPdf(false);
    }
  };

  const pdfCount = entries.filter((e) => isPdf(e.file)).length;
  const imageCount = entries.filter((e) => isImage(e.file)).length;
  const willMerge = entries.length > 1 || (entries.length === 1 && !isPdf(entries[0].file));

  // 드롭존 스타일 — drop 상태 / 에러 플래시 / 파일 있음
  const dropZoneBorder = dropError
    ? "2px dashed var(--color-danger)"
    : isDragOver
      ? "2px dashed var(--color-brand-primary)"
      : "2px dashed var(--color-border-divider)";
  const dropZoneBg = dropError
    ? "color-mix(in srgb, var(--color-danger) 6%, var(--color-bg-surface))"
    : isDragOver
      ? "color-mix(in srgb, var(--color-brand-primary) 8%, var(--color-bg-surface))"
      : entries.length > 0
        ? "color-mix(in srgb, var(--color-brand-primary) 5%, var(--color-bg-surface))"
        : undefined;

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
        data-testid="matchup-upload-modal"
        style={{
          background: "var(--color-bg-surface)", borderRadius: "var(--radius-xl)",
          width: 540, maxWidth: "92vw", maxHeight: "92vh",
          display: "flex", flexDirection: "column",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "var(--space-5) var(--space-6) var(--space-4)",
          borderBottom: "1px solid var(--color-border-divider)",
          flexShrink: 0,
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>문서 업로드</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        {/* Body (스크롤 영역) */}
        <div style={{
          padding: "var(--space-5) var(--space-6) var(--space-3)",
          overflow: "auto",
          flex: 1,
        }}>
          {/* 드래그앤드롭 / 파일 선택 */}
          <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            data-testid="matchup-drop-zone"
            style={{
              border: dropZoneBorder,
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-6)", textAlign: "center", cursor: "pointer",
              marginBottom: "var(--space-3)",
              background: dropZoneBg,
              transition: "border-color 0.2s, background 0.2s",
            }}
            onClick={() => inputRef.current?.click()}
          >
            {dropError ? (
              <AlertCircle size={24} style={{ color: "var(--color-danger)", marginBottom: "var(--space-2)" }} />
            ) : (
              <Upload size={24} style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-2)" }} />
            )}
            <p style={{ margin: 0, fontSize: 14, color: dropError ? "var(--color-danger)" : "var(--color-text-secondary)", fontWeight: dropError ? 600 : 400 }}>
              {dropError
                ? dropError
                : entries.length === 0
                  ? "PDF + 이미지 여러 개 드래그하거나 클릭해서 선택"
                  : `${entries.length}개 선택됨 (PDF ${pdfCount} · 이미지 ${imageCount})`}
            </p>
            <p style={{ margin: "var(--space-1) 0 0", fontSize: 12, color: "var(--color-text-muted)" }}>
              {entries.length === 0
                ? "PDF 여러 개도 OK · 자동으로 1개 PDF로 합쳐짐 · 최대 50MB"
                : `${(totalSize / 1024 / 1024).toFixed(1)}MB · 더 추가하려면 다시 클릭/드래그`}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              onChange={handleFiles}
              style={{ display: "none" }}
              data-testid="matchup-file-input"
            />
          </div>

          {/* 파일 목록 (썸네일 72px) */}
          {entries.length > 0 && (
            <div style={{
              marginBottom: "var(--space-3)",
              border: "1px solid var(--color-border-divider)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-2)",
              maxHeight: 280, overflow: "auto",
            }}>
              <p style={{ margin: "0 0 var(--space-2)", fontSize: 11, color: "var(--color-text-muted)" }}>
                업로드 순서 (위→아래). ↑↓ 버튼으로 변경 가능.
              </p>
              {entries.map((entry, i) => (
                <div
                  key={i}
                  data-testid="matchup-upload-entry"
                  style={{
                    display: "flex", alignItems: "center", gap: "var(--space-3)",
                    padding: "var(--space-2)",
                    fontSize: 12,
                    borderBottom: i < entries.length - 1 ? "1px solid var(--color-border-divider)" : "none",
                  }}
                >
                  {/* 썸네일 72x72 */}
                  {entry.thumbUrl ? (
                    <img
                      src={entry.thumbUrl}
                      alt={entry.file.name}
                      style={{
                        width: 72, height: 72, objectFit: "cover",
                        borderRadius: 6, flexShrink: 0,
                        border: "1px solid var(--color-border-divider)",
                        background: "var(--color-bg-surface-soft)",
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 72, height: 72, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: 6, border: "1px solid var(--color-border-divider)",
                      background: "var(--color-bg-surface-soft)",
                      color: "var(--color-danger)",
                    }}>
                      <FileText size={28} />
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      fontWeight: 500, fontSize: 13,
                    }}>
                      {i + 1}. {entry.file.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
                      {isPdf(entry.file) ? "PDF" : "이미지"} · {(entry.file.size / 1024 / 1024).toFixed(2)}MB
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveEntry(i, -1); }}
                      disabled={i === 0}
                      style={{ background: "none", border: "1px solid var(--color-border-divider)", borderRadius: 4, cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.3 : 1, fontSize: 12, padding: "2px 6px" }}
                      title="위로"
                    >↑</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveEntry(i, 1); }}
                      disabled={i === entries.length - 1}
                      style={{ background: "none", border: "1px solid var(--color-border-divider)", borderRadius: 4, cursor: i === entries.length - 1 ? "default" : "pointer", opacity: i === entries.length - 1 ? 0.3 : 1, fontSize: 12, padding: "2px 6px" }}
                      title="아래로"
                    >↓</button>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeEntry(i); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 4, flexShrink: 0 }}
                    title="제거"
                  ><X size={14} /></button>
                </div>
              ))}
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
        </div>

        {/* Footer (sticky) */}
        <div style={{
          padding: "var(--space-3) var(--space-6) var(--space-5)",
          borderTop: "1px solid var(--color-border-divider)",
          flexShrink: 0,
          background: "var(--color-bg-surface)",
          borderBottomLeftRadius: "var(--radius-xl)",
          borderBottomRightRadius: "var(--radius-xl)",
        }}>
          {/* 병합 안내 (버튼 바로 위) */}
          {willMerge && (
            <div style={{
              marginBottom: "var(--space-3)",
              padding: "var(--space-2) var(--space-3)",
              background: "color-mix(in srgb, var(--color-brand-primary) 6%, transparent)",
              borderRadius: "var(--radius-sm)",
              fontSize: 12, color: "var(--color-brand-primary)",
              display: "flex", alignItems: "center", gap: "var(--space-2)",
            }}>
              <ImageIcon size={14} />
              <span>자동으로 1개 PDF로 합쳐서 업로드됩니다</span>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
            <Button intent="ghost" size="sm" onClick={onClose} disabled={uploading}>
              취소
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={entries.length === 0 || uploading}
              data-testid="matchup-upload-submit"
            >
              {mergingPdf
                ? "PDF 병합 중..."
                : uploading
                  ? "업로드 중..."
                  : willMerge
                    ? `${entries.length}개 합쳐서 업로드`
                    : "업로드"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
