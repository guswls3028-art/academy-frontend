/**
 * 선생앱 모바일: 좌측 드로어에 표시할 전체 메뉴. 링크 클릭 시 드로어 닫힘.
 */
import { useMemo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Drawer } from "antd";
import { useAdminLayout } from "./AdminLayoutContext";
import { ADMIN_NAV_GROUPS, NavIcon } from "./adminNavConfig";
import { fetchStaffMe } from "@admin/domains/staff/api/staffMe.api";
import { setPreferAdmin } from "@/core/router/MobileTeacherRedirect";

export default function AdminNavDrawer() {
  const layout = useAdminLayout();
  const loc = useLocation();
  const navigate = useNavigate();
  const open = layout?.drawerOpen ?? false;
  const onClose = layout?.closeDrawer ?? (() => {});
  const { data: staffMe } = useQuery({ queryKey: ["staff-me"], queryFn: fetchStaffMe });
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;

  const groups = useMemo(() => {
    const isStaffAdmin = !!staffMe?.is_payroll_manager;
    return ADMIN_NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (it) => !it.requiresStaffAdmin || (it.requiresStaffAdmin && isStaffAdmin)
      ),
    })).filter((g) => g.items.length > 0);
  }, [staffMe?.is_payroll_manager]);

  const isActive = (to: string) =>
    to !== "" && (loc.pathname === to || loc.pathname.startsWith(to + "/"));

  return (
    <Drawer
      title="메뉴"
      placement="left"
      open={open}
      onClose={onClose}
      size={280}
      styles={{ body: { padding: "8px 0" } }}
    >
      <div className="nav" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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

      {/* 모바일에서만 표시: 선생님 앱으로 돌아가기 */}
      {isMobile && (
        <div style={{ padding: "12px 12px 0", borderTop: "1px solid var(--color-border-divider, #eee)", marginTop: 8 }}>
          <button
            onClick={() => {
              onClose();
              setPreferAdmin(false);
              navigate("/teacher");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              background: "none",
              border: "1px solid var(--color-brand-primary, #3b82f6)",
              cursor: "pointer",
              color: "var(--color-brand-primary, #3b82f6)",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x={5} y={2} width={14} height={20} rx={2} />
              <line x1={12} y1={18} x2={12} y2={18} strokeWidth={3} strokeLinecap="round" />
            </svg>
            선생님 앱으로 돌아가기
          </button>
        </div>
      )}
    </Drawer>
  );
}
