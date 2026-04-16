// PATH: src/app_admin/domains/storage/components/matchup/ProblemDetailModal.tsx
// 유사 문제 상세 모달 — 원본 이미지 + 텍스트 + 출처 + 액션

import { useState, useEffect } from "react";
import { X, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/shared/ui/ds";
import { getMatchupProblemPresignUrl } from "../../api/matchup.api";
import type { SimilarProblem } from "../../api/matchup.api";

type Props = {
  problem: SimilarProblem;
  onClose: () => void;
  onNavigate?: (documentId: number, problemNumber: number) => void;
};

export default function ProblemDetailModal({ problem, onClose, onNavigate }: Props) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (problem.image_url) {
      setImgUrl(problem.image_url);
    } else {
      getMatchupProblemPresignUrl(problem.id)
        .then(setImgUrl)
        .catch(() => setImgUrl(null));
    }
  }, [problem.id, problem.image_url]);

  const handleCopyText = () => {
    if (problem.text) {
      navigator.clipboard.writeText(problem.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const pct = Math.round(problem.similarity * 100);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--color-bg-surface)", borderRadius: "var(--radius-xl)",
          width: 560, maxWidth: "90vw", maxHeight: "85vh",
          display: "flex", flexDirection: "column",
          boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "var(--space-5) var(--space-6)",
          borderBottom: "1px solid var(--color-border-divider)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            {/* 유사도 뱃지 */}
            <div style={{
              padding: "4px 12px", borderRadius: "var(--radius-md)",
              fontSize: 14, fontWeight: 700,
              background: pct >= 80
                ? "color-mix(in srgb, var(--color-success) 12%, var(--color-bg-surface))"
                : "var(--color-bg-surface-soft)",
              color: pct >= 80 ? "var(--color-success)" : "var(--color-text-muted)",
            }}>
              {pct}% 유사
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)" }}>
                Q{problem.number}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {problem.document_title}
                {problem.source_lecture_title && (
                  <> &middot; {problem.source_lecture_title}</>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 본문 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-5) var(--space-6)" }}>
          {/* 출처 정보 */}
          {(problem.source_lecture_title || problem.source_exam_title) && (
            <div style={{
              display: "flex", flexWrap: "wrap", gap: "var(--space-2)",
              marginBottom: "var(--space-4)",
            }}>
              {problem.source_lecture_title && (
                <span style={{
                  fontSize: 11, padding: "3px 10px", borderRadius: 6,
                  background: "color-mix(in srgb, var(--color-brand-primary) 8%, var(--color-bg-surface))",
                  color: "var(--color-brand-primary)", fontWeight: 600,
                }}>
                  {problem.source_lecture_title}
                </span>
              )}
              {problem.source_session_title && (
                <span style={{
                  fontSize: 11, padding: "3px 10px", borderRadius: 6,
                  background: "var(--color-bg-surface-soft)", color: "var(--color-text-secondary)",
                }}>
                  {problem.source_session_title}
                </span>
              )}
              {problem.source_exam_title && (
                <span style={{
                  fontSize: 11, padding: "3px 10px", borderRadius: 6,
                  background: "var(--color-bg-surface-soft)", color: "var(--color-text-secondary)",
                }}>
                  {problem.source_exam_title}
                </span>
              )}
            </div>
          )}

          {/* 이미지 */}
          {imgUrl ? (
            <div style={{
              borderRadius: "var(--radius-lg)", overflow: "hidden",
              border: "1px solid var(--color-border-divider)",
              marginBottom: "var(--space-4)", background: "var(--color-bg-surface-soft)",
            }}>
              <img
                src={imgUrl}
                alt={`Q${problem.number}`}
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            </div>
          ) : (
            <div style={{
              height: 200, borderRadius: "var(--radius-lg)",
              background: "var(--color-bg-surface-soft)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--color-text-muted)", fontSize: 14,
              marginBottom: "var(--space-4)",
            }}>
              이미지를 불러올 수 없습니다
            </div>
          )}

          {/* 텍스트 */}
          {problem.text && (
            <div style={{
              padding: "var(--space-4)", borderRadius: "var(--radius-md)",
              background: "var(--color-bg-surface-soft)",
              border: "1px solid var(--color-border-divider)",
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: "var(--space-2)",
              }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                  OCR 추출 텍스트
                </span>
                <button
                  onClick={handleCopyText}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: copied ? "var(--color-success)" : "var(--color-text-muted)",
                    display: "flex", alignItems: "center", gap: 4, fontSize: 11,
                  }}
                >
                  {copied ? <><Check size={12} /> 복사됨</> : <><Copy size={12} /> 복사</>}
                </button>
              </div>
              <p style={{
                margin: 0, fontSize: 14, lineHeight: 1.6,
                color: "var(--color-text-primary)", whiteSpace: "pre-wrap",
              }}>
                {problem.text}
              </p>
            </div>
          )}
        </div>

        {/* 하단 액션 */}
        <div style={{
          display: "flex", justifyContent: "flex-end", gap: "var(--space-2)",
          padding: "var(--space-4) var(--space-6)",
          borderTop: "1px solid var(--color-border-divider)",
        }}>
          <Button intent="ghost" size="sm" onClick={onClose}>
            닫기
          </Button>
          {onNavigate && (
            <Button size="sm" onClick={() => {
              onNavigate(problem.document_id, problem.number);
              onClose();
            }}>
              <ExternalLink size={14} style={{ marginRight: 4 }} />
              이 문제로 이동
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
