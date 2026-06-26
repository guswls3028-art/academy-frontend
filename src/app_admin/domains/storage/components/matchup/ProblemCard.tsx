// PATH: src/app_admin/domains/storage/components/matchup/ProblemCard.tsx
//
// image_url은 list API에서 바로 내려옴 (N+1 presign 제거).
// 썸네일을 정말로 보고 싶을 때는 확대 버튼으로 큰 이미지 모달.

import { useEffect, useState } from "react";
import { Maximize2, X, AlertTriangle, Loader2, Trash2, Scissors, Lock, ShieldCheck } from "lucide-react";
import { ICON, Badge, ICON_FOR_BADGE } from "@/shared/ui/ds";
import type { MatchupProblem } from "../../api/matchup.api";
import { getMatchupProblemPresignUrl } from "../../api/matchup.api";
import { normalizeOcrTextPreview } from "../../utils/normalizeOcrText";

type Props = {
  problem: MatchupProblem;
  selected: boolean;
  onClick: () => void;
  // 합치기 모드 — mergeOrder>0이면 선택된 순번 표시. selected는 무시.
  mergeMode?: boolean;
  mergeOrder?: number;
  // 다중 선택(삭제) 모드 — 클릭=토글. selected=isInSelection 으로 사용.
  // mergeMode 와 mutually exclusive (호출부 보장).
  bulkSelectMode?: boolean;
  // 카드별 액션 (hover 노출). bulkSelectMode/mergeMode/isPartial 일 때는 자동 hide.
  // F1 (Phase F) — 카드별 1클릭 삭제.
  // F4 (Phase F) — 분할 진입점 (해당 페이지로 ManualCropModal 점프).
  onDelete?: () => void;
  onSplit?: () => void;
};

