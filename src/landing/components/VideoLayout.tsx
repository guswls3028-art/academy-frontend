import { useEffect, type ReactNode } from "react";
import { Link } from "react-router";
import { useProgram } from "@/shared/program";
import { saveReturnPath } from "@/shared/api/axios";
import useAuth from "@/auth/hooks/useAuth";
import { useVideoPublisher } from "../hooks/useVideoPublisher";
import { GodminSiteFooter, GodminSiteHeader } from "./GodminSiteChrome";
import home from "../pages/GodminLandingPage.module.css";
import s from "../pages/PublicVideos.module.css";

export default function VideoLayout({ children, title }: { children: ReactNode; title: string }) {
  const { program } = useProgram();
  const auth = useAuth();
  const publisher = useVideoPublisher();
  const isGodmin = program?.tenantCode === "godmin";
  const brand = program?.display_name || "영상";
  useEffect(() => { const before = document.title; document.title = `${title} | ${brand}`; return () => { document.title = before; }; }, [title, brand]);
  return <div className={`${s.shell} ${isGodmin ? `${home.page} ${s.godminShell}` : ""}`}>
    {isGodmin ? <GodminSiteHeader /> : <header className={s.header}>
      <Link to="/landing" className={s.brand}>{brand}</Link>
      <nav aria-label="홈페이지 주요 메뉴"><Link to="/landing">홈페이지</Link><Link to="/landing/videos" aria-current="page">영상</Link>
        {auth.isLoading ? <span>로그인 확인 중…</span> : auth.authUnavailable ? <button type="button" className={s.textButton} onClick={publisher.retry}>로그인 상태 다시 확인</button> : auth.user ? <><span>{auth.user.name || auth.user.username}님</span><Link to={publisher.state === "allowed" ? "/landing/admin/videos" : "/"}>{publisher.state === "allowed" ? "영상 관리" : "내 학습 공간"}</Link></> : <Link to="/login" onClick={() => saveReturnPath()}>로그인</Link>}
      </nav>
    </header>}
    <main className={s.main}>{children}</main>
    {isGodmin ? <GodminSiteFooter /> : <footer className={s.footer}><Link to="/landing">홈페이지</Link></footer>}
  </div>;
}

export function VideoFailure({ message, retry }: { message: string; retry?: () => void }) {
  return <div className={s.notice} role="alert"><p>{message}</p>{retry && <button type="button" onClick={retry}>다시 시도</button>}</div>;
}

export function VideoPublisherLink({ manage = false }: { manage?: boolean }) {
  const publisher = useVideoPublisher();
  if (publisher.state === "error") return <button className={s.textButton} type="button" onClick={publisher.retry}>관리 권한 다시 확인</button>;
  return publisher.state === "allowed" ? <Link className={manage ? s.textButton : s.primary} to={manage ? "/landing/admin/videos" : "/landing/admin/videos/new"}>{manage ? "영상 관리" : "영상 등록"}</Link> : null;
}

export function VideoEditLink({ id }: { id: string }) {
  const publisher = useVideoPublisher();
  return publisher.state === "allowed" ? <Link className={s.secondary} to={`/landing/admin/videos/${id}`}>이 영상 수정</Link> : null;
}

export function VideoAccess({ publisher }: { publisher: ReturnType<typeof useVideoPublisher> }) {
  const { isAuthenticated } = useAuth();
  if (publisher.state === "loading") return <p role="status">게시 권한을 확인하고 있습니다.</p>;
  if (publisher.state === "error") return <VideoFailure message="게시 권한을 확인하지 못했습니다." retry={publisher.retry} />;
  return <div className={s.empty}><h1>{isAuthenticated ? "이 계정에는 영상 게시 권한이 없습니다" : "영상 관리에 로그인해주세요"}</h1><p>{isAuthenticated ? "현재 로그인한 계정을 확인해주세요. 공개 영상은 계속 볼 수 있습니다." : "영상 게시 권한이 있는 계정으로 로그인하면 등록과 수정을 할 수 있습니다."}</p><Link className={s.primary} to="/login" onClick={() => saveReturnPath()}>{isAuthenticated ? "다른 계정으로 로그인" : "로그인"}</Link><Link className={s.secondary} to="/landing/videos">공개 영상 보기</Link></div>;
}
