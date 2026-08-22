// PATH: src/shared/ui/layout/Header.tsx
//
// 헤더 레이아웃은 design-system/patterns/header.css의 app-header 패턴을 SSOT로 사용.
import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge as AntBadge } from "antd";
import {
  AlertTriangle,
  RefreshCw,
  User as UserIcon,
  Settings as SettingsIcon,
  Bug,
  LogOut,
  Globe as GlobeIcon,
  Menu as MenuIcon,
  Bell as BellIcon,
  Inbox as InboxIcon,
  Check as CheckIcon,
  Search as SearchIcon,
  Sparkles,
} from "lucide-react";
import { useAdminNotificationCounts, type AdminNotificationItem } from "@admin/domains/admin-notifications";
import { useProgram } from "@/shared/program";
import { useAdminLayout } from "@admin/layout/useAdminLayout";
import { useWorkbox } from "@/shared/ui/layout/useWorkbox";
import { useAsyncStatus } from "@/shared/ui/asyncStatus/useAsyncStatus";
import { WorkboxPanelContent } from "@/shared/ui/asyncStatus";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { accountQueryKeys } from "@/shared/api/queryKeys/account";
import { Button, Badge, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { fetchMe, displayUsername, meToStaffRole, type MeStaffRole } from "@admin/domains/profile/api/profile.api";
import { StaffRoleAvatar } from "@/shared/ui/avatars";
import { HeaderCenterStaffClock } from "@admin/domains/staff/components/HeaderCenterStaffClock";
import CompactStaffClockButton from "@/features/staff-clock/CompactStaffClockButton";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import {
  resolveTenantCode,
  getTenantIdFromCode,
  getTenantBranding,
  getTenantHeaderCssVars,
} from "@/shared/tenant";
import useAuth from "@/auth/hooks/useAuth";
import TchulLogoIcon from "@/auth/assets/TchulLogoIcon";
import CommonLogoIcon from "@/auth/assets/CommonLogoIcon";
import { useTheme } from "@/shared/contexts/ThemeContext";
import { getThemeMeta } from "@/shared/theme/themes";
import { GuideBookLauncher, getGuideBookPreset } from "@/shared/ui/guide";
import { useProductUpdateAwareness } from "@/shared/product/useProductUpdateAwareness";

const NoticeOverlay = lazy(() => import("@admin/domains/notice/overlays/NoticeOverlay"));
const ADMIN_GUIDE_BOOK = getGuideBookPreset("admin");

/** 네이티브 프로필 드롭다운 — Ant Design Dropdown 대신 직접 구현 (모바일 터치 호환) */
function ProfileDropdown({
  open,
  onToggle,
  onClose,
  content,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  content: React.ReactNode;
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

  // 실제 children Button이 키보드/ARIA 트리거를 소유한다.
  // 이 래퍼는 메뉴 위치와 바깥 클릭 경계만 담당한다.
  return (
    <div ref={ref} className="app-header__profileDropdown">
      <div
        className="app-header__profileDropdownTrigger"
        onClick={onToggle}
      >
        {children}
      </div>
      {open && (
        <div
          className="app-header__profileDropdownOverlay"
          role="menu"
        >
          {content}
        </div>
      )}
    </div>
  );
}

/** 알림 항목 type → data-level 매핑 (헤더 알림 색상 톤) */
function alarmLevelFor(type: AdminNotificationItem["type"]): "info" | "warning" | "error" {
  if (type === "video_failed" || type === "arrivals_overdue") return "error";
  if (
    type === "registration_requests"
    || type === "clinic"
    || type === "arrivals_soon"
    || type === "arrivals_tomorrow"
  ) return "warning";
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

export default function Header({ onOpenQuickNavigation }: { onOpenQuickNavigation: () => void }) {
  const nav = useNavigate();
  const adminLayout = useAdminLayout();
  const isMobile = adminLayout != null;
  const { program } = useProgram();
  const meQ = useQuery({ queryKey: accountQueryKeys.me, queryFn: fetchMe });
  const me = meQ.data;
  const { clearAuth, user } = useAuth();

  const [openNotice, setOpenNotice] = useState(false);
  const [alarmDropdownOpen, setAlarmDropdownOpen] = useState(false);
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
  const productUpdate = useProductUpdateAwareness(user?.id);
  const unreadCount = adminCounts.total + (productUpdate.isUnread ? 1 : 0);
  const hasNotificationFailures = adminNotificationFailures.length > 0;

  const openNoticeAndCloseAlarm = () => {
    setAlarmDropdownOpen(false);
    setOpenNotice(true);
  };

  const openLatestProductUpdate = () => {
    productUpdate.markRead();
    setAlarmDropdownOpen(false);
    const nextWindow = window.open(productUpdate.href, "_blank", "noopener,noreferrer");
    if (nextWindow) nextWindow.opener = null;
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
  const headerBrandStyle = getTenantHeaderCssVars(tenantBranding);
  // 배경이 포함된 브랜드 에셋은 등록된 헤더용 크롭을 우선해 정사각형 원본 노출을 피한다.
  const brandLogoUrl = headerBrandStyle ? (headerLogoUrl ?? logoUrl) : (logoUrl ?? headerLogoUrl);

  const userMenu = {
    onClick: ({ key }: { key: string }) => {
      setProfileDropdownOpen(false);
      if (key === "profile") nav("/workspace/settings/profile");
      if (key === "settings") nav("/workspace/settings");
      if (key === "landing") {
        // 같은 탭 — 로그인 토큰은 same-origin 자동 유지. 학원장이 자기 도메인 랜딩 즉시 확인.
        window.location.assign("/landing");
        return;
      }
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
      {meQ.isError && (
        <div className="alarm-panel__empty alarm-panel__empty--warning" role="alert">
          프로필 정보를 불러오지 못했습니다.
          <button type="button" onClick={() => void meQ.refetch()}>다시 시도</button>
        </div>
      )}
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
      <button type="button" role="menuitem" className="app-header__profileDropdownItem" onClick={() => userMenu.onClick({ key: "landing" })}>
        <GlobeIcon size={ICON.sm} aria-hidden />
        <span>우리 학원 홈페이지</span>
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
            intent="secondary"
            size="lg"
            iconOnly
            className="app-header__iconBtn"
            onClick={() =>
              isMobile
                ? adminLayout?.openDrawer()
                : document.dispatchEvent(new Event("ui:sidebar:toggle"))
            }
            aria-label={isMobile ? "메뉴 열기" : "사이드바 토글"}
            leftIcon={<MenuIcon size={ICON_FOR_BUTTON.lg} aria-hidden />}
          />

          <button
            type="button"
            className="app-header__brand"
            data-testid="app-header-go-dashboard"
            data-tenant-header-brand={headerBrandStyle ? "" : undefined}
            style={headerBrandStyle as React.CSSProperties | undefined}
            title={`${academyName} 대시보드`}
            aria-label={`${academyName} 대시보드로 이동`}
            onClick={() => nav("/workspace/dashboard")}
          >
            <span className="app-header__brandMark" aria-hidden>
              {brandLogoUrl ? (
                <img
                  className={headerBrandStyle ? "app-header__brandLogo--blended" : undefined}
                  src={brandLogoUrl}
                  alt="logo"
                />
              ) : isTchul ? (
                <TchulLogoIcon height={24} />
              ) : (
                <CommonLogoIcon
                  height={24}
                  color="var(--color-primary)"
                />
              )}
            </span>
            <span className="app-header__brandName">{academyName}</span>
          </button>
        </div>

        {/* CENTER: 근무 중인 직원 아바타 + 총근무시간 + 출근/퇴근 */}
        {!isMobile && (
          <div className="app-header__center">
            <HeaderCenterStaffClock />
          </div>
        )}

        {/* RIGHT: 알람 | 프로필 */}
        <div className="app-header__right">

          {isMobile && <CompactStaffClockButton />}

          {!isMobile && (
            <Button
              intent="secondary"
              size="lg"
              className="app-header__quickNavigationBtn"
              onClick={onOpenQuickNavigation}
              aria-label="빠른 이동"
              aria-keyshortcuts="Control+K Meta+K"
              title="빠른 이동 (Ctrl+K)"
              leftIcon={<SearchIcon size={ICON_FOR_BUTTON.md} aria-hidden />}
            >
              <span>빠른 이동</span>
              <kbd aria-hidden>Ctrl K</kbd>
            </Button>
          )}

          {workbox && (
            <ProfileDropdown
              open={workbox.workboxOpen}
              onToggle={() => handleWorkboxOpenChange(!workbox.workboxOpen)}
              onClose={() => handleWorkboxOpenChange(false)}
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
                  aria-expanded={workbox.workboxOpen}
                  aria-haspopup="menu"
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
                        <InboxIcon size={ICON_FOR_BUTTON.lg} aria-hidden />
                      </AntBadge>
                    ) : hasOnlySuccessCompleted ? (
                      <CheckIcon size={ICON_FOR_BUTTON.lg} aria-hidden />
                    ) : pendingCount > 0 ? (
                      <AntBadge count={pendingCount} size="small" offset={[-2, 2]}>
                        <InboxIcon size={ICON_FOR_BUTTON.lg} aria-hidden />
                      </AntBadge>
                    ) : (
                      <InboxIcon size={ICON_FOR_BUTTON.lg} aria-hidden />
                    )
                  }
                />
            </ProfileDropdown>
          )}

          <ProfileDropdown
            open={alarmDropdownOpen}
            onToggle={() => setAlarmDropdownOpen((v) => !v)}
            onClose={() => setAlarmDropdownOpen(false)}
            content={
              <div className="ds-header-dropdown app-header__alarmDropdown alarm-panel--workbox-style">
                <div className="alarm-panel__header">
                  <span className="alarm-panel__header-title">
                    <span>알림</span>
                    {hasNotificationFailures && (
                      <span
                        className="alarm-panel__header-warning"
                        title={`일부 알림을 불러오지 못했습니다 (${adminNotificationFailures.length}개 항목). 다시 불러오기를 눌러주세요.`}
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
                  <button
                    type="button"
                    className="alarm-panel__product-update"
                    data-unread={productUpdate.isUnread || undefined}
                    onClick={openLatestProductUpdate}
                  >
                    <span className="alarm-panel__product-update-icon" aria-hidden>
                      <Sparkles size={ICON.sm} />
                    </span>
                    <span className="alarm-panel__product-update-copy">
                      <span>
                        {productUpdate.isUnread ? "새 업데이트" : "최신 업데이트"}
                        <small>{productUpdate.latest.date}</small>
                      </span>
                      <strong>{productUpdate.latest.title}</strong>
                      <small>클릭해서 달라진 기능과 사용 범위를 확인하세요.</small>
                    </span>
                  </button>
                  {hasNotificationFailures && adminNotificationItems.length === 0 ? (
                    <div className="alarm-panel__empty alarm-panel__empty--warning">
                      일부 알림을 불러오지 못했습니다. 다시 불러오기를 눌러주세요.
                    </div>
                  ) : adminNotificationItems.length === 0 ? (
                    <div className="alarm-panel__empty">처리할 업무 알림이 없습니다</div>
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
                aria-expanded={alarmDropdownOpen}
                aria-haspopup="menu"
                title={hasNotificationFailures ? "일부 알림을 불러오지 못했습니다" : "알림"}
                leftIcon={
                  <AntBadge
                    count={unreadCount}
                    size="small"
                    dot={hasNotificationFailures && unreadCount === 0}
                  >
                    <BellIcon size={ICON_FOR_BUTTON.lg} aria-hidden />
                  </AntBadge>
                }
              />
          </ProfileDropdown>

          <GuideBookLauncher
            preset={ADMIN_GUIDE_BOOK}
            tone="admin"
            buttonClassName="app-header__iconBtn"
            iconSize={ICON_FOR_BUTTON.lg}
            ariaLabel="가이드북"
            onNavigate={nav}
            supportAction={{
              label: "문제 신고",
              onClick: () => document.dispatchEvent(new Event("ui:bugreport:open")),
            }}
          />

          <ProfileDropdown
            open={profileDropdownOpen}
            onToggle={() => setProfileDropdownOpen((v) => !v)}
            onClose={() => setProfileDropdownOpen(false)}
            content={profileDropdownContent}
          >
            <Button
              intent="secondary"
              size="lg"
              className="app-header__userBtn"
              aria-label="프로필 메뉴"
              aria-expanded={profileDropdownOpen}
              aria-haspopup="menu"
              leftIcon={
                me ? (
                  <StaffRoleAvatar
                    role={meToStaffRole(me)}
                    size={ICON.md}
                    className="text-[var(--color-text-secondary)]"
                  />
                ) : (
                  <UserIcon size={ICON.md} aria-hidden />
                )
              }
            >
              {meQ.isLoading ? "확인 중…" : meQ.isError ? "프로필 오류" : me?.name || me?.username ? (me.name || displayUsername(me.username) || "사용자") : "프로필"}
            </Button>
          </ProfileDropdown>
        </div>
      </div>

      {openNotice && (
        <Suspense fallback={null}>
          <NoticeOverlay onClose={() => setOpenNotice(false)} />
        </Suspense>
      )}
    </>
  );
}
