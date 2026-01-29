// PATH: src/features/exams/components/AdminExamDetail.tsx

/**
 * AdminExamDetail (UX 강화)
 *
 * FIX:
 * - session 컨텍스트: query(session_id) 또는 pathname(/sessions/:id)에서 자동 resolve
 * - session_id 수동 입력폼 제거 (운영 흐름은 세션에서 들어오는 것이 정석)
 */

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useAdminExam } from "../hooks/useAdminExam";
import { useExamAssets, isAssetsReady } from "../hooks/useExamAssets";

import ExamTabs from "./common/ExamTabs";
import ExamHeader from "./common/ExamHeader";

import ExamSetupPanel from "../panels/setup/ExamSetupPanel";
import ExamAssetsPanel from "../panels/ExamAssetsPanel";
import ExamSubmissionsPanel from "../panels/ExamSubmissionsPanel";
import ExamResultsViewerPanel from "../panels/ExamResultsViewerPanel";

import BlockReason from "./BlockReason";
import GateNotice from "./common/GateNotice";
import { resolveSessionIdFromLocation } from "../utils/sessionContext";

export default function AdminExamDetail({ examId }: { examId: number }) {
  const safeExamId = Number.isFinite(examId) && examId > 0 ? examId : 0;

  // sp는 유지(기존 라우팅 영향 최소화). 단, sessionId는 location 기반으로 resolve.
  const [sp] = useSearchParams();

  const sessionId = useMemo(() => {
    return resolveSessionIdFromLocation(
      window.location.search,
      window.location.pathname
    );
  }, [sp]);

  const hasSession = Number.isFinite(sessionId) && sessionId > 0;

  const { data: exam, isLoading } = useAdminExam(safeExamId);

  const assetsQ = useExamAssets(safeExamId);
  const assets = assetsQ.data ?? [];
  const assetsReady = useMemo(() => isAssetsReady(assets), [assets]);

  const [tab, setTab] = useState<"setup" | "assets" | "submissions" | "results">(
    "setup"
  );

  if (!safeExamId) {
    return (
      <BlockReason title="잘못된 시험 ID" description="시험을 다시 선택하세요." />
    );
  }

  if (isLoading) return <div>Loading...</div>;

  if (!exam) {
    return (
      <BlockReason
        title="시험 조회 실패"
        description="시험 정보를 불러오지 못했습니다."
      />
    );
  }

  return (
    <div className="space-y-6">
      <ExamHeader exam={exam} />

      {/* ✅ Session Gate: 수동 입력 금지, 대신 정확한 행동 안내 */}
      {!hasSession && (
        <GateNotice
          title="세션 컨텍스트가 필요합니다"
          description="시험 운영(제출/결과/대상자 관리)은 세션(Session) 화면에서 진입해야 합니다."
          checklist={[
            "세션 화면에서 시험으로 진입하면 session 컨텍스트가 자동 포함됩니다.",
            "현재 URL이 /sessions/:id 경로라면 자동 인식됩니다.",
            "직접 쿼리를 붙여야 한다면 ?session_id= 형태를 사용합니다. (임시/운영 비권장)",
          ]}
        />
      )}

      {/* ✅ Asset Gate: 막힘 이유 + 다음 행동 CTA */}
      {hasSession && !assetsReady && (
        <GateNotice
          title="제출/채점 준비가 완료되지 않았습니다"
          description={
            exam.exam_type === "regular"
              ? "운영 시험은 템플릿 자산(PDF/OMR)을 그대로 사용합니다. 템플릿에서 자산을 등록하세요."
              : "시험지 PDF와 OMR 답안지가 등록되어야 제출 입력이 가능합니다."
          }
          checklist={[
            assets.some((a) => a.asset_type === "problem_pdf")
              ? "문제지 PDF ✔"
              : "문제지 PDF 필요",
            assets.some((a) => a.asset_type === "omr_sheet")
              ? "OMR 답안지 ✔"
              : "OMR 답안지 필요",
          ]}
          cta={{
            label: "자산 탭으로 이동",
            onClick: () => setTab("assets"),
          }}
        />
      )}

      <ExamTabs
        activeTab={tab}
        onChange={setTab}
        hasSession={hasSession}
        assetsReady={assetsReady}
      />

      {tab === "setup" && <ExamSetupPanel examId={safeExamId} />}

      {tab === "assets" && <ExamAssetsPanel examId={safeExamId} />}

      {tab === "submissions" && (
        <ExamSubmissionsPanel examId={safeExamId} sessionId={sessionId} />
      )}

      {tab === "results" && (
        <>
          {!hasSession && (
            <BlockReason
              title="세션 필요"
              description="결과 조회는 세션 컨텍스트가 있을 때만 가능합니다."
            />
          )}

          {hasSession && <ExamResultsViewerPanel examId={safeExamId} />}
        </>
      )}
    </div>
  );
}
