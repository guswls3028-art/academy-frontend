import { Badge } from "antd";
import { Link, NavLink, useLocation } from "react-router";
import { useAlertSummary } from "./alertQueue";
import styles from "./DawonStaffNavigation.module.css";

import { staffMenus } from "./staffMenu";
import { BookOpen, CalendarCheck, ClipboardList, GraduationCap, LayoutDashboard, Settings, UserRound, UsersRound } from "lucide-react";

const icons = { dashboard: LayoutDashboard, lectures: BookOpen, "students/class-groups": UsersRound, "students/home": UserRound,
  staff: UsersRound, results: ClipboardList, exams: GraduationCap, "settings/profile": Settings } as const;

export function DawonStaffNavigation({role, onNavigate}: {role: "admin" | "teacher"; onNavigate?: () => void}) {
  const {pathname, search} = useLocation();
  const summary = useAlertSummary(role);
  const pending = summary.data?.pending ?? 0;
  const badge = pending > 0 ? <span className={styles.count} aria-label={`미처리 경보 ${pending}건`}><Badge count={pending} overflowCount={99} size="small"/></span> : null;
  if (role === "admin") {
    const params = new URLSearchParams(search);
    const current = pathname === "/workspace/dashboard" ? params.get("panel") : null;
    return <nav aria-label="업무 메뉴" className={styles.adminNav}>
      {staffMenus.admin.map(section=><section key={section.label}>
        <h2>{section.label}</h2>
        {section.items.map(([label, path])=>{
          const [base, filter] = path.split("?");
          const panel = new URLSearchParams(filter).get("panel");
          const active = base === "dashboard" ? pathname === "/workspace/dashboard" && (current === panel || (!panel && current === "attendance")) :
            base === "students/home" ? ["/workspace/students/home","/workspace/students/class-groups"].includes(pathname) :
            base === "settings/profile" ? pathname.startsWith("/workspace/settings/") :
            pathname === "/workspace/"+base || pathname.startsWith("/workspace/"+base+"/");
          const Icon = icons[path as keyof typeof icons] ?? CalendarCheck;
          return <Link key={path} onClick={onNavigate} to={"/workspace/"+path} aria-current={active ? "page" : undefined}>
            <Icon size={16} aria-hidden/>{label}{panel === "alerts" && badge}</Link>;
        })}
      </section>)}
    </nav>;
  }
  return <nav aria-label="업무 메뉴" className={styles.nav}>
    {staffMenus[role].map((section, index) => {
      const links = section.items.map(([label,path]) => {
        const Icon = icons[path as keyof typeof icons] ?? CalendarCheck;
        return <NavLink key={path} onClick={onNavigate} to={`/workspace/${path}`}><Icon size={18} aria-hidden />{label}{path === "teacher-alerts" && badge}</NavLink>; });
      if (index === 0 || section.label === "환경 설정" || section.items.length === 1) return <section key={section.label}><h2>{section.label}</h2>{links}</section>;
      const active = section.items.some(([,path]) => pathname === `/workspace/${path.split("?")[0]}` || pathname.startsWith(`/workspace/${path.split("?")[0]}/`));
      return <details key={section.label} open={active || undefined}><summary>{section.label}{!active && section.items.some(([,path])=>path==="teacher-alerts") && <span className={styles.closedBadge}>{badge}</span>}</summary>{links}</details>;
    })}
  </nav>;
}
