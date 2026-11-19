/**
 * Keep the route tree mounted while only navigation and CSS respond to viewport changes.
 */
import { useLayoutEffect, useRef } from "react";
import { WORKSPACE_SECTIONS } from "@/core/navigation/workspaceSections";
import { DawonStaffNavigation } from "@/shared/product/dawon/DawonStaffNavigation";
import { dawonStaffPreviewRole } from "@/shared/product/dawon/staffPreview";
import { Link, Outlet, useLocation } from "react-router";
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
  const previewRole = dawonStaffPreviewRole();
  return (
    <div data-app="admin" className={styles.root}>
      <div className={styles.layout}>
        <header className={styles.header}>
          {previewRole ? <>
            <div className={styles.previewHeading}><strong>{previewRole === "admin" ? "다원수학 관리자앱" : "다원수학 선생님앱"}</strong>
              <Link to={`/login/dawon?demo=${previewRole}`}>로그인 화면</Link></div>
            {isMobile && <DawonStaffNavigation role={previewRole} />}
          </> : <Header onOpenQuickNavigation={onOpenQuickNavigation} />}
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
      {isMobile && !previewRole && <AdminNavDrawer onOpenQuickNavigation={onOpenQuickNavigation} />}
      {isMobile && !previewRole && <TeacherBottomBar />}
      <AsyncStatusBar />
    </div>
  );
}
