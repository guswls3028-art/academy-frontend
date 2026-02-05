// PATH: src/student/shared/ui/layout/StudentTopBar.tsx
/**
 * ✅ StudentTopBar (LOCK v1)
 * - 상단 고정 바
 * - 브랜드/기본 액션만 제공
 *
 * 원칙:
 * - 로그인/프로필/알림 데이터 판단 ❌
 * - 라우트 이동만 ✅
 */

import { Link, useLocation } from "react-router-dom";

export default function StudentTopBar() {
  const loc = useLocation();
  const isHome = loc.pathname.startsWith("/student/dashboard") || loc.pathname === "/student";

  return (
    <div
      style={{
        height: "var(--stu-header-h)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--stu-space-8)",
        padding: `0`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <Link
          to="/student/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
          }}
          aria-label="홈으로"
          title="홈"
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              background: "var(--stu-primary)",
              color: "var(--stu-primary-contrast)",
              display: "grid",
              placeItems: "center",
              fontWeight: 900,
              boxShadow: "var(--stu-shadow-1)",
              flex: "0 0 auto",
            }}
          >
            H
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 900,
                fontSize: 14,
                letterSpacing: -0.2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              HakwonPlus Student
            </div>
            <div className="stu-caption" style={{ marginTop: 2 }}>
              {isHome ? "오늘 할 일을 확인하세요" : "학습을 계속 진행하세요"}
            </div>
          </div>
        </Link>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link className="stu-btn stu-btn--secondary stu-btn--sm" to="/student/qna" aria-label="Q&A">
          Q&A
        </Link>
      </div>
    </div>
  );
}
