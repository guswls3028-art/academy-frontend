// PATH: src/shared/ui/layout/Sidebar.tsx
import { useEffect, useState } from "react";
import { getLocalItem, setLocalItem } from "@/shared/utils/safeLocalStorage";
import styles from "./Sidebar.module.css";
import AdminPrimaryNavigation from "./AdminPrimaryNavigation";

const SIDEBAR_STORAGE_KEY = "ui.sidebar.collapsed";

function safeGetCollapsed(): boolean {
  try {
    const v = getLocalItem(SIDEBAR_STORAGE_KEY);
    return v === "1";
  } catch {
    return false;
  }
}

function safeSetCollapsed(v: boolean) {
  try {
    setLocalItem(SIDEBAR_STORAGE_KEY, v ? "1" : "0");
  } catch {
    // ignore
  }
}

function applySidebarLayout(collapsed: boolean) {
  const root = document.documentElement;
  root.setAttribute("data-sidebar", collapsed ? "collapsed" : "expanded");
  root.style.setProperty(
    "--sidebar-width",
    collapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width-expanded)"
  );
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState<boolean>(() => safeGetCollapsed());
  useEffect(() => {
    applySidebarLayout(collapsed);
    safeSetCollapsed(collapsed);
  }, [collapsed]);

  useEffect(() => {
    const onToggle = () => setCollapsed((v) => !v);
    document.addEventListener("ui:sidebar:toggle", onToggle);
    return () => document.removeEventListener("ui:sidebar:toggle", onToggle);
  }, []);

  return (
    <aside
      className={`sidebar sidebar-shell ${styles.shell}`}
      data-analytics-placement="admin.sidebar"
    >
      <div
        className={`sidebar-scroll ${styles.scroll}`}
      >
        <AdminPrimaryNavigation compact={collapsed} onExpandSidebar={collapsed ? () => setCollapsed(false) : undefined} />
      </div>
    </aside>
  );
}
