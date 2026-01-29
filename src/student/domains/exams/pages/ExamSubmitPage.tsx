// src/student/domains/exams/pages/ExamSubmitPage.tsx
/**
 * ✅ ExamSubmitPage (학생 제출)
 *
 * ⚠️ 중요:
 * - Submission feature 재사용이 원칙(C)
 * - 다만 이 프로젝트는 submissions 구현이 여러 버전이 섞여있을 수 있어,
 *   "컴파일 안정 + 최소 UX" 기준으로 화면 골격만 제공한다.
 *
 * 여기서는:
 * - 제출은 /features/submissions 로 이식/연결하기 쉬운 형태로만 둔다.
 * - 프론트에서 상태 판단/계산 ❌
 * - 제출 완료 후: Result refetch/이동 ✅
 */

import { Link, useNavigate, useParams } from "react-router-dom";
import StudentPageShell from "@/student/shared/components/StudentPageShell";
import EmptyState from "@/student/shared/components/EmptyState";

export default function ExamSubmitPage() {
  const { examId } = useParams();
  const safeId = Number(examId);
  const nav = useNavigate();

  if (!Number.isFinite(safeId)) {
    return (
      <StudentPageShell title="제출" description="잘못된 접근입니다.">
        <EmptyState title="시험 ID가 올바르지 않습니다." />
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell
      title="시험 제출"
      description="OMR/답안 제출은 submissions feature로 연결됩니다."
      actions={
        <Link to={`/student/exams/${safeId}`} style={linkBtn}>
          뒤로
        </Link>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={card}>
          <div style={{ fontWeight: 900 }}>제출 UX (MVP)</div>
          <div style={{ marginTop: 8, fontSize: 13, color: "#666" }}>
            ✅ 이 화면은 “제출入口”만 담당합니다. 실제 업로드/폴링은
            <code>features/submissions</code>를 재사용해서 붙이세요.
          </div>

          <div style={{ marginTop: 12, fontSize: 13, color: "#666" }}>
            - 업로드 성공 → 폴링 DONE → 결과 페이지 이동
            <br />- FAILED → 재업로드 유도
          </div>

          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              style={btnStyle}
              onClick={() => {
                // ✅ 실제 구현은 submissions로 붙이면 됨
                // 지금은 네비 UX만
                nav(`/student/exams/${safeId}/result`);
              }}
            >
              (임시) 제출 완료 처리
            </button>
          </div>
        </div>

        <div style={{ fontSize: 12, color: "#777" }}>
          ※ 여기서 정책/채점/결과 판단을 하면 안 됩니다. 백엔드가 단일 진실입니다.
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

const btnStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#111",
  color: "#fff",
  fontWeight: 800,
};
