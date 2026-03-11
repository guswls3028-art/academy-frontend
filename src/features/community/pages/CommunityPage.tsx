// PATH: src/features/community/pages/CommunityPage.tsx
// 커뮤니티 — 게시 관리(게시판+공지) · QnA · 자료실

import { Outlet, useLocation } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";
import { CommunityScopeProvider } from "../context/CommunityScopeContext";
import CommunityScopeSelector from "../components/CommunityScopeSelector";

const COMMUNITY_TABS = [
  { key: "notice", label: "공지사항", path: "/admin/community/notice" },
  { key: "board", label: "게시판", path: "/admin/community/board" },
  { key: "materials", label: "자료실", path: "/admin/community/materials" },
  { key: "qna", label: "QnA", path: "/admin/community/qna" },
  { key: "counsel", label: "상담 신청", path: "/admin/community/counsel" },
  { key: "settings", label: "설정", path: "/admin/community/settings" },
];

function CommunityPageInner() {
  const location = useLocation();
  const showScope = false; /* 각 탭이 자체 트리 내비게이션 보유 */

  return (
    <DomainLayout
      title="커뮤니티"
      description="게시판 · 공지사항 · QnA · 상담 신청 · 자료실"
      tabs={COMMUNITY_TABS}
    >
      {showScope && <CommunityScopeSelector />}
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
