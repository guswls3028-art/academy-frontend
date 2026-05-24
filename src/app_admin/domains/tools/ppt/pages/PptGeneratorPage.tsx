// PATH: src/app_admin/domains/tools/ppt/pages/PptGeneratorPage.tsx
// PPT 생성기 메인 페이지 — 이미지/PDF 모드 선택 -> 설정 -> 생성/다운로드 (async worker)

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, Settings } from "lucide-react";
import { feedback } from "@/shared/ui/feedback/feedback";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { submitPptJob, submitPdfPptJob, pollPptJob, type PptSettings } from "../api/ppt.api";
import { asyncStatusStore } from "@/shared/ui/asyncStatus/asyncStatusStore";
import ImageUploadArea from "../components/ImageUploadArea";
import PdfUploadArea from "../components/PdfUploadArea";
import SortableImageGrid, { type ImageItem } from "../components/SortableImageGrid";
import SlideSettingsPanel from "../components/SlideSettingsPanel";
import styles from "./PptGeneratorPage.module.css";

type InputMode = "image" | "pdf";
type SortMode = "nameAsc" | "nameDesc" | "oldest" | "newest" | "upload" | "manual";

let _idSeq = 0;
function nextImageIdentity() {
  const addedSeq = ++_idSeq;
  return {
    id: `img_${Date.now()}_${addedSeq}`,
    addedSeq,
  };
}

const MAX_IMAGES = 500;
const MAX_TOTAL_IMAGE_BYTES = 1024 * 1024 * 1024;

const DEFAULT_SETTINGS: PptSettings = {
  aspect_ratio: "16:9",
  background: "black",
  fit_mode: "contain",
  invert: true,
  grayscale: true,
  auto_enhance: false,
  brightness: 1.0,
  contrast: 1.0,
};

const sortCollator = new Intl.Collator("ko-KR", {
  numeric: true,
  sensitivity: "base",
});

function sortImageItems(items: ImageItem[], mode: SortMode): ImageItem[] {
  if (mode === "manual") return items;
  const ordered = [...items];
  ordered.sort((a, b) => {
    if (mode === "nameAsc" || mode === "nameDesc") {
      const result = sortCollator.compare(a.file.name, b.file.name);
      return mode === "nameAsc" ? result : -result;
    }
    if (mode === "oldest" || mode === "newest") {
      const result = a.file.lastModified - b.file.lastModified;
      return mode === "oldest" ? result : -result;
    }
    return (a.addedSeq ?? 0) - (b.addedSeq ?? 0);
  });
  return ordered;
}

function buildPreviewFilter(item: ImageItem | undefined, settings: PptSettings): string {
  if (!item) return "";
  return [
    item.invert || settings.invert ? "invert(1)" : "",
    settings.grayscale ? "grayscale(1)" : "",
    settings.brightness !== 1.0 ? `brightness(${settings.brightness})` : "",
    settings.contrast !== 1.0 ? `contrast(${settings.contrast})` : "",
  ].filter(Boolean).join(" ");
}

