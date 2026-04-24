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

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import OmrReviewWorkspace from "./OmrReviewWorkspace";
import { listOmrReviewRows } from "./omrReviewApi";
import "./OmrReviewEntry.css";

type Props = {
  examId: number;
  examTitle: string;
};

export default function OmrReviewEntry({ examId, examTitle }: Props) {
  const [open, setOpen] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["omr-review-list", examId],
    queryFn: () => listOmrReviewRows(examId),
    enabled: Number.isFinite(examId),
    refetchInterval: 15000,
  });

  const badge = useMemo(() => {
    let pending = 0;
    let needsId = 0;
    let flagged = 0;
    let alignmentFailed = 0;
    let answerOk = 0;
    let answerTotal = 0;
    for (const r of rows) {
      const st = String(r.status || "").toLowerCase();
      const ids = String(r.identifier_status || "").toLowerCase();
      if (st === "needs_identification" || ids === "no_match" || ids === "missing") {
        needsId++;
        pending++;
      } else if (r.manual_review_required || st === "failed") {
        flagged++;
        pending++;
      }
      if ((r.manual_review_reasons || []).includes("ALIGNMENT_FAILED")) {
        alignmentFailed++;
      }
      const s = r.answer_stats;
      if (s && typeof s.total === "number" && s.total > 0) {
        answerOk += Number(s.ok || 0);
        answerTotal += Number(s.total);
      }
    }
    const autoRate =
      answerTotal > 0 ? Math.round((answerOk / answerTotal) * 100) : null;
    return {
      pending,
      needsId,
      flagged,
      alignmentFailed,
      autoRate,
      answerOk,
      answerTotal,
      total: rows.length,
    };
  }, [rows]);

  // 제출 자체가 없으면 노출 안 함
  if (badge.total === 0) return null;

  const allClean = badge.pending === 0;

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
                {badge.pending}건 검토 대기
              </span>
            )}
          </div>
          <div className="omr-entry__detail">
            {allClean ? (
              <span>총 {badge.total}건 자동 처리됨. 필요 시 다시 열어 수정할 수 있습니다.</span>
            ) : (
              <>
                <span>총 {badge.total}건 중</span>
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
                <small style={{ opacity: 0.7, marginLeft: 4 }}>
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
          {allClean ? "OMR 다시 보기" : `${badge.pending}건 처리하기`}
        </button>
      </div>

      <OmrReviewWorkspace
        examId={examId}
        examTitle={examTitle}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
