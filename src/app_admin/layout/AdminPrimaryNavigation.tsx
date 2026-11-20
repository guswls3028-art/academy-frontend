import { useId, useState } from "react";
import { Link, useLocation } from "react-router";
import { ChevronDown } from "lucide-react";
import { Badge, ICON } from "@/shared/ui/ds";
import { WORKSPACE_SECTIONS, workspaceSectionForPath } from "@/core/navigation/workspaceSections";
import { useOperationalNotificationCounts } from "@/shared/hooks/useOperationalNotificationCounts";
import { NavIcon } from "./adminNavConfig";
import { useAdminNavigationState } from "./useAvailableAdminNavigation";
import styles from "./Sidebar.module.css";

type SectionId = (typeof WORKSPACE_SECTIONS)[number]["id"];

function PendingAnswers({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Badge tone="danger" variant="solid" size="xs" className={styles.navBadge}
      ariaLabel={`답변 필요 질문 ${count}건`}>{count > 99 ? "99+" : count}</Badge>
  );
}

export default function AdminPrimaryNavigation({ compact = false, onExpandSidebar, onNavigate }: {
  compact?: boolean;
  onExpandSidebar?: () => void;
  onNavigate?: () => void;
}) {
  const id = useId();
  const { pathname } = useLocation();
  const { groups, permissionsPending, permissionsError, retryPermissions } = useAdminNavigationState();
  const { counts } = useOperationalNotificationCounts();
  const activeSectionId = workspaceSectionForPath(pathname.replace(/\/$/, ""))?.id;
  const [expanded, setExpanded] = useState<Partial<Record<SectionId, boolean>>>({});
  const primary = groups.find(group => group.title === "메인")?.items ?? [];
  const isCurrent = (to: string) => pathname === to || pathname.startsWith(to + "/");
  const primaryLink = (item: (typeof primary)[number]) => (
    <Link key={item.to} to={item.to} onClick={onNavigate}
      aria-current={isCurrent(item.to) ? "page" : undefined}
      className={`nav-item ${isCurrent(item.to) ? "active" : ""}`} title={item.label}>
      <span className={styles.iconSlot} aria-hidden="true"><NavIcon d={item.iconPath} /></span>
      <span className={compact ? "sr-only" : `label ${styles.label}`}>{item.label}</span>
    </Link>
  );

  return (
    <nav className="nav" aria-label="주요 메뉴">
      {primary.filter(item => !item.to.endsWith("/guide")).map(primaryLink)}
      {WORKSPACE_SECTIONS.map(section => {
        const group = groups.find(item => item.title === section.title);
        if (!group) return null;
        const active = activeSectionId === section.id;
        const open = !compact && (expanded[section.id] ?? active);
        const panelId = `${id}-${section.id}`;
        const management = section.id === "management";
        const count = management ? counts.qnaPending : 0;

        return (
          <div key={section.id}>
            <button type="button" className={`nav-item ${styles.sectionToggle} ${active ? "active" : ""}`}
              aria-expanded={open} aria-controls={panelId}
              title={compact ? section.title : undefined}
              onClick={() => {
                if (compact) onExpandSidebar?.();
                setExpanded(current => ({ ...current, [section.id]: !open }));
              }}>
              <span className={styles.iconSlot} aria-hidden="true"><NavIcon d={section.iconPath} /></span>
              <span className={compact ? "sr-only" : `label ${styles.label}`}>{section.title}</span>
              <PendingAnswers count={count} />
              {!compact && <ChevronDown size={ICON.sm} className={styles.chevron} aria-hidden="true" />}
            </button>
            <ul className={styles.submenu} id={panelId} hidden={!open}>
              {group.items.map(item => (
                <li key={item.to}>
                  <Link to={item.to} onClick={onNavigate}
                    aria-current={isCurrent(item.to) ? "page" : undefined}
                    className={`nav-item ${styles.childLink} ${isCurrent(item.to) ? "active" : ""}`}>
                    <span className={styles.label}>{item.label}</span>
                    {item.to.endsWith("/community") && <PendingAnswers count={count} />}
                  </Link>
                </li>
              ))}
              {management && permissionsPending && (
                <li className={styles.permissionStatus} role="status">관리 권한 확인 중</li>
              )}
              {management && permissionsError && (
                <li className={styles.permissionStatus}>
                  <p role="alert">직원 관리 권한을 확인하지 못했습니다.</p>
                  <button type="button" onClick={() => void retryPermissions()}>다시 시도</button>
                </li>
              )}
            </ul>
          </div>
        );
      })}
      {primary.filter(item => item.to.endsWith("/guide")).map(primaryLink)}
    </nav>
  );
}
