import { NavLink, useLocation } from "react-router";
import styles from "./DawonStaffNavigation.module.css";

const teacher = [
  { label: "수업 운영", items: [["수업 대시보드", "dashboard"], ["반별 강의", "lectures"], ["반 편성", "students/class-groups"], ["학생 명단", "students/home"]] },
  { label: "시험·성적", items: [["시험", "exams"], ["성적", "results"], ["성적취합", "students/surveys/school-reports"]] },
  { label: "클리닉·상담·알림", items: [["클리닉", "clinic/operations?panel=unresolved&focus=pending"], ["상담", "community/counsel"], ["학습 알림", "teacher-alerts"]] },
];
const admin = [{ label: "학원 운영", items: [["반 운영 현황", "dashboard"], ["직원 관리", "staff"], ["시험 결과", "results"]] }];

export function DawonStaffNavigation({role, onNavigate}: {role: "admin" | "teacher"; onNavigate?: () => void}) {
  const {pathname, search} = useLocation();
  const adminContext = new URLSearchParams();
  if (role === "admin") {
    const current = new URLSearchParams(search);
    for (const key of ["group", "course", "section"]) {
      const value = current.get(key);
      if (value) adminContext.set(key, value);
    }
  }
  const suffix = adminContext.size ? `?${adminContext}` : "";
  return <nav aria-label="업무 메뉴" className={styles.nav}>
    {(role === "admin" ? admin : teacher).map((section, index) => {
      const links = section.items.map(([label,path]) => <NavLink key={path} onClick={onNavigate} to={`/workspace/${path}${suffix}`}>{label}</NavLink>);
      if (index === 0) return <section key={section.label}><h2>{section.label}</h2>{links}</section>;
      const active = section.items.some(([,path]) => pathname === `/workspace/${path.split("?")[0]}` || pathname.startsWith(`/workspace/${path.split("?")[0]}/`));
      return <details key={section.label} open={active || undefined}><summary>{section.label}</summary>{links}</details>;
    })}
  </nav>;
}
