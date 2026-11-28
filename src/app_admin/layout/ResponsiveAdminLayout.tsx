/**
 * Keep the route tree mounted while only navigation and CSS respond to viewport changes.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { WORKSPACE_SECTIONS } from "@/core/navigation/workspaceSections";
import { Outlet, useLocation } from "react-router";
import Header from "./Header";
import Sidebar from "./Sidebar";
import AdminNavDrawer from "./AdminNavDrawer";
import TeacherBottomBar from "./TeacherBottomBar";
import { AsyncStatusBar } from "@/shared/ui/asyncStatus";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { getLocalItem, setLocalItem } from "@/shared/utils/safeLocalStorage";
import styles from "./ResponsiveAdminLayout.module.css";

const SIDEBAR_PREF = "ui.sidebar.collapsed";

export default function ResponsiveAdminLayout({ onOpenQuickNavigation }: { onOpenQuickNavigation: () => void }) {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(location.pathname);
  useLayoutEffect(() => {
    const paths = [previousPath.current, location.pathname].map(path => path.replace(/\/$/, ""));
    if (paths.some(path => path === "/workspace/staff-board" || path.startsWith("/workspace/staff-board/"))
      || WORKSPACE_SECTIONS.some(section => paths.includes(section.to))) {
      mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
    previousPath.current = location.pathname;
  }, [location.pathname]);
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => getLocalItem(SIDEBAR_PREF) === "1");
  useLayoutEffect(() => {
    if (isMobile) return;
    const root = document.documentElement;
    root.setAttribute("data-sidebar", sidebarCollapsed ? "collapsed" : "expanded");
    root.style.setProperty("--sidebar-width", sidebarCollapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width-expanded)");
    setLocalItem(SIDEBAR_PREF, sidebarCollapsed ? "1" : "0");
    return () => {
      root.removeAttribute("data-sidebar");
      root.style.removeProperty("--sidebar-width");
    };
  }, [isMobile, sidebarCollapsed]);
  return (
    <div data-app="admin" className={styles.root}>
      <div className={styles.layout}>
        <header className={styles.header}>
          <Header onOpenQuickNavigation={onOpenQuickNavigation} sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed(value => !value)} />
        </header>
        <div className={styles.sidebar}>
          {!isMobile && <Sidebar collapsed={sidebarCollapsed} onExpand={() => setSidebarCollapsed(false)} />}
        </div>
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
