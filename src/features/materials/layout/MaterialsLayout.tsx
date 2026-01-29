// PATH: src/features/materials/layout/MaterialsLayout.tsx
import { Outlet } from "react-router-dom";
import { Page, PageHeader, PageTabs } from "@/shared/ui/page";

export default function MaterialsLayout() {
  return (
    <Page>
      <PageHeader title="자료실" description="시험지 · 성적표 · 메시지 관리" />
      <PageTabs
        tabs={[
          { label: "시험지", to: "/admin/materials/sheets", end: true },
          { label: "성적표", to: "/admin/materials/reports" },
          { label: "메시지", to: "/admin/materials/messages" },
        ]}
      />
      <Outlet />
    </Page>
  );
}
