/**
 * PATH: src/features/results/panels/ExamResultsPanel.tsx
 *
 * ✅ STEP 1 — Results 자동 진입 & 자동 선택 처리
 * ✅ 학생 클릭 시 우측 상세 오버레이(드로어)로 답안지/오답노트 표시
 *
 * 설계 계약:
 * - Session → Exam 진입 시 자동 선택은 Results 도메인 책임
 * - query param 기반 "최초 1회" 자동 선택
 * - 이후 상태 변경은 사용자 클릭만 반영
 *
 * ❌ 금지:
 * - session API 직접 호출
 * - enrollment 계산
 * - 전역 상태 / store 사용
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import AdminExamResultsTable from "../components/AdminExamResultsTable";
import StudentResultDrawer from "../components/StudentResultDrawer";
import OmrReviewWorkspace from "../components/omr-review/OmrReviewWorkspace";
import { listOmrReviewRows } from "../components/omr-review/omrReviewApi";

import api from "@/shared/api/axios";
import type { AdminExamResultRow } from "../types/results.types";
import { EmptyState } from "@/shared/ui/ds";
import { useAdminExam } from "@admin/domains/exams/hooks/useAdminExam";

type Props = {
  examId: number;
};

/**
 * 기존 API 호출 로직 유지
 */
async function fetchAdminExamResults(examId: number) {
  const res = await api.get(
    `/results/admin/exams/${examId}/results/`
  );

  return Array.isArray(res.data?.results)
    ? res.data.results
    : Array.isArray(res.data)
    ? res.data
    : [];
}

export default function ExamResultsPanel({ examId }: Props) {
  const [searchParams] = useSearchParams();

  /**
   * 🔥 STEP 1 핵심
   * - Session에서 넘어온 enrollmentId를 최초 선택값으로 사용
   * - useState 초기값으로만 사용 (이후 자동 변경 ❌)
   */
  const initialEnrollmentId = Number(
    searchParams.get("enrollmentId")
  );

  const [selectedEnrollmentId, setSelectedEnrollmentId] =
    useState<number | null>(
      Number.isFinite(initialEnrollmentId)
        ? initialEnrollmentId
        : null
    );

  const [reviewOpen, setReviewOpen] = useState(false);

  const { data: exam } = useAdminExam(examId);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-exam-results", examId],
    queryFn: () => fetchAdminExamResults(examId),
    enabled: Number.isFinite(examId),
  });

  // OMR 제출 현황 (운영자 개입 배지용)
  const { data: omrRows = [] } = useQuery({
    queryKey: ["omr-review-list", examId],
    queryFn: () => listOmrReviewRows(examId),
    enabled: Number.isFinite(examId),
    refetchInterval: 15000,
  });

  const reviewBadge = useMemo(() => {
    let pending = 0;
    let needsId = 0;
    for (const r of omrRows) {
      const st = String(r.status || "").toLowerCase();
      const ids = String(r.identifier_status || "").toLowerCase();
      if (st === "needs_identification" || ids === "no_match" || ids === "missing") {
        needsId++;
        pending++;
      } else if (r.manual_review_required || st === "failed") {
        pending++;
      }
    }
    return { pending, needsId, total: omrRows.length };
  }, [omrRows]);

  if (isLoading) {
    return <EmptyState scope="panel" tone="loading" title="성적 불러오는 중…" />;
  }

  if (isError) {
    return <EmptyState scope="panel" tone="error" title="성적을 불러오지 못했습니다." />;
  }

  const rows: AdminExamResultRow[] = data ?? [];
  const hasResults = rows.length > 0;

  const selectedRow = selectedEnrollmentId != null
    ? rows.find((r) => r.enrollment_id === selectedEnrollmentId) ?? null
    : null;
  const examTitle = exam?.title ?? "시험";

  // 성적도 없고 OMR 제출도 없으면 기존 빈 상태 유지
  if (!hasResults && reviewBadge.total === 0) {
    return <EmptyState scope="panel" tone="empty" title="제출된 성적이 없습니다." />;
  }

  return (
    <div className="flex h-[calc(100vh-260px)] flex-col gap-3">
      {reviewBadge.total > 0 && (
        <div
          className="flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5"
          style={{
            background:
              reviewBadge.pending > 0
                ? "color-mix(in srgb, #f59e0b 6%, #fff)"
                : "color-mix(in srgb, #10b981 6%, #fff)",
            borderColor:
              reviewBadge.pending > 0
                ? "color-mix(in srgb, #f59e0b 30%, #fff)"
                : "color-mix(in srgb, #10b981 30%, #fff)",
          }}
        >
          <div className="text-sm" style={{ color: "#374151" }}>
            <b>📋 OMR 제출 {reviewBadge.total}건</b>
            {reviewBadge.pending > 0 ? (
              <span style={{ marginLeft: 10, color: "#b45309" }}>
                검토 필요 {reviewBadge.pending}건
                {reviewBadge.needsId > 0 && ` · 식별실패 ${reviewBadge.needsId}건`}
              </span>
            ) : (
              <span style={{ marginLeft: 10, color: "#047857" }}>
                전건 정상
              </span>
            )}
          </div>
          <button
            type="button"
            className="ds-status-badge"
            data-tone={reviewBadge.pending > 0 ? "warning" : "success"}
            style={{ cursor: "pointer", fontSize: 12, padding: "6px 14px" }}
            onClick={() => setReviewOpen(true)}
          >
            OMR 검토 열기 →
          </button>
        </div>
      )}

      <div className="flex flex-1 gap-4 min-h-0">
        {/* ================= LEFT: 학생 리스트 ================= */}
        <div className="w-[420px] shrink-0 overflow-auto border-r">
          {hasResults ? (
            <AdminExamResultsTable
              rows={rows}
              onSelectEnrollment={setSelectedEnrollmentId}
            />
          ) : (
            <div className="p-8 text-center text-sm" style={{ color: "#6b7280" }}>
              아직 채점된 성적이 없습니다.
              <br />
              상단에서 OMR 검토를 열어 식별·수정을 진행하세요.
            </div>
          )}
        </div>

        {/* ================= RIGHT: 빈 안내 또는 드로어 오버레이 ================= */}
        {selectedEnrollmentId == null ? (
          <div className="flex-1 flex items-center justify-center overflow-auto">
            <EmptyState
              scope="panel"
              tone="empty"
              mode="embedded"
              title={hasResults ? "학생을 선택하세요" : "OMR 검토 후 결과가 표시됩니다"}
              description={
                hasResults
                  ? "목록에서 학생을 클릭하면 우측에 답안지·오답노트 상세가 드로어로 열립니다."
                  : "식별실패/검토필요 제출을 상단 ‘OMR 검토 열기’로 해결하면 성적이 자동 집계됩니다."
              }
            />
          </div>
        ) : (
          selectedRow && (
            <StudentResultDrawer
              examId={examId}
              enrollmentId={selectedEnrollmentId}
              studentName={selectedRow.student_name ?? "학생"}
              examTitle={examTitle}
              onClose={() => setSelectedEnrollmentId(null)}
            />
          )
        )}
      </div>

      <OmrReviewWorkspace
        examId={examId}
        examTitle={examTitle}
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
      />
    </div>
  );
}
