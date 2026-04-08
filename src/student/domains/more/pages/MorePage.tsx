/**
 * 더보기 — 카테고리별 메뉴 단일 목록 + 로그아웃
 */
import { Link } from "react-router-dom";
import { logout } from "@/features/auth/api/auth";
import {
  IconUser,
  IconBoard,
  IconClipboard,
  IconCheck,
  IconExam,
  IconGrade,
  IconLogout,
  IconClinic,
  IconSettings,
  IconFolder,
  IconNotice,
  IconBell,
  IconFileText,
} from "@/student/shared/ui/icons/Icons";
import type { ReactNode } from "react";

const linkStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--stu-space-4)",
  padding: "var(--stu-space-3) var(--stu-space-4)",
  color: "var(--stu-text)",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 15,
};

/** 라우터 기준 전체 메뉴 대장 — 카테고리별 네비게이션 (홈·영상·일정 제외 = TabBar에 있는 것 제외) */
const FULL_NAV: { category: string; items: { label: string; to: string; icon: ReactNode }[] }[] = [
  {
    category: "학습",
    items: [
      { label: "시험", to: "/student/exams", icon: <IconExam style={{ width: 22, height: 22, flexShrink: 0 }} /> },
      { label: "제출", to: "/student/submit", icon: <IconClipboard style={{ width: 22, height: 22, flexShrink: 0 }} /> },
      { label: "내 인벤토리", to: "/student/inventory", icon: <IconFolder style={{ width: 22, height: 22, flexShrink: 0 }} /> },
      { label: "성적", to: "/student/grades", icon: <IconGrade style={{ width: 22, height: 22, flexShrink: 0 }} /> },
    ],
  },
  {
    category: "소통",
    items: [
      { label: "공지사항", to: "/student/notices", icon: <IconNotice style={{ width: 22, height: 22, flexShrink: 0 }} /> },
      { label: "커뮤니티", to: "/student/community", icon: <IconBoard style={{ width: 22, height: 22, flexShrink: 0 }} /> },
      { label: "알림", to: "/student/notifications", icon: <IconBell style={{ width: 22, height: 22, flexShrink: 0 }} /> },
    ],
  },
  {
    category: "클리닉",
    items: [
      { label: "클리닉", to: "/student/clinic", icon: <IconClinic style={{ width: 22, height: 22, flexShrink: 0 }} /> },
      { label: "클리닉 인증 패스", to: "/student/idcard", icon: <IconCheck style={{ width: 22, height: 22, flexShrink: 0 }} /> },
    ],
  },
  {
    category: "기타",
    items: [
      { label: "출결 현황", to: "/student/attendance", icon: <IconClipboard style={{ width: 22, height: 22, flexShrink: 0 }} /> },
      { label: "프로필", to: "/student/profile", icon: <IconUser style={{ width: 22, height: 22, flexShrink: 0 }} /> },
      { label: "설정", to: "/student/settings", icon: <IconSettings style={{ width: 22, height: 22, flexShrink: 0 }} /> },
      { label: "사용 가이드", to: "/student/guide", icon: <IconFileText style={{ width: 22, height: 22, flexShrink: 0 }} /> },
    ],
  },
];

export default function MorePage() {
  return (
    <div style={{ padding: "var(--stu-space-2) 0" }}>
      {/* 전체 메뉴 — 카테고리별 카드 그룹 */}
      {FULL_NAV.map((group) => (
        <div key={group.category} style={{ marginBottom: "var(--stu-space-5)" }}>
          {/* 카테고리 헤더 — 카드 밖 */}
          <h3
            className="stu-muted"
            style={{
              fontSize: 12,
              fontWeight: 800,
              marginBottom: "var(--stu-space-2)",
              paddingLeft: 4,
              letterSpacing: "0.02em",
              textTransform: "uppercase" as const,
            }}
          >
            {group.category}
          </h3>
          {/* 카드 래퍼 */}
          <div
            style={{
              background: "var(--stu-surface)",
              border: "1px solid var(--stu-border)",
              borderRadius: "var(--stu-radius-lg, 12px)",
              overflow: "hidden",
            }}
          >
            {group.items.map((item, idx) => (
              <Link
                key={item.to}
                to={item.to}
                style={{
                  ...linkStyle,
                  borderBottom:
                    idx < group.items.length - 1
                      ? "1px solid var(--stu-border-subtle)"
                      : "none",
                }}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* 로그아웃 */}
      <section style={{ marginTop: "var(--stu-space-4)" }}>
        <button
          type="button"
          className="stu-btn stu-btn--danger"
          style={{
            width: "100%",
            marginBottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--stu-space-4)",
            padding: "var(--stu-space-4)",
            fontSize: 15,
            fontWeight: 700,
            borderRadius: "var(--stu-radius-lg, 12px)",
          }}
          onClick={() => logout()}
        >
          <IconLogout style={{ width: 22, height: 22 }} />
          로그아웃
        </button>
      </section>
    </div>
  );
}
