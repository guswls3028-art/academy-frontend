// PATH: src/app_admin/domains/storage/components/matchup/ProblemCard.tsx
//
// image_url은 list API에서 바로 내려옴 (N+1 presign 제거).
// 썸네일을 정말로 보고 싶을 때는 확대 버튼으로 큰 이미지 모달.

import { useEffect, useState } from "react";
import { Maximize2, X, AlertTriangle, Loader2 } from "lucide-react";
import type { MatchupProblem } from "../../api/matchup.api";
import { getMatchupProblemPresignUrl } from "../../api/matchup.api";

type Props = {
  problem: MatchupProblem;
  selected: boolean;
  onClick: () => void;
};

export default function ProblemCard({ problem, selected, onClick }: Props) {
  // 자동분리가 인접 문항을 박스 단위로 합친 의심 — 매뉴얼 크롭+Ctrl+V paste 권장.
  const isMergeSuspect = Boolean(
    (problem.meta as { merge_suspect?: boolean } | undefined)?.merge_suspect,
  );
  // 파이프라인 진행 중 skeleton row — 분리만 끝났고 OCR/임베딩/이미지 미완.
  // 신규 업로드 사용자에게 즉시 카운트 노출용. 완료되면 false로 갱신됨.
  const isPartial = Boolean(
    (problem.meta as { is_partial?: boolean } | undefined)?.is_partial,
  );
  const [zoomOpen, setZoomOpen] = useState(false);
  // 기본은 list API가 내려준 image_url 사용 (N+1 없음).
  // 서버가 아직 image_url 미포함 버전이면 fallback으로 presign 1회 호출 (backend 배포 전 호환).
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const imgUrl = problem.image_url || fallbackUrl;

  useEffect(() => {
    if (problem.image_url || !problem.image_key) return;
    let cancelled = false;
    getMatchupProblemPresignUrl(problem.id)
      .then((u) => { if (!cancelled) setFallbackUrl(u); })
      .catch(() => { if (!cancelled) setFallbackUrl(null); });
    return () => { cancelled = true; };
  }, [problem.id, problem.image_key, problem.image_url]);

  useEffect(() => {
    if (!zoomOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoomOpen]);

  return (
    <>
      <div
        data-testid="matchup-problem-card"
        data-problem-id={problem.id}
        onClick={onClick}
        onDoubleClick={(e) => {
          if (imgUrl) {
            e.stopPropagation();
            setZoomOpen(true);
          }
        }}
        title={imgUrl ? "더블클릭 = 크게 보기" : undefined}
        style={{
          border: selected
            ? "2px solid var(--color-brand-primary)"
            : "1px solid var(--color-border-divider)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-3)",
          cursor: "pointer",
          background: selected
            ? "color-mix(in srgb, var(--color-brand-primary) 4%, var(--color-bg-surface))"
            : "var(--color-bg-surface)",
          transition: "border-color 0.15s, box-shadow 0.15s",
          boxShadow: selected ? "0 0 0 3px color-mix(in srgb, var(--color-brand-primary) 12%, transparent)" : undefined,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
          minHeight: 180,
          position: "relative",
        }}
      >
        {/* 번호 + 확대 버튼 */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: 11, fontWeight: 700,
          color: selected ? "var(--color-brand-primary)" : "var(--color-text-muted)",
          letterSpacing: "0.05em",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            Q{problem.number}
            {isPartial && (
              <span
                title="텍스트/이미지 추출 진행 중"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  padding: "1px 5px",
                  fontSize: 9, fontWeight: 600,
                  borderRadius: 999,
                  background: "color-mix(in srgb, var(--color-brand-primary) 14%, transparent)",
                  color: "var(--color-brand-primary)",
                  letterSpacing: 0,
                }}
              >
                <Loader2 size={9} className="animate-spin" /> 처리 중
              </span>
            )}
            {isMergeSuspect && (
              <span
                title="인접 문항이 합쳐진 것으로 의심됩니다. 매뉴얼 크롭 또는 Ctrl+V로 정확히 잘라주세요."
                style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  padding: "1px 5px",
                  fontSize: 9, fontWeight: 600,
                  borderRadius: 999,
                  background: "color-mix(in srgb, var(--color-status-warning) 14%, transparent)",
                  color: "var(--color-status-warning)",
                  letterSpacing: 0,
                }}
              >
                <AlertTriangle size={9} /> 검수
              </span>
            )}
          </span>
          {imgUrl && (
            <button
              onClick={(e) => { e.stopPropagation(); setZoomOpen(true); }}
              title="원본 크게 보기"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--color-text-muted)", padding: 2,
                display: "flex", alignItems: "center",
              }}
            >
              <Maximize2 size={12} />
            </button>
          )}
        </div>

        {imgUrl ? (
          <div style={{
            width: "100%",
            minHeight: 120,
            aspectRatio: "4 / 3",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            background: "white",
            border: "1px solid var(--color-border-divider)",
            padding: 4,
          }}>
            <img
              src={imgUrl}
              alt={`Q${problem.number}`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "top center",
                display: "block",
              }}
            />
          </div>
        ) : (
          <div style={{
            width: "100%",
            minHeight: 120,
            aspectRatio: "4 / 3",
            borderRadius: "var(--radius-md)",
            background: "var(--color-bg-surface-soft)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, color: "var(--color-text-muted)",
          }}>
            이미지 없음
          </div>
        )}

        {problem.text && (
          <p style={{
            fontSize: 11, color: "var(--color-text-secondary)",
            margin: 0, lineHeight: 1.4,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}>
            {problem.text}
          </p>
        )}
      </div>

      {zoomOpen && imgUrl && (
        <div
          onClick={() => setZoomOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 1100,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
            padding: "var(--space-6)",
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setZoomOpen(false); }}
            style={{
              position: "absolute", top: 16, right: 16,
              background: "rgba(255,255,255,0.9)", border: "none",
              borderRadius: "50%", width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
            title="닫기"
          >
            <X size={18} />
          </button>
          <img
            src={imgUrl}
            alt={`Q${problem.number} 원본`}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "100%", maxHeight: "100%",
              objectFit: "contain",
              background: "white", borderRadius: 8,
              boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
            }}
          />
        </div>
      )}
    </>
  );
}