export default function ProblemCard({
  problem,
  selected,
  onClick,
  mergeMode = false,
  mergeOrder = 0,
  bulkSelectMode = false,
  onDelete,
  onSplit,
}: Props) {
  const isMergeSelected = mergeMode && mergeOrder > 0;
  // bulkSelectMode 진입 시 selected 가 곧 selection 표시.
  const showSelectedStyle = mergeMode ? isMergeSelected : selected;
  // manual=true / manual_owner_pinned=true 는 학원장 수동 작업 또는 보고서 선별 문항.
  // backend 가 protected_ids 로 일괄삭제/reanalyze 에서 자동 보호한다.
  const meta = problem.meta as Record<string, unknown> | null;
  const isManual = Boolean(meta?.manual);
  const isManualPinned = Boolean(meta?.manual_owner_pinned);
  const isProtected = isManual || isManualPinned;
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
  const publicCleanup = problem.meta?.public_cleanup;
  const hasPublicImage = Boolean(problem.public_image_url || problem.public_image_key);
  const imgUrl = problem.public_image_url || problem.image_url || fallbackUrl;

  useEffect(() => {
    if (problem.public_image_url || problem.image_url || !problem.image_key) return;
    let cancelled = false;
    getMatchupProblemPresignUrl(problem.id)
      .then((u) => { if (!cancelled) setFallbackUrl(u); })
      .catch(() => { if (!cancelled) setFallbackUrl(null); });
    return () => { cancelled = true; };
  }, [problem.id, problem.image_key, problem.image_url, problem.public_image_url]);

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
  // Phase F — hover 시에만 카드 액션(삭제/분할) 노출. bulk-select / merge / partial
  // 상태에서는 액션 숨김 (선택 토글이 우선).
  const [hoverActionsOpen, setHoverActionsOpen] = useState(false);
  const showHoverActions =
    !mergeMode && !bulkSelectMode && !isPartial && (onDelete || onSplit);

  return (
    <>
      <div
        data-testid="matchup-problem-card"
        data-problem-id={problem.id}
        data-has-issue={hasIssue ? "true" : "false"}
        data-protected={isProtected ? "true" : "false"}
        onClick={onClick}
        onMouseEnter={() => setHoverActionsOpen(true)}
        onMouseLeave={() => setHoverActionsOpen(false)}
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
          <span style={/* eslint-disable-line no-restricted-syntax */ {
            display: "inline-flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 6,
            minWidth: 0,
          }}>
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
                번호 불일치
              </Badge>
            )}
            {hasPublicImage && (
              <Badge
                tone="success"
                size="xs"
                title={
                  typeof publicCleanup?.red_mask_ratio === "number"
                    ? `공개용 이미지 정리 완료 · 빨간 흔적 ${Math.round(publicCleanup.red_mask_ratio * 1000) / 10}%`
                    : "공개용 이미지 정리 완료"
                }
                ariaLabel="공개용 이미지 정리 완료"
              >
                <ShieldCheck size={ICON_FOR_BADGE.xs} />
                공개용
              </Badge>
            )}
          </span>
          <span style={/* eslint-disable-line no-restricted-syntax */ { display: "inline-flex", alignItems: "center", gap: 2 }}>
            {/* Phase F — 보호 표시 (잠금 아이콘). 일괄삭제/reanalyze 에서 자동 보호되는
                문항임을 항상 시각화. hover 액션 영역과 별개로 항상 노출. */}
            {isProtected && (
              <span
                title="직접 자르거나 보고서에서 선별한 문항입니다. 일괄삭제와 자동 재분석에서 보호됩니다."
                aria-label="보호된 문항"
                data-testid="matchup-problem-card-protected"
                style={/* eslint-disable-line no-restricted-syntax */ {
                  display: "inline-flex", alignItems: "center",
                  color: "var(--color-status-success)", padding: 2,
                }}
              >
                <Lock size={ICON.xs} />
              </span>
            )}
            {/* Phase F — hover 시 분할(F4) 진입점. ManualCropModal 을 해당 페이지로 점프. */}
            {showHoverActions && onSplit && hoverActionsOpen && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSplit(); }}
                title="이 문항이 둘 이상으로 잘려야 한다면 — 페이지에서 직접 다시 자르기"
                aria-label="다시 자르기 / 분할"
                data-testid="matchup-problem-card-split"
                style={/* eslint-disable-line no-restricted-syntax */ {
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--color-text-muted)", padding: 2,
                  display: "flex", alignItems: "center",
                }}
              >
                <Scissors size={ICON.xs} />
              </button>
            )}
            {/* Phase F — hover 시 카드별 1클릭 삭제(F1). manual 인 경우 호출부 confirm 에서
                보호 메시지 명시. 일반 문항도 confirm 필수. */}
            {showHoverActions && onDelete && hoverActionsOpen && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                title="이 문항 삭제 (다른 보고서 큐레이션에 영향 가능)"
                aria-label="문항 삭제"
                data-testid="matchup-problem-card-delete"
                style={/* eslint-disable-line no-restricted-syntax */ {
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--color-text-muted)", padding: 2,
                  display: "flex", alignItems: "center",
                }}
              >
                <Trash2 size={ICON.xs} />
              </button>
            )}
            {imgUrl && (
              <button
                onClick={(e) => { e.stopPropagation(); setZoomOpen(true); }}
                title={hasPublicImage ? "공개용 이미지 크게 보기" : "원본 크게 보기"}
                style={/* eslint-disable-line no-restricted-syntax */ {
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--color-text-muted)", padding: 2,
                  display: "flex", alignItems: "center",
                }}
              >
                <Maximize2 size={ICON.xs} />
              </button>
            )}
          </span>
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
              alt={hasPublicImage ? `Q${problem.number} 공개용` : `Q${problem.number}`}
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
          <p
            title={normalizeOcrTextPreview(problem.text)}
            style={/* eslint-disable-line no-restricted-syntax */ {
              fontSize: 10.5, color: "var(--color-text-muted)",
              margin: 0, lineHeight: 1.4,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              wordBreak: "keep-all",
              opacity: 0.75,
            }}
          >
            {normalizeOcrTextPreview(problem.text)}
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
            alt={hasPublicImage ? `Q${problem.number} 공개용` : `Q${problem.number} 원본`}
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
