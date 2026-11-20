/**
 * 선생앱 모바일: 좌측 드로어에 표시할 전체 메뉴. 링크 클릭 시 드로어 닫힘.
 */
import { useNavigate } from "react-router";
import { Drawer } from "antd";
import { Search, Smartphone } from "lucide-react";
import { useAdminLayout } from "./useAdminLayout";
import useAuth from "@/auth/hooks/useAuth";
import { consumeMobileWorkspaceReturnPath, setPreferFullWorkspace } from "@/core/router/MobileWorkspaceRedirect";
import styles from "./AdminNavDrawer.module.css";
import AdminPrimaryNavigation from "./AdminPrimaryNavigation";
import { HeaderCenterStaffClock } from "@admin/domains/staff/components/HeaderCenterStaffClock";

export default function AdminNavDrawer({ onOpenQuickNavigation }: { onOpenQuickNavigation: () => void }) {
  const layout = useAdminLayout();
  const navigate = useNavigate();
  const open = layout?.drawerOpen ?? false;
  const onClose = layout?.closeDrawer ?? (() => {});
  const { user } = useAuth();
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;


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
        <AdminPrimaryNavigation onNavigate={onClose} />
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
