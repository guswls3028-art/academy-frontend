// PATH: src/app_admin/domains/scores/components/ScorePrintPreviewModal.tsx
// 성적표 미리보기 + PDF 다운로드 모달 — 흑백 A4 가로

import { useRef, useEffect, useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
import { buildScorePdfHtml, downloadScorePdf, type ScorePdfParams } from "../utils/scorePdfGenerator";
import { feedback } from "@/shared/ui/feedback/feedback";
import { resolveTenantCodeString, getTenantIdFromCode, getTenantDefById } from "@/shared/tenant";
import "./PrintPreviewModal.css";

type Props = ScorePdfParams & {
  open: boolean;
  onClose: () => void;
};

export default function ScorePrintPreviewModal({
  open,
  onClose,
  rows,
  meta,
  sessionTitle,
  lectureTitle,
  date,
  attendanceMap,
  tenantName,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [downloading, setDownloading] = useState(false);

  const params = useMemo<ScorePdfParams>(
    () => ({
      rows,
      meta,
      sessionTitle,
      lectureTitle,
      date,
      attendanceMap,
      tenantName,
    }),
    [rows, meta, sessionTitle, lectureTitle, date, attendanceMap, tenantName]
  );

  // 테넌트명 자동 주입 — 인쇄물 식별 (호출처에서 전달받지 않은 경우)
  const resolvedParams = useMemo<ScorePdfParams>(() => {
    if (params.tenantName != null && params.tenantName.trim() !== "") return params;
    try {
      const code = resolveTenantCodeString();
      const tid = code ? getTenantIdFromCode(code) : null;
      const def = tid ? getTenantDefById(tid) : null;
      return { ...params, tenantName: def?.name };
    } catch {
      return params;
    }
  }, [params]);

  useEffect(() => {
    if (!open || !iframeRef.current) return;
    const html = buildScorePdfHtml(resolvedParams);
    const doc = iframeRef.current.contentDocument ?? iframeRef.current.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
  }, [open, resolvedParams]);

  if (!open) return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadScorePdf(resolvedParams);
      feedback.success("성적표 PDF가 다운로드되었습니다.");
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
      aria-labelledby="score-print-preview-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="print-preview-modal__panel print-preview-modal__panel--score bg-[var(--color-bg-surface)] rounded-lg shadow-2xl border border-[var(--color-border-divider)] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border-divider)]">
          <div className="flex items-center gap-3">
            <FileText size={20} strokeWidth={2} className="text-[var(--color-text-muted)]" aria-hidden />
            <h2 id="score-print-preview-title" className="text-base font-semibold text-[var(--color-text-primary)]">
              성적표 미리보기
            </h2>
            <span className="text-xs text-[var(--color-text-muted)]">
              {params.rows.length}명 · 흑백 A4 가로
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="h-9 px-5 rounded text-sm font-semibold bg-[var(--color-brand-primary)] text-white hover:opacity-90 disabled:opacity-60 flex items-center gap-2"
            >
              <Download size={16} strokeWidth={2} aria-hidden />
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
          <div className="print-preview-modal__paper print-preview-modal__paper--landscape mx-auto bg-white shadow-lg">
            <iframe
              ref={iframeRef}
              title="성적표 미리보기"
              className="print-preview-modal__iframe print-preview-modal__iframe--landscape"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
