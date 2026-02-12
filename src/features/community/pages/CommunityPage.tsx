// PATH: src/features/community/pages/CommunityPage.tsx
// Students UI SSOT — Domain Header + ds-tabs + panel

import { Outlet } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";

const COMMUNITY_TABS = [
  { key: "notice", label: "공지사항", path: "/admin/community/notice" },
  { key: "qna", label: "질의응답", path: "/admin/community/qna" },
  { key: "review", label: "수강후기", path: "/admin/community/review" },
];

export default function CommunityPage() {
  return (
    <DomainLayout
      title="커뮤니티"
      description="공지사항 · 질의응답 · 수강후기"
      tabs={COMMUNITY_TABS}
    >
      <Outlet />
    </DomainLayout>
  );
}
