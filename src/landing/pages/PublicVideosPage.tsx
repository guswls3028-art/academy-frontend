import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { getVideo, listVideos, videoCategories, type PublicVideo, type VideoPage } from "../api/publicVideos";
import { resourceError } from "../api/publicResources";
import VideoLayout, { VideoFailure, VideoPublisherLink } from "../components/VideoLayout";
import { VideoCards } from "../components/VideoCards";
import { VideoPlayer } from "../components/VideoPlayer";
import { setLandingMeta } from "../utils/seoMeta";
import s from "./PublicVideos.module.css";

export default function PublicVideosPage() {
  const { id } = useParams(); const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [data, setData] = useState<VideoPage<PublicVideo> | null>(null); const [video, setVideo] = useState<PublicVideo | null>(null);
  const [error, setError] = useState(""); const [retry, setRetry] = useState(0); const [loading, setLoading] = useState(true);
  const [share, setShare] = useState("");
  useEffect(() => {
    let disposed = false; setLoading(true); setError(""); setVideo(null); setShare("");
    const task = id ? getVideo(id).then((value) => { if (!disposed) setVideo(value); }) : listVideos(page).then((value) => { if (!disposed) setData(value); });
    task.catch((failure) => { if (!disposed) setError((failure as { response?: { status?: number } }).response?.status === 404 ? "공개 중인 영상을 찾을 수 없습니다. 영상 모아보기에서 다른 이야기를 만나보세요." : resourceError(failure, "영상을 불러오지 못했습니다.")); })
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [id, page, retry]);
  useEffect(() => {
    if (!video) return;
    const fields = { "description": video.summary, "og:title": video.title, "og:description": video.summary, "og:image": video.thumbnail_url, "og:url": `${window.location.origin}/landing/videos/${video.id}` };
    const before = Object.keys(fields).map((key) => ({ key, element: document.querySelector<HTMLMetaElement>(`meta[${key.startsWith("og:") ? "property" : "name"}="${key}"]`), content: document.querySelector<HTMLMetaElement>(`meta[${key.startsWith("og:") ? "property" : "name"}="${key}"]`)?.content }));
    Object.entries(fields).forEach(([key, value]) => setLandingMeta(key, value));
    return () => { before.forEach(({ key, element, content }) => { if (element) element.content = content || ""; else document.querySelector(`meta[${key.startsWith("og:") ? "property" : "name"}="${key}"]`)?.remove(); }); };
  }, [video]);
  async function copyLink() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/landing/videos/${id}`); setShare("영상 링크를 복사했습니다."); }
    catch { setShare("주소창의 링크를 복사해 공유해주세요."); }
  }
  return <VideoLayout title={video?.title || "영상 모아보기"}>
    {id ? <Link className={s.back} to="/landing/videos">← 영상 모아보기</Link> : <div className={s.pageHeading}><span className={s.kicker}>VIDEO JOURNAL</span><h1>생각을 나누는 시간</h1><p>과학과 수업, 그리고 선생님의 이야기.</p><VideoPublisherLink /></div>}
    {loading ? <p className={s.empty} role="status">영상을 불러오고 있습니다.</p> : error ? <VideoFailure message={error} retry={() => setRetry((value) => value + 1)} /> : id && video ? <article className={s.detail}>
      <div className={s.detailHeading}><span className={s.kicker}>{videoCategories[video.category]}</span><h1>{video.title}</h1><p>{video.summary}</p></div>
      <VideoPlayer video={video} /><div className={s.detailFooter}><div><span className={s.kicker}>ORIGINAL CHANNEL</span><p>{video.channel_title}</p></div><button className={s.secondary} type="button" onClick={() => void copyLink()}>링크 공유</button></div><p role="status">{share}</p>
    </article> : data?.results.length ? <><VideoCards videos={data.results} /><nav className={s.pagination} aria-label="영상 페이지"><button disabled={page === 1} onClick={() => setParams({ page: String(page - 1) })}>이전</button><span>{page} / {Math.ceil(data.count / 12)}</span><button disabled={!data.next} onClick={() => setParams({ page: String(page + 1) })}>다음</button></nav></> : <div className={s.empty}><h2>새로운 이야기를 준비하고 있습니다</h2><p>곧 영상으로 만나겠습니다.</p></div>}
  </VideoLayout>;
}
