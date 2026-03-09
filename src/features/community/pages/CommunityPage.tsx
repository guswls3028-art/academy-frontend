// PATH: src/features/community/pages/CommunityPage.tsx
// 커뮤니티 — 게시 관리(게시판+공지) · QnA · 자료실 · 설정

import { Outlet, useLocation } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";
import { CommunityScopeProvider } from "../context/CommunityScopeContext";
import CommunityScopeSelector from "../components/CommunityScopeSelector";

const COMMUNITY_TABS = [
  { key: "board", label: "게시판", path: "/admin/community/board" },
  { key: "notice", label: "공지사항", path: "/admin/community/notice" },
  { key: "qna", label: "QnA", path: "/admin/community/qna" },
  { key: "materials", label: "자료실", path: "/admin/community/materials" },
  { key: "settings", label: "설정", path: "/admin/community/settings" },
];

function CommunityPageInner() {
  const location = useLocation();
  const isBoardPanel = location.pathname.endsWith("/board");
  const showScope = isBoardPanel; /* 공지는 좌측 패널 폴더 트리로 선택 */

  return (
    <DomainLayout
      title="커뮤니티"
      description="게시판 · 공지사항 · QnA · 자료실"
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
