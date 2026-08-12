/**
 * PATH: src/app_teacher/layout/TeacherDrawer.tsx
 * 사이드 드로어 — PC 사이드바 구조 1:1 매칭. 그룹형 메뉴 + Lucide 아이콘
 */
import { useEffect, useRef, useState } from "react";
import { ICON } from "@/shared/ui/ds";
import { useNavigate, useLocation } from "react-router";
import useAuth from "@/auth/hooks/useAuth";
import { setPreferFullWorkspace } from "@/core/router/MobileWorkspaceRedirect";
import {
  Monitor, LogOut, AlertCircle, X, ChevronDown, ExternalLink,
} from "@teacher/shared/ui/Icons";
import type { TeacherNavigationGroup } from "./useTeacherNavigation";
import styles from "./TeacherDrawer.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  persistent?: boolean;
  menuGroups: TeacherNavigationGroup[];
  isOwnerOrAdmin: boolean;
}

export default function TeacherDrawer({
  open,
  onClose,
  persistent = false,
  menuGroups,
  isOwnerOrAdmin,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  const { clearAuth } = useAuth();
  const [expandedGroup, setExpandedGroup] = useState("오늘 업무");

  useEffect(() => {
    const activeGroup = menuGroups.find((group) =>
      group.items.some((item) => {
        if (!item.path) return false;
        if (item.path === "/workspace/mobile") return location.pathname === "/workspace/mobile";
        return location.pathname.startsWith(item.path);
      }),
    );
    if (activeGroup) setExpandedGroup(activeGroup.title);
  }, [location.pathname, menuGroups]);

  // Body scroll lock
  useEffect(() => {
    if (open && !persistent) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open, persistent]);

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

  const handleNav = (path: string) => {
    onClose();
    navigate(path);
  };

  const handleDesktopSwitch = () => {
    onClose();
    setPreferFullWorkspace(true);
    navigate("/workspace");
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

  const isActive = (path?: string) => {
    if (!path) return false;
    if (path === "/workspace/mobile") return location.pathname === "/workspace/mobile";
    return location.pathname.startsWith(path);
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
          {menuGroups.map((group, groupIndex) => (
            <div key={group.title}>
              <button
                type="button"
                className={
                  expandedGroup === group.title
                    ? `${styles.groupButton} ${styles.groupButtonOpen}`
                    : styles.groupButton
                }
                aria-expanded={expandedGroup === group.title}
                aria-controls={`teacher-menu-group-${groupIndex}`}
                onClick={() =>
                  setExpandedGroup((current) =>
                    current === group.title ? "" : group.title,
                  )
                }
              >
                <span>{group.title}</span>
                <span className={styles.groupCount}>{group.items.length}</span>
                <ChevronDown
                  size={ICON.xs}
                  className={
                    expandedGroup === group.title
                      ? `${styles.groupChevron} ${styles.groupChevronOpen}`
                      : styles.groupChevron
                  }
                  aria-hidden
                />
              </button>

              {expandedGroup === group.title && (
                <div id={`teacher-menu-group-${groupIndex}`} className={styles.groupItems}>
                  {group.items.map((item) => {
                    const active = isActive(item.path);
                    const itemClass = active
                      ? `${styles.menuItem} ${styles.menuItemActive}`
                      : styles.menuItem;
                    const content = (
                      <>
                        <span className={active ? `${styles.itemIcon} ${styles.itemIconActive}` : styles.itemIcon}>
                          {item.icon}
                        </span>
                        <span className={styles.itemLabel}>{item.label}</span>
                        {item.badge != null && item.badge > 0 && (
                          <span className={styles.badge}>
                            {item.badge > 99 ? "99+" : item.badge}
                          </span>
                        )}
                        {item.href && (
                          <ExternalLink
                            size={ICON.xs}
                            className={styles.externalMark}
                            aria-hidden
                          />
                        )}
                      </>
                    );

                    if (item.href) {
                      return (
                        <a
                          key={item.href}
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          className={itemClass}
                          onClick={onClose}
                        >
                          {content}
                        </a>
                      );
                    }

                    return (
                      <button
                        type="button"
                        key={item.path}
                        data-analytics-destination={item.path}
                        onClick={() => item.path && handleNav(item.path)}
                        className={itemClass}
                        aria-current={active ? "page" : undefined}
                      >
                        {content}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom actions */}
        <div className={styles.actions}>
          {/* Desktop switch */}
          {isOwnerOrAdmin && (
            <button
              type="button"
              onClick={handleDesktopSwitch}
              className={`${styles.actionButton} ${styles.primaryAction}`}
            >
              <Monitor size={ICON.md} />
              통합 업무 화면
            </button>
          )}

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
