import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { getManagedShowcase, listManagedVideos, videoStatuses, type ManagedVideo, type VideoPage, type VideoShowcase } from "../api/publicVideos";
import { resourceError } from "../api/publicResources";
import VideoLayout, { VideoAccess, VideoFailure } from "../components/VideoLayout";
import { useVideoPublisher } from "../hooks/useVideoPublisher";
import s from "./PublicVideos.module.css";

export default function VideoStudioPage() {
  const publisher = useVideoPublisher(); const [params, setParams] = useSearchParams(); const page = Math.max(1, Number(params.get("page")) || 1);
  const [data, setData] = useState<VideoPage<ManagedVideo> | null>(null); const [showcase, setShowcase] = useState<VideoShowcase | null>(null);
  const [error, setError] = useState(""); const [retry, setRetry] = useState(0); const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (publisher.state !== "allowed") return;
    let disposed = false; setLoading(true); setError("");
    Promise.all([listManagedVideos(page), getManagedShowcase()]).then(([rows, hero]) => { if (!disposed) { setData(rows); setShowcase(hero); } })
      .catch((failure) => { if (!disposed) setError(resourceError(failure, "영상 목록을 불러오지 못했습니다.")); }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [publisher.state, page, retry]);
  return <VideoLayout title="영상 관리">{publisher.state !== "allowed" ? <VideoAccess publisher={publisher} /> : <>
    <div className={s.sectionHeading}><div><span className={s.kicker}>VIDEO STUDIO</span><h1>영상 관리</h1><p>YouTube 링크 하나로, 홈페이지에 새로운 이야기를 전하세요.</p></div><Link className={s.primary} to="/landing/admin/videos/new">새 영상 등록</Link></div>
    <div className={s.studioNote}><strong>임시저장 → 미리보기 → 공개</strong><p>공개 중인 영상을 수정해도 다시 공개하기 전까지 방문자에게는 기존 내용이 보입니다. 대표 영상은 홈페이지 첫 화면에 한 편만 표시됩니다.</p></div>
    {loading ? <p role="status" className={s.empty}>영상 목록을 불러오고 있습니다.</p> : error ? <VideoFailure message={error} retry={() => setRetry((value) => value + 1)} /> : data?.results.length ? <>
      <div className={s.manageList}>{data.results.map((video) => <Link className={s.manageRow} key={video.id} to={`/landing/admin/videos/${video.id}`}>
        <img src={video.thumbnail_url || `https://i.ytimg.com/vi/${video.youtube_video_id}/hqdefault.jpg`} alt="" loading="lazy" />
        <div><div className={s.statusLine}><span className={video.status === "published" ? s.live : s.status}>{videoStatuses[video.status]}</span>{showcase?.hero_video_id === video.id && <span className={s.heroBadge}>홈 대표</span>}{video.status === "published" && JSON.stringify(video.draft_content) !== JSON.stringify(video.published_content) && <span className={s.status}>수정 내용 미공개</span>}</div><h2>{video.draft_content.title}</h2><p>{video.channel_title || "공개할 때 원본 영상 확인"} · {video.draft_content.format === "vertical" ? "Shorts" : "일반 영상"}</p></div><span className={s.editLabel}>편집 →</span>
      </Link>)}</div><nav className={s.pagination} aria-label="관리 목록 페이지"><button disabled={page === 1} onClick={() => setParams({ page: String(page - 1) })}>이전</button><span>{page} / {Math.ceil(data.count / 12)}</span><button disabled={!data.next} onClick={() => setParams({ page: String(page + 1) })}>다음</button></nav>
    </> : <div className={s.empty}><h2>첫 영상을 등록해보세요</h2><p>일반 영상과 Shorts 링크를 모두 사용할 수 있습니다.</p><Link className={s.primary} to="/landing/admin/videos/new">영상 등록 시작</Link></div>}
  </>}</VideoLayout>;
}
