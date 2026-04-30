// PATH: src/app_admin/domains/storage/components/matchup/ProblemGrid.tsx
// 문제 카드 그리드 — 선택된 문서의 추출 문제 표시

import { Loader2, AlertTriangle, Check, Clock } from "lucide-react";
import type { MatchupProblem } from "../../api/matchup.api";
import ProblemCard from "./ProblemCard";

type Props = {
  problems: MatchupProblem[];
  loading: boolean;
  selectedProblemId: number | null;
  onSelectProblem: (id: number) => void;
  documentStatus?: string;
  // 파일 크기 기반 동적 처리시간 안내
  fileSizeBytes?: number;
  progressPercent?: number;
  progressStepName?: string;
};

// 파이프라인 단계 — matchup_pipeline.py와 동기화. 사용자가 어디까지 됐는지 인식.
const PIPELINE_STAGES: Array<{ label: string; threshold: number }> = [
  { label: "문제 분할", threshold: 30 },
  { label: "텍스트 추출", threshold: 50 },
  { label: "AI 분석", threshold: 80 },
  { label: "이미지 업로드", threshold: 90 },
  { label: "마무리", threshold: 100 },
];

/** 파일 크기 기반 예상 처리시간 문구 (휴리스틱, 보수적). */
function estimateProcessingHint(sizeBytes?: number): string {
  if (!sizeBytes) return "보통 10~30초 정도 소요됩니다";
  const mb = sizeBytes / (1024 * 1024);
  if (mb < 3) return "보통 10~30초 정도 소요됩니다";
  if (mb < 10) return "보통 20초~1분 정도 소요됩니다";
  if (mb < 25) return "스캔본이라 1~2분 걸릴 수 있습니다";
  return "큰 파일이라 2~3분까지 걸릴 수 있습니다";
}

