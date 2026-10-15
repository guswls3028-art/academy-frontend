import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import { defaultVideoPresentation, getVideo, getVideoShowcase, listVideos, type PublicVideo, type VideoPage, type VideoPresentation, type VideoContent, type VideoSort } from "../api/publicVideos";
import { resourceError } from "../api/publicResources";
import VideoLayout, { VideoEditLink, VideoFailure, VideoPublisherLink } from "../components/VideoLayout";
import { VideoCards } from "../components/VideoCards";
import { VideoPlayer } from "../components/VideoPlayer";
import { setLandingMeta } from "../utils/seoMeta";
import { videoBrowseQuery, videoDateLabel, videoSortLabels, videoViewLabel } from "../utils/videoBrowse";
import s from "./PublicVideos.module.css";

export default function PublicVideosPage() {
  const { id } = useParams(); const [params, setParams] = useSearchParams();
  const location = useLocation();
  const requestedPage = Number(params.get("page"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [data, setData] = useState<VideoPage<PublicVideo> | null>(null); const [video, setVideo] = useState<PublicVideo | null>(null);
  const requestedFormat = params.get("format");
  const format: VideoContent["format"] = requestedFormat === "vertical" || requestedFormat === "landscape" ? requestedFormat : video?.format || "landscape";
  const requestedSort = params.get("sort");
  const sort: VideoSort = requestedSort === "popular" || requestedSort === "oldest" ? requestedSort : "latest";
  const query = (params.get("q") || "").trim().slice(0, 90);
  const [search, setSearch] = useState(query);
  const browseQuery = videoBrowseQuery(format, sort, query, page);
  const formatLabel = format === "vertical" ? "Shorts" : "동영상";
  const [error, setError] = useState(""); const [retry, setRetry] = useState(0); const [loading, setLoading] = useState(true);
  const [share, setShare] = useState("");
  const [listError, setListError] = useState(""); const [listLoading, setListLoading] = useState(true);
  const [listRetry, setListRetry] = useState(0);
  const [presentation, setPresentation] = useState<VideoPresentation>(defaultVideoPresentation);
  useEffect(() => { setSearch(query); }, [query]);
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
    Promise.all([listVideos(page, { format, sort, q: query }), getVideoShowcase()]).then(([value, settings]) => {
      if (!disposed) { setData(value); setPresentation(settings); }
    }).catch((failure) => { if (!disposed) setListError(resourceError(failure, "영상 목록을 불러오지 못했습니다.")); })
      .finally(() => { if (!disposed) setListLoading(false); });
    return () => { disposed = true; };
  }, [page, format, sort, query, listRetry]);
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
  function updateBrowse(next: { format?: VideoContent["format"]; sort?: VideoSort; q?: string; page?: number }) {
    setParams(videoBrowseQuery(next.format || format, next.sort || sort, next.q ?? query, next.page || 1));
  }
  const filters = <div className={s.browseControls}>
    <nav className={s.formatTabs} aria-label="영상 종류">
      {(["landscape", "vertical"] as const).map((value) => <button key={value} type="button" aria-pressed={format === value} onClick={() => updateBrowse({ format: value })}>{value === "vertical" ? "Shorts" : "동영상"}</button>)}
    </nav>
    <div className={s.filterRow}>
      <div className={s.sortButtons} role="group" aria-label="영상 정렬">{(Object.keys(videoSortLabels) as VideoSort[]).map((value) => <button key={value} type="button" aria-pressed={sort === value} onClick={() => updateBrowse({ sort: value })}>{videoSortLabels[value]}</button>)}</div>
      <form className={s.videoSearch} role="search" aria-label="등록 영상 검색" onSubmit={(event) => { event.preventDefault(); updateBrowse({ q: search.trim() }); }}>
        <input aria-label="영상 검색" placeholder="제목·분류·채널 검색" value={search} maxLength={90} onChange={(event) => setSearch(event.target.value)} />
        <button type="submit">검색</button>
      </form>
    </div>
    {query && <div className={s.searchSummary}><span>‘{query}’ 검색 결과</span><button type="button" onClick={() => updateBrowse({ q: "" })}>검색 지우기</button></div>}
    <p className={s.sortHelp}>{sort === "popular" ? "YouTube 조회수 기준 · 미확인 영상은 마지막에 표시됩니다." : "YouTube 업로드일 기준 · 날짜 미확인 영상은 홈페이지 공개일을 사용합니다."}</p>
  </div>;
  const pagination = data && data.count > 12 ? <nav className={s.pagination} aria-label="영상 페이지">
    <button disabled={page === 1 || listLoading} onClick={() => updateBrowse({ page: page - 1 })}>이전</button>
    <span>{page} / {Math.ceil(data.count / 12)}</span>
    <button disabled={!data.next || listLoading} onClick={() => updateBrowse({ page: page + 1 })}>다음</button>
  </nav> : null;
  const visibleVideos = data?.results.filter((item) => item.id !== id) || [];
  const library = listLoading ? <p className={s.empty} role="status">영상을 불러오고 있습니다.</p>
    : listError ? <><VideoFailure message={listError} retry={() => setListRetry((value) => value + 1)} /><div className={s.actions}>{sort === "popular" && <button type="button" className={s.secondary} onClick={() => updateBrowse({ sort: "latest" })}>최신순으로 보기</button>}{page > 1 && <button type="button" className={s.secondary} onClick={() => updateBrowse({ page: 1 })}>첫 페이지로</button>}</div></>
    : visibleVideos.length ? <><div className={s.browseGrid}><VideoCards videos={visibleVideos} compact={!!id} portrait={format === "vertical"} browseQuery={browseQuery} statistics /></div>{pagination}</>
    : <div className={s.empty}><h2>{query ? "검색 결과가 없습니다" : id ? `다른 ${formatLabel}이 없습니다` : `등록된 ${formatLabel}이 없습니다`}</h2><p>{query ? "다른 검색어를 입력하거나 검색을 지워주세요." : "다른 영상 종류를 선택해 둘러보세요."}</p>{page > 1 && <button className={s.secondary} onClick={() => updateBrowse({ page: 1 })}>첫 페이지로</button>}{pagination}</div>;

  return <VideoLayout title={video?.title || presentation.title}>
    {id ? <>
      <div className={s.watchToolbar}><Link className={s.back} to={`/landing/videos${browseQuery}`}>← 영상 목록</Link><div className={s.actions}><a className={s.browseJump} href="#more-videos">다른 영상</a><VideoPublisherLink /></div></div>
      <div className={s.watchGrid}>
        <article className={s.detail}>
          {loading ? <p className={s.empty} role="status">영상을 불러오고 있습니다.</p> : error ? <VideoFailure message={error} retry={() => setRetry((value) => value + 1)} /> : video && <>
            <div className={s.detailHeading}><div className={s.detailLabels}><span>{video.format === "vertical" ? "Shorts" : "동영상"}</span>{video.category_label && <span className={s.kicker}>{video.category_label}</span>}</div><h1>{video.title}</h1></div>
            <VideoPlayer key={video.id} video={video} />
            <div className={s.detailStatistics}><span>{videoViewLabel(video)}</span><time dateTime={video.youtube_published_at || video.published_at}>{videoDateLabel(video)}</time>{video.youtube_statistics_checked_at && <span title={new Date(video.youtube_statistics_checked_at).toLocaleString("ko-KR")}>조회수는 주기적으로 갱신됩니다.</span>}</div>
            {video.summary && <p className={s.detailSummary}>{video.summary}</p>}
            <div className={s.detailFooter}><p>{video.channel_title}</p><div className={s.actions}><button className={s.secondary} type="button" onClick={() => void copyLink()}>링크 공유</button><VideoEditLink id={video.id} /></div></div>
            <p className={s.message} role="status" aria-label="공유 결과">{share}</p>
          </>}
        </article>
        <aside id="more-videos" className={s.moreVideos} aria-label="다른 영상"><div className={s.libraryHeading}><h2>다른 영상</h2><Link to={`/landing/videos${browseQuery}`}>전체 보기</Link></div>
          {video && <div className={s.nowWatching}><span>지금 시청 중</span><p>{video.title}</p></div>}
          {filters}<div aria-busy={listLoading}>{library}</div>
        </aside>
      </div>
    </> : <>
      <div className={`${s.sectionHeading} ${s.catalogueHeader}`}><div className={s.pageHeading}><h1>{presentation.title}</h1>{presentation.description && <p>{presentation.description}</p>}</div><VideoPublisherLink /></div>
      {filters}
      <div className={s.catalogueToolbar}><span role="status">{formatLabel}{data && !listLoading && !listError ? ` ${data.count}편` : ""}</span>{data && data.count > 12 && <span>{page}페이지 · 페이지별 12편</span>}</div>
      <div className={s.library} aria-busy={listLoading}>{library}</div>
    </>}
  </VideoLayout>;
}
