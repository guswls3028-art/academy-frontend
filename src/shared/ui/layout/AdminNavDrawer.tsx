/**
 * 선생앱 모바일: 좌측 드로어에 표시할 전체 메뉴. 링크 클릭 시 드로어 닫힘.
 */
import { NavLink, useLocation } from "react-router-dom";
import { Drawer } from "antd";
import { useAdminLayout } from "./AdminLayoutContext";
import { ADMIN_NAV_GROUPS, NavIcon } from "./adminNavConfig";

export default function AdminNavDrawer() {
  const layout = useAdminLayout();
  const loc = useLocation();
  const open = layout?.drawerOpen ?? false;
  const onClose = layout?.closeDrawer ?? (() => {});

  const isActive = (to: string) =>
    to !== "" && (loc.pathname === to || loc.pathname.startsWith(to + "/"));

  return (
    <Drawer
      title="메뉴"
      placement="left"
      open={open}
      onClose={onClose}
      width={280}
      styles={{ body: { padding: "8px 0" } }}
    >
      <div className="nav" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ADMIN_NAV_GROUPS.map((g, gi) => (
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
                  onClick={onClose}
                  className={`nav-item ${active ? "active" : ""}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: 12,
                    marginBottom: 4,
                    textDecoration: "none",
                    color: "var(--sidebar-muted)",
                  }}
                >
                  <span style={{ display: "grid", placeItems: "center", width: 22, flex: "0 0 auto" }}>
                    <NavIcon d={it.iconPath} />
                  </span>
                  <span>{it.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>
    </Drawer>
  );
}
