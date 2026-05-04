// PATH: src/app_admin/domains/storage/components/matchup/ProblemDetailModal.tsx
//
// 유사 문제 상세 모달 — 좌-우 비교 뷰.
//   좌: 원본(비교 대상, source = 현재 선택한 문제)
//   우: 매치 자료(클릭한 similar problem)
//
// 둘이 한 화면에서 동시에 보여 즉시 비교 가능 — 사용자가 따로 탭 전환 안 해도 됨.

import { useState, useEffect } from "react";
import { X, ExternalLink, Copy, Check } from "lucide-react";
import { ICON, Button } from "@/shared/ui/ds";
import { getMatchupProblemPresignUrl } from "../../api/matchup.api";
import type { MatchupProblem, SimilarProblem } from "../../api/matchup.api";

type Props = {
  problem: SimilarProblem;
  sourceProblem?: MatchupProblem | null;
  sourceDocumentTitle?: string;
  onClose: () => void;
  onNavigate?: (documentId: number, problemNumber: number) => void;
};

function PaneImage({ url, alt }: { url: string | null; alt: string }) {
  if (!url) {
    return (
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--color-text-muted)", fontSize: 13,
        background: "var(--color-bg-surface-soft)",
      }}>
        이미지를 불러올 수 없습니다
      </div>
    );
  }
  return (
    <div style={{
      flex: 1, minHeight: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--color-bg-surface-soft)",
      overflow: "auto",
      padding: "var(--space-3)",
    }}>
      <img
        src={url}
        alt={alt}
        style={{
          maxWidth: "100%", maxHeight: "100%", height: "auto", width: "auto",
          objectFit: "contain", background: "white",
          borderRadius: 4, boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      />
    </div>
  );
}

