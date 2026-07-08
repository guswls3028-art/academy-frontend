/**
 * PATH: src/app_teacher/layout/TeacherDrawer.tsx
 * 사이드 드로어 — PC 사이드바 구조 1:1 매칭. 4그룹 + Lucide 아이콘
 */
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { ICON } from "@/shared/ui/ds";
import { useNavigate, useLocation } from "react-router-dom";
import useAuth from "@/auth/hooks/useAuth";
import { setPreferAdmin } from "@/core/router/MobileTeacherRedirect";
import { useFeesEnabled } from "@/shared/hooks/useFeesEnabled";
import { useTeacherPendingCounts } from "@teacher/shared/hooks/useTeacherPendingCounts";
import {
  Home, Users, BookOpen, Activity,
  ClipboardList, Award, Video, MessageSquare,
  FileText, Bell, User, Settings, Send, Clock,
  Monitor, LogOut, AlertCircle, X, FolderPlus, Calendar, Info,
  RefreshCw, Bug, Globe,
} from "@teacher/shared/ui/Icons";
import styles from "./TeacherDrawer.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

/* PC 사이드바 4그룹 구조 */
type MenuItem = {
  label: string;
  path: string;
  icon: ReactNode;
  badge?: number;
};

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

export default function TeacherDrawer({ open, onClose }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  const { clearAuth, user } = useAuth();
  const { counts } = useTeacherPendingCounts();
  const isOwnerOrAdmin = user?.tenantRole === "owner" || user?.tenantRole === "admin";
  const feesEnabled = useFeesEnabled();
  const recentSubmissions = counts?.recentSubmissions;
  const totalNotifications = counts?.total;

  const menuGroups = useMemo<MenuGroup[]>(
    () => [
      {
        title: "메인",
        items: [
          { label: "대시보드", path: "/teacher", icon: <Home size={ICON.md} /> },
          { label: "학원 홈페이지", path: "/landing", icon: <Globe size={ICON.md} /> },
          { label: "사용 가이드", path: "/teacher/guide", icon: <Info size={ICON.md} /> },
          { label: "학생", path: "/teacher/students", icon: <Users size={ICON.md} /> },
          { label: "강의", path: "/teacher/classes", icon: <BookOpen size={ICON.md} /> },
          { label: "클리닉", path: "/teacher/clinic", icon: <Activity size={ICON.md} /> },
          { label: "클리닉 리모컨", path: "/teacher/clinic/remote", icon: <RefreshCw size={ICON.md} /> },
          { label: "클리닉 보고서", path: "/teacher/clinic/reports", icon: <Calendar size={ICON.md} /> },
        ],
      },
      {
        title: "학습·운영",
        items: [
          { label: "시험", path: "/teacher/exams", icon: <ClipboardList size={ICON.md} /> },
          { label: "제출함", path: "/teacher/submissions", icon: <Send size={ICON.md} />, badge: recentSubmissions },
          { label: "템플릿 관리", path: "/teacher/exams/templates", icon: <FileText size={ICON.md} /> },
          { label: "시험 묶음", path: "/teacher/exams/bundles", icon: <FolderPlus size={ICON.md} /> },
          { label: "성적", path: "/teacher/results", icon: <Award size={ICON.md} /> },
          { label: "영상", path: "/teacher/videos", icon: <Video size={ICON.md} /> },
          { label: "발송 내역", path: "/teacher/message-log", icon: <Send size={ICON.md} /> },
          { label: "템플릿 저장", path: "/teacher/message-templates", icon: <FileText size={ICON.md} /> },
          ...(isOwnerOrAdmin ? [{ label: "메시지 설정", path: "/teacher/messaging-settings", icon: <Settings size={ICON.md} /> }] : []),
          { label: "자료 저장소", path: "/teacher/storage", icon: <FolderPlus size={ICON.md} /> },
          { label: "학생 인벤토리", path: "/teacher/storage/inventory", icon: <Users size={ICON.md} /> },
          { label: "상담 메모", path: "/teacher/counseling", icon: <FileText size={ICON.md} /> },
        ],
      },
      {
        title: "관리",
        items: [
          ...(isOwnerOrAdmin && feesEnabled
            ? [
                { label: "수납", path: "/teacher/fees", icon: <Award size={ICON.md} /> },
                { label: "청구서", path: "/teacher/fees/invoices", icon: <FileText size={ICON.md} /> },
              ]
            : []),
          { label: "커뮤니티", path: "/teacher/comms", icon: <MessageSquare size={ICON.md} />, badge: totalNotifications },
          { label: "타이머", path: "/teacher/tools/stopwatch", icon: <Clock size={ICON.md} /> },
          ...(isOwnerOrAdmin ? [{ label: "직원 관리", path: "/teacher/staff", icon: <Users size={ICON.md} /> }] : []),
          { label: "근태 / 지출", path: "/teacher/my-records", icon: <Clock size={ICON.md} /> },
          { label: "알림 센터", path: "/teacher/notifications", icon: <Bell size={ICON.md} />, badge: totalNotifications },
          { label: "프로필", path: "/teacher/profile", icon: <User size={ICON.md} /> },
          ...(isOwnerOrAdmin ? [{ label: "결제 / 구독", path: "/teacher/billing", icon: <Award size={ICON.md} /> }] : []),
          ...(isOwnerOrAdmin ? [{ label: "학원 정보", path: "/teacher/settings/organization", icon: <Settings size={ICON.md} /> }] : []),
          { label: "테마", path: "/teacher/settings/appearance", icon: <Settings size={ICON.md} /> },
          { label: "설정", path: "/teacher/settings", icon: <Settings size={ICON.md} /> },
          { label: "PC에서 처리하는 기능", path: "/teacher/desktop-only", icon: <Monitor size={ICON.md} /> },
        ],
      },
      {
        title: "To개발자",
        items: [
          { label: "패치노트", path: "/teacher/developer", icon: <FileText size={ICON.md} /> },
          { label: "버그 제보", path: "/teacher/developer/bug", icon: <Bug size={ICON.md} /> },
          { label: "피드백", path: "/teacher/developer/feedback", icon: <MessageSquare size={ICON.md} /> },
        ],
      },
    ],
    [feesEnabled, isOwnerOrAdmin, recentSubmissions, totalNotifications],
  );

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
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

  const handleNav = (path: string) => {
    onClose();
    navigate(path);
  };

  const handleDesktopSwitch = () => {
    onClose();
    setPreferAdmin(true);
    navigate("/admin");
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

  const isActive = (path: string) => {
    if (path === "/teacher") return location.pathname === "/teacher";
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div onClick={onClose} className={styles.backdrop} />
      )}

      {/* Drawer panel — PC 사이드바 스타일 */}
      <div
        ref={panelRef}
        className={open ? `${styles.panel} ${styles.panelOpen}` : styles.panel}
        role="navigation"
        aria-label="선생님 메뉴"
        aria-hidden={!open}
      >
        {/* Header — 사이드바 로고 영역 대응 */}
        <div className={styles.header}>
          <span className={styles.title}>메뉴</span>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            aria-label="닫기"
          >
            <X size={ICON.md} />
          </button>
        </div>

        {/* Grouped menu — PC 사이드바 구조 */}
        <div className={styles.menuScroll}>
          {menuGroups.map((group, gi) => (
            <div key={group.title}>
              {/* Group header */}
              <div className={styles.groupTitle}>
                {group.title}
              </div>

              {/* Items */}
              {group.items.map((item) => {
                const active = isActive(item.path);
                return (
                  <button
                    type="button"
                    key={item.path}
                    onClick={() => handleNav(item.path)}
                    className={active ? `${styles.menuItem} ${styles.menuItemActive}` : styles.menuItem}
                  >
                    <span className={active ? `${styles.itemIcon} ${styles.itemIconActive}` : styles.itemIcon}>
                      {item.icon}
                    </span>
                    <span className={styles.itemLabel}>{item.label}</span>
                    {item.badge != null && item.badge > 0 && (
                      <span className={styles.badge}>
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Divider between groups */}
              {gi < menuGroups.length - 1 && (
                <div className={styles.divider} />
              )}
            </div>
          ))}
        </div>

        {/* Bottom actions */}
        <div className={styles.actions}>
          {/* Desktop switch */}
          <button
            type="button"
            onClick={handleDesktopSwitch}
            className={`${styles.actionButton} ${styles.primaryAction}`}
          >
            <Monitor size={ICON.md} />
            데스크톱 버전
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
