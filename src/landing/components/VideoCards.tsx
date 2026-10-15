import { useEffect, useId, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowUpRight, Play } from "lucide-react";
import { ICON } from "@/shared/ui/ds";
import { defaultVideoPresentation, getVideoHero, getVideoShowcase, listVideos, type PublicVideo, type VideoPresentation } from "../api/publicVideos";
import { VideoFailure, VideoPublisherLink } from "./VideoLayout";
import VideoDialog from "./VideoPlayer";
import s from "../pages/PublicVideos.module.css";

export function VideoCards({ videos, compact = false, portrait = false, page = 1 }: { videos: PublicVideo[]; compact?: boolean; portrait?: boolean; page?: number }) {
  return <div className={compact ? s.queue : portrait ? s.shortsGrid : s.grid}>{videos.map((video) => <Link className={`${s.card} ${video.format === "vertical" ? s.shortCard : ""}`} to={`/landing/videos/${video.id}${page > 1 ? `?page=${page}` : ""}`} key={video.id}>
    <div className={s.thumbnail}><img src={video.thumbnail_url} alt="" loading="lazy" />{!compact && <span className={s.playMark}><Play size={ICON.md} fill="currentColor" /></span>}<span className={s.format}>{video.format === "vertical" ? "Shorts" : "영상"}</span></div>
    <div className={s.cardCopy}>{video.category_label && <span className={s.kicker}>{video.category_label}</span>}<h3>{video.title}</h3>{!compact && video.summary && <p>{video.summary}</p>}<span className={s.cardLink}>{video.channel_title}</span></div>
  </Link>)}</div>;
}

export function VideoCollection({ videos, page = 1, navigation = false }: { videos: PublicVideo[]; page?: number; navigation?: boolean }) {
  const headingId = useId();
  const landscape = videos.filter((video) => video.format !== "vertical");
  const shorts = videos.filter((video) => video.format === "vertical");
  return <>
    {navigation && landscape.length > 0 && shorts.length > 0 && <nav className={s.collectionNav} aria-label="영상 종류 바로가기"><a href={`#${headingId}-videos-section`}>동영상</a><a href={`#${headingId}-shorts-section`}>Shorts</a></nav>}
    <div className={`${s.collection} ${landscape.length && shorts.length ? s.mixedCollection : ""}`}>
    {landscape.length > 0 && <section id={`${headingId}-videos-section`} aria-labelledby={`${headingId}-videos`}>
      <div className={s.collectionHeading}><h2 id={`${headingId}-videos`}>동영상</h2><span>{landscape.length}편</span></div>
      <VideoCards videos={landscape} page={page} />
    </section>}
    {shorts.length > 0 && <section id={`${headingId}-shorts-section`} aria-labelledby={`${headingId}-shorts`}>
      <div className={s.collectionHeading}><h2 id={`${headingId}-shorts`}>Shorts</h2><span>{shorts.length}편</span></div>
      <VideoCards videos={shorts} page={page} portrait />
    </section>}
    </div>
  </>;
}

export function GodminHeroVideo({ fallback, onReady }: { fallback: ReactNode; onReady?: () => void }) {
  const [hero, setHero] = useState<PublicVideo | null>(null);
  const [error, setError] = useState(false); const [retry, setRetry] = useState(0); const [open, setOpen] = useState(false);
  useEffect(() => {
    let disposed = false; setError(false);
    getVideoHero().then((video) => { if (!disposed) setHero(video); }).catch(() => { if (!disposed) setError(true); }).finally(() => { if (!disposed) onReady?.(); });
    return () => { disposed = true; };
  }, [retry, onReady]);
  if (!hero) return <div>{fallback}{error && <div className={s.heroRetry}><span>대표 영상을 불러오지 못했습니다.</span><button type="button" onClick={() => setRetry((value) => value + 1)}>다시 시도</button></div>}</div>;
  return <div className={s.heroVideo}><div className={s.heroLabel}><span>대표 영상</span><span>{hero.format === "vertical" ? "Shorts" : hero.channel_title}</span></div>
    <button type="button" className={`${s.heroPoster} ${hero.format === "vertical" ? s.verticalPoster : ""}`} onClick={(event) => { event.currentTarget.focus(); setOpen(true); }} aria-label={`${hero.title} 영상 열기`}>
      <img src={hero.thumbnail_url} alt="" fetchPriority="high" /><span className={s.heroPlay}><Play size={ICON.lg} fill="currentColor" />영상 열기</span>
    </button><div className={s.heroCaption}><h2>{hero.title}</h2>{hero.summary && <p>{hero.summary}</p>}<Link to="/landing/videos">다른 영상도 둘러보기 <ArrowUpRight size={ICON.sm} /></Link></div>
    {open && <VideoDialog video={hero} close={() => setOpen(false)} />}
  </div>;
}

export function VideoHighlights({ onReady }: { onReady?: () => void }) {
  const [videos, setVideos] = useState<PublicVideo[] | null>(null); const [error, setError] = useState(false); const [retry, setRetry] = useState(0);
  const [presentation, setPresentation] = useState<VideoPresentation>(defaultVideoPresentation);
  useEffect(() => {
    let disposed = false; setError(false);
    Promise.all([listVideos(), getVideoShowcase()]).then(([page, settings]) => { if (!disposed) { setVideos(page.results.slice(0, 4)); setPresentation(settings); } }).catch(() => { if (!disposed) setError(true); }).finally(() => { if (!disposed) onReady?.(); });
    return () => { disposed = true; };
  }, [retry, onReady]);
  return <section className={s.highlights} aria-labelledby="video-highlights-title"><div className={s.sectionHeading}><div><h2 id="video-highlights-title">{presentation.title}</h2>{presentation.description && <p>{presentation.description}</p>}</div><div className={s.actions}><VideoPublisherLink /><Link className={s.secondary} to="/landing/videos">영상 전체 보기 <ArrowUpRight size={ICON.sm} /></Link></div></div>
    {error ? <VideoFailure message="영상을 불러오지 못했습니다." retry={() => setRetry((value) => value + 1)} /> : videos ? videos.length ? <VideoCollection videos={videos} /> : <p className={s.empty}>등록된 공개 영상이 없습니다.</p> : <p role="status" className={s.empty}>영상을 불러오고 있습니다.</p>}
  </section>;
}
