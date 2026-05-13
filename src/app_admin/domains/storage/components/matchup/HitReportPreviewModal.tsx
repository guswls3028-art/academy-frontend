// PATH: src/app_admin/domains/storage/components/matchup/HitReportPreviewModal.tsx
// 적중보고서 read-only preview modal (Phase #70, 2026-05-13).
//
// 학원장 spec (박철T 라이브 2026-05-13):
//   "저장된 보고서는 읽기모드로 빠르게 랜딩되고, 수정 누르면 정상 매치업 적중보고서 수정창"
//
// 본질: 매치업 콘솔 row 클릭 시 무거운 편집기(CLIP search 30s+) 안 띄움.
//   - PDF blob fetch → iframe inline preview (gen 3-10s)
//   - 메타(적중률/문항수/강사) 카드
//   - "수정" CTA → 기존 편집기 흐름 (HitReportListPage handleOpen)
/* eslint-disable no-restricted-syntax */

import { useEffect, useRef, useState } from "react";
import api from "@/shared/api/axios";
import type { HitReportListItem } from "../../api/matchup.api";

interface Props {
  report: HitReportListItem;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
}

export default function HitReportPreviewModal({ report, open, onClose, onEdit }: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cleanupRef = useRef<string | null>(null);

  // PDF blob fetch — modal open 시점에 한 번. 닫을 때 cleanup.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const resp = await api.get(`/matchup/hit-reports/${report.id}/curated.pdf`, {
          responseType: "blob",
          timeout: 5 * 60_000,
        });
        if (cancelled) return;
        const blob = new Blob([resp.data], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        cleanupRef.current = url;
        setPdfUrl(url);
      } catch (e) {
        if (cancelled) return;
        const status = (e as { response?: { status?: number } })?.response?.status;
        const msg = status === 504
          ? "PDF 생성에 시간이 너무 오래 걸렸습니다. 잠시 후 다시 시도해 주세요."
          : "PDF 미리보기 실패. 잠시 후 다시 시도해 주세요.";
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (cleanupRef.current) {
        URL.revokeObjectURL(cleanupRef.current);
        cleanupRef.current = null;
      }
    };
  }, [open, report.id]);

  // ESC + body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!open) return null;

  const isSubmitted = report.status === "submitted";
  const title = report.title || report.document_title || `적중보고서 #${report.id}`;
  const docCategory = report.document_category;
  const authorName = report.author_name || "—";
  const hitRate = report.hit_rate || 0;
  const hitCount = report.hit_count || 0;
  const examCount = report.exam_count || 0;
  const curatedProgress = report.curated_progress || 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(8,12,22,0.55)", backdropFilter: "blur(6px)",
        display: "flex", flexDirection: "column", padding: 0,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="적중보고서 미리보기"
        style={{
          width: "min(1000px, 100%)", height: "100%", maxHeight: "100vh", margin: "0 auto",
          background: "var(--color-bg-canvas, #fff)",
          display: "flex", flexDirection: "column",
          boxShadow: "0 0 40px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--color-border-divider, #e2e8f0)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          flexShrink: 0,
          background: "var(--color-bg-subtle, #f8fafc)",
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              {isSubmitted ? (
                <span style={{
                  padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                  background: "var(--color-status-success-bg, #dcfce7)",
                  color: "var(--color-status-success, #16a34a)",
                }}>🌐 게시 중</span>
              ) : (
                <span style={{
                  padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                  background: "var(--color-status-warning-bg, #fef3c7)",
                  color: "var(--color-status-warning, #d97706)",
                }}>작성 중</span>
              )}
              <span style={{ fontSize: 11, color: "var(--color-text-muted, #94a3b8)" }}>#{report.id}</span>
              {docCategory && (
                <span style={{ fontSize: 11, color: "var(--color-text-muted, #94a3b8)" }}>{docCategory}</span>
              )}
            </div>
            <h3 style={{
              fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: "-0.01em",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              color: "var(--color-text-primary, #0f172a)",
            }}>{title}</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              data-testid="hit-report-preview-edit"
              onClick={onEdit}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "none",
                background: "var(--color-brand-primary, #2563EB)",
                color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                letterSpacing: "-0.01em",
              }}
            >수정 →</button>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              style={{
                width: 36, height: 36, borderRadius: 8,
                border: "1px solid var(--color-border-divider, #cbd5e1)",
                background: "transparent", color: "var(--color-text-secondary, #475569)",
                cursor: "pointer", fontSize: 18, lineHeight: 1,
              }}
            >×</button>
          </div>
        </div>

        {/* 메타 카드 */}
        <div style={{
          padding: "10px 18px",
          borderBottom: "1px solid var(--color-border-divider, #e2e8f0)",
          display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap",
          flexShrink: 0,
          fontSize: 12,
        }}>
          <div>
            <span style={{ color: "var(--color-text-muted, #94a3b8)" }}>강사: </span>
            <strong style={{ color: "var(--color-text-primary, #0f172a)" }}>{authorName}</strong>
          </div>
          <div>
            <span style={{ color: "var(--color-text-muted, #94a3b8)" }}>적중률: </span>
            <strong style={{
              color: hitRate >= 50 ? "var(--color-status-success, #16a34a)"
                : hitRate >= 25 ? "var(--color-brand-primary, #2563EB)"
                : "var(--color-text-muted, #94a3b8)",
            }}>{hitRate.toFixed(1)}%</strong>
            <span style={{ color: "var(--color-text-muted, #94a3b8)", marginLeft: 4 }}>({hitCount}/{examCount})</span>
          </div>
          <div>
            <span style={{ color: "var(--color-text-muted, #94a3b8)" }}>작성률: </span>
            <strong>{curatedProgress.toFixed(0)}%</strong>
          </div>
        </div>

        {/* PDF iframe area */}
        <div style={{ flex: 1, position: "relative", background: "#f1f5f9", overflow: "hidden" }}>
          {loading ? (
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 12,
              color: "var(--color-text-secondary, #64748b)",
            }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>PDF 미리보기 만드는 중…</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted, #94a3b8)", textAlign: "center", lineHeight: 1.5, maxWidth: 360 }}>
                보고서 크기에 따라 몇 초~십수 초 걸릴 수 있어요.<br />
                편집(자료 추가/코멘트 수정)은 "수정 →" 버튼으로 바로 들어가실 수 있습니다.
              </div>
            </div>
          ) : error ? (
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 12,
              color: "var(--color-status-error, #dc2626)",
              padding: 24, textAlign: "center",
            }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{error}</div>
              <button
                type="button"
                onClick={onEdit}
                style={{
                  marginTop: 8,
                  padding: "8px 16px", borderRadius: 8, border: "1px solid var(--color-border-divider, #cbd5e1)",
                  background: "#fff", color: "var(--color-brand-primary, #2563EB)",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}
              >대신 편집기로 들어가기</button>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              title={title}
              data-testid="hit-report-preview-iframe"
              style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
