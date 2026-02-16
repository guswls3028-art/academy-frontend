// PATH: src/shared/ui/layout/Header.tsx
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Dropdown, Input, Badge } from "antd";
import ThemeOverlay from "@/features/settings/overlays/ThemeOverlay";
import NoticeOverlay from "@/features/notice/overlays/NoticeOverlay";
import { useNotices } from "@/features/notice/context/NoticeContext";
import { useProgram } from "@/shared/program";
import { useAdminLayout } from "@/shared/ui/layout/AdminLayoutContext";
import { Button } from "@/shared/ui/ds";
import { fetchLecture, fetchSession } from "@/features/lectures/api/sessions";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";

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

/** pathname에서 lectureId, sessionId 추출 (useParams 대체 — AppLayout 수준에서 params 미전달 대응) */
function parseIdsFromPath(pathname: string): { lectureId: number; sessionId: number } {
  const p = (pathname || "").split("?")[0];
  const lectureMatch = p.match(/\/lectures\/(\d+)/);
  const sessionMatch = p.match(/\/sessions\/(\d+)/);
  return {
    lectureId: lectureMatch ? Number(lectureMatch[1]) : 0,
    sessionId: sessionMatch ? Number(sessionMatch[1]) : 0,
  };
}

const LECTURE_TAB_LABELS: Record<string, string> = {
  materials: "자료실",
  board: "게시판",
  ddays: "디데이",
  attendance: "출결",
  report: "리포트",
  sessions: "차시",
};

const SESSION_TAB_LABELS: Record<string, string> = {
  attendance: "출결",
  scores: "성적",
  exams: "시험",
  assignments: "과제",
  videos: "영상",
  materials: "자료",
};

function deriveCrumbs(
  pathname: string,
  lecture?: { title?: string } | null,
  session?: { title?: string } | null
): Crumb[] {
  const p = stripAdminPrefix(pathname);
  if (p === "/" || p === "/dashboard") return [{ label: "대시보드" }];

  if (p.startsWith("/lectures")) {
    const base: Crumb[] = [{ label: "강의", to: "/admin/lectures" }];
    const lectureMatch = p.match(/^\/lectures\/(\d+)/);
    if (!lectureMatch) return base;

    const lid = lectureMatch[1];
    const lectureLabel = lecture?.title ?? (lecture as any)?.name ?? "강의";
    base.push({ label: lectureLabel, to: `/admin/lectures/${lid}` });

    const sessionMatch = p.match(/^\/lectures\/\d+\/sessions\/(\d+)/);
    if (sessionMatch) {
      const sid = sessionMatch[1];
      const sessionLabel = session?.title ?? "차시";
      base.push({
        label: sessionLabel,
        to: `/admin/lectures/${lid}/sessions/${sid}`,
      });
      const tailMatch = p.match(/^\/lectures\/\d+\/sessions\/\d+\/(\w+)(?:\/|$)/);
      if (tailMatch) {
        const tab = tailMatch[1];
        const label = SESSION_TAB_LABELS[tab] ?? tab;
        base.push({ label }); // 현재 탭, 링크 없음
      }
    } else {
      const tailMatch = p.match(/^\/lectures\/\d+\/(\w+)(?:\/|$)/);
      if (tailMatch) {
        const tab = tailMatch[1];
        const label = LECTURE_TAB_LABELS[tab] ?? tab;
        base.push({ label }); // 현재 탭
      }
    }
    return base;
  }

  if (p.startsWith("/students")) return [{ label: "학생", to: "/admin/students" }];
  if (p.startsWith("/exams")) return [{ label: "시험", to: "/admin/exams" }];
  if (p.startsWith("/results")) return [{ label: "결과", to: "/admin/results" }];
  if (p.startsWith("/clinic")) return [{ label: "클리닉", to: "/admin/clinic" }];
  if (p.startsWith("/staff")) return [{ label: "직원", to: "/admin/staff" }];
  if (p.startsWith("/videos")) return [{ label: "영상", to: "/admin/videos" }];
  if (p.startsWith("/community"))
    return [{ label: "커뮤니티", to: "/admin/community" }];
  if (p.startsWith("/materials"))
    return [{ label: "자료실", to: "/admin/materials" }];
  if (p.startsWith("/message"))
    return [{ label: "메시지", to: "/admin/message" }];
  if (p.startsWith("/messages"))
    return [{ label: "메시지", to: "/admin/message" }];
  if (p.startsWith("/settings"))
    return [{ label: "시스템 설정", to: "/admin/settings" }];
  if (p.startsWith("/profile"))
    return [{ label: "내 계정", to: "/admin/profile/account" }];
  return [{ label: "워크스페이스" }];
}

export default function Header() {
  const loc = useLocation();
  const nav = useNavigate();
  const adminLayout = useAdminLayout();
  const isMobile = adminLayout != null;
  const { lectureId: lid, sessionId: sid } = parseIdsFromPath(loc.pathname);

  const { data: lecture } = useQuery({
    queryKey: ["lecture", lid],
    queryFn: () => fetchLecture(lid),
    enabled: Number.isFinite(lid) && lid > 0,
  });

  const { data: session } = useQuery({
    queryKey: ["session", sid],
    queryFn: () => fetchSession(sid),
    enabled: Number.isFinite(sid) && sid > 0,
  });

  const crumbs = useMemo(
    () => deriveCrumbs(loc.pathname, lecture, session),
    [loc.pathname, lecture, session]
  );
  const { program } = useProgram();

  const [q, setQ] = useState("");
  const [openTheme, setOpenTheme] = useState(false);
  const [openNotice, setOpenNotice] = useState(false);
  const { unreadCount } = useNotices();









  // 브라우저 타이틀 동적 설정
  useDocumentTitle();

  // 학원 이름: Program의 display_name 사용
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

          {!isMobile && (
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
            {lecture && (lid > 0) && (
              <div
                className="app-header__crumb app-header__crumb--muted"
                style={{ marginLeft: 8, paddingLeft: 8, borderLeft: "1px solid var(--color-border-divider)" }}
                title="현재 컨텍스트"
              >
                <span style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>
                  현재: {lecture.title ?? "강의"}
                  {session && sid > 0 ? ` · ${session.title ?? "차시"}` : ""}
                </span>
              </div>
            )}
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
