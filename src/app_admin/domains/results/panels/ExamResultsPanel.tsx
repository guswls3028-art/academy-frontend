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
 * - OMR 검토 진입은 ExamResultsViewerPanel 상단 OmrReviewEntry가 담당
 *
 * ❌ 금지:
 * - session API 직접 호출
 * - enrollment 계산
 * - 전역 상태 / store 사용
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";

import AdminExamResultsTable from "../components/AdminExamResultsTable";
import { adminResultsQueryKeys } from "../queryKeys";
import StudentResultDrawer from "../components/StudentResultDrawer";

import api from "@/shared/api/axios";
import type { AdminExamResultRow } from "../types/results.types";
import { EmptyState } from "@/shared/ui/ds";
import { useAdminExam } from "@admin/domains/exams/hooks/useAdminExam";

type Props = {
  examId: number;
  lectureId?: number | null;
  wrongCompletionOnly?: boolean;
};

async function fetchAdminExamResults(examId: number, lectureId?: number | null) {
  const res = await api.get(
    `/results/admin/exams/${examId}/results/`,
    { params: lectureId == null ? undefined : { lecture_id: lectureId } },
  );

  return Array.isArray(res.data?.results)
    ? res.data.results
    : Array.isArray(res.data)
    ? res.data
    : [];
}

export default function ExamResultsPanel({ examId, lectureId = null, wrongCompletionOnly = false }: Props) {
  const [searchParams] = useSearchParams();

  const initialEnrollmentId = Number(
    searchParams.get("enrollmentId")
  );

  const [selectedEnrollmentId, setSelectedEnrollmentId] =
    useState<number | null>(
      Number.isFinite(initialEnrollmentId)
        ? initialEnrollmentId
        : null
    );

  const { data: exam } = useAdminExam(examId);

  const { data, isLoading, isError } = useQuery({
    queryKey: adminResultsQueryKeys.adminExamResults(examId, lectureId),
    queryFn: () => fetchAdminExamResults(examId, lectureId),
    enabled: Number.isFinite(examId),
  });

  if (isLoading) {
    return <EmptyState scope="panel" tone="loading" title="성적 불러오는 중…" />;
  }

  if (isError) {
    return <EmptyState scope="panel" tone="error" title="성적을 불러오지 못했습니다." />;
  }

  const rows: AdminExamResultRow[] = data ?? [];

  if (rows.length === 0) {
    return <EmptyState scope="panel" tone="empty" title="제출된 성적이 없습니다." />;
  }

  const selectedRow = selectedEnrollmentId != null
    ? rows.find((r) => r.enrollment_id === selectedEnrollmentId) ?? null
    : null;
  const examTitle = exam?.title ?? "시험";

  return (
    <div
      className="flex min-h-[420px] min-w-0 flex-col gap-4 lg:h-[calc(100vh-260px)] lg:flex-row"
      role="region"
      aria-label="시험 학생별 결과"
    >
      {/* ================= LEFT: 학생 리스트 ================= */}
      <div className="w-full min-w-0 shrink-0 overflow-auto border-b pb-3 lg:w-[420px] lg:border-b-0 lg:border-r lg:pb-0">
        <AdminExamResultsTable
          rows={rows}
          onSelectEnrollment={setSelectedEnrollmentId}
          wrongCompletionOnly={wrongCompletionOnly}
        />
      </div>

      {/* ================= RIGHT: 빈 안내 또는 드로어 오버레이 ================= */}
      {selectedEnrollmentId == null ? (
        <div className="flex min-h-48 flex-1 items-center justify-center overflow-auto">
          <EmptyState
            scope="panel"
            tone="empty"
            mode="embedded"
            title="학생을 선택하세요"
            description="목록에서 학생을 클릭하면 우측에 답안지·오답노트 상세가 드로어로 열립니다."
          />
        </div>
      ) : (
        selectedRow && (
          <StudentResultDrawer
            examId={examId}
            enrollmentId={selectedEnrollmentId}
            studentName={selectedRow.student_name ?? "학생"}
            examTitle={examTitle}
            readOnly
            onClose={() => setSelectedEnrollmentId(null)}
          />
        )
      )}
    </div>
  );
}
