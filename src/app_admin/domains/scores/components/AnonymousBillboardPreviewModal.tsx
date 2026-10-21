// 익명 성적 순위표 미리보기 + PDF 다운로드 모달

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Download, Trophy } from "lucide-react";
import {
  BILLBOARD_PRINT_PAGE,
  buildAnonymousBillboardDocument,
  buildAnonymousBillboardHtml,
  getAnonymousBillboardPageCount,
  downloadAnonymousBillboardPdf,
  type AnonymousBillboardPdfParams,
} from "../utils/anonymousBillboardPdfGenerator";
import { feedback } from "@/shared/ui/feedback/feedback";
import { ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import "./PrintPreviewModal.css";

type Props = AnonymousBillboardPdfParams & {
  open: boolean;
  onClose: () => void;
};

export default function AnonymousBillboardPreviewModal({
  open,
  onClose,
  rows,
  meta,
  sessionTitle,
  lectureTitle,
  date,
  attendanceMap,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [previewMode, setPreviewMode] = useState<"fit" | "actual">("fit");
  const [fitScale, setFitScale] = useState(0.78);
  const params = useMemo<AnonymousBillboardPdfParams>(
    () => ({
      rows,
      meta,
      sessionTitle,
      lectureTitle,
      date,
      attendanceMap,
    }),
    [rows, meta, sessionTitle, lectureTitle, date, attendanceMap],
  );
  const document = useMemo(() => buildAnonymousBillboardDocument(params), [params]);
  const pageCount = getAnonymousBillboardPageCount(document);
  const previewStyle = {
    "--billboard-preview-height": `${pageCount * 297 * 96 / 25.4 + (pageCount - 1) * 12}px`,
    "--billboard-preview-scale": previewMode === "fit" ? fitScale : 1,
  } as CSSProperties;

  useEffect(() => {
    const preview = previewRef.current;
    if (!open || !preview) return;
    const updateScale = () => {
      const style = getComputedStyle(preview);
      const available = preview.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      setFitScale(Math.min(1, Math.max(0.1, available / (210 * 96 / 25.4))));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(preview);
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open || !iframeRef.current) return;
    const html = buildAnonymousBillboardHtml(document);
    const doc = iframeRef.current.contentDocument ?? iframeRef.current.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
  }, [open, document]);

  if (!open) return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const downloaded = await downloadAnonymousBillboardPdf(params);
      if (downloaded) feedback.success("익명 순위표 PDF가 다운로드되었습니다.");
    } catch (e: unknown) {
      feedback.error(e instanceof Error ? e.message : "PDF 생성에 실패했습니다.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="anonymous-billboard-preview-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="print-preview-modal__panel print-preview-modal__panel--billboard bg-[var(--color-bg-surface)] rounded-lg shadow-2xl border border-[var(--color-border-divider)] flex flex-col"
      >
        <div className="billboard-print-preview__header flex items-center justify-between gap-3 px-5 py-3 border-b border-[var(--color-border-divider)]">
          <div className="flex flex-wrap items-center gap-2">
            <Trophy size={ICON.md} strokeWidth={2} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden />
            <h2 id="anonymous-billboard-preview-title" className="whitespace-nowrap text-base font-semibold text-[var(--color-text-primary)]">
              익명 순위표 미리보기
            </h2>
            <span className="text-xs text-[var(--color-text-muted)]">
              {BILLBOARD_PRINT_PAGE.label} {pageCount}쪽
            </span>
          </div>
          <div className="billboard-print-preview__actions flex flex-wrap items-center gap-2">
            <select
              aria-label="익명 순위표 미리보기 배율"
              value={previewMode}
              onChange={event => setPreviewMode(event.target.value === "actual" ? "actual" : "fit")}
              className="h-9 rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] px-2 text-sm"
            >
              <option value="fit">화면에 맞추기</option>
              <option value="actual">100%</option>
            </select>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="h-9 px-3 whitespace-nowrap rounded text-sm font-semibold bg-[var(--color-brand-primary)] text-white hover:opacity-90 disabled:opacity-60 flex items-center gap-2"
            >
              <Download size={ICON_FOR_BUTTON.md} strokeWidth={2} aria-hidden />
              {downloading ? "PDF 생성 중..." : "PDF 다운로드"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3 whitespace-nowrap rounded text-sm font-medium border border-[var(--color-border-divider)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)]"
            >
              닫기
            </button>
          </div>
        </div>

        <div ref={previewRef} className="billboard-print-preview__viewport flex-1 min-h-0 overflow-auto bg-[#e5e7eb] p-4">
          <div className="billboard-print-preview__scaled-page mx-auto" style={previewStyle}>
            <div className="print-preview-modal__paper print-preview-modal__paper--billboard bg-white shadow-lg">
            <iframe
              ref={iframeRef}
              title="익명 순위표 미리보기"
              className="print-preview-modal__iframe print-preview-modal__iframe--billboard"
            />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
