// PATH: src/features/community/pages/CommunityPage.tsx
// 커뮤니티 — 게시 관리(게시판+공지) · QnA · 자료실 · 설정

import { Outlet, useLocation } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";
import { CommunityScopeProvider } from "../context/CommunityScopeContext";
import CommunityScopeSelector from "../components/CommunityScopeSelector";

const COMMUNITY_TABS = [
  { key: "admin", label: "게시 관리", path: "/admin/community/admin" },
  { key: "qna", label: "QnA", path: "/admin/community/qna" },
  { key: "materials", label: "자료실", path: "/admin/community/materials" },
  { key: "settings", label: "설정", path: "/admin/community/settings" },
];

function CommunityPageInner() {
  const location = useLocation();
  const isAdminPanel = location.pathname.endsWith("/admin");
  const isSettingsPanel = location.pathname.endsWith("/settings");

  return (
    <DomainLayout
      title="커뮤니티"
      description="게시 관리 · QnA · 자료실"
      tabs={COMMUNITY_TABS}
    >
      {!isAdminPanel && !isSettingsPanel && <CommunityScopeSelector />}
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
