import { useEffect, type ReactNode } from "react";
import { Link } from "react-router";
import { useProgram } from "@/shared/program";
import { saveReturnPath } from "@/shared/api/axios";
import { useVideoPublisher } from "../hooks/useVideoPublisher";
import s from "../pages/PublicVideos.module.css";

export default function VideoLayout({ children, title }: { children: ReactNode; title: string }) {
  const { program } = useProgram();
  const brand = program?.display_name || "영상";
  useEffect(() => { const before = document.title; document.title = `${title} | ${brand}`; return () => { document.title = before; }; }, [title, brand]);
  return <div className={s.shell}><header className={s.header}>
    <Link to="/landing" className={s.brand}>{brand}<span>VIDEOS</span></Link>
    <nav aria-label="영상 메뉴"><Link to="/landing">홈페이지</Link><Link to="/landing/videos">영상</Link><Link to="/login" onClick={() => saveReturnPath()}>로그인</Link></nav>
  </header><main className={s.main}>{children}</main><footer className={s.footer}>영상은 원본 채널의 YouTube 플레이어로 재생됩니다. 좋아요와 댓글은 YouTube에서 남겨주세요.</footer></div>;
}

export function VideoFailure({ message, retry }: { message: string; retry?: () => void }) {
  return <div className={s.notice} role="alert"><p>{message}</p>{retry && <button type="button" onClick={retry}>다시 시도</button>}</div>;
}

export function VideoPublisherLink() {
  const publisher = useVideoPublisher();
  if (publisher.state === "error") return <button className={s.textButton} type="button" onClick={publisher.retry}>관리 권한 다시 확인</button>;
  return publisher.state === "allowed" ? <Link className={s.textButton} to="/landing/admin/videos">영상 관리</Link> : null;
}

export function VideoAccess({ publisher }: { publisher: ReturnType<typeof useVideoPublisher> }) {
  if (publisher.state === "loading") return <p role="status">게시 권한을 확인하고 있습니다.</p>;
  if (publisher.state === "error") return <VideoFailure message="게시 권한을 확인하지 못했습니다." retry={publisher.retry} />;
  return <div className={s.empty}><h1>지정 게시자 전용 공간입니다</h1><p>영상 게시 권한이 있는 계정으로 로그인해주세요.</p><Link className={s.primary} to="/login" onClick={() => saveReturnPath()}>로그인</Link><Link className={s.secondary} to="/landing/videos">공개 영상 보기</Link></div>;
}
