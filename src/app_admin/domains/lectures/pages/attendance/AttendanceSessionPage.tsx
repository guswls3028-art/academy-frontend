import type { ReactNode } from "react";
import { Link } from "react-router";
import styles from "./AttendanceToolsPage.module.css";

type Props = {
  listPath: string;
  children: ReactNode;
  notice: ReactNode;
};

export default function AttendanceSessionPage({ listPath, children, notice }: Props) {
  return <section className={styles.page} aria-labelledby="attendance-sessions-title">
    <header className={styles.header}>
      <Link to={listPath}>← 출결 명단</Link>
      <h2 id="attendance-sessions-title">차시 선택</h2>
      <p>출결을 확인할 차시를 선택하세요. 정규 수업과 보강을 나눠 보거나, 차시를 추가하고 설정을 수정할 수 있습니다.</p>
    </header>
    {notice}
    {children}
  </section>;
}
