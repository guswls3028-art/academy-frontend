// PATH: src/app_admin/domains/scores/components/ScorePrintPreviewModal.tsx
// 성적표 미리보기 + PDF 다운로드 모달 — 테넌트 브랜드 A4 가로

import { useRef, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Download, FileText } from "lucide-react";
import {
  buildScorePdfHtml,
  downloadScorePdf,
  getScorePdfPageCount,
  type ScorePdfParams,
} from "../utils/scorePdfGenerator";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useProgram } from "@/shared/program";
import {
  getTenantBranding,
  resolveTenantCodeString,
  getTenantIdFromCode,
  getTenantDefById,
} from "@/shared/tenant";
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
  const { program } = useProgram();
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

  // 인쇄물은 현재 프로그램 설정을 우선하고, 정적 테넌트 설정을 안전한 폴백으로 사용한다.
  const resolvedParams = useMemo<ScorePdfParams>(() => {
    try {
      const code = program?.tenantCode?.trim() || resolveTenantCodeString();
      const tid = code ? getTenantIdFromCode(code) : null;
      const def = tid ? getTenantDefById(tid) : null;
      const branding = tid ? getTenantBranding(tid) : null;
      return {
        ...params,
        tenantName:
          params.tenantName?.trim()
          || program?.display_name?.trim()
          || def?.name,
        tenantCode: code,
        tenantLogoUrl:
          program?.ui_config?.logo_url?.trim()
          || branding?.logoUrl?.trim()
          || branding?.headerLogoUrl?.trim(),
        primaryColor: program?.ui_config?.primary_color?.trim(),
      };
    } catch {
      return params;
    }
  }, [params, program]);
  const pageCount = getScorePdfPageCount(resolvedParams);
  const previewHeight = `${(pageCount * 210) + (Math.max(0, pageCount - 1) * 8)}mm`;
  const previewStyle = {
    "--score-report-preview-height": previewHeight,
  } as CSSProperties;

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
              {params.rows.length}명 · A4 가로 {pageCount}쪽
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
          <div
            className="print-preview-modal__paper print-preview-modal__paper--landscape mx-auto bg-white shadow-lg"
            style={previewStyle}
          >
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
