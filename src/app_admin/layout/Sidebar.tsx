// PATH: src/shared/ui/layout/Sidebar.tsx
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ADMIN_NAV_BASE,
  ADMIN_NAV_GROUPS,
  NavIcon,
} from "./adminNavConfig";
import { fetchStaffMe } from "@admin/domains/staff/api/staffMe.api";
import { useProgram } from "@/shared/program";

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
  const { data: staffMe } = useQuery({ queryKey: ["staff-me"], queryFn: fetchStaffMe });
  const { program } = useProgram();

  const groups = useMemo(() => {
    const isStaffAdmin = !!staffMe?.is_payroll_manager;
    const flags = program?.feature_flags ?? {};
    return ADMIN_NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((it) => {
        if (it.requiresStaffAdmin && !isStaffAdmin) return false;
        if (it.requiresFeatureFlag && !flags[it.requiresFeatureFlag]) return false;
        return true;
      }),
    })).filter((g) => g.items.length > 0);
  }, [staffMe?.is_payroll_manager, program?.feature_flags]);

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
      className="sidebar sidebar-shell"
      style={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background:
          "linear-gradient(180deg, var(--sidebar-bg), color-mix(in srgb, var(--sidebar-bg) 78%, var(--layout-canvas-bg)))",
      }}
    >
      <div
        className="sidebar-scroll"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          overscrollBehavior: "contain",
          padding: "12px",
        }}
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
