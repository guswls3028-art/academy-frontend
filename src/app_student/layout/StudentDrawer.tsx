/**
 * 좌측 사이드 드로어 - 더보기 메뉴 (모바일 슬라이드)
 */
import { useEffect, useRef } from "react";
import { Link } from "react-router";

import { logout } from "@/auth/api/auth.api";
import { cx } from "@/shared/utils/cx";
import { useConfirm } from "@/shared/ui/confirm";
import { useDialogSurface } from "@/shared/ui/overlays/useDialogSurface";
import { IconLogout } from "@student/shared/ui/icons/Icons";
import { STUDENT_NAV_GROUPS } from "./studentNavigation";
import { useWrongCompletionDisplay } from "@/shared/scoring/assessmentStatusDisplay";

import styles from "./StudentDrawer.module.css";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
};


export default function StudentDrawer({ open, onClose }: DrawerProps) {
  const confirm = useConfirm();
  const wrongCompletionOnly = useWrongCompletionDisplay();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    if (open) {
      panel.inert = false;
      panel.removeAttribute("inert");
    } else {
      if (document.activeElement instanceof HTMLElement && panel.contains(document.activeElement)) {
        document.activeElement.blur();
      }
      panel.inert = true;
      panel.setAttribute("inert", "");
    }
  }, [open]);

  useDialogSurface(open, panelRef, onClose);

  const handleLogout = async () => {
    if (!await confirm({
      title: "로그아웃",
      message: "정말 로그아웃 하시겠어요?",
      confirmText: "로그아웃",
      danger: true,
    })) return;
    onClose();
    logout();
  };

  return (
    <>
      <div
        role="presentation"
        className={cx(styles.backdrop, open && styles.backdropOpen)}
        onClick={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-label="메뉴"
        aria-modal={open}
        aria-hidden={!open}
        className={cx(styles.panel, open && styles.panelOpen)}
      >
        <div className={styles.header}>
          <span className={styles.title}>메뉴</span>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="닫기">
            <svg
              className={styles.closeIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav
          className={styles.nav}
          aria-label="학생 메뉴"
          data-analytics-placement="student.drawer"
        >
          {STUDENT_NAV_GROUPS.map((group) => (
            <section key={group.category} className={styles.group}>
              <div className={styles.groupLabel}>{group.category}</div>
              {group.items.map(({ label, to, Icon }) => (
                <Link key={to} to={to} className={styles.navLink} onClick={onClose}>
                  <Icon className={styles.navIcon} aria-hidden="true" />
                  <span>{to === "/student/idcard" && wrongCompletionOnly ? "오답 상태 카드" : label}</span>
                </Link>
              ))}
            </section>
          ))}
        </nav>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.logoutButton}
            onClick={() => void handleLogout()}
          >
            <IconLogout className={styles.logoutIcon} aria-hidden="true" />
            <span>로그아웃</span>
          </button>
        </div>
      </div>

    </>
  );
}
