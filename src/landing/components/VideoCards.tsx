import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowUpRight, Play } from "lucide-react";
import { ICON } from "@/shared/ui/ds";
import { defaultVideoPresentation, getVideoHero, getVideoShowcase, listVideos, type PublicVideo, type VideoPresentation } from "../api/publicVideos";
import { VideoFailure, VideoPublisherLink } from "./VideoLayout";
import VideoDialog from "./VideoPlayer";
import s from "../pages/PublicVideos.module.css";

export function VideoCards({ videos, compact = false, page = 1 }: { videos: PublicVideo[]; compact?: boolean; page?: number }) {
  return <div className={compact ? s.queue : s.grid}>{videos.map((video) => <Link className={`${s.card} ${video.format === "vertical" ? s.shortCard : ""}`} to={`/landing/videos/${video.id}${page > 1 ? `?page=${page}` : ""}`} key={video.id}>
    <div className={s.thumbnail}><img src={video.thumbnail_url} alt="" loading="lazy" />{!compact && <span className={s.playMark}><Play size={ICON.md} fill="currentColor" /></span>}<span className={s.format}>{video.format === "vertical" ? "Shorts" : "영상"}</span></div>
    <div className={s.cardCopy}>{video.category_label && <span className={s.kicker}>{video.category_label}</span>}<h3>{video.title}</h3>{!compact && video.summary && <p>{video.summary}</p>}<span className={s.cardLink}>{compact ? video.channel_title : <>영상 보기 <ArrowUpRight size={ICON.sm} /></>}</span></div>
  </Link>)}</div>;
}

export function GodminHeroVideo({ fallback }: { fallback: ReactNode }) {
  const [hero, setHero] = useState<PublicVideo | null>(null);
  const [error, setError] = useState(false); const [retry, setRetry] = useState(0); const [open, setOpen] = useState(false);
  useEffect(() => {
    let disposed = false; setError(false);
    getVideoHero().then((video) => { if (!disposed) setHero(video); }).catch(() => { if (!disposed) setError(true); });
    return () => { disposed = true; };
  }, [retry]);
  if (!hero) return <div>{fallback}{error && <div className={s.heroRetry}><span>대표 영상을 불러오지 못했습니다.</span><button type="button" onClick={() => setRetry((value) => value + 1)}>다시 시도</button></div>}</div>;
  return <div className={s.heroVideo}><div className={s.heroLabel}><span>VIDEO</span><span>대표 영상</span></div>
    <button type="button" className={`${s.heroPoster} ${hero.format === "vertical" ? s.verticalPoster : ""}`} onClick={(event) => { event.currentTarget.focus(); setOpen(true); }} aria-label={`${hero.title} 영상 열기`}>
      <img src={hero.thumbnail_url} alt="" fetchPriority="high" /><span className={s.heroPlay}><Play size={ICON.lg} fill="currentColor" />영상 열기</span>
    </button><div className={s.heroCaption}><h2>{hero.title}</h2><p>{hero.summary}</p><Link to={`/landing/videos/${hero.id}`}>다른 영상도 둘러보기 <ArrowUpRight size={ICON.sm} /></Link></div>
    {open && <VideoDialog video={hero} close={() => setOpen(false)} />}
  </div>;
}

export function VideoHighlights() {
  const [videos, setVideos] = useState<PublicVideo[] | null>(null); const [error, setError] = useState(false); const [retry, setRetry] = useState(0);
  const [presentation, setPresentation] = useState<VideoPresentation>(defaultVideoPresentation);
  useEffect(() => {
    let disposed = false; setError(false);
    Promise.all([listVideos(), getVideoShowcase()]).then(([page, settings]) => { if (!disposed) { setVideos(page.results.slice(0, 4)); setPresentation(settings); } }).catch(() => { if (!disposed) setError(true); });
    return () => { disposed = true; };
  }, [retry]);
  return <section className={s.highlights} aria-labelledby="video-highlights-title"><div className={s.sectionHeading}><div><h2 id="video-highlights-title">{presentation.title}</h2>{presentation.description && <p>{presentation.description}</p>}</div><div className={s.actions}><VideoPublisherLink /><Link className={s.secondary} to="/landing/videos">영상 전체 보기 <ArrowUpRight size={ICON.sm} /></Link></div></div>
    {error ? <VideoFailure message="영상을 불러오지 못했습니다." retry={() => setRetry((value) => value + 1)} /> : videos ? videos.length ? <VideoCards videos={videos} /> : <p className={s.empty}>등록된 공개 영상이 없습니다.</p> : <p role="status" className={s.empty}>영상을 불러오고 있습니다.</p>}
  </section>;
}
