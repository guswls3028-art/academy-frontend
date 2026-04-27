// PATH: src/app_admin/domains/tools/ppt/pages/PptGeneratorPage.tsx
// PPT 생성기 메인 페이지 — 이미지/PDF 모드 선택 -> 설정 -> 생성/다운로드 (async worker)

import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { feedback } from "@/shared/ui/feedback/feedback";
import { submitPptJob, submitPdfPptJob, pollPptJob, type PptSettings } from "../api/ppt.api";
import { asyncStatusStore } from "@/shared/ui/asyncStatus/asyncStatusStore";
import ImageUploadArea from "../components/ImageUploadArea";
import PdfUploadArea from "../components/PdfUploadArea";
import SortableImageGrid, { type ImageItem } from "../components/SortableImageGrid";
import SlideSettingsPanel from "../components/SlideSettingsPanel";

type InputMode = "image" | "pdf";

let _idSeq = 0;
function nextId() {
  return `img_${Date.now()}_${++_idSeq}`;
}

const DEFAULT_SETTINGS: PptSettings = {
  aspect_ratio: "16:9",
  background: "black",
  fit_mode: "contain",
  invert: false,
  grayscale: false,
  auto_enhance: false,
  brightness: 1.0,
  contrast: 1.0,
};

export default function PptGeneratorPage() {
  const [mode, setMode] = useState<InputMode>("image");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<PptSettings>(DEFAULT_SETTINGS);
  const [progressPct, setProgressPct] = useState<number | null>(null);
  const [progressLabel, setProgressLabel] = useState<string>("");

  // 모드 전환
  const handleModeChange = useCallback((newMode: InputMode) => {
    setMode(newMode);
  }, []);

  // 이미지 추가
  const handleFilesAdd = useCallback((files: File[]) => {
    const newItems: ImageItem[] = files.map((f) => ({
      id: nextId(),
      file: f,
      previewUrl: URL.createObjectURL(f),
      invert: false,
    }));
    setImages((prev) => {
      if (prev.length + newItems.length > 50) {
        feedback.warning("최대 50장까지 업로드할 수 있습니다.");
        return [...prev, ...newItems.slice(0, 50 - prev.length)];
      }
      return [...prev, ...newItems];
    });
  }, []);

  // 순서 변경
  const handleReorder = useCallback((newItems: ImageItem[]) => {
    setImages(newItems);
  }, []);

  // 이미지 삭제
  const handleRemove = useCallback((id: string) => {
    setImages((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  // 개별 반전 토글
  const handleToggleInvert = useCallback((id: string) => {
    setImages((prev) =>
      prev.map((item) => (item.id === id ? { ...item, invert: !item.invert } : item)),
    );
  }, []);

  // 전체 삭제
  const handleClearAll = useCallback(() => {
    images.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    setImages([]);
  }, [images]);

  // PPT 생성 mutation — 이미지 모드
  const imageGenerateMutation = useMutation({
    mutationFn: async () => {
      const files = images.map((i) => i.file);
      const order = images.map((_, idx) => idx);

      const perSlide = images.map((item) => ({
        invert: item.invert || settings.invert,
        grayscale: settings.grayscale,
        auto_enhance: settings.auto_enhance,
        brightness: settings.brightness,
        contrast: settings.contrast,
      }));

      setProgressLabel("파일 업로드 중...");

      // Phase 1: Upload and submit job
      const jobResp = await submitPptJob(files, order, { ...settings, per_slide: perSlide }, (pct) => {
        setProgressPct(Math.round(pct * 0.5));
        setProgressLabel(`업로드 중 ${Math.round(pct)}%`);
      });

      // Register in workbox for background tracking
      asyncStatusStore.addWorkerJob(
        `PPT 생성 (${images.length}장)`,
        jobResp.job_id,
        "ppt_generation",
      );

      // Phase 2: Poll for completion (page-level progress)
      const result = await pollPptJob(
        jobResp.job_id,
        (progress) => {
          if (progress?.percent != null) {
            setProgressPct(50 + Math.round((progress.percent / 100) * 50));
            const stepName = progress.step_name_display || progress.step_name || "";
            setProgressLabel(stepName ? `${stepName} ${Math.round(progress.percent)}%` : `PPT 생성 중 ${Math.round(progress.percent)}%`);
          }
        },
        (status) => {
          // percent가 아직 안 오는 PENDING 단계에서도 라벨 갱신 → stuck처럼 보이는 현상 제거.
          if (status === "PENDING") setProgressLabel("작업 대기 중...");
          else if (status === "RUNNING") setProgressLabel((prev) => prev.startsWith("PPT 생성 중") || prev.includes("%") ? prev : "PPT 생성 시작...");
        },
      );

      return result;
    },
    onSuccess: handleGenerateSuccess,
    onError: handleGenerateError,
  });

  // PPT 생성 mutation — PDF 모드
  const pdfGenerateMutation = useMutation({
    mutationFn: async () => {
      if (!pdfFile) throw new Error("PDF 파일을 선택해주세요.");

      setProgressLabel("PDF 업로드 중...");

      // Phase 1: Upload PDF and submit job
      const jobResp = await submitPdfPptJob(pdfFile, settings, (pct) => {
        setProgressPct(Math.round(pct * 0.5));
        setProgressLabel(`업로드 중 ${Math.round(pct)}%`);
      });

      // Register in workbox for background tracking
      asyncStatusStore.addWorkerJob(
        `PPT 생성 (PDF)`,
        jobResp.job_id,
        "ppt_generation",
      );

      // Phase 2: Poll for completion (page-level progress)
      const result = await pollPptJob(
        jobResp.job_id,
        (progress) => {
          if (progress?.percent != null) {
            setProgressPct(50 + Math.round((progress.percent / 100) * 50));
            const stepName = progress.step_name_display || progress.step_name || "";
            setProgressLabel(stepName ? `${stepName} ${Math.round(progress.percent)}%` : `PPT 생성 중 ${Math.round(progress.percent)}%`);
          }
        },
        (status) => {
          // percent가 아직 안 오는 PENDING 단계에서도 라벨 갱신 → stuck처럼 보이는 현상 제거.
          if (status === "PENDING") setProgressLabel("작업 대기 중...");
          else if (status === "RUNNING") setProgressLabel((prev) => prev.startsWith("PPT 생성 중") || prev.includes("%") ? prev : "PPT 생성 시작...");
        },
      );

      return result;
    },
    onSuccess: handleGenerateSuccess,
    onError: handleGenerateError,
  });

  function handleGenerateSuccess(data: { slide_count: number; size_bytes: number; download_url: string; filename: string; mode?: "question" | "page" }) {
    setProgressPct(null);
    setProgressLabel("");
    feedback.success(`PPT 생성 완료 (${data.slide_count}장, ${formatBytes(data.size_bytes)})`);
    if (data.mode === "page") {
      // 텍스트 추출 안 되는 PDF는 페이지 단위로 fallback. 사용자 안내(표지·목차도 포함됨).
      feedback.info("이 PDF는 텍스트 추출이 어려워 페이지 단위로 변환했습니다. 표지·목차도 슬라이드에 포함됩니다.");
    }
    const a = document.createElement("a");
    a.href = data.download_url;
    a.download = data.filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 100);
  }

  function handleGenerateError(err: any) {
    setProgressPct(null);
    setProgressLabel("");
    const msg = err?.response?.data?.detail || err?.message || "PPT 생성에 실패했습니다.";
    feedback.error(msg);
  }

  const isGenerating = imageGenerateMutation.isPending || pdfGenerateMutation.isPending;
  const canGenerate = mode === "image" ? images.length > 0 : pdfFile !== null;

  const handleGenerate = () => {
    if (mode === "image") {
      imageGenerateMutation.mutate();
    } else {
      pdfGenerateMutation.mutate();
    }
  };

  return (
    <div style={{ display: "flex", gap: 24, minHeight: "calc(100vh - 200px)" }}>
      {/* 좌측: 모드 토글 + 업로드 영역 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 모드 토글 */}
        <div style={{
          display: "inline-flex",
          borderRadius: "var(--radius-lg, 12px)",
          border: "1px solid var(--color-border-divider)",
          background: "var(--bg-surface)",
          padding: 3,
          marginBottom: 16,
          gap: 2,
        }}>
          <ModeTab
            active={mode === "image"}
            onClick={() => handleModeChange("image")}
            disabled={isGenerating}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            }
            label="이미지"
          />
          <ModeTab
            active={mode === "pdf"}
            onClick={() => handleModeChange("pdf")}
            disabled={isGenerating}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            }
            label="PDF"
          />
        </div>

        {/* 이미지 모드 */}
        {mode === "image" && (
          <>
            <ImageUploadArea onFilesAdd={handleFilesAdd} disabled={isGenerating} />

            <SortableImageGrid
              items={images}
              onReorder={handleReorder}
              onRemove={handleRemove}
              onToggleInvert={handleToggleInvert}
              disabled={isGenerating}
            />

            {images.length > 0 && (
              <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={isGenerating}
                  style={{
                    padding: "6px 14px",
                    fontSize: 12,
                    color: "var(--color-error, #ef4444)",
                    background: "transparent",
                    border: "1px solid var(--color-error, #ef4444)",
                    borderRadius: "var(--radius-md, 8px)",
                    cursor: isGenerating ? "not-allowed" : "pointer",
                    opacity: isGenerating ? 0.5 : 1,
                  }}
                >
                  전체 삭제
                </button>
              </div>
            )}
          </>
        )}

        {/* PDF 모드 */}
        {mode === "pdf" && (
          <>
            <PdfUploadArea
              file={pdfFile}
              onFileSelect={setPdfFile}
              disabled={isGenerating}
            />
            {pdfFile && (
              <div style={{
                marginTop: 16,
                padding: "14px 18px",
                background: "var(--bg-surface)",
                borderRadius: "var(--radius-md, 8px)",
                border: "1px solid var(--color-border-divider)",
              }}>
                <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                  PDF의 각 페이지가 자동으로 슬라이드로 변환됩니다.
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 우측: 설정 + 생성 버튼 */}
      <div style={{
        width: 320,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}>
        <div style={{
          background: "var(--bg-surface)",
          borderRadius: "var(--radius-lg, 12px)",
          border: "1px solid var(--color-border-divider)",
          padding: 20,
          overflow: "hidden",
        }}>
          <div style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--color-text-primary)",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            슬라이드 설정
          </div>
          <SlideSettingsPanel
            settings={settings}
            onChange={setSettings}
            disabled={isGenerating}
          />
        </div>

        {/* 미리보기 카드 — 이미지 모드만 */}
        {mode === "image" && images.length > 0 && (
          <div style={{
            background: settings.background === "white" ? "#f8f8f8" : settings.background === "dark_gray" ? "#1e1e1e" : "#000",
            borderRadius: "var(--radius-lg, 12px)",
            border: "1px solid var(--color-border-divider)",
            aspectRatio: settings.aspect_ratio === "16:9" ? "16/9" : "4/3",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            position: "relative",
          }}>
            <img
              src={images[0].previewUrl}
              alt="Preview"
              style={{
                maxWidth: settings.fit_mode === "stretch" ? "100%" : "90%",
                maxHeight: settings.fit_mode === "stretch" ? "100%" : "90%",
                width: settings.fit_mode === "stretch" ? "100%" : undefined,
                height: settings.fit_mode === "stretch" ? "100%" : undefined,
                objectFit: settings.fit_mode === "cover" ? "cover" : "contain",
                filter: (images[0].invert || settings.invert ? "invert(1) " : "")
                  + (settings.grayscale ? "grayscale(1) " : "")
                  + (settings.brightness !== 1.0 ? `brightness(${settings.brightness}) ` : "")
                  + (settings.contrast !== 1.0 ? `contrast(${settings.contrast})` : ""),
                transition: "filter 0.2s",
              }}
            />
            <div style={{
              position: "absolute",
              bottom: 8,
              right: 8,
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 4,
            }}>
              미리보기
            </div>
          </div>
        )}

        {/* 생성 버튼 */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate || isGenerating}
          style={{
            width: "100%",
            padding: "14px 24px",
            fontSize: 15,
            fontWeight: 700,
            color: "#fff",
            background: !canGenerate || isGenerating
              ? "var(--color-bg-disabled, #aaa)"
              : "var(--color-primary)",
            border: "none",
            borderRadius: "var(--radius-lg, 12px)",
            cursor: !canGenerate || isGenerating ? "not-allowed" : "pointer",
            transition: "background 0.15s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            flexDirection: "column",
          }}
        >
          {isGenerating ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Spinner />
                {progressLabel || "PPT 생성 중..."}
              </div>
              {progressPct !== null && (
                <div style={{
                  width: "80%",
                  height: 4,
                  background: "rgba(255,255,255,0.3)",
                  borderRadius: 2,
                  overflow: "hidden",
                  marginTop: 4,
                }}>
                  <div style={{
                    width: `${progressPct}%`,
                    height: "100%",
                    background: "#fff",
                    borderRadius: 2,
                    transition: "width 0.3s ease",
                  }} />
                </div>
              )}
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              PPT 생성 및 다운로드
            </div>
          )}
        </button>

        {/* 상태 요약 */}
        {mode === "image" && images.length > 0 && (
          <div style={{ textAlign: "center", lineHeight: 1.6 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)" }}>
              {images.length}장 슬라이드
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              {formatBytes(images.reduce((sum, i) => sum + i.file.size, 0))} · {settings.aspect_ratio} · {settings.background === "black" ? "검정" : settings.background === "white" ? "흰색" : "진회"} 배경
            </div>
          </div>
        )}
        {mode === "pdf" && pdfFile && (
          <div style={{ textAlign: "center", lineHeight: 1.6 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)" }}>
              PDF 변환 모드
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              {formatBytes(pdfFile.size)} · {settings.aspect_ratio} · {settings.background === "black" ? "검정" : settings.background === "white" ? "흰색" : "진회"} 배경
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  disabled,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 18px",
        borderRadius: "var(--radius-md, 8px)",
        border: "none",
        background: active ? "var(--color-primary)" : "transparent",
        color: active ? "#fff" : "var(--color-text-secondary)",
        fontWeight: 600,
        fontSize: 14,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.15s",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite" }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </svg>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
