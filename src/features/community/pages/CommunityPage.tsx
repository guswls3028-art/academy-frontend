// PATH: src/features/community/pages/CommunityPage.tsx

import { PageHeader, Section } from "@/shared/ui/ds";
import BoardTabs from "../components/BoardTabs";
import { Outlet } from "react-router-dom";

export default function CommunityPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader title="커뮤니티" />

      {/* Tabs */}
      <Section>
        <BoardTabs />
      </Section>

      {/* Content */}
      <Section>
        <Outlet />
      </Section>
    </div>
  );
}
