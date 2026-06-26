// PATH: src/app_admin/domains/storage/components/matchup/ProblemGrid.tsx
// 문제 카드 그리드 — 선택된 문서의 추출 문제 표시

import { useMemo } from "react";
import { Loader2, AlertTriangle, Check, Clock, Layers, X, Crop, FileSearch, Trash2, Shield } from "lucide-react";
import { ICON, Button } from "@/shared/ui/ds";
import type { MatchupProblem } from "../../api/matchup.api";
import ProblemCard from "./ProblemCard";
import styles from "./ProblemGrid.module.css";

type Props = {
  problems: MatchupProblem[];
  loading: boolean;
  selectedProblemId: number | null;
  onSelectProblem: (id: number) => void;
  documentStatus?: string;
  /** P2-ε — paper_type 별 over-extraction 임계값 차등. side_notes 는 30, 그 외 60. */
  paperType?: string;
  // 파일 크기 기반 동적 처리시간 안내
  fileSizeBytes?: number;
  progressPercent?: number;
  progressStepName?: string;
  // 합치기 모드 — 카드 다중 선택 + 합치기 CTA
  mergeMode?: boolean;
  mergeSelectedIds?: number[];
  onToggleMergeMode?: () => void;
  onToggleMergeSelect?: (id: number) => void;
  onClearMergeSelection?: () => void;
  onConfirmMerge?: () => void;
  // Phase F (2026-05-10) — 다중 선택 일괄삭제 모드. mergeMode 와 mutually exclusive.
  // 카드 클릭 = 토글 (ordering 무관, set 멤버십). hover trash 는 양쪽 모두 false 일 때만.
  deleteMode?: boolean;
  deleteSelectedIds?: number[];
  onToggleDeleteMode?: () => void;
  onToggleDeleteSelect?: (id: number) => void;
  onClearDeleteSelection?: () => void;
  onConfirmBulkDelete?: () => void;
  // 빈 상태 / 실패 상태에서 사용자가 다음 행동(직접 자르기)을 즉시 시작할 수 있도록.
  onOpenManualCrop?: () => void;
  onRetry?: () => void;
  // Phase F — 카드별 즉시 액션 (hover). bulk/merge 모드에선 자동 hide.
  onDeleteProblem?: (problem: MatchupProblem) => void;
  onSplitProblem?: (problem: MatchupProblem) => void;
  onApprovePublicImage?: (problem: MatchupProblem) => void;
  onUploadPublicImage?: (problem: MatchupProblem, file: File) => void;
};

// 파이프라인 단계 — matchup_pipeline.py와 동기화. 사용자가 어디까지 됐는지 인식.
const PIPELINE_STAGES: Array<{ label: string; threshold: number }> = [
  { label: "문제 분할", threshold: 30 },
  { label: "텍스트 추출", threshold: 50 },
  { label: "AI 분석", threshold: 80 },
  { label: "이미지 업로드", threshold: 90 },
  { label: "마무리", threshold: 100 },
];

const EMPTY_SELECTED_IDS: number[] = [];

/** 파일 크기 기반 예상 처리시간 문구 (휴리스틱, 보수적). */
function estimateProcessingHint(sizeBytes?: number): string {
  if (!sizeBytes) return "보통 10~30초 정도 소요됩니다";
  const mb = sizeBytes / (1024 * 1024);
  if (mb < 3) return "보통 10~30초 정도 소요됩니다";
  if (mb < 10) return "보통 20초~1분 정도 소요됩니다";
  if (mb < 25) return "스캔본이라 1~2분 걸릴 수 있습니다";
  return "큰 파일이라 2~3분까지 걸릴 수 있습니다";
}

function stageState(pct: number, threshold: number, index: number): "complete" | "current" | "pending" {
  const prevThreshold = index === 0 ? 0 : PIPELINE_STAGES[index - 1].threshold;
  if (pct >= threshold) return "complete";
  if (pct >= prevThreshold) return "current";
  return "pending";
}