export default function PptGeneratorPage() {
  const [mode, setMode] = useState<InputMode>("image");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<PptSettings>(DEFAULT_SETTINGS);
  const [sortMode, setSortMode] = useState<SortMode>("nameAsc");
  const [previewIndex, setPreviewIndex] = useState(0);
  const [progressPct, setProgressPct] = useState<number | null>(null);
  const [progressLabel, setProgressLabel] = useState<string>("");
  const imagesRef = useRef<ImageItem[]>([]);

  // 모드 전환
  const handleModeChange = useCallback((newMode: InputMode) => {
    setMode(newMode);
  }, []);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => () => {
    imagesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    imagesRef.current = [];
  }, []);

  // 이미지 추가
  const handleFilesAdd = useCallback((files: File[]) => {
    const newItems: ImageItem[] = files.map((f) => {
      const identity = nextImageIdentity();
      return {
        id: identity.id,
        addedSeq: identity.addedSeq,
        file: f,
        previewUrl: URL.createObjectURL(f),
        invert: false,
      };
    });
    setImages((prev) => {
      const currentBytes = prev.reduce((sum, item) => sum + item.file.size, 0);
      let nextBytes = currentBytes;
      const accepted: ImageItem[] = [];
      const rejectedByCount: ImageItem[] = [];
      const rejectedByTotalSize: ImageItem[] = [];

      for (const item of newItems) {
        if (prev.length + accepted.length >= MAX_IMAGES) {
          rejectedByCount.push(item);
          continue;
        }
        if (nextBytes + item.file.size > MAX_TOTAL_IMAGE_BYTES) {
          rejectedByTotalSize.push(item);
          continue;
        }
        accepted.push(item);
        nextBytes += item.file.size;
      }

      if (accepted.length === 0) {
        newItems.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        if (rejectedByCount.length > 0) {
          feedback.warning(`최대 ${MAX_IMAGES}장까지 업로드할 수 있습니다.`);
        }
        if (rejectedByTotalSize.length > 0) {
          feedback.warning(`이미지는 총 ${formatBytes(MAX_TOTAL_IMAGE_BYTES)}까지 업로드할 수 있습니다.`);
        }
        return prev;
      }

      [...rejectedByCount, ...rejectedByTotalSize].forEach((item) => URL.revokeObjectURL(item.previewUrl));
      if (rejectedByCount.length > 0) {
        feedback.warning(`최대 ${MAX_IMAGES}장까지 업로드할 수 있어 ${accepted.length}장만 추가했습니다.`);
      }
      if (rejectedByTotalSize.length > 0) {
        feedback.warning(`총 ${formatBytes(MAX_TOTAL_IMAGE_BYTES)} 한도 때문에 ${accepted.length}장만 추가했습니다.`);
      }
      return sortImageItems([...prev, ...accepted], sortMode);
    });
  }, [sortMode]);

  // 순서 변경
  const handleReorder = useCallback((newItems: ImageItem[]) => {
    setSortMode("manual");
    setImages(newItems);
  }, []);

  const handleSortModeChange = useCallback((newMode: SortMode) => {
    setSortMode(newMode);
    setImages((prev) => sortImageItems(prev, newMode));
    setPreviewIndex(0);
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
    setPreviewIndex(0);
  }, [images]);

  useEffect(() => {
    setPreviewIndex((prev) => {
      if (images.length === 0) return 0;
      return Math.min(prev, images.length - 1);
    });
  }, [images.length]);

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
        undefined,
        { suppressAutoDownload: true },
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
        undefined,
        { suppressAutoDownload: true },
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

  function handleGenerateError(err: unknown) {
    setProgressPct(null);
    setProgressLabel("");
    feedback.error(getApiErrorMessage(err, "PPT 생성에 실패했습니다."));
  }

  const isGenerating = imageGenerateMutation.isPending || pdfGenerateMutation.isPending;
  const canGenerate = mode === "image" ? images.length > 0 : pdfFile !== null;
  const previewItem = images[previewIndex];
  const previewFilter = buildPreviewFilter(previewItem, settings);
  const previewWindow = useMemo(() => {
    if (!images.length) return [];
    const start = Math.max(0, Math.min(previewIndex - 4, images.length - 9));
    return images.slice(start, start + 9).map((item, offset) => ({
      item,
      index: start + offset,
    }));
  }, [images, previewIndex]);

  const handleGenerate = () => {
    if (mode === "image") {
      imageGenerateMutation.mutate();
    } else {
      pdfGenerateMutation.mutate();
    }
  };

  return (
    <div className={styles.page}>
      {/* 좌측: 모드 토글 + 업로드 영역 */}
      <div className={styles.mainColumn}>
        {/* 모드 토글 */}
        <div className={styles.modeTabs}>
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
              sortMode={sortMode}
              onSortModeChange={handleSortModeChange}
              disabled={isGenerating}
            />

            {images.length > 0 && (
              <div className={styles.clearAllRow}>
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={isGenerating}
                  className={styles.clearAllButton}
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
              <div className={styles.pdfInfoCard}>
                <div className={styles.pdfInfoText}>
                  PDF의 문항을 자동으로 분리해 슬라이드로 변환합니다. 텍스트 추출이 어려운 PDF는 페이지 단위로 전환됩니다.
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 우측: 설정 + 생성 버튼 */}
      <div className={styles.sidebar}>
        <div className={styles.settingsCard}>
          <div className={styles.settingsTitle}>
            <Settings size={ICON_FOR_BUTTON.md} />
            슬라이드 설정
          </div>
          <SlideSettingsPanel
            settings={settings}
            onChange={setSettings}
            disabled={isGenerating}
          />
        </div>

        {/* 미리보기 — 이미지 모드 */}
        {mode === "image" && previewItem && (
          <div className={styles.previewPanel}>
            <div className={styles.previewHeader}>
              <span className={styles.previewTitle}>미리보기</span>
              <span className={styles.previewCount}>{previewIndex + 1} / {images.length}</span>
            </div>
            <div
              className={styles.previewCard}
              data-bg={settings.background}
              data-ratio={settings.aspect_ratio}
            >
              <button
                type="button"
                className={`${styles.previewNav} ${styles.previewNavLeft}`}
                onClick={() => setPreviewIndex((idx) => Math.max(0, idx - 1))}
                disabled={previewIndex === 0}
                title="이전 슬라이드"
              >
                <ChevronLeft size={ICON_FOR_BUTTON.sm} />
              </button>
              <img
                src={previewItem.previewUrl}
                alt={`슬라이드 ${previewIndex + 1} 미리보기`}
                className={styles.previewImage}
                data-fit={settings.fit_mode}
                decoding="async"
                // eslint-disable-next-line no-restricted-syntax
                style={{ filter: previewFilter }}
              />
              <button
                type="button"
                className={`${styles.previewNav} ${styles.previewNavRight}`}
                onClick={() => setPreviewIndex((idx) => Math.min(images.length - 1, idx + 1))}
                disabled={previewIndex >= images.length - 1}
                title="다음 슬라이드"
              >
                <ChevronRight size={ICON_FOR_BUTTON.sm} />
              </button>
              <div className={styles.previewBadge}>
                {previewItem.file.name}
              </div>
            </div>
            <div className={styles.thumbnailStrip}>
              {previewWindow.map(({ item, index }) => (
                <button
                  key={item.id}
                  type="button"
                  className={styles.thumbnailButton}
                  data-active={index === previewIndex ? "true" : "false"}
                  onClick={() => setPreviewIndex(index)}
                  title={`${index + 1}. ${item.file.name}`}
                >
                  <img
                    src={item.previewUrl}
                    alt=""
                    className={styles.thumbnailImage}
                    decoding="async"
                    // eslint-disable-next-line no-restricted-syntax
                    style={{ filter: buildPreviewFilter(item, settings) }}
                  />
                  <span className={styles.thumbnailNumber}>{index + 1}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 생성 버튼 */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate || isGenerating}
          className={styles.generateButton}
        >
          {isGenerating ? (
            <>
              <div className={styles.generateLabel}>
                <Spinner />
                {progressLabel || "PPT 생성 중..."}
              </div>
              {progressPct !== null && (
                <progress
                  className={styles.generateProgress}
                  value={progressPct}
                  max={100}
                  aria-label="PPT 생성 진행률"
                />
              )}
            </>
          ) : (
            <div className={styles.generateLabel}>
              <Download size={ICON_FOR_BUTTON.md} />
              PPT 생성 및 다운로드
            </div>
          )}
        </button>

        {/* 상태 요약 */}
        {mode === "image" && images.length > 0 && (
          <div className={styles.summary}>
            <div className={styles.summaryTitle}>
              {images.length}장 슬라이드
            </div>
            <div className={styles.summaryMeta}>
              {formatBytes(images.reduce((sum, i) => sum + i.file.size, 0))} · {settings.aspect_ratio} · {settings.background === "black" ? "검정" : settings.background === "white" ? "흰색" : "진회"} 배경
            </div>
          </div>
        )}
        {mode === "pdf" && pdfFile && (
          <div className={styles.summary}>
            <div className={styles.summaryTitle}>
              PDF 변환 모드
            </div>
            <div className={styles.summaryMeta}>
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
      className={styles.modeTab}
      data-active={active ? "true" : "false"}
    >
      {icon}
      {label}
    </button>
  );
}

function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={styles.spinner}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