export default function ProblemDetailModal({
  problem,
  sourceProblem = null,
  sourceDocumentTitle = "",
  onClose,
  onNavigate,
}: Props) {
  const [matchUrl, setMatchUrl] = useState<string | null>(problem.image_url || null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(sourceProblem?.image_url || null);
  const [copied, setCopied] = useState<"source" | "match" | null>(null);

  useEffect(() => {
    if (problem.image_url) {
      setMatchUrl(problem.image_url);
      return;
    }
    let cancelled = false;
    getMatchupProblemPresignUrl(problem.id)
      .then((u) => { if (!cancelled) setMatchUrl(u); })
      .catch(() => { if (!cancelled) setMatchUrl(null); });
    return () => { cancelled = true; };
  }, [problem.id, problem.image_url]);

  useEffect(() => {
    if (!sourceProblem) { setSourceUrl(null); return; }
    if (sourceProblem.image_url) {
      setSourceUrl(sourceProblem.image_url);
      return;
    }
    let cancelled = false;
    getMatchupProblemPresignUrl(sourceProblem.id)
      .then((u) => { if (!cancelled) setSourceUrl(u); })
      .catch(() => { if (!cancelled) setSourceUrl(null); });
    return () => { cancelled = true; };
  }, [sourceProblem]);

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleCopy = (text: string, which: "source" | "match") => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1800);
  };

  const pct = Math.round(problem.similarity * 100);
  const hasSource = !!sourceProblem;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        data-testid="matchup-detail-modal"
        style={{
          background: "var(--color-bg-surface)", borderRadius: "var(--radius-xl)",
          width: hasSource ? "min(1100px, 96vw)" : "min(640px, 92vw)",
          height: "min(820px, 90vh)",
          display: "flex", flexDirection: "column",
          boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "var(--space-3) var(--space-5)",
          borderBottom: "1px solid var(--color-border-divider)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div style={{
              padding: "4px 12px", borderRadius: "var(--radius-md)",
              fontSize: 14, fontWeight: 800,
              background: pct >= 80
                ? "color-mix(in srgb, var(--color-success) 14%, var(--color-bg-surface))"
                : pct >= 60
                  ? "color-mix(in srgb, var(--color-brand-primary) 10%, var(--color-bg-surface))"
                  : "var(--color-bg-surface-soft)",
              color: pct >= 80 ? "var(--color-success)"
                : pct >= 60 ? "var(--color-brand-primary)"
                : "var(--color-text-muted)",
            }}>
              {pct}% 유사
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)" }}>
              {hasSource
                ? "내 문제 ↔ 매치 자료 비교"
                : `Q${problem.number} 매치`}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 4 }}
            title="닫기 (Esc)"
          >
            <X size={ICON.md} />
          </button>
        </div>

        {/* 본문: 2-pane (source가 있을 때) 또는 1-pane */}
        <div style={{
          flex: 1, minHeight: 0,
          display: "flex",
        }}>
          {hasSource && sourceProblem && (
            <div style={{
              flex: 1, minWidth: 0,
              display: "flex", flexDirection: "column",
              borderRight: "1px solid var(--color-border-divider)",
            }}>
              {/* 좌 헤더 */}
              <div style={{
                padding: "8px var(--space-4)",
                background: "color-mix(in srgb, var(--color-warning) 8%, transparent)",
                borderBottom: "1px solid var(--color-border-divider)",
                flexShrink: 0,
              }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--color-warning)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  내 문제 (원본)
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)", marginTop: 2 }}>
                  Q{sourceProblem.number}
                </div>
                {sourceDocumentTitle && (
                  <div style={{
                    fontSize: 11, color: "var(--color-text-muted)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {sourceDocumentTitle}
                  </div>
                )}
              </div>
              <PaneImage url={sourceUrl} alt={`Q${sourceProblem.number} 원본`} />
              {sourceProblem.text && (
                <div style={{
                  padding: "var(--space-3) var(--space-4)",
                  borderTop: "1px solid var(--color-border-divider)",
                  background: "var(--color-bg-surface)",
                  maxHeight: 140, overflowY: "auto",
                  flexShrink: 0,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
                      OCR 텍스트
                    </span>
                    <button
                      onClick={() => handleCopy(sourceProblem.text || "", "source")}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: copied === "source" ? "var(--color-success)" : "var(--color-text-muted)",
                        display: "flex", alignItems: "center", gap: 4, fontSize: 10,
                      }}
                    >
                      {copied === "source" ? <><Check size={ICON.xs} /> 복사됨</> : <><Copy size={ICON.xs} /> 복사</>}
                    </button>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "var(--color-text-primary)", whiteSpace: "pre-wrap" }}>
                    {sourceProblem.text}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 우: 매치 자료 */}
          <div style={{
            flex: 1, minWidth: 0,
            display: "flex", flexDirection: "column",
          }}>
            <div style={{
              padding: "8px var(--space-4)",
              background: "color-mix(in srgb, var(--color-brand-primary) 8%, transparent)",
              borderBottom: "1px solid var(--color-border-divider)",
              flexShrink: 0,
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--color-brand-primary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                매치 자료
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)", marginTop: 2 }}>
                Q{problem.number}
              </div>
              <div style={{
                fontSize: 11, color: "var(--color-text-muted)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {problem.document_title}
                {problem.source_lecture_title && <> · {problem.source_lecture_title}</>}
              </div>
            </div>
            <PaneImage url={matchUrl} alt={`Q${problem.number} 매치`} />
            {problem.text && (
              <div style={{
                padding: "var(--space-3) var(--space-4)",
                borderTop: "1px solid var(--color-border-divider)",
                background: "var(--color-bg-surface)",
                maxHeight: 140, overflowY: "auto",
                flexShrink: 0,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
                    OCR 텍스트
                  </span>
                  <button
                    onClick={() => handleCopy(problem.text, "match")}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: copied === "match" ? "var(--color-success)" : "var(--color-text-muted)",
                      display: "flex", alignItems: "center", gap: 4, fontSize: 10,
                    }}
                  >
                    {copied === "match" ? <><Check size={ICON.xs} /> 복사됨</> : <><Copy size={ICON.xs} /> 복사</>}
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "var(--color-text-primary)", whiteSpace: "pre-wrap" }}>
                  {problem.text}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 하단 액션 */}
        <div style={{
          display: "flex", justifyContent: "flex-end", gap: "var(--space-2)",
          padding: "var(--space-3) var(--space-5)",
          borderTop: "1px solid var(--color-border-divider)",
          flexShrink: 0,
        }}>
          <Button intent="ghost" size="sm" onClick={onClose}>
            닫기
          </Button>
          {onNavigate && (
            <Button
              size="sm"
              onClick={() => {
                onNavigate(problem.document_id, problem.number);
                onClose();
              }}
              leftIcon={<ExternalLink size={ICON.sm} />}
            >
              이 매치 문서로 이동
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
