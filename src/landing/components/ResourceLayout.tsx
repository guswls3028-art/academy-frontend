import type { ReactNode } from "react";
import { Link } from "react-router";
import styles from "../pages/PublicResources.module.css";

export default function ResourceLayout({ children }: { children: ReactNode }) {
  return <div className={styles.shell}>
    <header className={styles.header}>
      <Link to="/landing" className={styles.brand}>신과함께<span>공개 자료게시판</span></Link>
      <nav aria-label="자료게시판 메뉴"><Link to="/landing">홈페이지</Link><Link to="/login">로그인</Link></nav>
    </header>
    <main className={styles.main}>{children}</main>
    <footer className={styles.footer}>학생과 학부모님, 방문하신 모든 분이 로그인 없이 자료를 확인할 수 있습니다.</footer>
  </div>;
}

export function ResourceFailure({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className={styles.error} role="alert"><p>{message}</p>{onRetry && <button type="button" onClick={onRetry}>다시 시도</button>}</div>;
}
