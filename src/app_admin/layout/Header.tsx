// PATH: src/shared/ui/layout/Header.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Badge as AntBadge } from "antd";
import { AlertTriangle, RefreshCw, User as UserIcon, Settings as SettingsIcon, Bug, LogOut } from "lucide-react";
import NoticeOverlay from "@admin/domains/notice/overlays/NoticeOverlay";
import { useNotices } from "@admin/domains/notice/context/NoticeContext";
import { useAdminNotificationCounts, type AdminNotificationItem } from "@admin/domains/admin-notifications";
import { useProgram } from "@/shared/program";
import { useAdminLayout } from "@admin/layout/AdminLayoutContext";
import { useWorkbox } from "@/shared/ui/layout/WorkboxContext";
import { useAsyncStatus } from "@/shared/ui/asyncStatus/useAsyncStatus";
import { WorkboxPanelContent } from "@/shared/ui/asyncStatus";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { Button, Badge, ICON } from "@/shared/ui/ds";
import { fetchMe, displayUsername, meToStaffRole, type MeStaffRole } from "@admin/domains/profile/api/profile.api";
import { StaffRoleAvatar } from "@/shared/ui/avatars";
import { HeaderCenterStaffClock } from "@admin/domains/staff/components/HeaderCenterStaffClock";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { resolveTenantCode, getTenantIdFromCode, getTenantBranding } from "@/shared/tenant";
import useAuth from "@/auth/hooks/useAuth";
import TchulLogoIcon from "@/auth/assets/TchulLogoIcon";
import CommonLogoIcon from "@/auth/assets/CommonLogoIcon";
import { useTheme } from "@/shared/contexts/ThemeContext";
import { getThemeMeta } from "@admin/domains/settings/constants/themes";

function IconMenu() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 6h16M4 12h16M4 18h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSmartphone() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}

function IconMonitor() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 21a8 8 0 1 0-16 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPalette() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 22a10 10 0 1 1 7.07-17.07c1.38 1.38.43 3.74-1.52 3.74H15a3 3 0 0 0 0 6h1.56c1.62 0 2.66 1.72 1.86 3.14A10 10 0 0 1 12 22Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 10.5h0"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M10.5 7.5h0"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M13.5 7.5h0"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M16.5 10.5h0"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 도움말 아이콘 — 사용 가이드/개발자 문의 진입 */
function IconHelp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

/** 작업박스(진행 상황) 아이콘 */
function IconWorkbox() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="2" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}

/** 완료(체크) 아이콘 — 작업 모두 완료 시 */
function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

