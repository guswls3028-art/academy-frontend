// PATH: src/shared/ui/layout/Sidebar.tsx
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ADMIN_NAV_BASE,
  ADMIN_NAV_GROUPS,
  NavIcon,
} from "./adminNavConfig";

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
    collapsed ? "var(--sidebar-width-collapsed)" : "260px"
  );
}

export default function Sidebar() {
  const loc = useLocation();
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

  const groups = ADMIN_NAV_GROUPS;

  const isActive = (to: string) =>
    loc.pathname === to || loc.pathname.startsWith(to + "/");

  return (
    <aside
      className="sidebar sidebar-shell"
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background:
          "linear-gradient(180deg, var(--sidebar-bg), color-mix(in srgb, var(--sidebar-bg) 78%, var(--layout-canvas-bg)))",
      }}
    >
      <div style={{ flex: 1, overflow: "hidden", padding: "12px" }}>
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
                    <span
                      style={{
                        display: "grid",
                        placeItems: "center",
                        width: 22,
                        flex: "0 0 auto",
                      }}
                    >
                      <NavIcon d={it.iconPath} />
                    </span>

                    {!collapsed && (
                      <span className="label" style={{ minWidth: 0 }}>
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
