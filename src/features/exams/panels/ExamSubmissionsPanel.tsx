/**
 * ExamSubmissionsPanel
 *
 * WHY:
 * - 시험 제출은 session + asset 조건을 반드시 만족해야 한다
 * - 막힌 이유를 상단에서 명확히 설명한다
 * - submissions의 역할과 결과 흐름을 사람 언어로 안내한다
 */

import { useMemo } from "react";
import GateNotice from "../components/common/GateNotice";
import AdminOmrUploadSection from "../components/submissions/AdminOmrUploadSection";
import { useExamDetail } from "../hooks/useExamDetail";
import { useExamAssets } from "../hooks/useExamAssets";

export default function ExamSubmissionsPanel({
  examId,
  sessionId,
}: {
  examId: number;
  sessionId?: number;
}) {
  const { data: exam } = useExamDetail(examId);
  const { data: assets } = useExamAssets(examId);

  const hasSession = Number.isFinite(sessionId) && Number(sessionId) > 0;
  const hasProblemPdf = Boolean(assets?.problem_pdf);
  const hasOmrSheet = Boolean(assets?.omr_sheet);

  const blockedReason = useMemo(() => {
    if (!hasSession) return "NO_SESSION";
    if (!hasProblemPdf || !hasOmrSheet) return "NO_ASSET";
    return null;
  }, [hasSession, hasProblemPdf, hasOmrSheet]);

  if (blockedReason === "NO_SESSION") {
    return (
      <GateNotice
        title="세션이 선택되지 않았습니다"
        description="시험 제출은 반드시 세션 컨텍스트에서만 가능합니다."
        checklist={[
          "URL에 session_id가 포함되어야 합니다",
          "운영 중인 차시(Session)를 선택해야 합니다",
        ]}
      />
    );
  }

  if (blockedReason === "NO_ASSET") {
    return (
      <GateNotice
        title="시험 자산이 준비되지 않았습니다"
        description="OMR 제출을 위해서는 문제지와 OMR 양식이 모두 필요합니다."
        checklist={[
          hasProblemPdf ? "문제지 PDF ✔" : "문제지 PDF 필요",
          hasOmrSheet ? "OMR 양식 ✔" : "OMR 양식 필요",
        ]}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] p-4">
        <div className="text-sm font-semibold text-[var(--text-primary)]">
          제출 처리 흐름 안내
        </div>
        <ul className="mt-2 list-disc pl-5 text-sm text-[var(--text-secondary)] space-y-1">
          <li>제출은 submissions 도메인에서 이벤트로 기록됩니다.</li>
          <li>답안 추출 후 자동으로 채점 파이프라인이 실행됩니다.</li>
          <li>점수/합불 판단은 결과 탭에서 확인합니다.</li>
        </ul>
      </section>

      <AdminOmrUploadSection examId={examId} />
    </div>
  );
}
