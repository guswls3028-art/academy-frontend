import { Link, useLocation } from "react-router";
import useAuth from "@/auth/hooks/useAuth";
import { saveReturnPath } from "@/shared/api/axios";
import { useVideoPublisher } from "../hooks/useVideoPublisher";
import home from "../pages/GodminLandingPage.module.css";
import s from "./GodminSiteChrome.module.css";

export function GodminSiteHeader() {
  const { pathname } = useLocation();
  const { user, isLoading, authUnavailable, refreshMe } = useAuth();
  const publisher = useVideoPublisher();
  const videos = pathname.startsWith("/landing/videos") || pathname.startsWith("/landing/admin/videos");
  const section = (hash: string) => pathname === "/landing" ? `#${hash}` : `/landing#${hash}`;

  return <header className={`${home.header} ${s.header}`}>
    <Link className={home.brand} to="/landing" aria-label="신과함께 홈"><img src="/tenants/godmin/logo.png" alt="신과함께" /></Link>
    <nav className={`${home.nav} ${s.nav}`} aria-label="홈페이지 주요 메뉴">
      <a href={section("philosophy")}>수업 철학</a>
      <a href={section("system")}>학습 관리</a>
      <a href={section("teacher")}>신민T</a>
      <Link to="/landing/resources">자료게시판</Link>
      <Link to="/landing/videos" aria-current={videos ? "page" : undefined}>영상</Link>
    </nav>
    <div className={s.account}>
      {isLoading ? <span>로그인 확인 중…</span> : authUnavailable ? <button type="button" onClick={() => void refreshMe().catch(() => undefined)}>로그인 상태 다시 확인</button> : user ? <>
        <span className={s.userName}>{user.name || user.username}님</span>
        {publisher.state === "allowed"
          ? <Link className={home.headerLogin} to="/landing/admin/videos">영상 관리</Link>
          : <Link className={home.headerLogin} to="/">내 학습 공간</Link>}
      </> : <Link className={home.headerLogin} to="/login/godmin" onClick={() => saveReturnPath()}>로그인</Link>}
    </div>
  </header>;
}

export function GodminSiteFooter() {
  return <footer className={home.footer}>
    <Link to="/landing" aria-label="신과함께 홈"><img src="/tenants/godmin/logo.png" alt="신과함께" /></Link>
    <div><Link to="/landing">홈페이지</Link><Link to="/landing/resources">자료게시판</Link><Link to="/landing/videos">영상</Link><Link to="/terms">이용약관</Link><Link to="/privacy">개인정보처리방침</Link></div>
    <p>© {new Date().getFullYear()} 신과함께. powered by 학원플러스</p>
  </footer>;
}
