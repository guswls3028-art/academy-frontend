/**
 * 좌측 사이드 드로어 - 더보기 메뉴 (모바일 슬라이드)
 */
import { useEffect, useRef, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import { Link } from "react-router-dom";

import { logout } from "@/auth/api/auth.api";
import { cx } from "@/shared/utils/cx";
import {
  IconBell,
  IconBoard,
  IconCalendar,
  IconCheck,
  IconClinic,
  IconClipboard,
  IconExam,
  IconFileText,
  IconFolder,
  IconGrade,
  IconLogout,
  IconNotice,
  IconPlay,
  IconSettings,
  IconUser,
} from "@student/shared/ui/icons/Icons";

import styles from "./StudentDrawer.module.css";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
};

type DrawerIcon = ComponentType<SVGProps<SVGSVGElement>>;

type NavGroup = {
  category: string;
  items: Array<{
    label: string;
    to: string;
    Icon: DrawerIcon;
  }>;
};

const NAV: NavGroup[] = [
  {
    category: "학습",
    items: [
      { label: "영상", to: "/student/video", Icon: IconPlay },
      { label: "성적", to: "/student/grades", Icon: IconGrade },
      { label: "시험", to: "/student/exams", Icon: IconExam },
      { label: "과제", to: "/student/submit/assignment", Icon: IconClipboard },
    ],
  },
  {
    category: "클리닉",
    items: [
      { label: "클리닉", to: "/student/clinic", Icon: IconClinic },
      { label: "클리닉 인증 패스", to: "/student/idcard", Icon: IconCheck },
    ],
  },
  {
    category: "학원",
    items: [
      { label: "일정", to: "/student/sessions", Icon: IconCalendar },
      { label: "공지사항", to: "/student/notices", Icon: IconNotice },
      { label: "커뮤니티", to: "/student/community", Icon: IconBoard },
      { label: "출결 현황", to: "/student/attendance", Icon: IconClipboard },
    ],
  },
  {
    category: "나",
    items: [
      { label: "제출", to: "/student/submit", Icon: IconClipboard },
      { label: "내 인벤토리", to: "/student/inventory", Icon: IconFolder },
      { label: "알림", to: "/student/notifications", Icon: IconBell },
      { label: "프로필", to: "/student/profile", Icon: IconUser },
      { label: "설정", to: "/student/settings", Icon: IconSettings },
      { label: "사용 가이드", to: "/student/guide", Icon: IconFileText },
    ],
  },
];

export default function StudentDrawer({ open, onClose }: DrawerProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

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

  const handleLogout = () => {
    setShowLogoutConfirm(false);
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

        <nav className={styles.nav} aria-label="학생 메뉴">
          {NAV.map((group) => (
            <section key={group.category} className={styles.group}>
              <div className={styles.groupLabel}>{group.category}</div>
              {group.items.map(({ label, to, Icon }) => (
                <Link key={to} to={to} className={styles.navLink} onClick={onClose}>
                  <Icon className={styles.navIcon} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              ))}
            </section>
          ))}
        </nav>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.logoutButton}
            onClick={() => setShowLogoutConfirm(true)}
          >
            <IconLogout className={styles.logoutIcon} aria-hidden="true" />
            <span>로그아웃</span>
          </button>
        </div>
      </div>

      {showLogoutConfirm && (
        <div className="stu-logout-dialog__overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="stu-logout-dialog__box" onClick={(e) => e.stopPropagation()}>
            <div className="stu-logout-dialog__title">로그아웃</div>
            <div className="stu-logout-dialog__desc">정말 로그아웃 하시겠어요?</div>
            <div className="stu-logout-dialog__actions">
              <button type="button" className="stu-logout-dialog__cancel" onClick={() => setShowLogoutConfirm(false)}>
                취소
              </button>
              <button type="button" className="stu-logout-dialog__confirm" onClick={handleLogout}>
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
