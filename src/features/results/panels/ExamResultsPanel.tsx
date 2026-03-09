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

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import AdminExamResultsTable from "../components/AdminExamResultsTable";
import StudentResultDrawer from "../components/StudentResultDrawer";

import api from "@/shared/api/axios";
import type { AdminExamResultRow } from "../types/results.types";
import { EmptyState } from "@/shared/ui/ds";
import { useAdminExam } from "@/features/exams/hooks/useAdminExam";

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

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-exam-results", examId],
    queryFn: () => fetchAdminExamResults(examId),
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
    <div className="flex h-[calc(100vh-260px)] gap-4">
      {/* ================= LEFT: 학생 리스트 ================= */}
      <div className="w-[420px] shrink-0 overflow-auto border-r">
        <AdminExamResultsTable
          rows={rows}
          onSelectEnrollment={setSelectedEnrollmentId}
        />
      </div>

      {/* ================= RIGHT: 빈 안내 또는 드로어 오버레이 ================= */}
      {selectedEnrollmentId == null ? (
        <div className="flex-1 flex items-center justify-center overflow-auto">
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
            onClose={() => setSelectedEnrollmentId(null)}
          />
        )
      )}
    </div>
  );
}
