// PATH: src/app_admin/domains/storage/components/matchup/DocumentPreviewModal.tsx
// 매치업 원본 PDF/이미지 미리보기 모달
//
// PDF: iframe → 브라우저 native viewer
// 이미지: img 태그 + 비율 유지
// ESC 키 닫기, 배경 클릭 닫기, 새 창 열기 버튼

import { useEffect, useState } from "react";
import { X, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { feedback } from "@/shared/ui/feedback/feedback";
import { getMatchupDocumentPreview } from "../../api/matchup.api";
import type { MatchupDocumentPreview } from "../../api/matchup.api";

type Props = {
  documentId: number;
  documentTitle: string;
  onClose: () => void;
};

export default function DocumentPreviewModal({ documentId, documentTitle, onClose }: Props) {
  const [preview, setPreview] = useState<MatchupDocumentPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getMatchupDocumentPreview(documentId)
      .then((p) => setPreview(p))
      .catch(() => {
        setError("미리보기를 불러올 수 없습니다.");
        feedback.error("미리보기를 불러올 수 없습니다.");
      })
      .finally(() => setLoading(false));
  }, [documentId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isPdf = preview?.content_type === "application/pdf";
  const isImage = preview?.content_type?.startsWith("image/");

  return (
    <div
      data-testid="matchup-preview-modal"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        padding: "var(--space-4)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-bg-surface)",
          borderRadius: "var(--radius-xl)",
          width: "min(1100px, 100%)",
          height: "min(90vh, 900px)",
          display: "flex", flexDirection: "column",
          boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        {/* 헤더 */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "var(--space-4) var(--space-5)",
          borderBottom: "1px solid var(--color-border-divider)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0 }}>
            <h3 style={{
              margin: 0, fontSize: 14, fontWeight: 700,
              color: "var(--color-text-primary)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {documentTitle}
            </h3>
            {preview && (
              <span style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 4,
                background: "var(--color-bg-surface-soft)",
                color: "var(--color-text-muted)",
                whiteSpace: "nowrap",
              }}>
                {isPdf ? "PDF" : isImage ? "이미지" : preview.content_type}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", flexShrink: 0 }}>
            {preview?.url && (
              <a
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
                title="새 창에서 열기"
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "6px 10px", fontSize: 12,
                  color: "var(--color-text-secondary)",
                  borderRadius: 6, textDecoration: "none",
                }}
              >
                <ExternalLink size={14} />
                새 창
              </a>
            )}
            <button
              onClick={onClose}
              title="닫기 (ESC)"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--color-text-muted)", padding: 6,
                display: "flex", alignItems: "center",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div style={{
          flex: 1, overflow: "hidden", position: "relative",
          background: "var(--color-bg-surface-soft)",
        }}>
          {loading && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: "var(--space-2)", color: "var(--color-text-muted)",
            }}>
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--color-brand-primary)" }} />
              <span style={{ fontSize: 13 }}>미리보기 불러오는 중...</span>
            </div>
          )}
          {error && !loading && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: "var(--space-2)", color: "var(--color-danger)",
            }}>
              <AlertCircle size={24} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>{error}</span>
            </div>
          )}
          {preview && !loading && !error && (
            <>
              {isPdf && (
                <iframe
                  src={preview.url}
                  title={preview.title}
                  style={{
                    width: "100%", height: "100%",
                    border: "none", display: "block",
                  }}
                />
              )}
              {isImage && (
                <div style={{
                  width: "100%", height: "100%", overflow: "auto",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "var(--space-3)",
                }}>
                  <img
                    src={preview.url}
                    alt={preview.title}
                    style={{
                      maxWidth: "100%", maxHeight: "100%",
                      objectFit: "contain",
                      background: "white", borderRadius: 4,
                    }}
                  />
                </div>
              )}
              {!isPdf && !isImage && (
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--color-text-muted)", fontSize: 13,
                }}>
                  미리보기를 지원하지 않는 형식입니다 ({preview.content_type}).
                  새 창으로 열어주세요.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
