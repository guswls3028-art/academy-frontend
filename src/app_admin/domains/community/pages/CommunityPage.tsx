// PATH: src/app_admin/domains/community/pages/CommunityPage.tsx
// 커뮤니티 — 게시 관리(게시판+공지) · QnA · 자료실

import { Outlet, useLocation, useNavigate } from "react-router";
import { Settings } from "lucide-react";
import { DomainLayout } from "@/shared/ui/layout";
import { ICON } from "@/shared/ui/ds";
import { CommunityScopeProvider } from "../context/CommunityScopeContext";
import "@admin/domains/community/community.css";

const COMMUNITY_TABS = [
  { key: "notice", label: "공지사항", path: "/workspace/community/notice" },
  { key: "board", label: "게시판", path: "/workspace/community/board" },
  { key: "materials", label: "자료실", path: "/workspace/community/materials" },
  { key: "qna", label: "QnA", path: "/workspace/community/qna" },
  { key: "counsel", label: "상담 신청", path: "/workspace/community/counsel" },
];

function SettingsButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname.startsWith("/workspace/community/settings");

  return (
    <button
      type="button"
      title="자동발송 설정"
      onClick={() => navigate("/workspace/community/settings")}
      className={`domain-header-action-btn community-settings-btn${isActive ? " community-settings-btn--active" : ""}`}
    >
      <Settings size={ICON.xs} aria-hidden />
      설정
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
