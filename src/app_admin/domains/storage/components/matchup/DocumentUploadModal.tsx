// PATH: src/app_admin/domains/storage/components/matchup/DocumentUploadModal.tsx
//
// 매치업 업로드 모달.
// 개선 항목:
//  - iPhone HEIC 자동 JPEG 변환 (heic2any lazy import)
//  - 병합 진행률 표시 (HEIC 변환 / PDF 병합 단계별 N/Total)
//  - 업로드 중 X 버튼 잠금 (닫을 수 없음 → pending 상태 유령 문서 방지)
//  - 파일 drag-reorder (HTML5 DnD, 순서 변경 UX)
//  - 제목 중복 경고 (같은 테넌트 동일 제목 존재 시 inline 안내)
//  - 과목/학년 datalist 자동완성 (기존 문서 기반)

import { useState, useRef, useEffect, useMemo } from "react";
import { Upload, X, Image as ImageIcon, FileText, AlertCircle, GripVertical } from "lucide-react";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { filesToPdf, isImage, isPdf, isHeic } from "./filesToPdf";
import type { MergeProgress } from "./filesToPdf";

type Props = {
  onClose: () => void;
  onUpload: (payload: { file: File; title: string; category: string; subject: string; grade_level: string }) => Promise<void>;
  intent?: "reference" | "test";
  existingTitles?: string[];
  categorySuggestions?: string[];
  subjectSuggestions?: string[];
  gradeLevelSuggestions?: string[];
  // 카테고리 헤더 또는 외부 컨텍스트에서 모달을 열 때 prefill.
  // 사용자는 여전히 자유 편집 가능.
  defaultCategory?: string;
};

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.heic,.heif";
const MAX_SIZE = 50 * 1024 * 1024;

type Entry = {
  file: File;
  thumbUrl: string | null;
};

