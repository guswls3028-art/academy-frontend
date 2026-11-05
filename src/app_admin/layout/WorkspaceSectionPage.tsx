import { Link, useLocation } from "react-router";
import { ArrowRight } from "lucide-react";
import { Badge, Button, ICON } from "@/shared/ui/ds";
import { DomainLayout } from "@/shared/ui/layout";
import { WORKSPACE_SECTIONS } from "@/core/navigation/workspaceSections";
import { useOperationalNotificationCounts } from "@/shared/hooks/useOperationalNotificationCounts";
import { useAdminNavigationState } from "./useAvailableAdminNavigation";
import { NavIcon } from "./adminNavConfig";
import styles from "./WorkspaceSectionPage.module.css";

export default function WorkspaceSectionPage() {
  const { pathname } = useLocation();
  const { groups, permissionsPending, permissionsError, retryPermissions } = useAdminNavigationState();
  const notifications = useOperationalNotificationCounts();
  const section = WORKSPACE_SECTIONS.find(item => item.to === pathname.replace(/\/$/, ""))!;
  const items = groups.find(group => group.title === section.title)?.items ?? [];
  return (
    <DomainLayout title={section.title} description={section.description} descriptionMode="visible"
      breadcrumbs={[{ label: "대시보드", to: "/workspace/dashboard" }]}>
      {section.id === "management" && (permissionsPending || permissionsError) && (
        <div className={styles.permissionNotice} role={permissionsError ? "alert" : "status"}>
          <p>{permissionsError ? "직원 관리 권한을 확인하지 못해 일부 메뉴가 보이지 않습니다." : "사용할 수 있는 관리 기능을 확인하고 있습니다."}</p>
          {permissionsError && <Button type="button" onClick={() => void retryPermissions()}>다시 시도</Button>}
        </div>
      )}
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
