// PATH: src/shared/ui/layout/Header.tsx
import { useState, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Dropdown, Input, Badge } from "antd";
import ThemeOverlay from "@/features/settings/overlays/ThemeOverlay";
import NoticeOverlay from "@/features/notice/overlays/NoticeOverlay";
import { useNotices } from "@/features/notice/context/NoticeContext";
import { useProgram } from "@/shared/program";
import { useAdminLayout } from "@/shared/ui/layout/AdminLayoutContext";
import { useTeacherView } from "@/shared/ui/layout/TeacherViewContext";
import { Button } from "@/shared/ui/ds";
import { useMessagingInfo } from "@/features/messages/hooks/useMessagingInfo";
import { fetchMe, displayUsername } from "@/features/profile/api/profile.api";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";

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

function IconSearch() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M16.5 16.5 21 21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
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

function IconCredit() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12M8 10h8M8 14h8" />
    </svg>
  );
}

export default function Header() {
  const loc = useLocation();
  const nav = useNavigate();
  const adminLayout = useAdminLayout();
  const teacherView = useTeacherView();
  const isMobile = adminLayout != null;
  const { program } = useProgram();
  const { data: messagingInfo } = useMessagingInfo();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  const [searchParams] = useSearchParams();
  const searchFromUrl = searchParams.get("search") ?? "";
  const isOnDashboard = loc.pathname.includes("/dashboard");
  const [q, setQ] = useState(searchFromUrl);
  const [openTheme, setOpenTheme] = useState(false);

  useEffect(() => {
    if (isOnDashboard && searchFromUrl !== q) setQ(searchFromUrl);
  }, [isOnDashboard, searchFromUrl]);
  const [openNotice, setOpenNotice] = useState(false);
  const { unreadCount } = useNotices();









  // 브라우저 타이틀 동적 설정
  useDocumentTitle();

  // 학원 이름: Program의 display_name 사용
  const academyName = program?.display_name || "HakwonPlus";
  
  









  
  
  const logoUrl = program?.ui_config?.logo_url;

  const userMenu = {
    items: [
      { key: "settings", label: "설정" },
      { key: "divider-1", type: "divider" as const },
      { key: "logout", label: "로그아웃" },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === "settings") nav("/admin/settings");
      if (key === "logout") nav("/login");
    },
  };

  const quickMenu = {
    items: [
      { key: "student", label: "학생 등록" },
      { key: "lecture", label: "강의 생성" },
      { key: "exam", label: "시험 생성" },
      { key: "divider-1", type: "divider" as const },
      { key: "clinic", label: "클리닉 생성" },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === "student") nav("/admin/students");
      if (key === "lecture") nav("/admin/lectures");
      if (key === "exam") nav("/admin/exams");
      if (key === "clinic") nav("/admin/clinic");
    },
  };

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
              ) : (
                <span style={{ width: 8, height: 8, borderRadius: 999 }} />
              )}
            </span>
            <span className="app-header__brandName">{academyName}</span>
          </div>
        </div>

        {/* CENTER: 중앙 통합 검색창 */}
        {!isMobile && (
        <div className="app-header__center">
          <div className="app-header__searchWrap">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Q 전체 검색 (학생/강의/시험/클리닉/직원)…"
              allowClear
              prefix={
                <span style={{ color: "var(--color-text-muted)" }}>
                  <IconSearch />
                </span>
              }
              onPressEnter={() =>
                nav(`/admin/dashboard?search=${encodeURIComponent(q.trim())}`)
              }
              className="app-header__searchInput"
            />
          </div>
        </div>
        )}

        {/* RIGHT: 크레딧 | 만들기 | 모바일/PC | 알람 드롭다운 | 접속자 아바타+이름 */}
        <div className="app-header__right">
          {!isMobile && (
            <div className="app-header__credit" title="알림톡 크레딧">
              <span className="app-header__creditIcon"><IconCredit /></span>
              <span className="app-header__creditValue">
                {messagingInfo != null
                  ? Number(messagingInfo.credit_balance).toLocaleString()
                  : "0"}
              </span>
            </div>
          )}

          {!isMobile && (
          <Dropdown menu={quickMenu} trigger={["click"]} placement="bottomRight">
            <span>
              <Button
                intent="secondary"
                size="lg"
                className="app-header__menuBtn"
                leftIcon={<IconPlus />}
              >
                만들기
              </Button>
            </span>
          </Dropdown>
          )}

          {teacherView && (
            <Button
              intent="secondary"
              size="lg"
              iconOnly
              className="app-header__iconBtn"
              onClick={() => teacherView.setForceView(isMobile ? "desktop" : "mobile")}
              aria-label={isMobile ? "PC 버전으로 보기" : "모바일 버전으로 보기"}
              title={isMobile ? "PC 버전으로 보기" : "모바일 버전으로 보기"}
              leftIcon={isMobile ? <IconMonitor /> : <IconSmartphone />}
            />
          )}

          <Dropdown
            trigger={["click"]}
            placement="bottomRight"
            dropdownRender={() => (
              <div className="app-header__alarmDropdown">
                <div className="app-header__alarmDropdownHeader">
                  <span>알림</span>
                  <Button
                    type="button"
                    intent="ghost"
                    size="sm"
                    onClick={() => { setOpenNotice(true); }}
                  >
                    알림 전체 보기
                  </Button>
                </div>
                <div className="app-header__alarmDropdownList">
                  {notices.length === 0 ? (
                    <div className="app-header__alarmDropdownEmpty">알림이 없습니다</div>
                  ) : (
                    notices.slice(0, 5).map((n) => (
                      <div
                        key={n.id}
                        className="app-header__alarmDropdownItem"
                        onClick={() => setOpenNotice(true)}
                      >
                        <strong>{n.title}</strong>
                        {n.body && <span className="app-header__alarmDropdownItemBody">{n.body}</span>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          >
            <span>
              <Button
                intent="secondary"
                size="lg"
                iconOnly
                className="app-header__iconBtn"
                aria-label="알림"
                leftIcon={
                  <Badge count={unreadCount} size="small">
                    <IconBell />
                  </Badge>
                }
              />
            </span>
          </Dropdown>

          <Dropdown menu={userMenu} trigger={["click"]} placement="bottomRight">
            <span>
              <Button
                intent="secondary"
                size="lg"
                className="app-header__userBtn"
                aria-label="프로필"
                leftIcon={
                  me?.name || me?.username ? (
                    <span className="app-header__avatar" aria-hidden>
                      {(me.name || me.username || "?").slice(0, 1).toUpperCase()}
                    </span>
                  ) : (
                    <IconUser />
                  )
                }
              >
                {me?.name || me?.username ? displayUsername(me.username) || (me.name ?? "사용자") : "프로필"}
              </Button>
            </span>
          </Dropdown>
        </div>
      </div>

      {openTheme && <ThemeOverlay onClose={() => setOpenTheme(false)} />}
      {openNotice && <NoticeOverlay onClose={() => setOpenNotice(false)} />}
    </>
  );
}
