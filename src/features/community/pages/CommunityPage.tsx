// src/features/community/pages/CommunityPage.tsx
  
import { Page, PageHeader, PageSection } from "@/shared/ui/page";
import BoardTabs from "../components/BoardTabs";
import { Outlet } from "react-router-dom";

export default function CommunityPage() {
  return (
    <Page title="">
      <PageHeader title="커뮤니티" />

      <BoardTabs />

      <Outlet />
    </Page>
  );
}
