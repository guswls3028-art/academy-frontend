import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { defaultVideoPresentation, getManagedShowcase, listManagedVideos, saveVideoPresentation, videoStatuses, type ManagedVideo, type VideoPage, type VideoPresentation, type VideoShowcase } from "../api/publicVideos";
import { resourceError } from "../api/publicResources";
import VideoLayout, { VideoAccess, VideoFailure } from "../components/VideoLayout";
import { useVideoPublisher } from "../hooks/useVideoPublisher";
import s from "./PublicVideos.module.css";

export default function VideoStudioPage() {
  const publisher = useVideoPublisher(); const [params, setParams] = useSearchParams(); const page = Math.max(1, Number(params.get("page")) || 1);
  const [data, setData] = useState<VideoPage<ManagedVideo> | null>(null); const [showcase, setShowcase] = useState<VideoShowcase | null>(null);
  const [error, setError] = useState(""); const [retry, setRetry] = useState(0); const [loading, setLoading] = useState(true);
  const location = useLocation();
  const [presentation, setPresentation] = useState<VideoPresentation>(defaultVideoPresentation);
  const [settingsError, setSettingsError] = useState(""); const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsRetry, setSettingsRetry] = useState(0);
  const [settingsBusy, setSettingsBusy] = useState(false); const settingsBusyRef = useRef(false);
  const [settingsConflict, setSettingsConflict] = useState(false); const [latest, setLatest] = useState<VideoShowcase | null>(null);
  const dirty = !!showcase && (presentation.title !== showcase.title || presentation.description !== showcase.description);
  useEffect(() => {
    if (publisher.state !== "allowed") return;
    let disposed = false; setLoading(true); setError("");
    listManagedVideos(page).then((rows) => { if (!disposed) setData(rows); })
      .catch((failure) => { if (!disposed) setError(resourceError(failure, "영상 목록을 불러오지 못했습니다.")); }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [publisher.state, page, retry]);
  useEffect(() => {
    if (publisher.state !== "allowed") return;
    let disposed = false; setSettingsError("");
    getManagedShowcase().then((value) => { if (!disposed) { setShowcase(value); setPresentation({ title: value.title, description: value.description }); } })
      .catch((failure) => { if (!disposed) setSettingsError(resourceError(failure, "영상 영역 설정을 불러오지 못했습니다.")); });
    return () => { disposed = true; };
  }, [publisher.state, settingsRetry]);
  useEffect(() => {
    if (!dirty) return;
    const before = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const leave = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.("a[href]");
      if (link && link.getAttribute("target") !== "_blank" && !window.confirm("저장하지 않은 영상 영역 설정이 있습니다. 이 페이지를 나갈까요?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", before); document.addEventListener("click", leave, true);
    return () => { window.removeEventListener("beforeunload", before); document.removeEventListener("click", leave, true); };
  }, [dirty]);
  async function saveSettings(event: FormEvent) {
    event.preventDefault(); if (!showcase || settingsBusyRef.current) return;
    settingsBusyRef.current = true; setSettingsBusy(true); setSettingsError(""); setSettingsMessage("");
    try {
      const saved = await saveVideoPresentation(showcase, presentation); setShowcase(saved); setPresentation({ title: saved.title, description: saved.description }); setSettingsMessage("영상 영역 설정을 저장했습니다.");
    } catch (failure) {
      setSettingsError(resourceError(failure, "설정을 저장하지 못했습니다. 입력을 유지했으니 다시 시도해주세요."));
      if ((failure as { response?: { status?: number } }).response?.status === 409) setSettingsConflict(true);
    } finally { settingsBusyRef.current = false; setSettingsBusy(false); }
  }
  async function checkSettings() {
    if (settingsBusyRef.current) return;
    settingsBusyRef.current = true; setSettingsBusy(true);
    try { setLatest(await getManagedShowcase()); }
    catch (failure) { setSettingsError(resourceError(failure, "최신 설정을 불러오지 못했습니다. 다시 시도해주세요.")); }
    finally { settingsBusyRef.current = false; setSettingsBusy(false); }
  }
  function acceptSettings(keepInput: boolean) {
    if (!latest) return;
    setShowcase(latest); if (!keepInput) setPresentation({ title: latest.title, description: latest.description });
    setLatest(null); setSettingsConflict(false); setSettingsError("");
    setSettingsMessage(keepInput ? "내 입력을 유지했습니다. 확인한 뒤 다시 저장해주세요." : "최신 설정을 불러왔습니다.");
  }
  return <VideoLayout title="영상 관리">{publisher.state !== "allowed" ? <VideoAccess publisher={publisher} /> : <>
    <div className={s.sectionHeading}><div><h1>영상 관리</h1><p>YouTube 링크로 영상을 등록하고 공개 정보를 관리합니다.</p></div><div className={s.actions}><Link className={s.secondary} to="/landing/videos">공개 영상 보기</Link><Link className={s.primary} to="/landing/admin/videos/new">새 영상 등록</Link></div></div>
    {location.state?.videoDeleted && <p role="status" aria-label="삭제 결과" className={s.message}>영상을 삭제했습니다. 홈페이지와 관리 목록에서 내려갔습니다.</p>}
    <details className={s.settingsPanel}><summary>영상 영역 설정</summary><p className={s.hint}>홈페이지 영상 영역과 영상 목록에 함께 표시됩니다. 제목과 소개를 직접 정할 수 있습니다.</p>
      {settingsError && <VideoFailure message={settingsError} retry={!showcase ? () => setSettingsRetry((value) => value + 1) : undefined} />}
      {showcase ? <form onSubmit={(event) => void saveSettings(event)}>
        <label className={s.field} htmlFor="video-section-title">영역 제목<input id="video-section-title" required maxLength={60} value={presentation.title} onChange={(event) => setPresentation({ ...presentation, title: event.target.value })} disabled={settingsBusy || settingsConflict} /></label>
        <label className={s.field} htmlFor="video-section-description">영역 소개 · 선택<textarea id="video-section-description" rows={3} maxLength={220} value={presentation.description} onChange={(event) => setPresentation({ ...presentation, description: event.target.value })} disabled={settingsBusy || settingsConflict} /></label>
        {settingsConflict && <div className={s.notice}><h2>다른 게시자의 설정 변경이 있습니다</h2><p>내 입력을 유지했습니다. 최신 설정을 확인해주세요.</p><button type="button" onClick={() => void checkSettings()} disabled={settingsBusy}>최신 설정 확인</button>{latest && <div className={s.latest}><strong>{latest.title}</strong><p>{latest.description || "소개 없음"}</p><div className={s.actions}><button type="button" onClick={() => acceptSettings(false)}>최신 설정 불러오기</button><button type="button" onClick={() => acceptSettings(true)}>내 설정으로 이어서 수정</button></div></div>}</div>}
        <button className={s.secondary} type="submit" disabled={settingsBusy || settingsConflict || !presentation.title.trim()}>{settingsBusy ? "처리 중…" : "영역 설정 저장"}</button><p role="status" aria-label="영역 설정 결과" className={s.message}>{settingsMessage}</p>
      </form> : !settingsError && <p role="status">설정을 불러오고 있습니다.</p>}
    </details>
    <div className={s.studioNote}><strong>YouTube 링크 입력 → 제목 확인 → 공개</strong><p>바로 공개하거나 임시저장해 나중에 이어서 작성할 수 있습니다. 공개 중인 영상의 수정 내용은 다시 공개해야 반영됩니다. 대표 영상은 홈페이지 첫 화면에 한 편만 표시됩니다.</p></div>
    <div className={s.catalogueToolbar}><span>등록한 영상{data && !loading && !error ? ` ${data.count}편` : ""}</span><span>영상을 선택하면 수정할 수 있습니다.</span></div>
    {loading ? <p role="status" className={s.empty}>영상 목록을 불러오고 있습니다.</p> : error ? <VideoFailure message={error} retry={() => setRetry((value) => value + 1)} /> : data?.results.length ? <>
      <div className={s.manageList}>{data.results.map((video) => <Link className={s.manageRow} key={video.id} to={`/landing/admin/videos/${video.id}`}>
        <img src={video.thumbnail_url || `https://i.ytimg.com/vi/${video.youtube_video_id}/hqdefault.jpg`} alt="" loading="lazy" />
        <div><div className={s.statusLine}><span className={video.status === "published" ? s.live : s.status}>{videoStatuses[video.status]}</span>{showcase?.hero_video_id === video.id && <span className={s.heroBadge}>홈 대표</span>}{video.status === "published" && JSON.stringify(video.draft_content) !== JSON.stringify(video.published_content) && <span className={s.status}>수정 내용 미공개</span>}</div><h2>{video.draft_content.title}</h2><p>{video.channel_title || "공개할 때 원본 영상 확인"} · {video.draft_content.format === "vertical" ? "Shorts" : "일반 영상"}</p></div><span className={s.editLabel}>편집 →</span>
      </Link>)}</div>{data.count > 12 && <nav className={s.pagination} aria-label="관리 목록 페이지"><button disabled={page === 1} onClick={() => setParams({ page: String(page - 1) })}>이전</button><span>{page} / {Math.ceil(data.count / 12)}</span><button disabled={!data.next} onClick={() => setParams({ page: String(page + 1) })}>다음</button></nav>}
    </> : <div className={s.empty}><h2>첫 영상을 등록해보세요</h2><p>일반 영상과 Shorts 링크를 모두 사용할 수 있습니다.</p><Link className={s.primary} to="/landing/admin/videos/new">영상 등록 시작</Link></div>}
  </>}</VideoLayout>;
}
