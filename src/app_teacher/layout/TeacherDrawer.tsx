/**
 * PATH: src/app_teacher/layout/TeacherDrawer.tsx
 * 사이드 드로어 — PC 사이드바 구조 1:1 매칭. 그룹형 메뉴 + Lucide 아이콘
 */
import { useEffect, useRef } from "react";
import { ICON } from "@/shared/ui/ds";
import { useNavigate, useLocation } from "react-router";
import useAuth from "@/auth/hooks/useAuth";
import { useDialogSurface } from "@/shared/ui/overlays/useDialogSurface";
import { setPreferFullWorkspace } from "@/core/router/MobileWorkspaceRedirect";
import { resolveFullWorkspaceDestination } from "@/core/router/workspaceRoutes";
import {
  Monitor, LogOut, AlertCircle, X, ChevronRight,
} from "@teacher/shared/ui/Icons";
import type { TeacherNavigationGroup } from "./useTeacherNavigation";
import { TEACHER_MENU_GROUP_IDS } from "@/core/navigation/workspaceSections";
import styles from "./TeacherDrawer.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  persistent?: boolean;
  menuGroups: TeacherNavigationGroup[];
}

export default function TeacherDrawer({
  open,
  onClose,
  persistent = false,
  menuGroups,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  const { clearAuth, user } = useAuth();
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    if (open || persistent) {
      panel.inert = false;
      panel.removeAttribute("inert");
    } else {
      if (document.activeElement instanceof HTMLElement && panel.contains(document.activeElement)) {
        document.activeElement.blur();
      }
      panel.inert = true;
      panel.setAttribute("inert", "");
    }
  }, [open, persistent]);

  useDialogSurface(open && !persistent, panelRef, onClose);

  const mobileReturnPath = `${location.pathname}${location.search}`;
  const contextualDesktopPath = resolveFullWorkspaceDestination(mobileReturnPath);

  const handleDesktopSwitch = (path = contextualDesktopPath ?? "/workspace") => {
    onClose();
    setPreferFullWorkspace(true, {
      accountId: user?.id,
      mobileReturnPath,
    });
    navigate(path);
  };

  const handleNav = (path: string) => {
    onClose();
    navigate(path);
  };

  const handleLogout = () => {
    onClose();
    clearAuth();
    navigate("/login");
  };

  const handleBugReport = () => {
    onClose();
    document.dispatchEvent(new Event("ui:bugreport:open"));
  };


  return (
    <>
      {/* Backdrop */}
      {open && !persistent && (
        <div onClick={onClose} className={styles.backdrop} />
      )}

      {/* Drawer panel — PC 사이드바 스타일 */}
      <div
        ref={panelRef}
        className={[
          styles.panel,
          open ? styles.panelOpen : "",
          persistent ? styles.panelPersistent : "",
        ].filter(Boolean).join(" ")}
        role="navigation"
        aria-label="선생님 메뉴"
        aria-hidden={!open && !persistent}
        data-analytics-placement="teacher.drawer"
      >
        {/* Header — 사이드바 로고 영역 대응 */}
        <div className={styles.header}>
          <span className={styles.title}>메뉴</span>
          <button
            type="button"
            onClick={onClose}
            className={persistent ? `${styles.closeButton} ${styles.closeButtonPersistent}` : styles.closeButton}
            aria-label="닫기"
          >
            <X size={ICON.md} />
          </button>
        </div>

        {/* Grouped menu — PC 사이드바 구조 */}
        <div className={styles.menuScroll}>
          <div className={styles.groupItems}>
            {menuGroups.flatMap(group => group.items).filter(item =>
              ["/workspace/mobile", "/workspace/mobile/students", "/workspace/mobile/classes"].includes(item.path ?? "")
            ).map(item => (
              <button key={item.path} type="button" onClick={() => item.path && handleNav(item.path)}
                data-analytics-destination={item.path}
                className={`${styles.menuItem} ${location.pathname === item.path ? styles.menuItemActive : ""}`}
                aria-current={location.pathname === item.path ? "page" : undefined}>
                <span className={styles.itemIcon}>{item.icon}</span>
                <span className={styles.itemLabel}>{item.label}</span>
              </button>
            ))}
          </div>
          {menuGroups.map(group => (
            <button key={group.title} type="button" className={styles.groupButton}
              onClick={() => handleNav(`/workspace/mobile/menu?group=${TEACHER_MENU_GROUP_IDS[group.title]}`)}>
              <span>{group.title}</span>
              {group.items.some(item => item.badgeLabel || (item.badge ?? 0) > 0) && (
                <span className={styles.badge} aria-label={`${group.title} ${group.items.find(item => item.badgeLabel)?.badgeLabel ?? "확인할 알림 있음"}`}>
                  {group.items.find(item => item.badgeLabel)?.badgeLabel ?? "확인"}
                </span>
              )}
              <span className={styles.groupCount}>{group.items.length}</span>
              <ChevronRight size={ICON.xs} aria-hidden />
            </button>
          ))}
        </div>

        {/* Bottom actions */}
        <div className={styles.actions}>
          {/* Desktop switch */}
          <button
            type="button"
            onClick={() => handleDesktopSwitch()}
            className={`${styles.actionButton} ${styles.primaryAction}`}
          >
            <Monitor size={ICON.md} />
            전체 업무
          </button>

          {/* Bug report */}
          <button
            type="button"
            onClick={handleBugReport}
            className={`${styles.actionButton} ${styles.secondaryAction}`}
          >
            <AlertCircle size={ICON.md} />
            문제 신고
          </button>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className={`${styles.actionButton} ${styles.logoutAction}`}
          >
            <LogOut size={ICON.md} />
            로그아웃
          </button>
        </div>
      </div>
    </>
  );
}