export default function ProblemGrid({
  problems, loading, selectedProblemId, onSelectProblem, documentStatus,
  fileSizeBytes, progressPercent, progressStepName,
}: Props) {
  const isProcessing = loading || documentStatus === "processing" || documentStatus === "pending";
  const hasProgress = typeof progressPercent === "number" && progressPercent > 0;
  const pct = hasProgress ? Math.round(progressPercent!) : 0;

  // 부분 결과 노출 — 재처리 또는 부분 저장된 케이스에서 이미 노출 가능한 문항 먼저 보여줌.
  // (현재 백엔드는 파이프라인 끝에 일괄 INSERT라 신규 업로드에서는 빈 배열이지만,
  //  reanalyze 중인 doc은 이전 problems가 그대로 남아 있어 사용자에게 즉시 컨텐츠 노출됨.)
  const showPartialResults = isProcessing && problems.length > 0;

  if (isProcessing && !showPartialResults) {
    return (
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "var(--space-6)", gap: "var(--space-3)",
      }}>
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--color-brand-primary)" }} />
        <p style={{ fontSize: 14, color: "var(--color-text-primary)", margin: 0, fontWeight: 600 }}>
          {hasProgress
            ? `${progressStepName || "처리 중"} · ${pct}%`
            : "AI가 문제를 분석하고 있습니다..."}
        </p>
        <div style={{
          width: 240, height: 4, borderRadius: 2,
          background: "var(--color-bg-surface-soft)", overflow: "hidden",
        }}>
          <div style={{
            width: `${hasProgress ? pct : 5}%`,
            height: "100%", background: "var(--color-brand-primary)",
            transition: "width 0.4s",
            animation: hasProgress ? undefined : "matchup-progress-indeterminate 1.6s ease-in-out infinite",
          }} />
        </div>
        {/* 단계별 체크리스트 — 어느 단계 진행 중인지 명시 */}
        {hasProgress && (
          <div style={{
            display: "flex", flexDirection: "column", gap: 4,
            paddingTop: 4, fontSize: 11, color: "var(--color-text-muted)",
            minWidth: 240,
          }}>
            {PIPELINE_STAGES.map((stage, idx) => {
              const prevThreshold = idx === 0 ? 0 : PIPELINE_STAGES[idx - 1].threshold;
              const isComplete = pct >= stage.threshold;
              const isCurrent = !isComplete && pct >= prevThreshold;
              return (
                <div
                  key={stage.label}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    color: isComplete
                      ? "var(--color-status-success)"
                      : isCurrent
                        ? "var(--color-brand-primary)"
                        : "var(--color-text-muted)",
                    fontWeight: isCurrent ? 700 : 500,
                    opacity: isComplete || isCurrent ? 1 : 0.5,
                  }}
                >
                  {isComplete ? <Check size={12} /> : <Clock size={12} />}
                  <span>{stage.label}</span>
                  {isCurrent && <span style={{ opacity: 0.7 }}>· 진행 중</span>}
                </div>
              );
            })}
          </div>
        )}
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0, opacity: 0.7 }}>
          {hasProgress ? "완료되면 자동으로 문제 그리드로 바뀝니다" : estimateProcessingHint(fileSizeBytes)}
        </p>
        <style>{`
          @keyframes matchup-progress-indeterminate {
            0%   { width: 5%; margin-left: 0%; }
            50%  { width: 45%; margin-left: 55%; }
            100% { width: 5%; margin-left: 95%; }
          }
        `}</style>
      </div>
    );
  }

  if (problems.length === 0) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "var(--space-8)",
      }}>
        <p style={{ fontSize: 14, color: "var(--color-text-muted)", margin: 0 }}>
          {documentStatus === "failed"
            ? "문제 추출에 실패했습니다. 상단의 재시도 버튼을 눌러주세요."
            : "추출된 문제가 없습니다."}
        </p>
      </div>
    );
  }

  // 문제 60+ → 학습자료 over-extraction 의심 / merge_suspect 1개라도 있으면 가이드 노출.
  const mergeSuspectCount = problems.filter(
    (p) => Boolean((p.meta as { merge_suspect?: boolean } | undefined)?.merge_suspect),
  ).length;
  const showReviewGuide = problems.length >= 60 || mergeSuspectCount > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
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
          <div style={{
            display: "flex", gap: "var(--space-2)", alignItems: "center",
            padding: "var(--space-2) var(--space-3)",
            background: "color-mix(in srgb, var(--color-brand-primary) 8%, var(--color-bg-surface))",
            border: "1px solid color-mix(in srgb, var(--color-brand-primary) 30%, transparent)",
            borderRadius: "var(--radius-md)",
            fontSize: 12, color: "var(--color-text-secondary)",
          }}>
            <Loader2 size={14} className="animate-spin" style={{ color: "var(--color-brand-primary)", flexShrink: 0 }} />
            <div>
              <strong>{progressStepName || (isFreshUpload ? "분석 중" : "재분석 중")}</strong>
              {hasProgress && <span> · {pct}%</span>}
              <span style={{ marginLeft: 6, opacity: 0.7 }}>· {guidance}</span>
            </div>
          </div>
        );
      })()}
      {showReviewGuide && (
        <div style={{
          display: "flex", gap: "var(--space-2)", alignItems: "flex-start",
          padding: "var(--space-2) var(--space-3)",
          background: "color-mix(in srgb, var(--color-status-warning) 8%, var(--color-bg-surface))",
          border: "1px solid color-mix(in srgb, var(--color-status-warning) 30%, transparent)",
          borderRadius: "var(--radius-md)",
          fontSize: 12, color: "var(--color-text-secondary)",
        }}>
          <AlertTriangle size={14} style={{ color: "var(--color-status-warning)", flexShrink: 0, marginTop: 1 }} />
          <div>
            {problems.length >= 60 && (
              <>
                <strong>학습자료 자동분리 한계:</strong> 본문 항목번호(1.~60.)를 문항으로 잘못 잡았을 수 있습니다. 정확한 매칭이 필요한 문항은
                {" "}<strong>매뉴얼 크롭(드래그) 또는 Ctrl+V로 직접 붙여넣기</strong>를 권장합니다.
              </>
            )}
            {problems.length < 60 && mergeSuspectCount > 0 && (
              <>
                <strong>{mergeSuspectCount}개 문항</strong>이 인접 문항과 합쳐졌을 가능성이 있습니다 (검수 배지 표시).
                {" "}<strong>매뉴얼 크롭 또는 Ctrl+V</strong>로 정확히 잘라주세요.
              </>
            )}
          </div>
        </div>
      )}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: "var(--space-3)",
      }}>
        {problems.map((p) => (
          <ProblemCard
            key={p.id}
            problem={p}
            selected={selectedProblemId === p.id}
            onClick={() => onSelectProblem(p.id)}
          />
        ))}
      </div>
    </div>
  );
}
