/**
 * PATH: src/app_admin/domains/results/components/omr-review/OmrReviewEntry.tsx
 *
 * OMR 검토 진입점 — 배너 + 워크스페이스 캡슐화.
 *
 * 사용처:
 * - ExamResultsViewerPanel 최상단 (운영자 첫 시야 진입)
 *
 * 동작:
 * - omr-review-list 폴링 → 검토 필요 건수 계산
 * - 검토 필요 0건: 컴팩트한 정상 배지 (시각적 노이즈 최소)
 * - 검토 필요 N건: 강조 배너 + "N건 처리하기" CTA
 * - 0건이고 OMR 제출 자체가 없으면 아무것도 렌더하지 않음
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";

import OmrReviewWorkspace from "./OmrReviewWorkspace";
import { listOmrReviewIssuesPage, listOmrReviewRows } from "./omrReviewApi";
import { adminResultsQueryKeys } from "../../queryKeys";
import "./OmrReviewEntry.css";

type Props = {
  examId: number;
  examTitle: string;
};

export default function OmrReviewEntry({ examId, examTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [initialSubmissionId, setInitialSubmissionId] = useState<number | undefined>();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("reviewOmr") !== "1") return;
    const requestedId = Number(searchParams.get("reviewSubmissionId"));
    setInitialSubmissionId(Number.isSafeInteger(requestedId) && requestedId > 0 ? requestedId : undefined);
    setOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("reviewOmr");
    next.delete("reviewSubmissionId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const { data: rows = [], isError, refetch } = useQuery({
    queryKey: adminResultsQueryKeys.omrReviewList(examId),
    queryFn: () => listOmrReviewRows(examId),
    enabled: Number.isFinite(examId),
    refetchInterval: 15000,
  });
  const issues = useQuery({
    queryKey: adminResultsQueryKeys.omrReviewIssuesSummary(examId),
    queryFn: () => listOmrReviewIssuesPage(examId),
    enabled: Number.isFinite(examId),
    refetchInterval: 15000,
  });

  const badge = useMemo(() => {
    let needsId = 0;
    let flagged = 0;
    let processing = 0;
    let alignmentFailed = 0;
    let answerOk = 0;
    let answerTotal = 0;
    let total = 0;
    for (const r of issues.data?.items ?? []) {
      const st = String(r.status || "").toLowerCase();
      const ids = String(r.identifier_status || "").toLowerCase();
      if (st === "needs_identification" || ids === "no_match" || ids === "missing") {
        needsId++;
      } else if (r.manual_review_required || st === "failed") {
        flagged++;
      } else if (st && st !== "done") {
        processing++;
      }
      if ((r.manual_review_reasons || []).includes("ALIGNMENT_FAILED")) {
        alignmentFailed++;
      }
    }
    for (const r of rows) {
      if (String(r.status || "").toLowerCase() === "superseded") continue;
      total++;
      const s = r.answer_stats;
      if (s && typeof s.total === "number" && s.total > 0) {
        answerOk += Number(s.ok || 0);
        answerTotal += Number(s.total);
      }
    }
    const autoRate =
      answerTotal > 0 ? Math.round((answerOk / answerTotal) * 100) : null;
    return {
      needsId,
      flagged,
      processing,
      alignmentFailed,
      autoRate,
      answerOk,
      answerTotal,
      total,
    };
  }, [issues.data, rows]);

  if (isError || issues.isError) {
    return (
      <div className="omr-entry omr-entry--pending" role="alert">
        <div className="omr-entry__info">
          <div className="omr-entry__title">OMR 검토 현황을 불러오지 못했습니다</div>
          <div className="omr-entry__detail">검토 대기 답안이 없는 것으로 간주하지 않았습니다.</div>
        </div>
        <button type="button" className="omr-entry__cta" onClick={() => { void refetch(); void issues.refetch(); }}>
          다시 시도
        </button>
      </div>
    );
  }

  if (!issues.data) {
    return <div className="omr-entry" role="status">OMR 검토 현황 확인 중…</div>;
  }

  // 제출 자체가 없으면 노출 안 함
  if (badge.total === 0 && issues.data?.total === 0) return null;

  const pending = issues.data?.total ?? 0;
  const allClean = pending === 0;

  return (
    <>
      <div className={`omr-entry ${allClean ? "omr-entry--clean" : "omr-entry--pending"}`}>
        <div className="omr-entry__info">
          <div className="omr-entry__title">
            OMR 검토
            {allClean ? (
              <span className="omr-entry__status omr-entry__status--ok">
                전건 처리 완료
              </span>
            ) : (
              <span className="omr-entry__status omr-entry__status--pending">
                {pending}건 검토 대기
              </span>
            )}
          </div>
          <div className="omr-entry__detail">
            {allClean ? (
              <span>미해결 OMR이 없습니다. 최근 {badge.total}건은 필요 시 다시 열어 수정할 수 있습니다.</span>
            ) : (
              <>
                <span>최근 표시된 답안 {badge.total}건 · 전체 검토 대기 {pending}건</span>
                {pending > 50 && <span>유형별 건수는 최신 검토 대상 50건 기준</span>}
                {badge.needsId > 0 && (
                  <span className="omr-entry__metric omr-entry__metric--noid">
                    학생 식별 실패 {badge.needsId}건
                  </span>
                )}
                {badge.flagged > 0 && (
                  <span className="omr-entry__metric omr-entry__metric--flag">
                    답안 검토 필요 {badge.flagged}건
                  </span>
                )}
                {badge.processing > 0 && (
                  <span className="omr-entry__metric">처리 중 {badge.processing}건</span>
                )}
                {badge.alignmentFailed > 0 && (
                  <span className="omr-entry__metric omr-entry__metric--flag">
                    정렬 실패 {badge.alignmentFailed}건
                  </span>
                )}
              </>
            )}
            {badge.autoRate !== null && (
              <span className="omr-entry__metric">
                자동 인식 {badge.autoRate}%
                <small className="omr-entry__metric-count">
                  ({badge.answerOk}/{badge.answerTotal})
                </small>
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          className={`omr-entry__cta ${allClean ? "omr-entry__cta--ghost" : ""}`}
          onClick={() => setOpen(true)}
        >
          {allClean ? "OMR 다시 보기" : `${pending}건 처리하기`}
        </button>
      </div>

      <OmrReviewWorkspace
        examId={examId}
        examTitle={examTitle}
        initialSubmissionId={initialSubmissionId}
        open={open}
        onClose={() => { setOpen(false); setInitialSubmissionId(undefined); }}
      />
    </>
  );
}
