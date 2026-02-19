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
import { useQuery } from "@tanstack/react-query";
import { fetchExamAssets } from "@/student/domains/exams/api/assets";

export default function ExamDetailPage() {
  const { examId } = useParams();
  const safeId = Number(examId);

  const examQ = useStudentExam(Number.isFinite(safeId) ? safeId : undefined);

  // ✅ 결과는 "단일 진실": can_retake 포함
  const resultQ = useMyExamResult(Number.isFinite(safeId) ? safeId : undefined);

  // ✅ 자산 목록
  const assetsQ = useQuery({
    queryKey: ["student-exam-assets", safeId],
    queryFn: () => fetchExamAssets(safeId),
    enabled: Number.isFinite(safeId),
  });

  if (!Number.isFinite(safeId)) {
    return (
      <StudentPageShell title="시험" description="잘못된 접근입니다.">
        <EmptyState title="시험 ID가 올바르지 않습니다." />
      </StudentPageShell>
    );
  }

  if (examQ.isLoading) {
    return (
      <StudentPageShell title="시험" description="불러오는 중...">
        <div style={{ fontSize: 14, color: "#666" }}>불러오는 중...</div>
      </StudentPageShell>
    );
  }

  if (examQ.isError || !examQ.data) {
    return (
      <StudentPageShell title="시험" description="불러오지 못했습니다.">
        <EmptyState title="시험 정보를 불러오지 못했습니다." />
      </StudentPageShell>
    );
  }

  const exam = examQ.data;
  const canRetake = typeof resultQ.data?.can_retake === "boolean" ? resultQ.data.can_retake : true;

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
            응시 / 결과
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
            <Link to={`/student/exams/${exam.id}/result`} className="stu-cta-link">
              결과 보기
            </Link>

            {/* ✅ can_retake만 신뢰 */}
            {canRetake ? (
              <Link to={`/student/exams/${exam.id}/submit`} className="stu-cta-link">
                제출하기
              </Link>
            ) : (
              <div className="stu-muted" style={{ fontSize: 13 }}>
                재시험 불가
              </div>
            )}
          </div>

          <div style={{ marginTop: "var(--stu-space-6)", fontSize: 12, color: "var(--stu-text-muted)" }}>
            ※ 재시험 가능 여부는 결과 API의 <b>can_retake</b>만 신뢰합니다.
          </div>
        </div>
      </div>
    </StudentPageShell>
  );
}

const card: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 14,
  background: "#fff",
};

const linkBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  textDecoration: "none",
  background: "#fafafa",
  color: "#111",
  fontWeight: 800,
};

