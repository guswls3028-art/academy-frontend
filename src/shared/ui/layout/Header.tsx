// PATH: src/shared/ui/layout/Header.tsx
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Dropdown, Input, Badge } from "antd";
import ThemeOverlay from "@/features/settings/overlays/ThemeOverlay";
import NoticeOverlay from "@/features/notice/overlays/NoticeOverlay";
import { useNotices } from "@/features/notice/context/NoticeContext";
import { useProgram } from "@/shared/program";
import { Button } from "@/shared/ui/ds";

type Crumb = { label: string; to?: string };

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

function stripAdminPrefix(pathname: string) {
  const p = pathname.split("?")[0] || "";
  if (p === "/admin") return "/";
  if (p.startsWith("/admin/")) return p.slice("/admin".length);
  return p;
}

function deriveCrumbs(pathname: string): Crumb[] {
  const p = stripAdminPrefix(pathname);
  if (p === "/" || p === "/dashboard") return [{ label: "대시보드" }];
  if (p.startsWith("/lectures")) return [{ label: "강의", to: "/admin/lectures" }];
  if (p.startsWith("/students")) return [{ label: "학생", to: "/admin/students" }];
  if (p.startsWith("/exams")) return [{ label: "시험", to: "/admin/exams" }];
  if (p.startsWith("/results")) return [{ label: "결과", to: "/admin/results" }];
  if (p.startsWith("/clinic")) return [{ label: "클리닉", to: "/admin/clinic" }];
  if (p.startsWith("/staff")) return [{ label: "직원", to: "/admin/staff" }];
  if (p.startsWith("/videos")) return [{ label: "영상", to: "/admin/videos" }];
  if (p.startsWith("/community"))
    return [{ label: "커뮤니티", to: "/admin/community" }];
  if (p.startsWith("/messages"))
    return [{ label: "메시지", to: "/admin/messages" }];
  if (p.startsWith("/profile"))
    return [{ label: "설정", to: "/admin/profile/account" }];
  return [{ label: "워크스페이스" }];
}

export default function Header() {
  const loc = useLocation();
  const nav = useNavigate();
  const crumbs = useMemo(() => deriveCrumbs(loc.pathname), [loc.pathname]);
  const { program } = useProgram();

  const [q, setQ] = useState("");
  const [openTheme, setOpenTheme] = useState(false);
  const [openNotice, setOpenNotice] = useState(false);
  const { unreadCount } = useNotices();

  const academyName = program?.display_name || "HakwonPlus";
  const logoUrl = program?.ui_config?.logo_url;

  const userMenu = {
    items: [
      { key: "profile", label: "내 계정 / 설정" },
      { key: "divider-1", type: "divider" as const },
      { key: "logout", label: "로그아웃" },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === "profile") nav("/admin/profile/account");
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
      <div className="app-header">
        {/* LEFT */}
        <div className="app-header__left">
          <Button
            intent="ghost"
            size="lg"
            iconOnly
            className="app-header__iconBtn"
            onClick={() => document.dispatchEvent(new Event("ui:sidebar:toggle"))}
            aria-label="사이드바 토글"
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

          <div className="app-header__crumbs">
            {crumbs.map((c, idx) => {
              const isLast = idx === crumbs.length - 1;
              return (
                <div
                  key={`${c.label}-${idx}`}
                  className={[
                    "app-header__crumb",
                    isLast ? "app-header__crumb--active" : "app-header__crumb--muted",
                  ].join(" ")}
                >
                  {c.to ? (
                    <span
                      style={{ cursor: "pointer" }}
                      onClick={() => nav(c.to!)}
                      title={c.label}
                    >
                      {c.label}
                    </span>
                  ) : (
                    <span title={c.label} style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.label}
                    </span>
                  )}

                  {!isLast && <span className="app-header__crumbSep">›</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTER */}
        <div className="app-header__center">
          <div style={{ width: "min(720px, 100%)" }}>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="전체 검색 (학생/강의/시험/클리닉/직원)…"
              allowClear
              prefix={
                <span style={{ color: "var(--color-text-muted)" }}>
                  <IconSearch />
                </span>
              }
              onPressEnter={() =>
                nav(`/admin/dashboard?search=${encodeURIComponent(q.trim())}`)
              }
              style={{
                borderRadius: 999,
                height: 40,
              }}
            />
          </div>
        </div>

        {/* RIGHT */}
        <div className="app-header__right">
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

          <Button
            intent="secondary"
            size="lg"
            iconOnly
            className="app-header__iconBtn"
            onClick={() => setOpenNotice(true)}
            aria-label="공지"
            leftIcon={
              <Badge count={unreadCount} size="small">
                <IconBell />
              </Badge>
            }
          />

          <Button
            intent="secondary"
            size="lg"
            iconOnly
            className="app-header__iconBtn"
            onClick={() => setOpenTheme(true)}
            aria-label="테마"
            leftIcon={<IconPalette />}
          />

          <Dropdown menu={userMenu} trigger={["click"]} placement="bottomRight">
            <span>
              <Button
                intent="secondary"
                size="lg"
                iconOnly
                className="app-header__iconBtn"
                aria-label="내 계정"
                leftIcon={<IconUser />}
              />
            </span>
          </Dropdown>
        </div>
      </div>

      {openTheme && <ThemeOverlay onClose={() => setOpenTheme(false)} />}
      {openNotice && <NoticeOverlay onClose={() => setOpenNotice(false)} />}
    </>
  );
}
