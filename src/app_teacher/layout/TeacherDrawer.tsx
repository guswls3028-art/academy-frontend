/**
 * PATH: src/app_teacher/layout/TeacherDrawer.tsx
 * 사이드 드로어 — PC 사이드바 구조 1:1 매칭. 4그룹 + Lucide 아이콘
 */
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { ICON } from "@/shared/ui/ds";
import { useNavigate, useLocation } from "react-router-dom";
import useAuth from "@/auth/hooks/useAuth";
import { setPreferFullWorkspace } from "@/core/router/MobileWorkspaceRedirect";
import { useFeesEnabled } from "@/shared/hooks/useFeesEnabled";
import { useTeacherPendingCounts } from "@teacher/shared/hooks/useTeacherPendingCounts";
import {
  Home, Users, BookOpen, Activity,
  ClipboardList, Award, Video, MessageSquare,
  FileText, Bell, User, Settings, Send, Clock,
  Monitor, LogOut, AlertCircle, X, FolderPlus, Calendar, Info,
  RefreshCw, Bug, Globe, Wrench,
} from "@teacher/shared/ui/Icons";
import styles from "./TeacherDrawer.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  persistent?: boolean;
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

export default function TeacherDrawer({ open, onClose, persistent = false }: Props) {
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
        title: "오늘 업무",
        items: [
          { label: "대시보드", path: "/workspace/mobile", icon: <Home size={ICON.md} /> },
          { label: "알림 센터", path: "/workspace/mobile/notifications", icon: <Bell size={ICON.md} />, badge: totalNotifications },
          { label: "커뮤니티", path: "/workspace/mobile/comms", icon: <MessageSquare size={ICON.md} />, badge: totalNotifications },
          { label: "제출함", path: "/workspace/mobile/submissions", icon: <Send size={ICON.md} />, badge: recentSubmissions },
        ],
      },
      {
        title: "수업 운영",
        items: [
          { label: "학생", path: "/workspace/mobile/students", icon: <Users size={ICON.md} /> },
          { label: "강의", path: "/workspace/mobile/classes", icon: <BookOpen size={ICON.md} /> },
          { label: "시험", path: "/workspace/mobile/exams", icon: <ClipboardList size={ICON.md} /> },
          { label: "성적", path: "/workspace/mobile/results", icon: <Award size={ICON.md} /> },
          { label: "영상", path: "/workspace/mobile/videos", icon: <Video size={ICON.md} /> },
          { label: "클리닉", path: "/workspace/mobile/clinic", icon: <Activity size={ICON.md} /> },
          { label: "클리닉 리모컨", path: "/workspace/mobile/clinic/remote", icon: <RefreshCw size={ICON.md} /> },
          { label: "클리닉 보고서", path: "/workspace/mobile/clinic/reports", icon: <Calendar size={ICON.md} /> },
        ],
      },
      {
        title: "자료·메시지",
        items: [
          { label: "상담 메모", path: "/workspace/mobile/counseling", icon: <FileText size={ICON.md} /> },
          { label: "발송 내역", path: "/workspace/mobile/message-log", icon: <Send size={ICON.md} /> },
          { label: "템플릿 저장", path: "/workspace/mobile/message-templates", icon: <FileText size={ICON.md} /> },
          { label: "시험 템플릿", path: "/workspace/mobile/exams/templates", icon: <FileText size={ICON.md} /> },
          { label: "시험 묶음", path: "/workspace/mobile/exams/bundles", icon: <FolderPlus size={ICON.md} /> },
          { label: "자료 저장소", path: "/workspace/mobile/storage", icon: <FolderPlus size={ICON.md} /> },
          { label: "학생 인벤토리", path: "/workspace/mobile/storage/inventory", icon: <Users size={ICON.md} /> },
          ...(isOwnerOrAdmin ? [{ label: "메시지 설정", path: "/workspace/mobile/messaging-settings", icon: <Settings size={ICON.md} /> }] : []),
        ],
      },
      {
        title: isOwnerOrAdmin ? "관리자 전용" : "내 계정",
        items: [
          ...(isOwnerOrAdmin && feesEnabled
            ? [
                { label: "수납", path: "/workspace/mobile/fees", icon: <Award size={ICON.md} /> },
                { label: "청구서", path: "/workspace/mobile/fees/invoices", icon: <FileText size={ICON.md} /> },
              ]
            : []),
          ...(isOwnerOrAdmin ? [{ label: "직원 관리", path: "/workspace/mobile/staff", icon: <Users size={ICON.md} /> }] : []),
          { label: "근태 / 지출", path: "/workspace/mobile/my-records", icon: <Clock size={ICON.md} /> },
          { label: "프로필", path: "/workspace/mobile/profile", icon: <User size={ICON.md} /> },
          ...(isOwnerOrAdmin ? [{ label: "결제 / 구독", path: "/workspace/mobile/billing", icon: <Award size={ICON.md} /> }] : []),
          ...(isOwnerOrAdmin ? [{ label: "학원 정보", path: "/workspace/mobile/settings/organization", icon: <Settings size={ICON.md} /> }] : []),
          { label: "테마", path: "/workspace/mobile/settings/appearance", icon: <Settings size={ICON.md} /> },
          { label: "설정", path: "/workspace/mobile/settings", icon: <Settings size={ICON.md} /> },
        ],
      },
      {
        title: "지원",
        items: [
          { label: "사용 가이드", path: "/workspace/mobile/guide", icon: <Info size={ICON.md} /> },
          { label: "학원 홈페이지", path: "/landing", icon: <Globe size={ICON.md} /> },
          { label: "도구", path: "/workspace/mobile/tools", icon: <Wrench size={ICON.md} /> },
          { label: "PC에서 처리하는 기능", path: "/workspace/mobile/desktop-only", icon: <Monitor size={ICON.md} /> },
          { label: "패치노트", path: "/workspace/mobile/developer", icon: <FileText size={ICON.md} /> },
          { label: "버그 제보", path: "/workspace/mobile/developer/bug", icon: <Bug size={ICON.md} /> },
          { label: "피드백", path: "/workspace/mobile/developer/feedback", icon: <MessageSquare size={ICON.md} /> },
        ],
      },
    ],
    [feesEnabled, isOwnerOrAdmin, recentSubmissions, totalNotifications],
  );

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

  const isActive = (path: string) => {
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
                    data-analytics-destination={item.path}
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
