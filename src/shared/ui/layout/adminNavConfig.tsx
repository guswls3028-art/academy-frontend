/**
 * 선생앱(관리자) 사이드바/모바일 드로어 네비 공통 설정.
 * Sidebar.tsx, TeacherBottomBar, 모바일 Drawer에서 사용.
 */
export const ADMIN_NAV_BASE = "/admin";

export function NavIcon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type AdminNavItem = {
  to: string;
  label: string;
  iconPath: string;
};

export type AdminNavGroup = {
  title?: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    items: [
      { to: `${ADMIN_NAV_BASE}/dashboard`, label: "대시보드", iconPath: "M3 11l9-7 9 7v9H3z" },
      { to: `${ADMIN_NAV_BASE}/students`, label: "학생", iconPath: "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 8a7 7 0 0 1 14 0" },
      { to: `${ADMIN_NAV_BASE}/lectures`, label: "강의", iconPath: "M4 4h16v12H4zM8 20h8" },
      { to: `${ADMIN_NAV_BASE}/clinic`, label: "클리닉", iconPath: "M12 21s7-4 7-10a7 7 0 0 0-14 0c0 6 7 10 7 10Z" },
    ],
  },
  {
    items: [
      { to: `${ADMIN_NAV_BASE}/exams`, label: "시험", iconPath: "M7 3h10v18H7zM9 7h6M9 11h6M9 15h4" },
      { to: `${ADMIN_NAV_BASE}/results`, label: "성적", iconPath: "M4 18h16M6 15V9M12 15V5M18 15v-7" },
      { to: `${ADMIN_NAV_BASE}/videos`, label: "영상", iconPath: "M3 6h14v12H3zM17 10l4-2v8l-4-2z" },
      { to: `${ADMIN_NAV_BASE}/message`, label: "메시지", iconPath: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" },
      { to: `${ADMIN_NAV_BASE}/storage`, label: "저장소", iconPath: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" },
    ],
  },
  {
    items: [
      { to: `${ADMIN_NAV_BASE}/community`, label: "커뮤니티", iconPath: "M4 4h16v12H7l-3 3z" },
    ],
  },
  {
    items: [
      { to: `${ADMIN_NAV_BASE}/settings`, label: "설정", iconPath: "M12 15.5a3.5 3.5 0 1 0 0-7M19.4 15a8 8 0 0 0 0-6l2-1-2-4-2.3.5a8 8 0 0 0-3.4-2L11 1h-4l-.7 2.5a8 8 0 0 0-3.4 2L1.6 5l-2 4 2 1a8 8 0 0 0 0 6l-2 1 2 4 2.3-.5a8 8 0 0 0 3.4 2L7 23h4l.7-2.5a8 8 0 0 0 3.4-2l2.3.5 2-4Z" },
    ],
  },
];

/** 모바일 하단 탭에 노출할 항목 (경로, 라벨, 아이콘 path d) */
export const ADMIN_MOBILE_TABS: { to: string; label: string; iconPath: string }[] = [
  { to: `${ADMIN_NAV_BASE}/dashboard`, label: "홈", iconPath: "M3 11l9-7 9 7v9H3z" },
  { to: `${ADMIN_NAV_BASE}/students`, label: "학생", iconPath: "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 8a7 7 0 0 1 14 0" },
  { to: `${ADMIN_NAV_BASE}/lectures`, label: "강의", iconPath: "M4 4h16v12H4zM8 20h8" },
  { to: `${ADMIN_NAV_BASE}/community`, label: "커뮤니티", iconPath: "M4 4h16v12H7l-3 3z" },
  { to: "", label: "메뉴", iconPath: "M4 6h16M4 12h16M4 18h16" },
];
