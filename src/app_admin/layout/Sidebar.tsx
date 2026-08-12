// PATH: src/shared/ui/layout/Sidebar.tsx
import { NavLink, useLocation } from "react-router";
import { useEffect, useState } from "react";
import { NavIcon } from "./adminNavConfig";
import { useAvailableAdminNavigation } from "./useAvailableAdminNavigation";
import styles from "./Sidebar.module.css";

const SIDEBAR_STORAGE_KEY = "ui.sidebar.collapsed";

function safeGetCollapsed(): boolean {
  try {
    const v = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return v === "1";
  } catch {
    return false;
  }
}

function safeSetCollapsed(v: boolean) {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, v ? "1" : "0");
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
  const loc = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(() => safeGetCollapsed());
  const groups = useAvailableAdminNavigation();

  const isActive = (to: string) =>
    loc.pathname === to || loc.pathname.startsWith(to + "/");

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
        <div className="nav">
          {groups.map((g, gi) => (
            <div key={gi} className="sidebar-group">
              {g.title ? (
                <div className="sidebar-group-title">{g.title}</div>
              ) : null}

              {g.items.map((it) => {
                const active = isActive(it.to);

                return (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    className={`nav-item ${active ? "active" : ""}`}
                    title={it.label}
                  >
                    <span className={styles.iconSlot}>
                      <NavIcon d={it.iconPath} />
                    </span>

                    {!collapsed && (
                      <span className={`label ${styles.label}`}>
                        {it.label}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
