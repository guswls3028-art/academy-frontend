// PATH: src/features/profile/layout/ProfileLayout.tsx
import { useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Page, PageHeader, PageSection } from "@/shared/ui/page";

export type ProfileOutletContext = {
  month: string;
  setMonth: (v: string) => void;
};

export default function ProfileLayout() {
  const [month, setMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const ctx = useMemo<ProfileOutletContext>(
    () => ({ month, setMonth }),
    [month]
  );

  return (
    <Page>
      <PageHeader title="사용자 정보" />

      {/* Tabs */}
      <PageSection>
        <div className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)] p-4">
          <div className="flex gap-2">
            {[
              { to: "info", label: "내 정보" },
              { to: "records", label: "근태 기록" },
              { to: "expenses", label: "지출" },
            ].map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  [
                    "rounded-lg px-4 py-2 text-sm font-medium",
                    isActive
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--bg-surface-soft)] text-[var(--text-secondary)]",
                  ].join(" ")
                }
              >
                {t.label}
              </NavLink>
            ))}
          </div>
        </div>
      </PageSection>

      {/* Content */}
      <div className="px-6 pb-10">
        <Outlet context={ctx} />
      </div>
    </Page>
  );
}
