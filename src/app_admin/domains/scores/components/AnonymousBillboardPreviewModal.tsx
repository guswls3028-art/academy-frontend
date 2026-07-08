// 익명 성적 빌보드 미리보기 + PDF 다운로드 모달

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Trophy } from "lucide-react";
import {
  BILLBOARD_PRINT_PAGE,
  buildAnonymousBillboardPdfHtml,
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
  const [downloading, setDownloading] = useState(false);
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

  useEffect(() => {
    if (!open || !iframeRef.current) return;
    const html = buildAnonymousBillboardPdfHtml(params);
    const doc = iframeRef.current.contentDocument ?? iframeRef.current.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
  }, [open, params]);

  if (!open) return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const downloaded = await downloadAnonymousBillboardPdf(params);
      if (downloaded) feedback.success("익명 빌보드 PDF가 다운로드되었습니다.");
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
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border-divider)]">
          <div className="flex items-center gap-3">
            <Trophy size={ICON.md} strokeWidth={2} className="text-[var(--color-text-muted)]" aria-hidden />
            <h2 id="anonymous-billboard-preview-title" className="text-base font-semibold text-[var(--color-text-primary)]">
              익명 빌보드 미리보기
            </h2>
            <span className="text-xs text-[var(--color-text-muted)]">
              {BILLBOARD_PRINT_PAGE.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="h-9 px-5 rounded text-sm font-semibold bg-[var(--color-brand-primary)] text-white hover:opacity-90 disabled:opacity-60 flex items-center gap-2"
            >
              <Download size={ICON_FOR_BUTTON.md} strokeWidth={2} aria-hidden />
              {downloading ? "PDF 생성 중..." : "PDF 다운로드"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded text-sm font-medium border border-[var(--color-border-divider)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)]"
            >
              닫기
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[#e5e7eb] p-4">
          <div className="print-preview-modal__paper print-preview-modal__paper--billboard mx-auto bg-white shadow-lg">
            <iframe
              ref={iframeRef}
              title="익명 빌보드 미리보기"
              className="print-preview-modal__iframe print-preview-modal__iframe--billboard"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
