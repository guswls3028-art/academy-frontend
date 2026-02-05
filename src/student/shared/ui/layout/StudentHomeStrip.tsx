// PATH: src/student/shared/ui/layout/StudentHomeStrip.tsx
/**
 * ✅ StudentHomeStrip (LOCK v1)
 * - 상단 "공지 + 일정" 중앙상단 영역
 *
 * 원칙:
 * - 데이터 fetch/판단 ❌
 * - 링크/구조만 제공 ✅
 *
 * 확장:
 * - 추후 공지/일정 API를 붙이고 싶으면
 *   이 컴포넌트 내부에서만 확장(도메인 침범 금지)
 */

import { Link } from "react-router-dom";

export default function StudentHomeStrip() {
  return (
    <div className="stu-stack" style={{ gap: "var(--stu-space-8)" }}>
      {/* Notice */}
      <Link to="/student/dashboard" className="stu-card stu-card--pressable" style={{ padding: "var(--stu-space-10)" }}>
        <div className="stu-between" style={{ alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div className="stu-h3" style={{ fontSize: 16, marginBottom: 6 }}>
              📣 공지사항
            </div>
            <div className="stu-muted">
              
            </div>
          </div>
          <span className="stu-badge stu-badge--neutral">보기</span>
        </div>

        <div style={{ marginTop: "var(--stu-space-8)" }} className="stu-caption">
          ※ 디자인 표본입니다. (전역)
        </div>
      </Link>

      {/* Schedule / Today */}
      <Link to="/student/sessions" className="stu-card stu-card--pressable" style={{ padding: "var(--stu-space-10)" }}>
        <div className="stu-between" style={{ alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div className="stu-h3" style={{ fontSize: 16, marginBottom: 6 }}>
              🗓️ 오늘 일정
            </div>
            <div className="stu-muted">
              
            </div>
          </div>
          <span className="stu-badge stu-badge--neutral">차시</span>
        </div>

        <div style={{ marginTop: "var(--stu-space-8)" }} className="stu-caption">
          ※ 중앙 상단 일정 제공 (전역)
        </div>
      </Link>
    </div>
  );
}
