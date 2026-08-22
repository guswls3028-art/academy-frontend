// PATH: src/app_admin/domains/scores/components/ClinicPrintPreviewModal.tsx
// 클리닉 대상자 안내 미리보기 + PDF 다운로드 모달

import { useRef, useEffect, useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
import {
  buildClinicPdfHtml,
  CLINIC_PRINT_PAGE,
  downloadClinicPdf,
  type ClinicPdfParams,
} from "../utils/clinicPdfGenerator";
import { feedback } from "@/shared/ui/feedback/feedback";
import { ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import "./PrintPreviewModal.css";

type Props = ClinicPdfParams & {
  open: boolean;
  onClose: () => void;
  attendanceState?: "loading" | "error" | "ready";
  onRetryAttendance?: () => void;
};

export default function ClinicPrintPreviewModal({
  open,
  onClose,
  rows,
  meta,
  sessionTitle,
  lectureTitle,
  date,
  attendanceMap,
  schedule,
  attendanceState = "ready",
  onRetryAttendance,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [downloading, setDownloading] = useState(false);
  const params = useMemo<ClinicPdfParams>(
    () => ({
      rows,
      meta,
      sessionTitle,
      lectureTitle,
      date,
      attendanceMap,
      schedule,
    }),
    [rows, meta, sessionTitle, lectureTitle, date, attendanceMap, schedule]
  );

  useEffect(() => {
    if (!open || attendanceState !== "ready" || !iframeRef.current) return;
    const html = buildClinicPdfHtml(params);
    const doc = iframeRef.current.contentDocument ?? iframeRef.current.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
  }, [attendanceState, open, params]);

  if (!open) return null;

  const handleDownload = async () => {
    if (attendanceState !== "ready") return;
    setDownloading(true);
    try {
      await downloadClinicPdf(params);
      feedback.success("클리닉 대상자 PDF가 다운로드되었습니다.");
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
      aria-labelledby="clinic-print-preview-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="print-preview-modal__panel print-preview-modal__panel--clinic bg-[var(--color-bg-surface)] rounded-lg shadow-2xl border border-[var(--color-border-divider)] flex flex-col"
      >
        {/* Header */}
        <div className="clinic-print-preview-modal__header flex items-center justify-between px-5 py-3 border-b border-[var(--color-border-divider)]">
          <div className="flex items-center gap-3">
            <FileText size={ICON.md} strokeWidth={2} className="text-[var(--color-text-muted)]" aria-hidden />
            <h2 id="clinic-print-preview-title" className="text-base font-semibold text-[var(--color-text-primary)]">
              클리닉 대상자 미리보기
            </h2>
            <span className="text-xs text-[var(--color-text-muted)]">
              {CLINIC_PRINT_PAGE.label}
            </span>
          </div>
          <div className="clinic-print-preview-modal__actions flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading || attendanceState !== "ready"}
              className="h-9 px-5 rounded text-sm font-semibold bg-[var(--color-brand-primary)] text-white hover:opacity-90 disabled:opacity-60 flex items-center gap-2"
            >
              <Download size={ICON_FOR_BUTTON.md} strokeWidth={2} aria-hidden />
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
          {attendanceState === "loading" ? (
            <div className="mx-auto flex min-h-72 max-w-xl items-center justify-center rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-8 text-sm font-medium text-[var(--color-text-secondary)]" role="status">
              출결 정보를 불러오는 중입니다…
            </div>
          ) : attendanceState === "error" ? (
            <div className="mx-auto flex min-h-72 max-w-xl flex-col items-center justify-center gap-4 rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-8 text-center" role="alert">
              <div>
                <strong className="block text-sm text-[var(--color-text-primary)]">출결 정보를 불러오지 못했습니다</strong>
                <span className="mt-1 block text-xs text-[var(--color-text-muted)]">영상·결석 학생이 섞이지 않도록 명단 생성을 중단했습니다.</span>
              </div>
              <button
                type="button"
                onClick={onRetryAttendance}
                className="h-9 rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] px-4 text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)]"
              >
                다시 시도
              </button>
            </div>
          ) : (
            <div className="print-preview-modal__paper print-preview-modal__paper--a3-portrait mx-auto bg-white shadow-lg">
              <iframe
                ref={iframeRef}
                title="클리닉 대상자 미리보기"
                className="print-preview-modal__iframe print-preview-modal__iframe--a3-portrait"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
