/**
 * 선생앱 모바일: 좌측 드로어에 표시할 전체 메뉴. 링크 클릭 시 드로어 닫힘.
 */
import { useMemo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Drawer } from "antd";
import { Smartphone } from "lucide-react";
import { useAdminLayout } from "./useAdminLayout";
import { ADMIN_NAV_GROUPS, NavIcon } from "./adminNavConfig";
import { fetchStaffMe } from "@admin/domains/staff/api/staffMe.api";
import { staffQueryKeys } from "@admin/domains/staff/queryKeys";
import { useProgram } from "@/shared/program";
import { setPreferAdmin } from "@/core/router/MobileTeacherRedirect";
import useAuth from "@/auth/hooks/useAuth";
import styles from "./AdminNavDrawer.module.css";

export default function AdminNavDrawer() {
  const layout = useAdminLayout();
  const loc = useLocation();
  const navigate = useNavigate();
  const open = layout?.drawerOpen ?? false;
  const onClose = layout?.closeDrawer ?? (() => {});
  const { data: staffMe } = useQuery({ queryKey: staffQueryKeys.me, queryFn: fetchStaffMe });
  const { program } = useProgram();
  const { user } = useAuth();
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;

  const groups = useMemo(() => {
    const isStaffAdmin = !!staffMe?.is_payroll_manager;
    const isTenantAdmin = user?.tenantRole === "owner" || user?.tenantRole === "admin" || !!user?.is_superuser;
    const flags = program?.feature_flags ?? {};
    return ADMIN_NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (it) =>
          (!it.requiresStaffAdmin || isStaffAdmin)
          && (!it.requiresTenantAdmin || isTenantAdmin)
          && (!it.requiresFeatureFlag || !!flags[it.requiresFeatureFlag])
      ),
    })).filter((g) => g.items.length > 0);
  }, [program?.feature_flags, staffMe?.is_payroll_manager, user?.tenantRole, user?.is_superuser]);

  const isActive = (to: string) =>
    to !== "" && (loc.pathname === to || loc.pathname.startsWith(to + "/"));

  return (
    <Drawer
      title="메뉴"
      placement="left"
      open={open}
      onClose={onClose}
      size={280}
      rootClassName={styles.drawer}
    >
      <div className={styles.nav}>
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
                >
                  <span className={styles.navIcon}>
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
        <div className={styles.teacherReturn}>
          <button
            onClick={() => {
              onClose();
              setPreferAdmin(false);
              navigate("/teacher");
            }}
            className={styles.teacherReturnButton}
          >
            <Smartphone size={18} aria-hidden />
            선생님 앱으로 돌아가기
          </button>
        </div>
      )}
    </Drawer>
  );
}
