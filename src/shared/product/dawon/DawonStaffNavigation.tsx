import { NavLink, useLocation } from "react-router";
import styles from "./DawonStaffNavigation.module.css";

import { staffMenus } from "./staffMenu";
import { BookOpen, CalendarCheck, ClipboardList, GraduationCap, LayoutDashboard, Settings, UserRound, UsersRound } from "lucide-react";

const icons = { dashboard: LayoutDashboard, lectures: BookOpen, "students/class-groups": UsersRound, "students/home": UserRound,
  staff: UsersRound, results: ClipboardList, exams: GraduationCap, "settings/profile": Settings } as const;

export function DawonStaffNavigation({role, onNavigate}: {role: "admin" | "teacher"; onNavigate?: () => void}) {
  const {pathname} = useLocation();
  return <nav aria-label="업무 메뉴" className={styles.nav}>
    {staffMenus[role].map((section, index) => {
      const links = section.items.map(([label,path]) => {
        const Icon = icons[path as keyof typeof icons] ?? CalendarCheck;
        return <NavLink key={path} onClick={onNavigate} to={`/workspace/${path}`}><Icon size={18} aria-hidden />{label}</NavLink>; });
      if (index === 0 || section.label === "환경 설정" || section.items.length === 1) return <section key={section.label}><h2>{section.label}</h2>{links}</section>;
      const active = section.items.some(([,path]) => pathname === `/workspace/${path.split("?")[0]}` || pathname.startsWith(`/workspace/${path.split("?")[0]}/`));
      return <details key={section.label} open={active || undefined}><summary>{section.label}</summary>{links}</details>;
    })}
  </nav>;
}
