import { useEffect, type ReactNode } from "react";
import { useProgram } from "@/shared/program";
import { saveReturnPath } from "@/shared/api/axios";
import { Link } from "react-router";
import styles from "../pages/PublicResources.module.css";

export default function ResourceLayout({ children }: { children: ReactNode }) {
  const { program } = useProgram();
  const brand = program?.display_name || "학습 자료";
  useEffect(() => {
    const previous = document.title; document.title = `공개 자료게시판 | ${brand}`;
    return () => { document.title = previous; };
  }, [brand]);
  return <div className={styles.shell}>
    <header className={styles.header}>
      <Link to="/landing" className={styles.brand}>{brand}<span>공개 자료게시판</span></Link>
      <nav aria-label="자료게시판 메뉴"><Link to="/landing">홈페이지</Link><Link to="/login" onClick={() => saveReturnPath()}>로그인</Link></nav>
    </header>
    <main className={styles.main}>{children}</main>
    <footer className={styles.footer}>학생과 학부모님, 방문하신 모든 분이 로그인 없이 자료를 확인할 수 있습니다.</footer>
  </div>;
}

export function ResourceFailure({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className={styles.error} role="alert"><p>{message}</p>{onRetry && <button type="button" onClick={onRetry}>다시 시도</button>}</div>;
}