export default function ProblemGrid({
  problems, loading, selectedProblemId, onSelectProblem, documentStatus,
  paperType,
  fileSizeBytes, progressPercent, progressStepName,
  mergeMode = false, mergeSelectedIds = EMPTY_SELECTED_IDS,
  onToggleMergeMode, onToggleMergeSelect, onClearMergeSelection, onConfirmMerge,
  deleteMode = false, deleteSelectedIds = EMPTY_SELECTED_IDS,
  onToggleDeleteMode, onToggleDeleteSelect, onClearDeleteSelection, onConfirmBulkDelete,
  onOpenManualCrop, onRetry,
  onDeleteProblem, onSplitProblem,
  onApprovePublicImage, onUploadPublicImage,
}: Props) {
  const mergeSelectedCount = mergeSelectedIds.length;
  const mergeOrderById = useMemo(
    () => new Map(mergeSelectedIds.map((id, idx) => [id, idx + 1])),
    [mergeSelectedIds],
  );
  // Phase F — 다중 선택 삭제 모드 (mergeMode 와 mutually exclusive).
  const deleteSelectedSet = useMemo(() => new Set(deleteSelectedIds), [deleteSelectedIds]);
  const deleteSelectedCount = deleteSelectedIds.length;
  const problemById = useMemo(() => new Map(problems.map((p) => [p.id, p])), [problems]);
  // 삭제 대상 중 manual 보호 카드 개수 — toolbar 에 명시 (학원장이 보호 동작 인지).
  const deleteProtectedCount = useMemo(() => deleteSelectedIds.reduce((acc, id) => {
    const p = problemById.get(id);
    if (!p) return acc;
    const meta = p.meta as Record<string, unknown> | null;
    return acc + (meta?.manual || meta?.manual_owner_pinned ? 1 : 0);
  }, 0), [deleteSelectedIds, problemById]);
  const deleteDeletableCount = Math.max(0, deleteSelectedCount - deleteProtectedCount);
  // mode entry CTA 바 — 합치기/일괄삭제 진입 가능. 두 모드 진입 핸들러 둘 다 없으면 hidden.
  const canEnterAnyMode = (!!onToggleMergeMode || !!onToggleDeleteMode) && problems.length >= 2;
  const showModeEntryBar = canEnterAnyMode && !mergeMode && !deleteMode;
  const isProcessing = loading || documentStatus === "processing" || documentStatus === "pending";
  const hasProgress = typeof progressPercent === "number" && progressPercent > 0;
  const pct = hasProgress ? Math.min(100, Math.max(0, Math.round(progressPercent ?? 0))) : 0;

  // 부분 결과 노출 — 재처리 또는 부분 저장된 케이스에서 이미 노출 가능한 문항 먼저 보여줌.
  // (현재 백엔드는 파이프라인 끝에 일괄 INSERT라 신규 업로드에서는 빈 배열이지만,
  //  reanalyze 중인 doc은 이전 problems가 그대로 남아 있어 사용자에게 즉시 컨텐츠 노출됨.)
  const showPartialResults = isProcessing && problems.length > 0;
  const mergeSuspectCount = useMemo(() => problems.filter(
    (p) => Boolean((p.meta as { merge_suspect?: boolean } | undefined)?.merge_suspect),
  ).length, [problems]);
  const overThreshold = paperType === "side_notes" ? 30 : 60;
  const showReviewGuide = problems.length >= overThreshold || mergeSuspectCount > 0;
  const hasStickyActionBar = mergeMode || deleteMode;

  if (isProcessing && !showPartialResults) {
    return (
      <div className={styles.processingState}>
        <Loader2 size={ICON.xl} className={`animate-spin ${styles.primaryIcon}`} />
        <p className={styles.processingTitle}>
          {hasProgress
            ? `${progressStepName || "처리 중"} · ${pct}%`
            : "AI가 문제를 분석하고 있습니다..."}
        </p>
        {hasProgress ? (
          <progress className={styles.progressBar} value={pct} max={100} aria-label="문제 분석 진행률" />
        ) : (
          <div className={styles.progressTrack} aria-hidden="true">
            <div className={styles.progressIndeterminateFill} />
          </div>
        )}
        {/* 단계별 체크리스트 — 어느 단계 진행 중인지 명시 */}
        {hasProgress && (
          <div className={styles.stageList}>
            {PIPELINE_STAGES.map((stage, idx) => {
              const state = stageState(pct, stage.threshold, idx);
              return (
                <div key={stage.label} className={styles.stageItem} data-state={state}>
                  {state === "complete" ? <Check size={ICON.xs} /> : <Clock size={ICON.xs} />}
                  <span>{stage.label}</span>
                  {state === "current" && <span className={styles.stageCurrentText}>· 진행 중</span>}
                </div>
              );
            })}
          </div>
        )}
        <p className={styles.processingHint}>
          {hasProgress ? "완료되면 자동으로 문제 그리드로 바뀝니다" : estimateProcessingHint(fileSizeBytes)}
        </p>
      </div>
    );
  }

  if (problems.length === 0) {
    const isFailed = documentStatus === "failed";
    // 빈 상태에서도 학원장이 다음 행동을 즉시 할 수 있어야 한다.
    // 자동분리 0건 = 결과 없음으로 끝나면 안 되고, "직접 자르기"로 시작 가능 안내.
    return (
      <div className={styles.emptyState}>
        <FileSearch size={28} className={styles.emptyIcon} />
        <p className={styles.emptyTitle}>
          {isFailed ? "문제 추출에 실패했습니다" : "자동으로 인식된 문제가 없습니다"}
        </p>
        <p className={styles.emptyDescription}>
          {isFailed
            ? "재시도하거나, 원본 위에 직접 박스를 그려 문항을 추가할 수 있습니다."
            : "원본 PDF 위에 박스를 그리면 문항을 직접 추가할 수 있어요. 스캔 품질이 낮을 때 가장 정확합니다."}
        </p>
        <div className={styles.emptyActions}>
          {isFailed && onRetry && (
            <Button intent="ghost" size="sm" onClick={onRetry}>
              재시도
            </Button>
          )}
          {onOpenManualCrop && (
            <Button
              intent="primary"
              size="sm"
              onClick={onOpenManualCrop}
              data-testid="matchup-grid-empty-crop-cta"
              leftIcon={<Crop size={ICON.sm} />}
            >
              직접 자르기로 시작
            </Button>
          )}
        </div>
      </div>
    );
  }

  // 문제 over-extraction 의심 / merge_suspect 1개라도 있으면 가이드 노출.
  // P2-ε (2026-05-08) — 임계값 paper_type 별 차등.
  //   side_notes (학습자료 본문, anchor 기반) = 30+ 시 즉시 가이드 (30~60 범위 워크북도
  //     본문 항목번호 over-extraction risk 큼)
  //   그 외 (시험지 등) = 60+ (정상 시험지 60문항 흔함)
  return (
    <div className={`${styles.root} ${hasStickyActionBar ? styles.rootWithActionBar : ""}`}>
      {/* Mode entry bar — 두 모드 모두 미진입일 때만. 합치기 + 일괄삭제 진입 CTA 동시 노출. */}
      {showModeEntryBar && (
        <div className={styles.modeEntryBar}>
          <Layers size={ICON.sm} className={styles.mutedIcon} />
          <span className={styles.modeBarText}>
            <strong>여러 문항을 한 번에 정리</strong> — 쪼개진 문항을 합치거나, 잘못 잡힌 문항을 골라서 일괄 삭제할 수 있습니다.
          </span>
          <div className={styles.modeBarActions}>
            {onToggleMergeMode && (
              <button
                type="button"
                onClick={onToggleMergeMode}
                data-testid="matchup-merge-mode-enter"
                className={styles.primarySmallButton}
              >
                <Layers size={ICON.xs} /> 쪼개진 문항 합치기
              </button>
            )}
            {onToggleDeleteMode && (
              <button
                type="button"
                onClick={onToggleDeleteMode}
                data-testid="matchup-bulk-select-mode-enter"
                className={styles.secondarySmallButton}
              >
                <Trash2 size={ICON.xs} /> 여러 문항 삭제
              </button>
            )}
          </div>
        </div>
      )}

      {/* Merge mode bar — 진입 시 안내 + 모드 종료 */}
      {mergeMode && (
        <div className={`${styles.modeBar} ${styles.mergeModeBar}`}>
          <Layers size={ICON.sm} className={styles.primaryModeIcon} />
          <strong className={styles.primaryText}>합치기 모드</strong>
          <span className={styles.modeBarText}>— 합칠 문항을 위→아래 순서대로 클릭하세요</span>
          <button
            type="button"
            onClick={onToggleMergeMode}
            data-testid="matchup-merge-mode-exit"
            className={styles.modeExitButton}
          >
            <X size={ICON.xs} /> 모드 종료
          </button>
        </div>
      )}

      {/* Delete mode bar — 진입 시 안내 + 모드 종료. */}
      {deleteMode && (
        <div className={`${styles.modeBar} ${styles.deleteModeBar}`}>
          <Trash2 size={ICON.sm} className={styles.warningModeIcon} />
          <strong className={styles.warningText}>일괄 삭제 모드</strong>
          <span className={styles.modeBarText}>— 삭제할 문항을 클릭해서 선택하세요. 직접 자르거나 보고서에서 선별한 문항은 자동 보호됩니다.</span>
          <button
            type="button"
            onClick={onToggleDeleteMode}
            data-testid="matchup-bulk-select-mode-exit"
            className={styles.modeExitButton}
          >
            <X size={ICON.xs} /> 모드 종료
          </button>
        </div>
      )}

      {showPartialResults && (() => {
        // skeleton(is_partial=true) 비율로 신규 업로드 vs 재분석 구분.
        // 50% 이상 partial이면 신규 업로드(전체 skeleton 시작), 그 미만이면 재분석.
        const partialCount = problems.filter(
          (p) => Boolean((p.meta as { is_partial?: boolean } | undefined)?.is_partial),
        ).length;
        const isFreshUpload = partialCount >= problems.length / 2;
        const guidance = isFreshUpload
          ? `${problems.length}개 문항 중 ${problems.length - partialCount}개 완료 · 나머지는 진행 중`
          : "이전 결과를 표시 중. 완료되면 자동으로 갱신됩니다.";
        return (
          <div className={styles.partialNotice}>
            <Loader2 size={ICON.sm} className={`animate-spin ${styles.primarySmallIcon}`} />
            <div>
              <strong>{progressStepName || (isFreshUpload ? "분석 중" : "재분석 중")}</strong>
              {hasProgress && <span> · {pct}%</span>}
              <span className={styles.inlineMuted}>· {guidance}</span>
            </div>
          </div>
        );
      })()}
      {showReviewGuide && (
        <div className={styles.reviewGuide}>
          <AlertTriangle size={ICON.sm} className={styles.reviewGuideIcon} />
          <div className={styles.reviewGuideText}>
            {problems.length >= overThreshold && (
              <>
                <strong>학습자료 자동분리 한계:</strong> 본문 항목번호를 문항으로 잘못 잡았을 수 있습니다 ({problems.length}개 검출). 정확한 매칭이 필요한 문항은
                {" "}<strong>매뉴얼 크롭(드래그) 또는 Ctrl+V로 직접 붙여넣기</strong>를 권장합니다.
              </>
            )}
            {problems.length < overThreshold && mergeSuspectCount > 0 && (
              <>
                <strong>{mergeSuspectCount}개 문항</strong>이 인접 문항과 합쳐졌을 가능성이 있습니다 (검수 배지 표시).
                {" "}<strong>매뉴얼 크롭 또는 Ctrl+V</strong>로 정확히 잘라주세요.
              </>
            )}
          </div>
        </div>
      )}
      <div className={styles.grid}>
        {problems.map((p) => {
          const isInDeleteSelection = deleteMode && deleteSelectedSet.has(p.id);
          // bulk-select mode 일 때 카드의 selected 시각은 selection 멤버십.
          const cardSelected = deleteMode
            ? isInDeleteSelection
            : selectedProblemId === p.id;
          return (
            <ProblemCard
              key={p.id}
              problem={p}
              selected={cardSelected}
              onClick={() => {
                if (mergeMode && onToggleMergeSelect) onToggleMergeSelect(p.id);
                else if (deleteMode && onToggleDeleteSelect) onToggleDeleteSelect(p.id);
                else onSelectProblem(p.id);
              }}
              mergeMode={mergeMode}
              mergeOrder={mergeOrderById.get(p.id) ?? 0}
              bulkSelectMode={deleteMode}
            onDelete={onDeleteProblem ? () => onDeleteProblem(p) : undefined}
            onSplit={onSplitProblem ? () => onSplitProblem(p) : undefined}
            onApprovePublicImage={onApprovePublicImage}
            onUploadPublicImage={onUploadPublicImage}
          />
          );
        })}
      </div>

      {/* Bulk delete action bar — 일괄삭제 모드 + 1개 이상 선택. */}
      {deleteMode && deleteSelectedCount > 0 && (
        <div data-testid="matchup-bulk-delete-action-bar" className={`${styles.actionBar} ${styles.deleteActionBar}`}>
          <Trash2 size={ICON.sm} className={styles.warningModeIcon} />
          <strong className={styles.actionWarningCount}>
            {deleteSelectedCount}개 선택됨
          </strong>
          {deleteProtectedCount > 0 && (
            <span data-testid="matchup-bulk-delete-protected-hint" className={styles.protectedHint}>
              <Shield size={ICON.xs} />
              보호 문항 {deleteProtectedCount}개 제외
            </span>
          )}
          <span className={styles.actionHint}>
            삭제는 되돌릴 수 없습니다. 보고서에서 선별된 문항은 삭제 대상에서 제외됩니다.
          </span>
          <div className={styles.actionButtons}>
            <button type="button" onClick={onClearDeleteSelection} className={styles.secondaryActionButton}>
              선택 해제
            </button>
            <button
              type="button"
              onClick={onConfirmBulkDelete}
              disabled={deleteDeletableCount <= 0}
              data-testid="matchup-bulk-delete-confirm-action"
              className={styles.dangerActionButton}
            >
              <Trash2 size={ICON.xs} />
              {deleteDeletableCount}개 삭제
            </button>
          </div>
        </div>
      )}

      {mergeMode && mergeSelectedCount > 0 && (
        <div data-testid="matchup-merge-action-bar" className={`${styles.actionBar} ${styles.mergeActionBar}`}>
          <Layers size={ICON.sm} className={styles.primaryModeIcon} />
          <strong className={styles.actionPrimaryCount}>
            {mergeSelectedCount}개 선택됨
          </strong>
          <span className={styles.actionHint}>
            {mergeSelectedCount < 2 ? "1개 더 선택하면 합칠 수 있습니다" : "위→아래 순서대로 합쳐집니다"}
          </span>
          <div className={styles.actionButtons}>
            <button type="button" onClick={onClearMergeSelection} className={styles.secondaryActionButton}>
              선택 해제
            </button>
            <button
              type="button"
              onClick={onConfirmMerge}
              disabled={mergeSelectedCount < 2}
              data-testid="matchup-merge-open-modal"
              className={styles.mergeConfirmButton}
            >
              <Layers size={ICON.xs} />
              {mergeSelectedCount}개를 1개로 합치기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
