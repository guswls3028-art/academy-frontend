/**
 * Keep the route tree mounted while only navigation and CSS respond to viewport changes.
 */
import { useLayoutEffect, useRef } from "react";
import { WORKSPACE_SECTIONS } from "@/core/navigation/workspaceSections";
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
  return (
    <div data-app="admin" className={styles.root}>
      <div className={styles.layout}>
        <header className={styles.header}>
          <Header onOpenQuickNavigation={onOpenQuickNavigation} />
        </header>
        <aside className={`sidebar ${styles.sidebar}`}>
          {!isMobile && <Sidebar />}
        </aside>
        <main ref={mainRef} className={styles.main}>
          <div className={styles.content}>
            <Outlet key={location.pathname} />
          </div>
        </main>
      </div>
      {isMobile && <AdminNavDrawer onOpenQuickNavigation={onOpenQuickNavigation} />}
      {isMobile && <TeacherBottomBar />}
      <AsyncStatusBar />
    </div>
  );
}
