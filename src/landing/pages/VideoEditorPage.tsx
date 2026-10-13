import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { createRandomUuid } from "@/shared/utils/randomUuid";
import { createVideo, getManagedShowcase, getManagedVideo, publishVideo, resolveVideo, saveVideo, videoCategories, videoStatuses, type ManagedVideo, type VideoContent, type VideoShowcase, type VideoSource } from "../api/publicVideos";
import { resourceError } from "../api/publicResources";
import VideoLayout, { VideoAccess, VideoFailure } from "../components/VideoLayout";
import VideoDialog from "../components/VideoPlayer";
import { useVideoPublisher } from "../hooks/useVideoPublisher";
import s from "./PublicVideos.module.css";

const EMPTY: VideoContent = { title: "", summary: "", category: "interview", format: "landscape" };
export default function VideoEditorPage() {
  const { id } = useParams(); const publisher = useVideoPublisher(); const navigate = useNavigate();
  const [row, setRow] = useState<ManagedVideo | null>(null); const [showcase, setShowcase] = useState<VideoShowcase | null>(null);
  const [url, setUrl] = useState(""); const [source, setSource] = useState<VideoSource | null>(null); const [content, setContent] = useState<VideoContent>(EMPTY);
  const [hero, setHero] = useState(false); const [preview, setPreview] = useState(false); const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(""); const busyRef = useRef(false); const [retry, setRetry] = useState(0);
  const [error, setError] = useState(""); const [loadError, setLoadError] = useState(""); const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false); const [duplicate, setDuplicate] = useState<string | null>(null);
  const [latest, setLatest] = useState<{ row: ManagedVideo; showcase: VideoShowcase } | null>(null);
  const request = useRef({ id: createRandomUuid(), body: "" });
  const dirty = JSON.stringify(content) !== JSON.stringify(row?.draft_content || EMPTY) || (!row && !!url);
  useEffect(() => {
    if (publisher.state !== "allowed") return;
    let disposed = false; setLoading(true); setLoadError(""); setError(""); setConflict(false); setLatest(null); setDuplicate(null); setPreview(false); setMessage("");
    Promise.all([id ? getManagedVideo(id) : Promise.resolve(null), getManagedShowcase()]).then(([video, current]) => {
      if (disposed) return;
      setRow(video); setShowcase(current); setContent(video?.draft_content || EMPTY); setSource(video); setUrl(video?.canonical_url || ""); setHero(!!video && current.hero_video_id === video.id);
    }).catch((failure) => { if (!disposed) setLoadError(resourceError(failure, "편집할 영상을 불러오지 못했습니다.")); }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [id, publisher.state, retry]);
  useEffect(() => {
    if (!dirty) return;
    const before = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const leave = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.("a[href]");
      if (!link || link.getAttribute("target") === "_blank") return;
      if (!window.confirm("저장하지 않은 입력이 있습니다. 이 페이지를 나갈까요?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", before); document.addEventListener("click", leave, true);
    return () => { window.removeEventListener("beforeunload", before); document.removeEventListener("click", leave, true); };
  }, [dirty]);
  async function run(label: string, work: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(label); setError(""); setMessage(""); setDuplicate(null);
    try { await work(); }
    catch (failure) {
      const response = (failure as { response?: { status?: number; data?: { existing_id?: string } } }).response;
      setError(resourceError(failure, "요청을 완료하지 못했습니다. 입력은 유지됩니다. 다시 시도해주세요."));
      if (response?.status === 409) { setConflict(!!row); setDuplicate(response.data?.existing_id || null); }
    } finally { busyRef.current = false; setBusy(""); }
  }
  function lookup(event: FormEvent) {
    event.preventDefault();
    void run("영상 확인 중…", async () => {
      const result = await resolveVideo(url); setSource(result); setUrl(result.canonical_url);
      setContent((before) => ({ ...before, title: before.title || result.source_title.slice(0, 90), format: result.format }));
      setMessage("영상을 확인했습니다. 홈페이지에 표시할 제목과 소개를 다듬어주세요.");
    });
  }
  async function persist(): Promise<ManagedVideo> {
    if (row) { const saved = await saveVideo(row, content); setRow(saved); return saved; }
    const body = JSON.stringify({ url, content });
    if (request.current.body && request.current.body !== body) request.current.id = createRandomUuid();
    request.current.body = body;
    const saved = await createVideo(url, request.current.id, content); setRow(saved); setSource(saved); return saved;
  }
  function save(event: FormEvent) {
    event.preventDefault();
    void run("저장 중…", async () => { const saved = await persist(); if (!id) navigate(`/landing/admin/videos/${saved.id}`, { replace: true }); setMessage("임시저장했습니다. 공개 화면은 변경되지 않았습니다."); });
  }
  function publish() {
    if (!showcase || !window.confirm(hero ? "이 영상을 공개하고 홈페이지 대표 영상으로 표시할까요?" : "입력한 내용으로 영상을 공개할까요?")) return;
    void run("공개 중…", async () => {
      const saved = await persist(); const result = await publishVideo(saved, showcase, hero);
      setRow(result.video); setSource(result.video); setShowcase({ revision: result.showcase_revision, hero_video_id: hero ? saved.id : showcase.hero_video_id === saved.id ? null : showcase.hero_video_id });
      if (!id) navigate(`/landing/admin/videos/${saved.id}`, { replace: true }); setMessage("공개했습니다. 방문자 화면에서 영상을 확인할 수 있습니다.");
    });
  }
  function hide() {
    if (!row || !showcase || !window.confirm("이 영상을 비공개로 전환할까요? 대표 영상이면 홈페이지 첫 화면에서도 내려갑니다. 저장된 내용은 유지됩니다.")) return;
    void run("비공개 전환 중…", async () => {
      const result = await publishVideo(row, showcase, false, "unpublish"); setRow(result.video); setHero(false);
      setShowcase({ revision: result.showcase_revision, hero_video_id: showcase.hero_video_id === row.id ? null : showcase.hero_video_id }); setMessage("비공개로 전환했습니다. 저장된 내용은 다시 공개할 수 있습니다.");
    });
  }
  function checkLatest() {
    if (!row) return;
    void run("최신 상태 확인 중…", async () => { const [video, current] = await Promise.all([getManagedVideo(row.id), getManagedShowcase()]); setLatest({ row: video, showcase: current }); });
  }
  function acceptLatest(keepInput: boolean) {
    if (!latest) return;
    setRow(latest.row); setSource(latest.row); setShowcase(latest.showcase); setHero(latest.showcase.hero_video_id === latest.row.id);
    if (!keepInput) setContent(latest.row.draft_content);
    setLatest(null); setConflict(false); setError(""); setMessage(keepInput ? "내 입력을 유지했습니다. 변경 내용을 검토한 뒤 다시 저장해주세요." : "최신 저장 내용을 불러왔습니다.");
  }
  const formDisabled = !!busy || conflict;
  return <VideoLayout title={id ? "영상 편집" : "새 영상 등록"}>{publisher.state !== "allowed" ? <VideoAccess publisher={publisher} /> : loading ? <p role="status">편집 화면을 불러오고 있습니다.</p> : loadError ? <VideoFailure message={loadError} retry={() => setRetry((value) => value + 1)} /> : <>
    <Link className={s.back} to="/landing/admin/videos">← 영상 관리</Link><div className={s.pageHeading}><span className={s.kicker}>VIDEO STUDIO</span><h1>{id ? "이야기를 다듬는 공간" : "새로운 이야기를 더하세요"}</h1><p>{row ? `${videoStatuses[row.status]} · 공개할 때 원본 영상 정보를 다시 확인합니다.` : "파일 업로드 없이 YouTube 주소로 등록합니다. 일반 영상과 Shorts 모두 지원합니다."}</p></div>
    {error && <VideoFailure message={error} />}{duplicate && <Link className={s.secondary} to={`/landing/admin/videos/${duplicate}`}>기존 등록 영상 열기</Link>}<p role="status" className={s.message}>{busy || message}</p>
    {conflict && <div className={s.notice}><h2>다른 게시자의 변경이 있습니다</h2><p>내 입력은 유지했습니다. 최신 저장 내용과 대표 영상 상태를 확인한 뒤 이어서 편집해주세요.</p><button type="button" onClick={checkLatest} disabled={!!busy}>최신 상태 확인</button>{latest && <div className={s.latest}><strong>{latest.row.draft_content.title}</strong><p>{latest.row.draft_content.summary}</p><p>{videoCategories[latest.row.draft_content.category]} · {latest.row.draft_content.format === "vertical" ? "Shorts" : "일반 영상"} · {videoStatuses[latest.row.status]} · {latest.showcase.hero_video_id === latest.row.id ? "홈 대표" : "홈 대표 아님"}</p><div className={s.actions}><button type="button" onClick={() => acceptLatest(false)}>최신 내용 불러오기</button><button type="button" onClick={() => acceptLatest(true)}>내 입력으로 이어서 수정</button></div></div>}</div>}
    <div className={s.editorGrid}><div>
      {!row && <form className={s.panel} onSubmit={lookup}><label htmlFor="video-url">01 · YouTube 링크</label><p>youtu.be, youtube.com/watch, youtube.com/shorts 주소를 붙여넣으세요.</p><div className={s.urlRow}><input id="video-url" type="url" required value={url} onChange={(event) => { setUrl(event.target.value); setSource(null); }} placeholder="https://youtu.be/…" disabled={!!busy} /><button className={s.secondary} disabled={!!busy} type="submit">영상 확인</button></div><p className={s.hint}>정보 확인이 잠시 어려워도 제목을 직접 입력해 임시저장할 수 있습니다.</p></form>}
      <form id="video-content-form" className={s.panel} onSubmit={save}>
        <label htmlFor="video-title">{row ? "홈페이지 표시 정보" : "02 · 홈페이지 표시 정보"}</label><label className={s.field} htmlFor="video-title">제목 <span>{content.title.length}/90</span><input id="video-title" required maxLength={90} value={content.title} onChange={(event) => setContent({ ...content, title: event.target.value })} disabled={formDisabled} /></label>
        <label className={s.field} htmlFor="video-summary">한 줄 소개 <span>{content.summary.length}/220</span><textarea id="video-summary" maxLength={220} rows={3} value={content.summary} onChange={(event) => setContent({ ...content, summary: event.target.value })} disabled={formDisabled} /></label>
        <div className={s.fieldColumns}><label className={s.field} htmlFor="video-category">분류<select id="video-category" value={content.category} onChange={(event) => setContent({ ...content, category: event.target.value as VideoContent["category"] })} disabled={formDisabled}>{Object.entries(videoCategories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className={s.field} htmlFor="video-format">영상 형태<select id="video-format" value={content.format} onChange={(event) => setContent({ ...content, format: event.target.value as VideoContent["format"] })} disabled={formDisabled}><option value="landscape">일반 영상</option><option value="vertical">Shorts</option></select></label></div>
        <label className={s.check}><input type="checkbox" checked={hero} onChange={(event) => setHero(event.target.checked)} disabled={formDisabled} /><span><strong>홈페이지 대표 영상으로 표시</strong><small>공개할 때 적용됩니다. 기존 대표 영상은 영상 모아보기에 남습니다.</small></span></label>
        <div className={s.actions}><button className={s.secondary} type="submit" disabled={formDisabled}>임시저장</button><button className={s.primary} type="button" disabled={formDisabled || !content.title.trim() || (!row && !url.trim())} onClick={publish}>{row?.status === "published" ? "수정 내용 공개" : "공개하기"}</button></div>
        {row?.status === "published" && <div className={s.publishFooter}><Link to={`/landing/videos/${row.id}`} target="_blank">공개 화면 확인 ↗</Link><button type="button" className={s.textButton} disabled={formDisabled} onClick={hide}>비공개로 전환</button></div>}
      </form>
    </div><aside className={s.previewPanel}><span className={s.kicker}>PREVIEW</span><h2>방문자에게 이렇게 보여요</h2>{source ? <><div className={s.previewImage}><img src={source.thumbnail_url || `https://i.ytimg.com/vi/${source.youtube_video_id}/hqdefault.jpg`} alt="영상 미리보기" /></div><span className={s.kicker}>{videoCategories[content.category]}</span><h3>{content.title || "영상 제목"}</h3><p>{content.summary || "한 줄 소개를 입력해보세요."}</p><button type="button" className={s.secondary} onClick={(event) => { event.currentTarget.focus(); setPreview(true); }}>재생 미리보기</button><p className={s.source}>원본 채널 · {source.channel_title || "공개할 때 확인"}</p><a className={s.external} href={source.canonical_url} target="_blank" rel="noopener noreferrer">YouTube 원본 확인 ↗</a></> : <div className={s.empty}>링크를 확인하면 영상 미리보기가 표시됩니다.</div>}<p className={s.hint}>조회수는 YouTube의 유효 재생 기준에 따라 원본 영상에 반영됩니다. 좋아요는 로그인한 YouTube에서 직접 누를 수 있습니다.</p></aside></div>
    {preview && source && <VideoDialog video={{ ...source, ...content }} close={() => setPreview(false)} />}
  </>}</VideoLayout>;
}
