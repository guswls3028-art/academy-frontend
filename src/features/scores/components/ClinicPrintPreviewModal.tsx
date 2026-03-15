// PATH: src/features/scores/components/ClinicPrintPreviewModal.tsx
// 클리닉 대상자 안내 미리보기 + PDF 다운로드 모달

import { useRef, useEffect, useState } from "react";
import { buildClinicPdfHtml, downloadClinicPdf, type ClinicPdfParams } from "../utils/clinicPdfGenerator";
import { feedback } from "@/shared/ui/feedback/feedback";

type Props = ClinicPdfParams & {
  open: boolean;
  onClose: () => void;
};

export default function ClinicPrintPreviewModal({ open, onClose, ...params }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!open || !iframeRef.current) return;
    const html = buildClinicPdfHtml(params);
    const doc = iframeRef.current.contentDocument ?? iframeRef.current.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
  }, [open, params.rows, params.meta, params.sessionTitle, params.lectureTitle]);

  if (!open) return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadClinicPdf(params);
      feedback.success("클리닉 대상자 PDF가 다운로드되었습니다.");
    } catch (e: any) {
      feedback.error(e?.message ?? "PDF 생성에 실패했습니다.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clinic-print-preview-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-[var(--color-bg-surface)] rounded-lg shadow-2xl border border-[var(--color-border-divider)] flex flex-col"
        style={{ width: "90vw", maxWidth: 900, height: "85vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border-divider)]">
          <div className="flex items-center gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-muted)]">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <h2 id="clinic-print-preview-title" className="text-base font-semibold text-[var(--color-text-primary)]">
              클리닉 대상자 미리보기
            </h2>
            <span className="text-xs text-[var(--color-text-muted)]">
              A4 세로
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="h-9 px-5 rounded text-sm font-semibold bg-[var(--color-brand-primary)] text-white hover:opacity-90 disabled:opacity-60 flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {downloading ? "PDF 생성 중…" : "PDF 다운로드"}
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

        {/* Preview area */}
        <div className="flex-1 overflow-auto bg-[#e5e7eb] p-4">
          <div
            className="mx-auto bg-white shadow-lg"
            style={{
              width: "210mm",
              minHeight: "297mm",
              transform: "scale(0.75)",
              transformOrigin: "top center",
            }}
          >
            <iframe
              ref={iframeRef}
              title="클리닉 대상자 미리보기"
              style={{ width: "100%", height: "297mm", border: "none" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
