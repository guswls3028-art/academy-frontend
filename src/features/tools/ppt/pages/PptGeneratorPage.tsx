// PATH: src/features/tools/ppt/pages/PptGeneratorPage.tsx
// PPT 생성기 메인 페이지 — 이미지 업로드/정렬 → 설정 → 생성/다운로드

import { useState, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { feedback } from "@/shared/ui/feedback/feedback";
import { generatePpt, type PptSettings } from "../api/pptApi";
import ImageUploadArea from "../components/ImageUploadArea";
import SortableImageGrid, { type ImageItem } from "../components/SortableImageGrid";
import SlideSettingsPanel from "../components/SlideSettingsPanel";

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
};

export default function PptGeneratorPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [settings, setSettings] = useState<PptSettings>(DEFAULT_SETTINGS);
  const [uploadPct, setUploadPct] = useState<number | null>(null);

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

  // PPT 생성 mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const files = images.map((i) => i.file);
      const order = images.map((_, idx) => idx); // 이미 정렬된 순서

      // 슬라이드별 반전 설정 반영
      const perSlide = images.map((item) => ({
        invert: item.invert || settings.invert,
        grayscale: settings.grayscale,
      }));

      return generatePpt(files, order, { ...settings, per_slide: perSlide }, (pct) => {
        setUploadPct(pct);
      });
    },
    onSuccess: (data) => {
      setUploadPct(null);
      feedback.success(`PPT 생성 완료 (${data.slide_count}장, ${formatBytes(data.size_bytes)})`);
      // 자동 다운로드
      const a = document.createElement("a");
      a.href = data.download_url;
      a.download = data.filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 100);
    },
    onError: (err: any) => {
      setUploadPct(null);
      const msg = err?.response?.data?.detail || "PPT 생성에 실패했습니다.";
      feedback.error(msg);
    },
  });

  const isGenerating = generateMutation.isPending;

  return (
    <div style={{ display: "flex", gap: 24, minHeight: "calc(100vh - 200px)" }}>
      {/* 좌측: 이미지 업로드 + 그리드 */}
      <div style={{ flex: 1, minWidth: 0 }}>
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

        {/* 미리보기 카드 */}
        {images.length > 0 && (
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
                  + (settings.grayscale ? "grayscale(1)" : ""),
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
          onClick={() => generateMutation.mutate()}
          disabled={images.length === 0 || isGenerating}
          style={{
            width: "100%",
            padding: "14px 24px",
            fontSize: 15,
            fontWeight: 700,
            color: "#fff",
            background: images.length === 0 || isGenerating
              ? "var(--color-bg-disabled, #aaa)"
              : "var(--color-primary)",
            border: "none",
            borderRadius: "var(--radius-lg, 12px)",
            cursor: images.length === 0 || isGenerating ? "not-allowed" : "pointer",
            transition: "background 0.15s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {isGenerating ? (
            <>
              <Spinner />
              {uploadPct !== null ? `업로드 중 ${uploadPct}%` : "PPT 생성 중..."}
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              PPT 생성 및 다운로드
            </>
          )}
        </button>

        {images.length > 0 && (
          <div style={{ textAlign: "center", lineHeight: 1.6 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)" }}>
              {images.length}장 슬라이드
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              {formatBytes(images.reduce((sum, i) => sum + i.file.size, 0))} · {settings.aspect_ratio} · {settings.background === "black" ? "검정" : settings.background === "white" ? "흰색" : "진회"} 배경
            </div>
          </div>
        )}
      </div>
    </div>
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
