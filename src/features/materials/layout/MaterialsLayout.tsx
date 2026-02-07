// PATH: src/features/materials/layout/MaterialsLayout.tsx
import { Outlet, NavLink } from "react-router-dom";
import { Section, Panel, PageHeader } from "@/shared/ui/ds";

export default function MaterialsLayout() {
  return (
    <>
      <PageHeader title="자료실" />

      <Section>
        <Panel>
          <div className="panel-body flex gap-4 text-sm font-semibold">
            <NavLink
              to="/admin/materials/sheets"
              className={({ isActive }) =>
                isActive ? "text-[var(--color-primary)]" : ""
              }
            >
              시험지
            </NavLink>
            <NavLink
              to="/admin/materials/reports"
              className={({ isActive }) =>
                isActive ? "text-[var(--color-primary)]" : ""
              }
            >
              성적표
            </NavLink>
            <NavLink
              to="/admin/materials/messages"
              className={({ isActive }) =>
                isActive ? "text-[var(--color-primary)]" : ""
              }
            >
              메시지
            </NavLink>
          </div>
        </Panel>
      </Section>

      <Outlet />
    </>
  );
}
