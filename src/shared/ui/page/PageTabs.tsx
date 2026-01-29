// src/shared/ui/page/PageTabs.tsx
import { NavLink } from "react-router-dom";

interface TabItem {
  label: string;
  to: string;
  end?: boolean;
}

interface PageTabsProps {
  tabs: TabItem[];
}

export default function PageTabs({ tabs }: PageTabsProps) {
  return (
    <div className="flex gap-6 border-b border-[var(--border-divider)]">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `pb-2 text-sm font-medium transition-colors border-b-2 ${
              isActive
                ? "border-[var(--color-primary)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
