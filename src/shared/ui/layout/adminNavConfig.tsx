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
  /** true면 is_payroll_manager(관리자 권한 on)일 때만 메뉴 노출 */
  requiresStaffAdmin?: boolean;
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
      { to: `${ADMIN_NAV_BASE}/fees`, label: "수납", iconPath: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
      { to: `${ADMIN_NAV_BASE}/community`, label: "커뮤니티", iconPath: "M4 4h16v12H7l-3 3z" },
      { to: `${ADMIN_NAV_BASE}/tools`, label: "도구", iconPath: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" },
      { to: `${ADMIN_NAV_BASE}/staff`, label: "직원관리", iconPath: "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 8a7 7 0 0 1 14 0", requiresStaffAdmin: true },
    ],
  },
  {
    items: [
      { to: `${ADMIN_NAV_BASE}/guide`, label: "사용 가이드", iconPath: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M16 13H8M16 17H8M10 9H8" },
      { to: `${ADMIN_NAV_BASE}/settings`, label: "설정", iconPath: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" },
      { to: `${ADMIN_NAV_BASE}/developer`, label: "To개발자", iconPath: "M16 18l6-6-6-6M8 6l-6 6 6 6" },
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
