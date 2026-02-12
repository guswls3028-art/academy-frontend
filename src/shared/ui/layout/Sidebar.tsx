// PATH: src/shared/ui/layout/Sidebar.tsx
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

const BASE = "/admin";
const SIDEBAR_STORAGE_KEY = "ui.sidebar.collapsed";

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
};

type NavGroup = {
  title?: string;
  items: NavItem[];
};

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

  const groups: NavGroup[] = useMemo(
    () => [
      {
        items: [
          {
            to: `${BASE}/dashboard`,
            label: "대시보드",
            icon: <Icon d="M3 11l9-7 9 7v9H3z" />,
          },
          {
            to: `${BASE}/students`,
            label: "학생",
            icon: (
              <Icon d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 8a7 7 0 0 1 14 0" />
            ),
          },
          {
            to: `${BASE}/lectures`,
            label: "강의",
            icon: <Icon d="M4 4h16v12H4zM8 20h8" />,
          },
        ],
      },
      {
        items: [
          {
            to: `${BASE}/exams`,
            label: "시험",
            icon: <Icon d="M7 3h10v18H7zM9 7h6M9 11h6M9 15h4" />,
          },
          {
            to: `${BASE}/results`,
            label: "성적",
            icon: <Icon d="M4 18h16M6 15V9M12 15V5M18 15v-7" />,
          },
          {
            to: `${BASE}/clinic`,
            label: "클리닉",
            icon: (
              <Icon d="M12 21s7-4 7-10a7 7 0 0 0-14 0c0 6 7 10 7 10Z" />
            ),
          },
        ],
      },
      {
        items: [
          {
            to: `${BASE}/staff`,
            label: "직원관리",
            icon: (
              <Icon d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 8a7 7 0 0 1 14 0" />
            ),
          },
          {
            to: `${BASE}/videos`,
            label: "영상",
            icon: <Icon d="M3 6h14v12H3zM17 10l4-2v8l-4-2z" />,
          },
          {
            to: `${BASE}/community`,
            label: "커뮤니티",
            icon: <Icon d="M4 4h16v12H7l-3 3z" />,
          },
          {
            to: `${BASE}/materials`,
            label: "자료실",
            icon: (
              <Icon d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" />
            ),
          },
        ],
      },
      {
        items: [
          {
            to: `${BASE}/settings`,
            label: "시스템 설정",
            icon: (
              <Icon d="M12 15.5a3.5 3.5 0 1 0 0-7M19.4 15a8 8 0 0 0 0-6l2-1-2-4-2.3.5a8 8 0 0 0-3.4-2L11 1h-4l-.7 2.5a8 8 0 0 0-3.4 2L1.6 5l-2 4 2 1a8 8 0 0 0 0 6l-2 1 2 4 2.3-.5a8 8 0 0 0 3.4 2L7 23h4l.7-2.5a8 8 0 0 0 3.4-2l2.3.5 2-4Z" />
            ),
          },
          {
            to: `${BASE}/profile/account`,
            label: "내 계정",
            icon: (
              <Icon d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 8a7 7 0 0 1 14 0" />
            ),
          },
        ],
      },
    ],
    []
  );

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
                      {it.icon}
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
