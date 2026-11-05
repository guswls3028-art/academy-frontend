import { Link, useLocation } from "react-router";
import { ArrowRight } from "lucide-react";
import { Badge, ICON } from "@/shared/ui/ds";
import { DomainLayout } from "@/shared/ui/layout";
import { WORKSPACE_SECTIONS } from "@/core/navigation/workspaceSections";
import { useOperationalNotificationCounts } from "@/shared/hooks/useOperationalNotificationCounts";
import { useAvailableAdminNavigation } from "./useAvailableAdminNavigation";
import { NavIcon } from "./adminNavConfig";
import styles from "./WorkspaceSectionPage.module.css";

export default function WorkspaceSectionPage() {
  const { pathname } = useLocation();
  const groups = useAvailableAdminNavigation();
  const notifications = useOperationalNotificationCounts();
  const section = WORKSPACE_SECTIONS.find(item => item.to === pathname.replace(/\/$/, ""))!;
  const items = groups.find(group => group.title === section.title)?.items ?? [];
  return (
    <DomainLayout title={section.title} description={section.description} descriptionMode="visible"
      breadcrumbs={[{ label: "대시보드", to: "/workspace/dashboard" }]}>
      <div className={styles.list} aria-label={`${section.title} 업무`}>
        {items.map(item => (
          <Link key={item.to} to={item.to} className={styles.entry}>
            <span className={styles.icon}><NavIcon d={item.iconPath} /></span>
            <div className={styles.copy}>
              <h2>{item.label}</h2>
              <p>{section.destinations[item.to]}</p>
            </div>
            {item.to.endsWith("/community") && notifications.counts.qnaPending > 0 && (
              <Badge tone="danger" size="sm" ariaLabel={`답변 필요 질문 ${notifications.counts.qnaPending}건`}>
                답변 필요 {notifications.counts.qnaPending}
              </Badge>
            )}
            <ArrowRight className={styles.arrow} size={ICON.md} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </DomainLayout>
  );
}
