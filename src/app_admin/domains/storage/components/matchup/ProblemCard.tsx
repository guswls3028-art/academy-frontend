// PATH: src/app_admin/domains/storage/components/matchup/ProblemCard.tsx
//
// image_url은 list API에서 바로 내려옴 (N+1 presign 제거).
// 썸네일을 정말로 보고 싶을 때는 확대 버튼으로 큰 이미지 모달.

import { useEffect, useState } from "react";
import { Maximize2, X, AlertTriangle, Loader2 } from "lucide-react";
import { ICON, Badge, ICON_FOR_BADGE } from "@/shared/ui/ds";
import type { MatchupProblem } from "../../api/matchup.api";
import { getMatchupProblemPresignUrl } from "../../api/matchup.api";

type Props = {
  problem: MatchupProblem;
  selected: boolean;
  onClick: () => void;
  // 합치기 모드 — mergeOrder>0이면 선택된 순번 표시. selected는 무시.
  mergeMode?: boolean;
  mergeOrder?: number;
};

export default function ProblemCard({ problem, selected, onClick, mergeMode = false, mergeOrder = 0 }: Props) {
  const isMergeSelected = mergeMode && mergeOrder > 0;
  const showSelectedStyle = mergeMode ? isMergeSelected : selected;
  // 자동분리가 인접 문항을 박스 단위로 합친 의심 — 매뉴얼 크롭+Ctrl+V paste 권장.
  const isMergeSuspect = Boolean(problem.meta?.merge_suspect);
  // 파이프라인 진행 중 skeleton row — 분리만 끝났고 OCR/임베딩/이미지 미완.
  // 신규 업로드 사용자에게 즉시 카운트 노출용. 완료되면 false로 갱신됨.
  const isPartial = Boolean(problem.meta?.is_partial);
  // 본문 OCR 첫 줄에서 인식한 번호가 DB number와 다른 경우 — 신뢰성 검수 신호.
  // (예: DB Q3인데 OCR가 본문에서 "5." 발견 → 인접 문항 컨텐츠로 잘못 잘렸을 가능성)
  const numberMismatch = problem.meta?.number_mismatch;
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

  // 자동분리 결함 의심 카드는 외곽 강조 + warning stripe로 시각 우선순위.
  // 기존 작은 뱃지(9px)는 그리드에서 묻혔던 사고 보완.
  const hasIssue = numberMismatch || isMergeSuspect;

  return (
    <>
      <div
        data-testid="matchup-problem-card"
        data-problem-id={problem.id}
        data-has-issue={hasIssue ? "true" : "false"}
        onClick={onClick}
        onDoubleClick={(e) => {
          // 합치기 모드에선 더블클릭으로 zoom을 열지 않음 — 첫/두 번째 클릭이 선택 토글로 동작.
          // (확대는 우상단 확대 버튼으로만 가능하게 해서 토글 동작과 분리)
          if (mergeMode) return;
          if (imgUrl) {
            e.stopPropagation();
            setZoomOpen(true);
          }
        }}
        title={mergeMode
          ? (isMergeSelected ? "다시 클릭하면 선택 해제" : "클릭해서 합치기 대상에 추가")
          : (imgUrl ? "더블클릭 = 크게 보기" : undefined)}
        style={/* eslint-disable-line no-restricted-syntax */ {
          border: showSelectedStyle
            ? "2px solid var(--color-brand-primary)"
            : hasIssue
              ? "2px solid color-mix(in srgb, var(--color-warning) 55%, transparent)"
              : "1px solid var(--color-border-divider)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-3)",
          cursor: "pointer",
          background: showSelectedStyle
            ? "color-mix(in srgb, var(--color-brand-primary) 4%, var(--color-bg-surface))"
            : hasIssue
              ? "color-mix(in srgb, var(--color-warning) 4%, var(--color-bg-surface))"
              : "var(--color-bg-surface)",
          transition: "border-color 0.15s, box-shadow 0.15s",
          boxShadow: showSelectedStyle
            ? "0 0 0 3px color-mix(in srgb, var(--color-brand-primary) 12%, transparent)"
            : hasIssue
              ? "0 0 0 2px color-mix(in srgb, var(--color-warning) 18%, transparent)"
              : undefined,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
          minHeight: 180,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {hasIssue && (
          <div
            aria-hidden
            title={
              numberMismatch && isMergeSuspect
                ? "번호 불일치 + 인접 문항 합쳐짐 의심 — 두 종류의 결함이 함께 감지됐습니다."
                : numberMismatch
                  ? "DB 번호와 본문 OCR 번호가 다릅니다"
                  : "인접 문항이 합쳐졌을 가능성"
            }
            style={/* eslint-disable-line no-restricted-syntax */ {
              position: "absolute", top: 0, left: 0, right: 0, height: 4,
              // 두 결함 동시 = 빨강+주황 분할로 시각 구분
              background: numberMismatch && isMergeSuspect
                ? "linear-gradient(to right, var(--color-danger) 0%, var(--color-danger) 50%, var(--color-warning) 50%, var(--color-warning) 100%)"
                : numberMismatch
                  ? "var(--color-danger)"
                  : "var(--color-warning)",
            }}
          />
        )}
        {mergeMode && (
          <div style={/* eslint-disable-line no-restricted-syntax */ {
            position: "absolute", top: 6, left: 6, zIndex: 2,
            width: 22, height: 22, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 800,
            background: isMergeSelected ? "var(--color-brand-primary)" : "var(--color-bg-surface)",
            color: isMergeSelected ? "white" : "var(--color-text-muted)",
            border: isMergeSelected
              ? "2px solid var(--color-brand-primary)"
              : "2px dashed var(--color-border-divider)",
            boxShadow: isMergeSelected ? "0 1px 4px rgba(0,0,0,0.15)" : undefined,
          }}>
            {isMergeSelected ? mergeOrder : ""}
          </div>
        )}
        {/* 번호 + 확대 버튼 */}
        <div style={/* eslint-disable-line no-restricted-syntax */ {
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: 11, fontWeight: 700,
          color: showSelectedStyle ? "var(--color-brand-primary)" : "var(--color-text-muted)",
          letterSpacing: "0.05em",
        }}>
          <span style={/* eslint-disable-line no-restricted-syntax */ { display: "inline-flex", alignItems: "center", gap: 6 }}>
            Q{problem.number}
            {isPartial && (
              <span
                title="텍스트/이미지 추출 진행 중"
                style={/* eslint-disable-line no-restricted-syntax */ {
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
                style={/* eslint-disable-line no-restricted-syntax */ {
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
            {numberMismatch && (
              <Badge
                tone="danger"
                size="xs"
                title={`DB 번호(Q${numberMismatch.db})와 본문 OCR 번호(Q${numberMismatch.ocr})가 다릅니다. 인접 문항 컨텐츠가 잘못 잘렸을 수 있습니다 — 매뉴얼 크롭 또는 Ctrl+V로 정확히 잘라주세요.`}
                ariaLabel={`번호 불일치 DB Q${numberMismatch.db} OCR Q${numberMismatch.ocr}`}
              >
                <AlertTriangle size={ICON_FOR_BADGE.xs} />
                번호 불일치 (DB Q{numberMismatch.db} vs OCR Q{numberMismatch.ocr})
              </Badge>
            )}
          </span>
          {imgUrl && (
            <button
              onClick={(e) => { e.stopPropagation(); setZoomOpen(true); }}
              title="원본 크게 보기"
              style={/* eslint-disable-line no-restricted-syntax */ {
                background: "none", border: "none", cursor: "pointer",
                color: "var(--color-text-muted)", padding: 2,
                display: "flex", alignItems: "center",
              }}
            >
              <Maximize2 size={ICON.xs} />
            </button>
          )}
        </div>

        {imgUrl ? (
          <div style={/* eslint-disable-line no-restricted-syntax */ {
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
              style={/* eslint-disable-line no-restricted-syntax */ {
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "top center",
                display: "block",
              }}
            />
          </div>
        ) : (
          <div style={/* eslint-disable-line no-restricted-syntax */ {
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
          <p style={/* eslint-disable-line no-restricted-syntax */ {
            fontSize: 11, color: "var(--color-text-secondary)",
            margin: 0, lineHeight: 1.4,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            wordBreak: "keep-all",
          }}>
            {problem.text}
          </p>
        )}
      </div>

      {zoomOpen && imgUrl && (
        <div
          onClick={() => setZoomOpen(false)}
          style={/* eslint-disable-line no-restricted-syntax */ {
            position: "fixed", inset: 0, zIndex: 1100,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
            padding: "var(--space-6)",
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setZoomOpen(false); }}
            style={/* eslint-disable-line no-restricted-syntax */ {
              position: "absolute", top: 16, right: 16,
              background: "rgba(255,255,255,0.9)", border: "none",
              borderRadius: "50%", width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
            title="닫기"
          >
            <X size={ICON.md} />
          </button>
          <img
            src={imgUrl}
            alt={`Q${problem.number} 원본`}
            onClick={(e) => e.stopPropagation()}
            style={/* eslint-disable-line no-restricted-syntax */ {
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