/** 네이티브 프로필 드롭다운 — Ant Design Dropdown 대신 직접 구현 (모바일 터치 호환) */
function ProfileDropdown({
  open,
  onToggle,
  onClose,
  content,
  ariaLabel,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  content: React.ReactNode;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // <button> 안에 children Button(<button>)을 넣으면 invalid HTML.
  // role="button" + tabIndex + onKeyDown 패턴으로 키보드 접근성 확보.
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        style={{ cursor: "pointer", display: "inline-flex", borderRadius: 8, outlineOffset: 2 }}
      >
        {children}
      </div>
      {open && (
        <div
          className="app-header__profileDropdownOverlay"
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            zIndex: 1050,
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}

/** 알림 항목 type → data-level 매핑 (헤더 알림 색상 톤) */
function alarmLevelFor(type: AdminNotificationItem["type"]): "info" | "warning" | "error" {
  if (type === "video_failed") return "error";
  if (type === "registration_requests" || type === "clinic") return "warning";
  return "info";
}

/** 직책 → 뱃지 톤 매핑 */
function staffRoleBadgeTone(role: MeStaffRole): "primary" | "success" | "info" {
  if (role === "owner") return "primary";
  if (role === "TEACHER") return "success";
  return "info";
}

const STAFF_ROLE_LABEL: Record<MeStaffRole, string> = {
  owner: "대표",
  TEACHER: "강사",
  ASSISTANT: "조교",
};

export default function Header() {
  const loc = useLocation();
  const nav = useNavigate();
  const adminLayout = useAdminLayout();
  const isMobile = adminLayout != null;
  const { program } = useProgram();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const { clearAuth } = useAuth();

  const [openNotice, setOpenNotice] = useState(false);
  const [alarmDropdownOpen, setAlarmDropdownOpen] = useState(false);
  const [helpDropdownOpen, setHelpDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const workbox = useWorkbox();
  const tasks = useAsyncStatus();
  const currentTenantKey = getTenantCodeForApiRequest() ?? "";
  const displayTasks = tasks.filter((t) => (t.tenantScope ?? "") === currentTenantKey);
  const pendingCount = displayTasks.filter((t) => t.status === "pending").length;
  const errorCount = displayTasks.filter((t) => t.status === "error").length;
  const hasCompletedOnly = pendingCount === 0 && displayTasks.length > 0;
  const hasOnlySuccessCompleted = hasCompletedOnly && errorCount === 0;

  // 자동 clearCompleted 제거: 사용자가 결과를 보기 전에 비워지지 않도록.
  // 명시적 "완료된 항목 지우기" 버튼(AsyncStatusBar.tsx)으로만 제거.
  const handleWorkboxOpenChange = (open: boolean) => {
    workbox?.setWorkboxOpen(open);
  };
  const {
    counts: adminCounts,
    items: adminNotificationItems,
    failures: adminNotificationFailures,
    isFetching: adminNotificationsFetching,
    refetch: refetchAdminNotifications,
  } = useAdminNotificationCounts();
  const unreadCount = adminCounts.total;
  const hasNotificationFailures = adminNotificationFailures.length > 0;

  const { notices } = useNotices();
  const openNoticeAndCloseAlarm = () => {
    setAlarmDropdownOpen(false);
    setOpenNotice(true);
  };









  // 브라우저 타이틀 동적 설정
  useDocumentTitle();

  // 학원 이름: Program의 display_name 사용
  const academyName = program?.display_name || "HakwonPlus";
  
  









  
  
  // 로고 URL: Program의 ui_config.logo_url 우선, 없으면 테넌트별 기본 로고 사용
  const tenantResult = resolveTenantCode();
  const tenantId = tenantResult.ok ? getTenantIdFromCode(tenantResult.code) : null;
  const isTchul = tenantResult.ok && (tenantResult.code === "tchul" || tenantId === 2);
  const tenantBranding = tenantId ? getTenantBranding(tenantId) : null;

  const { theme } = useTheme();
  const isDarkTheme = getThemeMeta(theme).group === "DARK";

  const logoUrl = program?.ui_config?.logo_url ?? null;
  // 커스텀 헤더 로고: tenant branding의 headerLogoUrl (아이콘 전용 크롭), 다크 테마 시 dark 변형 우선
  const headerLogoUrl = isDarkTheme
    ? (tenantBranding?.headerLogoDarkUrl ?? tenantBranding?.headerLogoUrl ?? null)
    : (tenantBranding?.headerLogoUrl ?? null);

  const userMenu = {
    onClick: ({ key }: { key: string }) => {
      setProfileDropdownOpen(false);
      if (key === "profile") nav("/admin/settings/profile");
      if (key === "settings") nav("/admin/settings");
      if (key === "bugreport") {
        document.dispatchEvent(new Event("ui:bugreport:open"));
        return;
      }
      if (key === "logout") {
        clearAuth();
        nav("/login");
      }
    },
  };

  const meStaffRole = me ? meToStaffRole(me) : null;
  const meDisplayName =
    me?.name?.trim() || (me?.username ? displayUsername(me.username) : "") || "사용자";
  const meSubLabel = me?.username ? displayUsername(me.username) : "";

  const profileDropdownContent = (
    <div className="ds-header-dropdown app-header__profileDropdown" role="menu">
      {me && (
        <>
          <div className="app-header__profileDropdownUserCard">
            <div className="app-header__profileDropdownUserCard-avatar" aria-hidden>
              <StaffRoleAvatar role={meStaffRole ?? "ASSISTANT"} size={ICON.lg} />
            </div>
            <div className="app-header__profileDropdownUserCard-body">
              <div className="app-header__profileDropdownUserCard-nameRow">
                <span className="app-header__profileDropdownUserCard-name">{meDisplayName}</span>
                {meStaffRole && (
                  <Badge tone={staffRoleBadgeTone(meStaffRole)} size="sm" variant="soft">
                    {STAFF_ROLE_LABEL[meStaffRole]}
                  </Badge>
                )}
              </div>
              {meSubLabel && (
                <div className="app-header__profileDropdownUserCard-meta">{meSubLabel}</div>
              )}
              {academyName && (
                <div className="app-header__profileDropdownUserCard-meta">{academyName}</div>
              )}
            </div>
          </div>
          <div className="app-header__profileDropdownDivider" />
        </>
      )}
      <button type="button" role="menuitem" className="app-header__profileDropdownItem" onClick={() => userMenu.onClick({ key: "profile" })}>
        <UserIcon size={ICON.sm} aria-hidden />
        <span>내 프로필</span>
      </button>
      <button type="button" role="menuitem" className="app-header__profileDropdownItem" onClick={() => userMenu.onClick({ key: "settings" })}>
        <SettingsIcon size={ICON.sm} aria-hidden />
        <span>학원/시스템 설정</span>
      </button>
      <div className="app-header__profileDropdownDivider" />
      <button type="button" role="menuitem" className="app-header__profileDropdownItem" onClick={() => userMenu.onClick({ key: "bugreport" })}>
        <Bug size={ICON.sm} aria-hidden />
        <span>문제 신고</span>
      </button>
      <div className="app-header__profileDropdownDivider" />
      <button type="button" role="menuitem" className="app-header__profileDropdownItem app-header__profileDropdownItem--danger" onClick={() => userMenu.onClick({ key: "logout" })}>
        <LogOut size={ICON.sm} aria-hidden />
        <span>로그아웃</span>
      </button>
    </div>
  );

  return (
    <>
      <div className="app-header" data-mobile={isMobile || undefined}>
        {/* LEFT */}
        <div className="app-header__left">
          <Button
            intent="ghost"
            size="lg"
            iconOnly
            className="app-header__iconBtn"
            onClick={() =>
              isMobile
                ? adminLayout?.openDrawer()
                : document.dispatchEvent(new Event("ui:sidebar:toggle"))
            }
            aria-label={isMobile ? "메뉴 열기" : "사이드바 토글"}
            leftIcon={<IconMenu />}
          />

          <div className="app-header__brand">
            <span className="app-header__brandMark" aria-hidden>
              {logoUrl ? (
                <img src={logoUrl} alt="logo" />
              ) : headerLogoUrl ? (
                <img src={headerLogoUrl} alt="logo" style={{ height: 24, width: "auto" }} />
              ) : isTchul ? (
                <TchulLogoIcon height={24} />
              ) : (
                <CommonLogoIcon
                  height={24}
                  style={{ color: "var(--color-primary)" }}
                />
              )}
            </span>
            <span className="app-header__brandName">{academyName}</span>
          </div>
        </div>

        {/* CENTER: 근무 중인 직원 아바타 + 총근무시간 + 출근/퇴근 */}
        {!isMobile && (
          <div className="app-header__center">
            <HeaderCenterStaffClock />
          </div>
        )}

        {/* RIGHT: 알람 | 프로필 */}
        <div className="app-header__right">

          {workbox && (
            <ProfileDropdown
              open={workbox.workboxOpen}
              onToggle={() => handleWorkboxOpenChange(!workbox.workboxOpen)}
              onClose={() => handleWorkboxOpenChange(false)}
              ariaLabel="작업박스"
              content={
                <div className="ds-header-dropdown app-header__alarmDropdown alarm-panel--workbox-style">
                  <WorkboxPanelContent onClose={() => workbox.setWorkboxOpen(false)} />
                </div>
              }
            >
                <Button
                  intent="secondary"
                  size="lg"
                  iconOnly
                  className={`app-header__iconBtn app-header__workboxBtn ${hasOnlySuccessCompleted ? "app-header__workboxBtn--done" : ""} ${errorCount > 0 ? "app-header__iconBtn--danger" : ""}`}
                  aria-label={
                    workbox.workboxOpen
                      ? "작업박스 닫기"
                      : errorCount > 0
                        ? `작업박스 (실패 ${errorCount}건)`
                        : "작업박스 열기"
                  }
                  title={
                    workbox.workboxOpen
                      ? "작업박스 닫기"
                      : errorCount > 0
                        ? `작업박스 — 실패 ${errorCount}건`
                        : "작업박스"
                  }
                  leftIcon={
                    errorCount > 0 ? (
                      <AntBadge count={errorCount} size="small" offset={[-2, 2]}>
                        <IconWorkbox />
                      </AntBadge>
                    ) : hasOnlySuccessCompleted ? (
                      <IconCheck />
                    ) : pendingCount > 0 ? (
                      <AntBadge count={pendingCount} size="small" offset={[-2, 2]}>
                        <IconWorkbox />
                      </AntBadge>
                    ) : (
                      <IconWorkbox />
                    )
                  }
                />
            </ProfileDropdown>
          )}

          <ProfileDropdown
            open={alarmDropdownOpen}
            onToggle={() => setAlarmDropdownOpen((v) => !v)}
            onClose={() => setAlarmDropdownOpen(false)}
            ariaLabel={hasNotificationFailures ? "알림 (일부 로드 실패)" : "알림"}
            content={
              <div className="ds-header-dropdown app-header__alarmDropdown alarm-panel--workbox-style">
                <div className="alarm-panel__header">
                  <span className="alarm-panel__header-title">
                    <span>알림</span>
                    {hasNotificationFailures && (
                      <span
                        className="alarm-panel__header-warning"
                        title={`일부 알림을 불러오지 못했습니다 (${adminNotificationFailures.length}/6). 다시 불러오기를 눌러주세요.`}
                        aria-label={`일부 알림 로드 실패 ${adminNotificationFailures.length}건`}
                      >
                        <AlertTriangle size={ICON.sm} aria-hidden />
                      </span>
                    )}
                  </span>
                  <span className="alarm-panel__header-actions">
                    <button
                      type="button"
                      className="alarm-panel__header-iconbtn"
                      onClick={() => refetchAdminNotifications()}
                      disabled={adminNotificationsFetching}
                      title="다시 불러오기"
                      aria-label="다시 불러오기"
                    >
                      <RefreshCw
                        size={ICON.sm}
                        className={adminNotificationsFetching ? "alarm-panel__header-iconbtn--spin" : undefined}
                        aria-hidden
                      />
                    </button>
                    <button
                      type="button"
                      className="alarm-panel__header-link"
                      onClick={openNoticeAndCloseAlarm}
                    >
                      공지사항 보기
                    </button>
                  </span>
                </div>
                <div className="alarm-panel__list">
                  {hasNotificationFailures && adminNotificationItems.length === 0 ? (
                    <div className="alarm-panel__empty alarm-panel__empty--warning">
                      일부 알림을 불러오지 못했습니다. 다시 불러오기를 눌러주세요.
                    </div>
                  ) : adminNotificationItems.length === 0 ? (
                    <div className="alarm-panel__empty">알림이 없습니다</div>
                  ) : (
                    adminNotificationItems.map((item) => (
                      <div
                        key={item.type}
                        className="alarm-panel__item"
                        data-level={alarmLevelFor(item.type)}
                        onClick={() => {
                          setAlarmDropdownOpen(false);
                          nav(item.to);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setAlarmDropdownOpen(false);
                            nav(item.to);
                          }
                        }}
                      >
                        <div className="alarm-panel__item-row">
                          <span className="alarm-panel__item-accent" aria-hidden />
                          <div className="alarm-panel__item-body">
                            <div className="alarm-panel__item-content">
                              <strong>{item.label}</strong>
                              <span className="alarm-panel__item-meta">{item.count}건</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            }
          >
              <Button
                intent="secondary"
                size="lg"
                iconOnly
                className={`app-header__iconBtn ${hasNotificationFailures ? "app-header__iconBtn--warning" : ""}`}
                aria-label={hasNotificationFailures ? "알림 (일부 로드 실패)" : "알림"}
                title={hasNotificationFailures ? "일부 알림을 불러오지 못했습니다" : "알림"}
                leftIcon={
                  <AntBadge
                    count={unreadCount}
                    size="small"
                    dot={hasNotificationFailures && unreadCount === 0}
                  >
                    <IconBell />
                  </AntBadge>
                }
              />
          </ProfileDropdown>

          <ProfileDropdown
            open={helpDropdownOpen}
            onToggle={() => setHelpDropdownOpen((v) => !v)}
            onClose={() => setHelpDropdownOpen(false)}
            ariaLabel="도움말"
            content={
              <div className="ds-header-dropdown app-header__profileDropdown" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="app-header__profileDropdownItem"
                  onClick={() => {
                    setHelpDropdownOpen(false);
                    nav("/admin/guide");
                  }}
                >
                  사용 가이드
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="app-header__profileDropdownItem"
                  onClick={() => {
                    setHelpDropdownOpen(false);
                    nav("/admin/developer");
                  }}
                >
                  개발자 문의
                </button>
              </div>
            }
          >
            <Button
              intent="secondary"
              size="lg"
              iconOnly
              className="app-header__iconBtn"
              aria-label="도움말"
              title="도움말"
              leftIcon={<IconHelp />}
            />
          </ProfileDropdown>

          <ProfileDropdown
            open={profileDropdownOpen}
            onToggle={() => setProfileDropdownOpen((v) => !v)}
            onClose={() => setProfileDropdownOpen(false)}
            ariaLabel="프로필 메뉴"
            content={profileDropdownContent}
          >
            <Button
              intent="secondary"
              size="lg"
              className="app-header__userBtn"
              aria-label="프로필"
              leftIcon={
                me ? (
                  <StaffRoleAvatar
                    role={meToStaffRole(me)}
                    size={16}
                    className="text-[var(--color-text-secondary)]"
                  />
                ) : (
                  <IconUser />
                )
              }
            >
              {me?.name || me?.username ? (me.name || displayUsername(me.username) || "사용자") : "프로필"}
            </Button>
          </ProfileDropdown>
        </div>
      </div>

      {openNotice && <NoticeOverlay onClose={() => setOpenNotice(false)} />}
    </>
  );
}
