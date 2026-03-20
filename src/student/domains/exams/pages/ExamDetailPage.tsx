// src/student/domains/exams/pages/ExamDetailPage.tsx
/**
 * ✅ ExamDetailPage (학생)
 * - 자산 다운로드 + 결과/제출 진입
 *
 * 원칙:
 * - 응시 가능 여부를 프론트에서 판단 ❌
 * - "재시험 버튼" 판단은 Result API의 can_retake만 신뢰 ✅
 */

import { Link, useParams } from "react-router-dom";
import StudentPageShell from "../../../shared/ui/pages/StudentPageShell";
import EmptyState from "../../../shared/ui/layout/EmptyState";
import { useStudentExam } from "@/student/domains/exams/hooks/useStudentExams";
import { useMyExamResult } from "@/student/domains/exams/hooks/useMyExamResult";
import { useAuthContext } from "@/features/auth/context/AuthContext";

export default function ExamDetailPage() {
  const { examId } = useParams();
  const safeId = Number(examId);
  const { user } = useAuthContext();
  const isParent = user?.tenantRole === "parent";

  const examQ = useStudentExam(Number.isFinite(safeId) ? safeId : undefined);

  // ✅ 결과는 "단일 진실": can_retake 포함
  const resultQ = useMyExamResult(Number.isFinite(safeId) ? safeId : undefined);

  if (!Number.isFinite(safeId)) {
    return (
      <StudentPageShell title="시험" description="잘못된 접근입니다.">
        <EmptyState title="잘못된 주소입니다." />
      </StudentPageShell>
    );
  }

  if (examQ.isLoading) {
    return (
      <StudentPageShell title="시험">
        <div style={{ padding: "var(--stu-space-4)", display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
          <div className="stu-skel" style={{ height: 120, borderRadius: "var(--stu-radius)" }} />
          <div className="stu-skel" style={{ height: 80, borderRadius: "var(--stu-radius)" }} />
        </div>
      </StudentPageShell>
    );
  }

  if (examQ.isError || !examQ.data) {
    return (
      <StudentPageShell title="시험">
        <EmptyState title="시험 정보를 불러오지 못했어요." description="잠시 후 다시 시도해 주세요." />
      </StudentPageShell>
    );
  }

  const exam = examQ.data;

  // Closed exam check: if close_at exists and has passed, exam is closed
  const isClosed = exam.close_at
    ? new Date(exam.close_at) < new Date()
    : false;

  // While result is loading: hide submit button (unknown state).
  // On error (no prior submission = 404): allow submit (first attempt).
  // On success: trust can_retake from backend.
  // 404 = 미제출(첫 시도 가능), 그 외 에러 = 상태 불명(버튼 숨김)
  const canRetake = resultQ.isLoading
    ? null
    : resultQ.isError
      ? ((resultQ.error as { response?: { status?: number } })?.response?.status === 404 ? true : null)
      : (typeof resultQ.data?.can_retake === "boolean" ? resultQ.data.can_retake : true);

  return (
    <StudentPageShell
      title={exam.title}
      description="제출 / 결과 조회"
      actions={
        <Link to="/student/exams" className="stu-cta-link">
          목록
        </Link>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* ===== Assets ===== */}
        {/* 다운로드 기능 제거됨 (의도적으로 미제공) */}

        {/* ===== Actions ===== */}
        <div className="stu-section">
          <div className="stu-section-header" style={{ fontWeight: 700, fontSize: 15 }}>
            시험 응시 및 결과
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
            <Link to={`/student/exams/${exam.id}/result`} className="stu-cta-link">
              결과 보기
            </Link>

            {/* ✅ can_retake만 신뢰. null = 로딩 중(버튼 미표시). 학부모는 응시 불가. 마감된 시험은 응시 불가 */}
            {isParent ? (
              <div className="stu-muted" style={{ fontSize: 13 }}>학부모는 시험에 응시할 수 없습니다.</div>
            ) : isClosed ? (
              <div className="stu-muted" style={{ fontSize: 13 }}>시험이 마감되었습니다</div>
            ) : canRetake === null ? (
              <div className="stu-muted" style={{ fontSize: 13 }}>확인 중…</div>
            ) : canRetake ? (
              <Link to={`/student/exams/${exam.id}/submit`} className="stu-cta-link">
                답안 입력하기
              </Link>
            ) : (
              <div className="stu-muted" style={{ fontSize: 13 }}>
                재시험 기회가 없습니다.
              </div>
            )}
          </div>

        </div>
      </div>
    </StudentPageShell>
  );
}

// 다운로드 기능 제거됨 (의도적으로 미제공)
// Surface 기반 스타일은 base.css의 .stu-section 사용

