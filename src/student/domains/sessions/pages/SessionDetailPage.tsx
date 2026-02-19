// src/student/domains/sessions/pages/SessionDetailPage.tsx
/**
 * ✅ SessionDetailPage (허브)
 * - 학생 앱의 "행동 중심 허브"
 * - 영상/시험/과제/자료 링크만 제공 (판단/계산 ❌)
 *
 * 주의:
 * - session → exam 연결 추론 ❌
 * - 백엔드가 exam_ids 등을 내려주면 그대로 사용
 * - 없으면 "시험으로 이동" 같은 범용 링크만 제공
 */

import { Link, useParams } from "react-router-dom";
import StudentPageShell from "../../../shared/ui/pages/StudentPageShell";
import EmptyState from "../../../shared/ui/layout/EmptyState";
import { useSessionDetail } from "@/student/domains/sessions/hooks/useStudentSessions";
import { formatYmd } from "@/student/shared/utils/date";

export default function SessionDetailPage() {
  const { sessionId } = useParams();
  const safeId = Number(sessionId);

  const { data, isLoading, isError } = useSessionDetail(
    Number.isFinite(safeId) ? safeId : undefined
  );

  if (!Number.isFinite(safeId)) {
    return (
      <StudentPageShell title="차시" description="잘못된 접근입니다.">
        <EmptyState title="세션 ID가 올바르지 않습니다." />
      </StudentPageShell>
    );
  }

  if (isLoading) {
    return (
      <StudentPageShell title="차시" description="불러오는 중...">
        <div style={{ fontSize: 14, color: "#666" }}>불러오는 중...</div>
      </StudentPageShell>
    );
  }

  if (isError || !data) {
    return (
      <StudentPageShell title="차시" description="불러오지 못했습니다.">
        <EmptyState title="차시 상세를 불러오지 못했습니다." />
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell title={data.title} description={`날짜: ${formatYmd(data.date ?? null)}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* ===== Actions ===== */}
        <ActionCard title="영상 보기" desc="미디어 도메인으로 이동합니다.">
          {/* media 이식 전이면 링크만 자리 확보 */}
          <Link to={`/student/video?session=${data.id}`} className="stu-cta-link">
            영상으로 이동
          </Link>
        </ActionCard>

        <ActionCard title="시험/평가" desc="시험 목록 또는 해당 시험으로 이동합니다.">
          {/* ✅ 백엔드가 exam_ids 내려주는 경우: 직접 링크 */}
          {Array.isArray(data.exam_ids) && data.exam_ids.length > 0 ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {data.exam_ids.map((eid) => (
                <Link key={eid} to={`/student/exams/${eid}`} style={btnStyle}>
                  시험 #{eid}
                </Link>
              ))}
            </div>
          ) : (
            <Link to="/student/exams" style={btnStyle}>
              시험 목록 보기
            </Link>
          )}
        </ActionCard>

        <ActionCard title="성적" desc="결과 요약 화면으로 이동합니다.">
          <Link to="/student/grades" className="stu-cta-link">
            성적 보기
          </Link>
        </ActionCard>

        <div style={{ fontSize: 12, color: "#777" }}>
          ※ 이 페이지는 “행동 허브”입니다. 정책/상태 판단은 백엔드가 책임집니다.
        </div>
      </div>
    </StudentPageShell>
  );
}

function ActionCard({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="stu-section">
      <div className="stu-section-header" style={{ fontWeight: 700, fontSize: 15 }}>
        {title}
      </div>
      <div className="stu-muted" style={{ fontSize: 13, marginBottom: "var(--stu-space-4)" }}>{desc}</div>
      <div>{children}</div>
    </div>
  );
}
