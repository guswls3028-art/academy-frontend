/**
 * Keep the route tree mounted while only navigation and CSS respond to viewport changes.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { Drawer } from "antd";
import { useAdminLayout } from "./useAdminLayout";
import { WORKSPACE_SECTIONS } from "@/core/navigation/workspaceSections";
import { DawonStaffNavigation } from "@/shared/product/dawon/DawonStaffNavigation";
import { dawonStaffPreviewRole } from "@/shared/product/dawon/staffPreview";
import { Outlet, useLocation } from "react-router";
import Header from "./Header";
import Sidebar from "./Sidebar";
import AdminNavDrawer from "./AdminNavDrawer";
import TeacherBottomBar from "./TeacherBottomBar";
import { AsyncStatusBar } from "@/shared/ui/asyncStatus";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import styles from "./ResponsiveAdminLayout.module.css";

export default function ResponsiveAdminLayout({ onOpenQuickNavigation }: { onOpenQuickNavigation: () => void }) {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(location.pathname);
  useLayoutEffect(() => {
    if (WORKSPACE_SECTIONS.some(section => section.to === location.pathname.replace(/\/$/, "")
      || section.to === previousPath.current.replace(/\/$/, ""))) {
      mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
    previousPath.current = location.pathname;
  }, [location.pathname]);
  const isMobile = useIsMobile();
  const drawer = useAdminLayout();
  const [collapsed, setCollapsed] = useState(false);
  const previewRole = dawonStaffPreviewRole();
  return (
    <div data-app="admin" data-workspace-shell="" className={styles.root}>
      <div className={styles.layout} data-dawon-staff={previewRole ?? undefined} data-collapsed={previewRole && collapsed ? true : undefined}>
        <header className={styles.header}>
          <Header onOpenQuickNavigation={onOpenQuickNavigation}
            onToggleSidebar={previewRole && !isMobile ? () => setCollapsed(value => !value) : undefined}
            sidebarExpanded={previewRole ? (isMobile ? drawer?.drawerOpen : !collapsed) : undefined} />
        </header>
        <aside className={`sidebar ${styles.sidebar}`}>
          {!isMobile && (previewRole ? <DawonStaffNavigation role={previewRole} /> : <Sidebar />)}
        </aside>
        <main ref={mainRef} className={styles.main}>
          <div className={styles.content}>
            <Outlet key={location.pathname} />
          </div>
        </main>
      </div>
      {isMobile && previewRole && <Drawer title="업무 메뉴" placement="left" size={280} zIndex={100010} open={drawer?.drawerOpen} destroyOnHidden onClose={drawer?.closeDrawer}>
        <DawonStaffNavigation role={previewRole} onNavigate={drawer?.closeDrawer} />
      </Drawer>}
      {isMobile && !previewRole && <AdminNavDrawer onOpenQuickNavigation={onOpenQuickNavigation} />}
      {isMobile && !previewRole && <TeacherBottomBar />}
      <AsyncStatusBar />
    </div>
  );
}