export default function DocumentUploadModal({
  onClose,
  onUpload,
  intent = "reference",
  existingTitles = [],
  categorySuggestions = [],
  subjectSuggestions = [],
  gradeLevelSuggestions = [],
  defaultCategory = "",
}: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [mergeProgress, setMergeProgress] = useState<MergeProgress | null>(null);
  // 다중 업로드 모드 — 각 파일을 별도 시험지로 동시 업로드
  const [splitMode, setSplitMode] = useState(false);
  const [splitProgress, setSplitProgress] = useState<{ done: number; total: number } | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalSize = useMemo(
    () => entries.reduce((s, e) => s + e.file.size, 0),
    [entries],
  );

  // 제목 중복 체크 (trim + case-insensitive)
  const titleDuplicate = useMemo(() => {
    if (!title.trim()) return false;
    const normalized = title.trim().toLowerCase();
    return existingTitles.some((t) => t.trim().toLowerCase() === normalized);
  }, [title, existingTitles]);

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

  // ESC로 닫기 (업로드 중에는 무시)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !uploading) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [uploading, onClose]);

  // Ctrl+V 붙여넣기 — 시험탭과 동일한 패턴. 텍스트 입력에 포커스가 있어도
  // 클립보드에 파일이 있으면 entries에 추가. (텍스트 paste는 그대로 통과)
  const handlePaste = (e: React.ClipboardEvent) => {
    if (uploading) return;
    const files = e.clipboardData?.files;
    if (!files || files.length === 0) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    addFiles(imgs);
    feedback.success(`${imgs.length}장 붙여넣기됨`);
  };

  const showDropError = (msg: string) => {
    setDropError(msg);
    feedback.error(msg);
  };

  const addFiles = (selected: File[]) => {
    if (selected.length === 0) return;

    const invalid = selected.filter((f) => !isPdf(f) && !isImage(f) && !isHeic(f));
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
      // HEIC는 브라우저가 직접 렌더 못 하므로 썸네일 생성 안 함
      thumbUrl: isImage(file) && !isHeic(file) ? URL.createObjectURL(file) : null,
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

  // drag-reorder — HTML5 DnD
  const handleEntryDragStart = (idx: number) => (e: React.DragEvent) => {
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", String(idx)); } catch { /* ignore */ }
  };
  const handleEntryDragOver = () => (e: React.DragEvent) => {
    // File drop와 충돌 방지 — entry reorder 중일 때만 preventDefault
    if (dragIndex === null) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };
  const handleEntryDrop = (idx: number) => (e: React.DragEvent) => {
    if (dragIndex === null) return;
    e.preventDefault();
    e.stopPropagation();
    if (dragIndex === idx) { setDragIndex(null); return; }
    const next = [...entries];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(idx, 0, moved);
    setEntries(next);
    setDragIndex(null);
  };
  const handleEntryDragEnd = () => setDragIndex(null);

  const handleSubmit = async () => {
    if (entries.length === 0) return;
    setUploading(true);
    try {
      // ── Split mode: 각 파일을 별도 시험지로 동시 업로드 ──
      if (splitMode && entries.length > 1) {
        setSplitProgress({ done: 0, total: entries.length });
        // HEIC만 미리 변환 (각 파일을 그대로 업로드, 헤이크는 backend가 거부)
        const prepared: { file: File; baseName: string }[] = [];
        for (const e of entries) {
          let file = e.file;
          if (isHeic(file)) {
            const { convertHeicToJpeg } = await import("./filesToPdf");
            file = await convertHeicToJpeg(file);
          }
          // 이미지(png/jpg)도 PDF로 변환해서 backend 분리 파이프라인이 일관 처리
          if (!isPdf(file)) {
            const baseName = file.name.replace(/\.[^.]+$/, "");
            file = await filesToPdf([file], `${baseName}.pdf`);
          }
          if (file.size > MAX_SIZE) {
            throw new Error(`${file.name}이(가) 50MB를 초과합니다.`);
          }
          prepared.push({ file, baseName: file.name.replace(/\.pdf$/i, "") });
        }
        // 병렬 업로드 (각 파일이 별도 문서)
        let done = 0;
        const baseTitle = title.trim();
        await Promise.all(prepared.map(async (p) => {
          const docTitle = baseTitle ? `${baseTitle} - ${p.baseName}` : p.baseName;
          await onUpload({
            file: p.file,
            title: docTitle,
            category,
            subject,
            grade_level: gradeLevel,
          });
          done += 1;
          setSplitProgress({ done, total: prepared.length });
        }));
        setSplitProgress(null);
        onClose();
        return;
      }

      // ── Merge mode (default): 모든 파일을 1개 PDF로 합쳐 업로드 ──
      const hasHeic = entries.some((e) => isHeic(e.file));
      const files = entries.map((e) => e.file);
      let finalFile: File;
      if (files.length === 1 && isPdf(files[0])) {
        finalFile = files[0];
      } else {
        setMergeProgress({ phase: hasHeic ? "heic" : "pdf", current: 0, total: files.length });
        const pdfName = (title || "scan").replace(/[^\w가-힣-]/g, "_") + ".pdf";
        finalFile = await filesToPdf(files, pdfName, {
          onProgress: (p) => setMergeProgress(p),
        });
        setMergeProgress(null);
      }

      // 병합 후 크기 재검증 — pdf-lib가 이미지를 더 크게 저장하는 경우 대비
      if (finalFile.size > MAX_SIZE) {
        throw new Error(
          `병합된 PDF가 50MB를 초과합니다 (${(finalFile.size / 1024 / 1024).toFixed(1)}MB). 파일 수를 줄이거나 해상도가 낮은 사진을 사용해 주세요.`,
        );
      }

      await onUpload({
        file: finalFile,
        title: title || finalFile.name,
        category,
        subject,
        grade_level: gradeLevel,
      });
      onClose();
    } catch (e) {
      console.error(e);
      let msg: string;
      if (e instanceof Error && e.message) {
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
      setMergeProgress(null);
      setSplitProgress(null);
    }
  };

  const pdfCount = entries.filter((e) => isPdf(e.file)).length;
  const imageCount = entries.filter((e) => isImage(e.file) && !isHeic(e.file)).length;
  const heicCount = entries.filter((e) => isHeic(e.file)).length;
  const willMerge = entries.length > 1 || (entries.length === 1 && !isPdf(entries[0].file));

  // 드롭존 스타일
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

  const mergeLabel = mergeProgress
    ? mergeProgress.phase === "heic"
      ? `아이폰 사진 변환 중... (${mergeProgress.current}/${mergeProgress.total})`
      : `PDF 병합 중... (${mergeProgress.current}/${mergeProgress.total})`
    : null;
  const intentLabel = intent === "test" ? "학생 시험지" : "참고 자료";

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
        onPaste={handlePaste}
      >
        {/* Header */}
        <div style={{
          padding: "var(--space-5) var(--space-6) var(--space-3)",
          borderBottom: "1px solid var(--color-border-divider)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{intentLabel} 업로드</h3>
            <button
              onClick={onClose}
              disabled={uploading}
              title={uploading ? "업로드가 끝날 때까지 닫을 수 없습니다" : "닫기"}
              style={{
                background: "none", border: "none",
                cursor: uploading ? "not-allowed" : "pointer",
                color: uploading ? "var(--color-text-muted)" : "var(--color-text-secondary)",
                opacity: uploading ? 0.4 : 1,
              }}
            >
              <X size={18} />
            </button>
          </div>
          <p style={{
            margin: "var(--space-2) 0 0 0",
            fontSize: 12,
            color: "var(--color-text-muted)",
            lineHeight: 1.5,
          }}>
            {intent === "test" ? (
              <>학생이 본 <strong>시험지</strong>를 올리면, 등록된 <strong>참고 자료</strong>에서 유사 문제를 찾아 추천합니다.</>
            ) : (
              <>교재·기출 등 <strong>참고 자료</strong>를 등록해두면, 학생 <strong>시험지</strong>를 기준으로 유사 문제를 찾을 수 있습니다.</>
            )}
          </p>
        </div>

        {/* Body (스크롤 영역) */}
        <div style={{
          padding: "var(--space-5) var(--space-6) var(--space-3)",
          overflow: "auto",
          flex: 1,
        }}>
          {/* 드래그앤드롭 / 파일 선택 */}
          <div
            onDragOver={(e) => {
              // entry reorder 중이면 드롭존 하이라이트 안 함
              if (dragIndex !== null) return;
              e.preventDefault(); e.stopPropagation(); setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            data-testid="matchup-drop-zone"
            style={{
              border: dropZoneBorder,
              borderRadius: "var(--radius-lg)",
              padding: entries.length === 0 ? "var(--space-6)" : "var(--space-4)",
              textAlign: "center", cursor: "pointer",
              marginBottom: "var(--space-3)",
              background: dropZoneBg,
              transition: "border-color 0.2s, background 0.2s, padding 0.2s",
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
                  : `${entries.length}개 선택됨 (PDF ${pdfCount} · 이미지 ${imageCount}${heicCount ? ` · HEIC ${heicCount}` : ""})`}
            </p>
            <p style={{ margin: "var(--space-1) 0 0", fontSize: 12, color: "var(--color-text-muted)" }}>
              {entries.length === 0
                ? "PDF · JPG · PNG · HEIC(아이폰) · Ctrl+V로 붙여넣기도 가능 · 자동으로 1개 PDF로 합쳐짐 · 최대 50MB"
                : `${(totalSize / 1024 / 1024).toFixed(1)}MB · 더 추가하려면 다시 클릭/드래그/Ctrl+V`}
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

          {/* 모드 토글 — 파일 2개 이상일 때만 */}
          {entries.length > 1 && (
            <div style={{
              marginBottom: "var(--space-3)",
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--color-border-divider)",
              borderRadius: "var(--radius-md)",
              display: "flex", alignItems: "center", gap: "var(--space-3)",
              fontSize: 12,
            }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flex: 1 }}>
                <input
                  type="checkbox"
                  checked={splitMode}
                  onChange={(e) => setSplitMode(e.target.checked)}
                  disabled={uploading}
                  data-testid="matchup-split-mode-toggle"
                  style={{ cursor: "pointer" }}
                />
                <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
                  각 파일을 별도 {intentLabel}로 업로드
                </span>
                <span style={{ color: "var(--color-text-muted)" }}>
                  ({entries.length}개 파일 → {entries.length}개 문서)
                </span>
              </label>
            </div>
          )}

          {/* 병합/분할 안내 */}
          {willMerge && (
            <div style={{
              marginBottom: "var(--space-3)",
              padding: "6px var(--space-3)",
              background: splitMode
                ? "color-mix(in srgb, var(--color-success) 8%, transparent)"
                : "color-mix(in srgb, var(--color-brand-primary) 6%, transparent)",
              borderRadius: "var(--radius-sm)",
              fontSize: 12,
              color: splitMode ? "var(--color-success)" : "var(--color-brand-primary)",
              display: "flex", alignItems: "center", gap: "var(--space-2)",
            }}>
              <ImageIcon size={14} />
              <span>
                {splitMode
                  ? `각 파일이 별도 ${intentLabel}로 동시 업로드됩니다 (${entries.length}개)${heicCount > 0 ? ", HEIC는 자동 변환" : ""}`
                  : heicCount > 0
                    ? "HEIC는 자동으로 JPEG로 변환 후 1개 PDF로 합쳐집니다"
                    : "자동으로 1개 PDF로 합쳐서 업로드됩니다"}
              </span>
            </div>
          )}

          {/* 파일 목록 */}
          {entries.length > 0 && (
            <div style={{
              marginBottom: "var(--space-3)",
              border: "1px solid var(--color-border-divider)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-2)",
              maxHeight: 220, overflow: "auto",
            }}>
              <p style={{ margin: "0 0 var(--space-2)", fontSize: 11, color: "var(--color-text-muted)" }}>
                업로드 순서 (위→아래). 드래그하거나 ↑↓ 버튼으로 변경 가능.
              </p>
              {entries.map((entry, i) => (
                <div
                  key={i}
                  data-testid="matchup-upload-entry"
                  draggable={!uploading}
                  onDragStart={handleEntryDragStart(i)}
                  onDragOver={handleEntryDragOver()}
                  onDrop={handleEntryDrop(i)}
                  onDragEnd={handleEntryDragEnd}
                  style={{
                    display: "flex", alignItems: "center", gap: "var(--space-3)",
                    padding: "var(--space-2)",
                    fontSize: 12,
                    borderBottom: i < entries.length - 1 ? "1px solid var(--color-border-divider)" : "none",
                    background: dragIndex === i ? "color-mix(in srgb, var(--color-brand-primary) 8%, transparent)" : undefined,
                    cursor: uploading ? "default" : "grab",
                  }}
                >
                  <GripVertical
                    size={14}
                    style={{
                      color: "var(--color-text-muted)",
                      flexShrink: 0,
                      opacity: uploading ? 0.3 : 0.7,
                    }}
                  />

                  {/* 썸네일 */}
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
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                      borderRadius: 6, border: "1px solid var(--color-border-divider)",
                      background: "var(--color-bg-surface-soft)",
                      color: isHeic(entry.file) ? "var(--color-brand-primary)" : "var(--color-text-muted)",
                    }}>
                      <FileText size={24} />
                      {isHeic(entry.file) && (
                        <span style={{ fontSize: 9, fontWeight: 700, marginTop: 2 }}>HEIC</span>
                      )}
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
                      {isPdf(entry.file) ? "PDF" : isHeic(entry.file) ? "HEIC (자동 변환)" : "이미지"} · {(entry.file.size / 1024 / 1024).toFixed(2)}MB
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveEntry(i, -1); }}
                      disabled={i === 0 || uploading}
                      style={{ background: "none", border: "1px solid var(--color-border-divider)", borderRadius: 4, cursor: i === 0 || uploading ? "default" : "pointer", opacity: i === 0 || uploading ? 0.3 : 1, fontSize: 12, padding: "2px 6px" }}
                      title="위로"
                    >↑</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveEntry(i, 1); }}
                      disabled={i === entries.length - 1 || uploading}
                      style={{ background: "none", border: "1px solid var(--color-border-divider)", borderRadius: 4, cursor: i === entries.length - 1 || uploading ? "default" : "pointer", opacity: i === entries.length - 1 || uploading ? 0.3 : 1, fontSize: 12, padding: "2px 6px" }}
                      title="아래로"
                    >↓</button>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeEntry(i); }}
                    disabled={uploading}
                    style={{ background: "none", border: "none", cursor: uploading ? "default" : "pointer", color: "var(--color-text-muted)", padding: 4, flexShrink: 0, opacity: uploading ? 0.3 : 1 }}
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
                  padding: "var(--space-2) var(--space-3)",
                  border: `1px solid ${titleDuplicate ? "var(--color-warning)" : "var(--color-border-divider)"}`,
                  borderRadius: "var(--radius-md)", fontSize: 14, background: "var(--color-bg-surface)",
                }}
              />
              {titleDuplicate && (
                <span style={{
                  display: "block", marginTop: 4, fontSize: 11,
                  color: "var(--color-warning)", fontWeight: 500,
                }}>
                  같은 제목의 문서가 이미 존재합니다. 계속 업로드해도 되지만, 구분을 위해 제목 뒤에 날짜 등을 추가하는 것을 권장합니다.
                </span>
              )}
            </label>

            {/* 카테고리 — 칩 셀렉터(원클릭) + 자유 입력 (둘 다 동기화). */}
            <div>
              <label
                htmlFor="matchup-upload-category-input"
                style={{
                  display: "block",
                  fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)",
                  marginBottom: 6,
                }}
              >
                카테고리
                {defaultCategory && (
                  <span style={{
                    marginLeft: 8,
                    fontSize: 11, fontWeight: 600,
                    color: "var(--color-brand-primary)",
                  }}>
                    · 기본값 적용됨
                  </span>
                )}
              </label>
              {categorySuggestions.length > 0 && (
                <div
                  data-testid="matchup-upload-category-chips"
                  style={{
                    display: "flex", flexWrap: "wrap", gap: 4,
                    marginBottom: 6,
                  }}
                >
                  {categorySuggestions.map((c) => {
                    const active = category.trim() === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategory(active ? "" : c)}
                        title={active ? "선택 해제" : `카테고리 "${c}" 선택`}
                        style={{
                          fontSize: 11,
                          padding: "3px 9px",
                          borderRadius: 999,
                          cursor: "pointer",
                          border: active
                            ? "1px solid var(--color-brand-primary)"
                            : "1px solid var(--color-border-divider)",
                          background: active
                            ? "color-mix(in srgb, var(--color-brand-primary) 14%, transparent)"
                            : "var(--color-bg-surface-soft)",
                          color: active
                            ? "var(--color-brand-primary)"
                            : "var(--color-text-secondary)",
                          fontWeight: active ? 700 : 500,
                        }}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              )}
              <input
                id="matchup-upload-category-input"
                data-testid="matchup-upload-category-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="예: 중대부고 (직접 입력 또는 위 칩 선택)"
                list="matchup-category-suggestions"
                style={{
                  display: "block", width: "100%",
                  padding: "var(--space-2) var(--space-3)",
                  border: "1px solid var(--color-border-divider)",
                  borderRadius: "var(--radius-md)", fontSize: 14, background: "var(--color-bg-surface)",
                }}
              />
              <datalist id="matchup-category-suggestions">
                {categorySuggestions.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>

            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <label style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)" }}>
                과목
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="예: 수학"
                  list="matchup-subject-suggestions"
                  style={{
                    display: "block", width: "100%", marginTop: "var(--space-1)",
                    padding: "var(--space-2) var(--space-3)", border: "1px solid var(--color-border-divider)",
                    borderRadius: "var(--radius-md)", fontSize: 14, background: "var(--color-bg-surface)",
                  }}
                />
                <datalist id="matchup-subject-suggestions">
                  {subjectSuggestions.map((s) => <option key={s} value={s} />)}
                </datalist>
              </label>
              <label style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)" }}>
                학년
                <input
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  placeholder="예: 고1"
                  list="matchup-grade-suggestions"
                  style={{
                    display: "block", width: "100%", marginTop: "var(--space-1)",
                    padding: "var(--space-2) var(--space-3)", border: "1px solid var(--color-border-divider)",
                    borderRadius: "var(--radius-md)", fontSize: 14, background: "var(--color-bg-surface)",
                  }}
                />
                <datalist id="matchup-grade-suggestions">
                  {gradeLevelSuggestions.map((s) => <option key={s} value={s} />)}
                </datalist>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "var(--space-3) var(--space-6) var(--space-4)",
          borderTop: "1px solid var(--color-border-divider)",
          flexShrink: 0,
          background: "var(--color-bg-surface)",
          borderBottomLeftRadius: "var(--radius-xl)",
          borderBottomRightRadius: "var(--radius-xl)",
        }}>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)", alignItems: "center" }}>
            {(mergeLabel || splitProgress) && (
              <span style={{
                fontSize: 12,
                color: splitProgress ? "var(--color-success)" : "var(--color-brand-primary)",
                fontWeight: 600, marginRight: "auto",
              }}>
                {splitProgress
                  ? `${intentLabel} 업로드 중... ${splitProgress.done}/${splitProgress.total}`
                  : mergeLabel}
              </span>
            )}
            <Button intent="ghost" size="sm" onClick={onClose} disabled={uploading}>
              취소
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={entries.length === 0 || uploading}
              data-testid="matchup-upload-submit"
            >
              {mergeProgress
                ? mergeProgress.phase === "heic" ? "아이폰 사진 변환 중..." : "PDF 병합 중..."
                : splitProgress
                  ? `업로드 중... ${splitProgress.done}/${splitProgress.total}`
                  : uploading
                    ? "업로드 중..."
                    : splitMode && entries.length > 1
                      ? `${entries.length}개 ${intentLabel} 동시 업로드`
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
