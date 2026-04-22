// PATH: src/app_admin/domains/storage/components/matchup/ProblemGrid.tsx
// 문제 카드 그리드 — 선택된 문서의 추출 문제 표시

import { Loader2 } from "lucide-react";
import type { MatchupProblem } from "../../api/matchup.api";
import ProblemCard from "./ProblemCard";

type Props = {
  problems: MatchupProblem[];
  loading: boolean;
  selectedProblemId: number | null;
  onSelectProblem: (id: number) => void;
  documentStatus?: string;
  // 실시간 진행률 — 좌측 row와 동일한 값을 공유해서 사용자가 2곳에서 같은 정보를 봄
  progressPercent?: number;
  progressStepName?: string;
};

export default function ProblemGrid({
  problems, loading, selectedProblemId, onSelectProblem, documentStatus,
  progressPercent, progressStepName,
}: Props) {
  if (loading || documentStatus === "processing") {
    const hasProgress = typeof progressPercent === "number" && progressPercent > 0;
    const pct = hasProgress ? Math.round(progressPercent!) : 0;
    return (
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "var(--space-8)", gap: "var(--space-3)",
      }}>
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--color-brand-primary)" }} />
        <p style={{ fontSize: 14, color: "var(--color-text-primary)", margin: 0, fontWeight: 600 }}>
          {hasProgress
            ? `${progressStepName || "처리 중"} · ${pct}%`
            : "AI가 문제를 분석하고 있습니다..."}
        </p>
        {/* 진행률 바 (좌측 row의 바와 동일한 값) */}
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
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0, opacity: 0.7 }}>
          {hasProgress ? "완료되면 자동으로 문제 그리드로 바뀝니다" : "보통 10~30초 정도 소요됩니다"}
        </p>
        {/* indeterminate 애니메이션 keyframes */}
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
            ? "문제 추출에 실패했습니다. 재시도해 주세요."
            : "추출된 문제가 없습니다."}
        </p>
      </div>
    );
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
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
  );
}
