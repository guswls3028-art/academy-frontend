// PATH: src/features/scores/components/ScorePrintPreviewModal.tsx
// 성적표 인쇄 미리보기 모달 — 흑백 A4 가로

import { useRef, useEffect } from "react";
import { buildScorePdfHtml, type ScorePdfParams } from "../utils/scorePdfGenerator";

type Props = ScorePdfParams & {
  open: boolean;
  onClose: () => void;
};

export default function ScorePrintPreviewModal({ open, onClose, ...params }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!open || !iframeRef.current) return;
    const html = buildScorePdfHtml(params);
    const doc = iframeRef.current.contentDocument ?? iframeRef.current.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
  }, [open, params.rows, params.meta, params.sessionTitle, params.lectureTitle]);

  if (!open) return null;

  const handlePrint = () => {
    iframeRef.current?.contentWindow?.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="score-print-preview-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-[var(--color-bg-surface)] rounded-lg shadow-2xl border border-[var(--color-border-divider)] flex flex-col"
        style={{ width: "90vw", maxWidth: 1200, height: "85vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border-divider)]">
          <div className="flex items-center gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-muted)]">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <h2 id="score-print-preview-title" className="text-base font-semibold text-[var(--color-text-primary)]">
              성적표 인쇄 미리보기
            </h2>
            <span className="text-xs text-[var(--color-text-muted)]">
              {params.rows.length}명 · 흑백 A4 가로
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="h-9 px-5 rounded text-sm font-semibold bg-[var(--color-brand-primary)] text-white hover:opacity-90 flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              인쇄
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
              width: "297mm",
              minHeight: "210mm",
              transform: "scale(0.85)",
              transformOrigin: "top center",
            }}
          >
            <iframe
              ref={iframeRef}
              title="성적표 미리보기"
              style={{ width: "100%", height: "210mm", border: "none" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
