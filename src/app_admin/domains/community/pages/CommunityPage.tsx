// PATH: src/app_admin/domains/community/pages/CommunityPage.tsx
// 커뮤니티 — 게시 관리(게시판+공지) · QnA · 자료실

import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";
import { CommunityScopeProvider } from "../context/CommunityScopeContext";

const COMMUNITY_TABS = [
  { key: "notice", label: "공지사항", path: "/admin/community/notice" },
  { key: "board", label: "게시판", path: "/admin/community/board" },
  { key: "materials", label: "자료실", path: "/admin/community/materials" },
  { key: "qna", label: "QnA", path: "/admin/community/qna" },
  { key: "counsel", label: "상담 신청", path: "/admin/community/counsel" },
];

function SettingsButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname.startsWith("/admin/community/settings");

  return (
    <button
      type="button"
      title="자동발송 설정"
      onClick={() => navigate("/admin/community/settings")}
      className="domain-header-action-btn"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 34,
        height: 34,
        borderRadius: "var(--radius-md, 8px)",
        border: "1px solid",
        borderColor: isActive ? "var(--color-primary)" : "var(--color-border-divider)",
        background: isActive ? "color-mix(in srgb, var(--color-primary) 10%, transparent)" : "var(--color-bg-surface)",
        color: isActive ? "var(--color-primary)" : "var(--color-text-muted)",
        cursor: "pointer",
        transition: "all 120ms ease",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  );
}

function CommunityPageInner() {
  return (
    <DomainLayout
      title="커뮤니티"
      description="게시판 · 공지사항 · QnA · 상담 신청 · 자료실"
      tabs={COMMUNITY_TABS}
      headerActions={<SettingsButton />}
    >
      <Outlet />
    </DomainLayout>
  );
}

export default function CommunityPage() {
  return (
    <CommunityScopeProvider>
      <CommunityPageInner />
    </CommunityScopeProvider>
  );
}
