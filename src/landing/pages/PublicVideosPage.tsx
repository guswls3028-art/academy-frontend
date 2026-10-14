import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import { defaultVideoPresentation, getVideo, getVideoShowcase, listVideos, type PublicVideo, type VideoPage, type VideoPresentation } from "../api/publicVideos";
import { resourceError } from "../api/publicResources";
import VideoLayout, { VideoEditLink, VideoFailure, VideoPublisherLink } from "../components/VideoLayout";
import { VideoCards, VideoCollection } from "../components/VideoCards";
import { VideoPlayer } from "../components/VideoPlayer";
import { setLandingMeta } from "../utils/seoMeta";
import s from "./PublicVideos.module.css";

export default function PublicVideosPage() {
  const { id } = useParams(); const [params, setParams] = useSearchParams();
  const location = useLocation();
  const requestedPage = Number(params.get("page"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [data, setData] = useState<VideoPage<PublicVideo> | null>(null); const [video, setVideo] = useState<PublicVideo | null>(null);
  const [error, setError] = useState(""); const [retry, setRetry] = useState(0); const [loading, setLoading] = useState(true);
  const [share, setShare] = useState("");
  const [listError, setListError] = useState(""); const [listLoading, setListLoading] = useState(true);
  const [listRetry, setListRetry] = useState(0);
  const [presentation, setPresentation] = useState<VideoPresentation>(defaultVideoPresentation);
  useEffect(() => { window.scrollTo(0, 0); }, [id]);
  useEffect(() => { if (!id && !location.hash) window.scrollTo(0, 0); }, [id, page, location]);
  useEffect(() => {
    if (!id) { setVideo(null); setError(""); setLoading(false); return; }
    let disposed = false; setLoading(true); setError(""); setVideo(null); setShare("");
    getVideo(id).then((value) => { if (!disposed) setVideo(value); })
      .catch((failure) => { if (!disposed) setError((failure as { response?: { status?: number } }).response?.status === 404 ? "공개 중인 영상을 찾을 수 없습니다. 영상 목록에서 다른 영상을 확인해주세요." : resourceError(failure, "영상을 불러오지 못했습니다.")); })
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [id, retry]);
  useEffect(() => {
    let disposed = false; setListLoading(true); setListError("");
    Promise.all([listVideos(page), getVideoShowcase()]).then(([value, settings]) => {
      if (!disposed) { setData(value); setPresentation(settings); }
    }).catch((failure) => { if (!disposed) setListError(resourceError(failure, "영상 목록을 불러오지 못했습니다.")); })
      .finally(() => { if (!disposed) setListLoading(false); });
    return () => { disposed = true; };
  }, [page, listRetry]);
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
  const pagination = data && data.count > 12 ? <nav className={s.pagination} aria-label="영상 페이지">
    <button disabled={page === 1 || listLoading} onClick={() => setParams({ page: String(page - 1) })}>이전</button>
    <span>{page} / {Math.ceil(data.count / 12)}</span>
    <button disabled={!data.next || listLoading} onClick={() => setParams({ page: String(page + 1) })}>다음</button>
  </nav> : null;
  const visibleVideos = data?.results.filter((item) => item.id !== id) || [];
  const library = listLoading ? <p className={s.empty} role="status">영상을 불러오고 있습니다.</p>
    : listError ? <VideoFailure message={listError} retry={() => setListRetry((value) => value + 1)} />
    : visibleVideos.length ? <>{id ? <VideoCards videos={visibleVideos} compact page={page} /> : <VideoCollection videos={visibleVideos} page={page} navigation />}{pagination}</>
    : <div className={s.empty}><h2>{id ? "다른 공개 영상이 없습니다" : "등록된 공개 영상이 없습니다"}</h2>{page > 1 && <button className={s.secondary} onClick={() => setParams({})}>첫 페이지로</button>}{pagination}</div>;

  return <VideoLayout title={video?.title || presentation.title}>
    {id ? <>
      <div className={s.watchToolbar}><Link className={s.back} to={`/landing/videos${page > 1 ? `?page=${page}` : ""}`}>← 영상 목록</Link><div className={s.actions}><a className={s.browseJump} href="#more-videos">다른 영상</a><VideoPublisherLink /></div></div>
      <div className={s.watchGrid}>
        <article className={s.detail}>
          {loading ? <p className={s.empty} role="status">영상을 불러오고 있습니다.</p> : error ? <VideoFailure message={error} retry={() => setRetry((value) => value + 1)} /> : video && <>
            <div className={s.detailHeading}><div className={s.detailLabels}><span>{video.format === "vertical" ? "Shorts" : "동영상"}</span>{video.category_label && <span className={s.kicker}>{video.category_label}</span>}</div><h1>{video.title}</h1></div>
            <VideoPlayer key={video.id} video={video} />
            {video.summary && <p className={s.detailSummary}>{video.summary}</p>}
            <div className={s.detailFooter}><p>{video.channel_title}</p><div className={s.actions}><button className={s.secondary} type="button" onClick={() => void copyLink()}>링크 공유</button><VideoEditLink id={video.id} /></div></div>
            <p className={s.message} role="status" aria-label="공유 결과">{share}</p>
          </>}
        </article>
        <aside id="more-videos" className={s.moreVideos} aria-label="다른 영상"><div className={s.libraryHeading}><h2>다른 영상</h2><Link to={`/landing/videos${page > 1 ? `?page=${page}` : ""}`}>전체 보기</Link></div>
          {video && <div className={s.nowWatching}><span>지금 시청 중</span><p>{video.title}</p></div>}
          {library}
        </aside>
      </div>
    </> : <>
      <div className={`${s.sectionHeading} ${s.catalogueHeader}`}><div className={s.pageHeading}><h1>{presentation.title}</h1>{presentation.description && <p>{presentation.description}</p>}</div><VideoPublisherLink /></div>
      <div className={s.catalogueToolbar}><span>전체 영상{data && !listLoading && !listError ? ` ${data.count}편` : ""}</span>{data && data.count > 12 && <span>{page}페이지 · 페이지별 12편</span>}</div>
      <div className={s.library} aria-busy={listLoading}>{library}</div>
    </>}
  </VideoLayout>;
}
