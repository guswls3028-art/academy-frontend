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
} from "@/student/shared/ui/icons/Icons";
import type { ReactNode } from "react";

const linkStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--stu-space-4)",
  padding: "var(--stu-space-4) var(--stu-space-4)",
  borderRadius: "var(--stu-radius-md)",
  background: "var(--stu-surface)",
  border: "1px solid var(--stu-border)",
  color: "var(--stu-text)",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 15,
  marginBottom: "var(--stu-space-2)",
};

/** 라우터 기준 전체 메뉴 대장 — 카테고리별 네비게이션 (홈·영상·일정·알림·공지 제외) */
const FULL_NAV: { category: string; items: { label: string; to: string; icon: ReactNode }[] }[] = [
  {
    category: "학습",
    items: [
      { label: "시험", to: "/student/exams", icon: <IconExam style={{ width: 22, height: 22, flexShrink: 0 }} /> },
      { label: "제출", to: "/student/submit", icon: <IconClipboard style={{ width: 22, height: 22, flexShrink: 0 }} /> },
      { label: "성적", to: "/student/grades", icon: <IconGrade style={{ width: 22, height: 22, flexShrink: 0 }} /> },
    ],
  },
  {
    category: "소통",
    items: [{ label: "QnA", to: "/student/qna", icon: <IconBoard style={{ width: 22, height: 22, flexShrink: 0 }} /> }],
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
    ],
  },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: "var(--stu-space-8)" }}>
      <h2 className="stu-muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: "var(--stu-space-3)", paddingLeft: 4 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function MorePage() {
  return (
    <div style={{ padding: "var(--stu-space-2) 0" }}>
      {/* 전체 메뉴 대장 — 카테고리별 모든 라우트 */}
      <Section title="전체 메뉴">
        {FULL_NAV.map((group) => (
          <div key={group.category} style={{ marginBottom: "var(--stu-space-6)" }}>
            <h3 className="stu-muted" style={{ fontSize: 11, fontWeight: 700, marginBottom: "var(--stu-space-2)", paddingLeft: 4 }}>
              {group.category}
            </h3>
            {group.items.map((item) => (
              <Link key={item.to} to={item.to} style={linkStyle}>
                {item.icon}
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </Section>

      {/* 로그아웃 */}
      <section>
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
