/**
 * PATH: src/features/results/panels/ExamResultsPanel.tsx
 *
 * ✅ STEP 1 — Results 자동 진입 & 자동 선택 처리
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
import StudentResultPanel from "./StudentResultPanel";

import api from "@/shared/api/axios";
import type { AdminExamResultRow } from "../types/results.types";

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
    return (
      <div className="text-sm text-gray-500">
        성적 불러오는 중...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-sm text-red-600">
        성적 조회 실패
      </div>
    );
  }

  const rows: AdminExamResultRow[] = data ?? [];

  if (rows.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        제출된 성적이 없습니다.
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-260px)] gap-4">
      {/* ================= LEFT: 학생 리스트 ================= */}
      <div className="w-[420px] shrink-0 overflow-auto border-r">
        <AdminExamResultsTable
          rows={rows}
          onSelectEnrollment={setSelectedEnrollmentId}
        />
      </div>

      {/* ================= RIGHT: 학생 상세 ================= */}
      <div className="flex-1 overflow-auto">
        {selectedEnrollmentId ? (
          <StudentResultPanel
            examId={examId}
            enrollmentId={selectedEnrollmentId}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            좌측에서 학생을 선택하세요
          </div>
        )}
      </div>
    </div>
  );
}
