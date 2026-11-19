import { NavLink } from "react-router";
import styles from "./DawonStaffNavigation.module.css";

const admin = [
  ["반 운영 현황", "dashboard"], ["직원 관리", "staff"], ["시험 결과", "results"],
];
const teacher = [
  ["수업 대시보드", "dashboard"], ["반별 강의", "lectures"], ["반 편성", "students/class-groups"],
  ["시험", "exams"], ["성적", "results"], ["클리닉", "clinic/operations"], ["상담", "community/counsel"],
  ["학습 알림", "teacher-alerts"],
];

export function DawonStaffNavigation({role}: {role: "admin" | "teacher"}) {
  return <nav aria-label="업무 메뉴" className={styles.nav}>
    {(role === "admin" ? admin : teacher).map(([label, path]) =>
      <NavLink key={path} to={`/workspace/${path}`}>{label}</NavLink>)}
  </nav>;
}
