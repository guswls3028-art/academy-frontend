import { Link, useLocation } from "react-router";
import { Badge } from "@/shared/ui/ds";
import { WORKSPACE_SECTIONS, workspaceSectionForPath } from "@/core/navigation/workspaceSections";
import { useOperationalNotificationCounts } from "@/shared/hooks/useOperationalNotificationCounts";
import { NavIcon } from "./adminNavConfig";
import { useAvailableAdminNavigation } from "./useAvailableAdminNavigation";
import styles from "./Sidebar.module.css";

export default function AdminPrimaryNavigation({ compact = false, onNavigate }: {
  compact?: boolean; onNavigate?: () => void;
}) {
  const { pathname } = useLocation();
  const groups = useAvailableAdminNavigation();
  const notifications = useOperationalNotificationCounts();
  const activeSection = workspaceSectionForPath(pathname);
  const primary = groups.find(group => group.title === "메인")?.items ?? [];
  const guide = primary.filter(item => item.to.endsWith("/guide"));
  const entries = [
    ...primary.filter(item => !item.to.endsWith("/guide")),
    ...WORKSPACE_SECTIONS.filter(section => groups.some(group => group.title === section.title))
      .map(section => ({ to: section.to, label: section.title, iconPath: section.iconPath })),
    ...guide,
  ];
  return (
    <nav className="nav" aria-label="주요 메뉴">
      {entries.map(item => {
        const current = pathname === item.to || pathname.startsWith(item.to + "/");
        const active = current || activeSection?.to === item.to;
        const count = item.to === "/workspace/management" ? notifications.counts.qnaPending : 0;
        return (
          <Link key={item.to} to={item.to} onClick={onNavigate}
            aria-current={active ? (current ? "page" : "location") : undefined}
            className={`nav-item ${active ? "active" : ""}`}
            title={count > 0 ? `${item.label} · 답변 필요 ${count}건` : item.label}>
            <span className={styles.iconSlot}><NavIcon d={item.iconPath} /></span>
            {!compact && <span className={`label ${styles.label}`}>{item.label}</span>}
            {compact && <span className="sr-only">{item.label}</span>}
            {count > 0 && <Badge tone="danger" variant="solid" size="xs" className={styles.navBadge}
              ariaLabel={`답변 필요 질문 ${count}건`}>{count > 99 ? "99+" : count}</Badge>}
          </Link>
        );
      })}
    </nav>
  );
}
