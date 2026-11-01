/**
 * 선생앱 모바일: 좌측 드로어에 표시할 전체 메뉴. 링크 클릭 시 드로어 닫힘.
 */
import { NavLink, useLocation, useNavigate } from "react-router";
import { Drawer } from "antd";
import { Search, Smartphone } from "lucide-react";
import { useAdminLayout } from "./useAdminLayout";
import { NavIcon } from "./adminNavConfig";
import { useAvailableAdminNavigation } from "./useAvailableAdminNavigation";
import useAuth from "@/auth/hooks/useAuth";
import { consumeMobileWorkspaceReturnPath, setPreferFullWorkspace } from "@/core/router/MobileWorkspaceRedirect";
import styles from "./AdminNavDrawer.module.css";
import { HeaderCenterStaffClock } from "@admin/domains/staff/components/HeaderCenterStaffClock";

export default function AdminNavDrawer({ onOpenQuickNavigation }: { onOpenQuickNavigation: () => void }) {
  const layout = useAdminLayout();
  const loc = useLocation();
  const navigate = useNavigate();
  const open = layout?.drawerOpen ?? false;
  const onClose = layout?.closeDrawer ?? (() => {});
  const groups = useAvailableAdminNavigation();
  const { user } = useAuth();
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;

  const isActive = (to: string) =>
    to !== "" && (loc.pathname === to || loc.pathname.startsWith(to + "/"));

  return (
    <Drawer
      title="메뉴"
      placement="left"
      open={open}
      onClose={onClose}
      size={280}
      getContainer={false}
      rootClassName={styles.drawer}
    >
      <section className={styles.staffOverview} aria-label="근무 현황">
        <HeaderCenterStaffClock />
      </section>
      <div className={styles.quickNavigationWrap}>
        <button
          type="button"
          aria-label="기능 검색"
          className={styles.quickNavigationButton}
          onClick={() => {
            onClose();
            onOpenQuickNavigation();
          }}
        >
          <Search size={18} aria-hidden />
          <span>기능 검색</span>
          <span className={styles.quickNavigationHint}>메뉴 검색</span>
        </button>
      </div>
      <div
        className={styles.nav}
        data-analytics-placement="admin.drawer"
      >
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

      {/* 모바일에서만 표시: 간편 업무으로 돌아가기 */}
      {isMobile && (
        <div className={styles.teacherReturn}>
          <button
            onClick={() => {
              onClose();
              const returnPath = consumeMobileWorkspaceReturnPath(user?.id);
              setPreferFullWorkspace(false);
              navigate(returnPath);
            }}
            className={styles.teacherReturnButton}
          >
            <Smartphone size={18} aria-hidden />
            간편 업무
          </button>
        </div>
      )}
    </Drawer>
  );
}
