import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { createRandomUuid } from "@/shared/utils/randomUuid";
import ResourceDocumentReader from "../components/ResourceDocumentReader";
import ResourceLayout, { ResourceFailure } from "../components/ResourceLayout";
import { discardResourceFile, getResource, resourceError, resourceSize, saveResource, uploadResource, type ReaderStatus, type ResourceCategory, type ResourceFile } from "../api/publicResources";
import { useResourcePublisher } from "../hooks/useResourcePublisher";
import styles from "./PublicResources.module.css";

export default function PublicResourceWritePage() {
  const { id } = useParams(); const navigate = useNavigate(); const publisher = useResourcePublisher();
  const [title, setTitle] = useState(""); const [category, setCategory] = useState<ResourceCategory>("matchup"); const [content, setContent] = useState("");
  const [files, setFiles] = useState<ResourceFile[]>([]); const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0); const busyRef = useRef(false); const pending = useRef(new Set<string>());
  const [publishedSummary, setPublishedSummary] = useState<{ title: string; content: string; filenames: string[] } | null>(null);
  const [publishedId, setPublishedId] = useState<string>();
  const targetId = id || publishedId;
  const [version, setVersion] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const [cleanupIds, setCleanupIds] = useState<string[]>([]);
  const [progress, setProgress] = useState("");
  const saved = useRef(false); const disposed = useRef(false); const [requestId] = useState(createRandomUuid);
  useEffect(() => {
    disposed.current = false;
    const pendingUploads = pending.current;
    return () => { disposed.current = true; if (!saved.current) for (const fileId of pendingUploads) void discardResourceFile(fileId).catch(() => undefined); };
  }, []);
  useEffect(() => {
    if (!id || publisher.state !== "allowed") return;
    let cancelled = false; setLoading(true); setLoadError("");
    getResource(id).then((post) => { if (!cancelled) { setTitle(post.title); setCategory(post.category); setContent(post.content); setFiles(post.files); setVersion(post.updated_at); setConflict(false); } })
      .catch((failure) => { if (!cancelled) setLoadError(resourceError(failure, "수정할 자료를 불러오지 못했습니다.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, publisher.state, retry]);
  async function addFiles(selected: FileList | null) {
    if (!selected || busyRef.current) return;
    const queue = Array.from(selected);
    if (files.length + queue.length > 5) { setError("파일은 최대 5개까지 첨부할 수 있습니다."); return; }
    if (queue.some((file) => file.size === 0 || file.size > 30 * 1024 * 1024)) { setError("비어 있지 않은 30MB 이하의 파일을 선택해주세요."); return; }
    busyRef.current = true; setBusy(true); setError("");
    try {
      for (const source of queue) {
        const prefix = `${queue.indexOf(source) + 1}/${queue.length} · ${source.name}`;
        setProgress(`${prefix} 업로드 중…`);
        const file = await uploadResource(source, (percent) => { if (!disposed.current) setProgress(`${prefix} ${percent}%${percent === 100 ? " · 파일 확인 중…" : ""}`); });
        pending.current.add(file.id);
        if (disposed.current) { await discardResourceFile(file.id); pending.current.delete(file.id); break; }
        setFiles((previous) => [...previous, file]);
      }
    } catch (failure) { if (!disposed.current) setError(resourceError(failure, "파일을 올리지 못했습니다. 이미 올라간 파일은 유지됩니다.")); }
    finally { busyRef.current = false; if (!disposed.current) { setBusy(false); setProgress(""); } }
  }
  async function removeFile(file: ResourceFile) {
    if (busyRef.current) return; busyRef.current = true; setBusy(true); setError("");
    try { if (pending.current.has(file.id)) { setCleanupIds((ids) => [...new Set([...ids, file.id])]); await discardResourceFile(file.id); pending.current.delete(file.id); setCleanupIds((ids) => ids.filter((value) => value !== file.id)); } setFiles((previous) => previous.filter((value) => value.id !== file.id)); }
    catch (failure) { setError(resourceError(failure, "첨부를 정리하지 못했습니다. 다시 시도해주세요.")); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function cleanPending() {
    for (const fileId of pending.current) {
      setCleanupIds((ids) => [...new Set([...ids, fileId])]);
      await discardResourceFile(fileId);
      pending.current.delete(fileId);
      setFiles((previous) => previous.filter((file) => file.id !== fileId));
      setCleanupIds((ids) => ids.filter((value) => value !== fileId));
    }
  }
  async function reloadLatest() {
    if (!targetId || busyRef.current || !window.confirm("입력한 수정 내용과 새 첨부를 정리하고 최신 게시물을 불러올까요?")) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      await cleanPending(); const post = await getResource(targetId);
      setTitle(post.title); setCategory(post.category); setContent(post.content); setFiles(post.files);
      setVersion(post.updated_at); setConflict(false); setPublishedSummary(null);
    }
    catch (failure) { setError(resourceError(failure, "첨부를 정리하지 못했습니다. 입력은 유지됩니다. 다시 시도해주세요.")); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function cancel() {
    if (busyRef.current) return; busyRef.current = true; setBusy(true); setError("");
    try { await cleanPending(); navigate(targetId ? `/landing/resources/${targetId}` : "/landing/resources"); }
    catch (failure) { setError(resourceError(failure, "첨부 정리가 끝나지 않았습니다. 돌아가기를 다시 눌러주세요.")); }
    finally { busyRef.current = false; setBusy(false); }
  }
  function updateReaderStatus(fileId: string, status: ReaderStatus) {
    setFiles((previous) => previous.some((file) => file.id === fileId && file.reader_status !== status)
      ? previous.map((file) => file.id === fileId ? { ...file, reader_status: status } : file) : previous);
  }
  function moveFile(fileId: string, offset: number) {
    setFiles((previous) => {
      const index = previous.findIndex((file) => file.id === fileId);
      const destination = index + offset;
      if (index < 0 || destination < 0 || destination >= previous.length) return previous;
      const next = [...previous]; [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  }
  const preparing = files.some((file) => !["ready", "unsupported"].includes(file.reader_status));
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busyRef.current) return;
    if (cleanupIds.length) { setError("정리 중인 첨부의 취소를 다시 시도한 뒤 게시해주세요."); return; }
    if (!title.trim() || (!content.trim() && !files.some((file) => file.reader_status === "ready"))) { setError("제목과 방문자가 읽을 본문 또는 문서를 확인해주세요."); return; }
    if (preparing) { setError("문서 본문 준비가 끝난 뒤 게시해주세요. 아래에서 다시 시도할 수 있습니다."); return; }
    busyRef.current = true; setBusy(true); setError("");
    try {
      const post = await saveResource({ request_id: requestId, ...(targetId && version ? { expected_updated_at: version } : {}), title: title.trim(), category, content, file_ids: files.map((file) => file.id) }, targetId);
      saved.current = true; pending.current.clear(); navigate(`/landing/resources/${post.id}`, { replace: true });
    } catch (failure) {
      const response = (failure as { response?: { status?: number; data?: { post_id?: unknown; updated_at?: unknown; file_ids?: unknown; published_title?: unknown; published_content?: unknown; published_filenames?: unknown } } })?.response;
      const existing = response?.data; const postId = Number(existing?.post_id);
      if (!targetId && response?.status === 409 && Number.isSafeInteger(postId) && postId > 0
        && typeof existing?.updated_at === "string" && Array.isArray(existing.file_ids)) {
        const attached = new Set(existing.file_ids.filter((value): value is string => typeof value === "string"));
        for (const fileId of attached) pending.current.delete(fileId);
        setCleanupIds((ids) => ids.filter((fileId) => !attached.has(fileId)));
        setPublishedId(String(postId)); setVersion(existing.updated_at);
        const hasSummary = typeof existing.published_title === "string" && typeof existing.published_content === "string" && Array.isArray(existing.published_filenames);
        setConflict(!hasSummary);
        setPublishedSummary(hasSummary ? { title: existing.published_title as string, content: existing.published_content as string, filenames: (existing.published_filenames as unknown[]).filter((value): value is string => typeof value === "string") } : null);
      } else setConflict(response?.status === 409);
      setError(resourceError(failure, "게시하지 못했습니다. 입력한 내용은 유지됩니다. 다시 시도해주세요."));
    }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <ResourceLayout>
    <button className={styles.back} type="button" disabled={busy} onClick={() => void cancel()}>← 돌아가기</button>
    <h1>{targetId ? "글 수정" : "글 올리기"}</h1>
    {publisher.state === "loading" && <p role="status">게시 권한을 확인하는 중입니다…</p>}
    {publisher.state === "error" && <ResourceFailure message="게시 권한을 확인하지 못했습니다." onRetry={publisher.retry} />}
    {publisher.state === "denied" && <div className={styles.empty}><strong>지정된 두 게시자만 자료를 올릴 수 있습니다.</strong><p>자료 열람과 다운로드는 누구나 이용할 수 있습니다.</p><Link to="/landing/resources">자료게시판 보기</Link></div>}
    {publisher.state === "allowed" && loading && <p role="status">수정할 자료를 불러오는 중입니다…</p>}
    {loadError && <ResourceFailure message={loadError} onRetry={() => setRetry((value) => value + 1)} />}
    {publisher.state === "allowed" && !loading && !loadError && <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <label>분류<select aria-label="분류" value={category} disabled={busy} onChange={(event) => setCategory(event.target.value as ResourceCategory)}><option value="matchup">매치업</option><option value="analysis">분석자료</option></select></label>
      <label>제목<input required maxLength={200} value={title} disabled={busy} onChange={(event) => setTitle(event.target.value)} placeholder="자료 제목을 입력해주세요" /></label>
      <label>본문 <span className={styles.hint}>(선택)</span><textarea aria-label="본문" maxLength={20000} rows={3} value={content} disabled={busy} onChange={(event) => setContent(event.target.value)} placeholder="덧붙일 설명이 있을 때만 작성하세요. 완성한 파일은 아래에 그대로 첨부하면 됩니다." /></label>
      <div className={styles.upload}><label>첨부 자료<input type="file" multiple disabled={busy || files.length >= 5} onChange={(event) => { void addFiles(event.target.files); event.target.value = ""; }} /></label>
        <p className={styles.hint}>완성한 파일을 통째로 올려주세요. PDF·한글(HWP/HWPX)·Word·엑셀·PPT·이미지·텍스트는 글 안에서 바로 보입니다. 파일당 30MB, 최대 5개, 문서 100쪽까지. 그 외 파일은 원본으로 첨부됩니다.</p>
        {files.map((file, index) => <div key={file.id} className={styles.file}><div><strong>{file.filename}</strong><span>{resourceSize(file.size)}{cleanupIds.includes(file.id) ? " · 첨부 정리 필요" : ""}</span></div><div className={styles.fileOrder}><button type="button" disabled={busy || index === 0} onClick={() => moveFile(file.id, -1)} aria-label={`${file.filename} 위로`}>↑</button><button type="button" disabled={busy || index === files.length - 1} onClick={() => moveFile(file.id, 1)} aria-label={`${file.filename} 아래로`}>↓</button><button type="button" disabled={busy} onClick={() => void removeFile(file)} aria-label={`${file.filename} 첨부 취소`}>{cleanupIds.includes(file.id) ? "첨부 취소 다시 시도" : "첨부 취소"}</button></div></div>)}
      </div>
      {progress && <p className={styles.hint} role="status" aria-live="polite">{progress}</p>}
      {error && <ResourceFailure message={error} />}
      {publishedSummary && <details className={styles.recovery} open><summary>이미 게시된 내용과 비교</summary><strong>{publishedSummary.title}</strong><p>{publishedSummary.content || "작성한 본문 없음"}</p><ul>{publishedSummary.filenames.map((filename, index) => <li key={`${index}-${filename}`}>{filename}</li>)}</ul><p>아래 게시 버튼은 현재 입력한 내용으로 이 글을 수정합니다. 최신 게시 내용과 비교한 뒤 반영해주세요.</p><Link to={`/landing/resources/${targetId}`} target="_blank" rel="noopener">게시된 자료 보기 (새 창)</Link></details>}
      {conflict && <div className={styles.actions}><Link to={`/landing/resources/${targetId}`} target="_blank" rel="noopener">최신 게시물 확인 (새 창)</Link><button type="button" disabled={busy} onClick={() => void reloadLatest()}>최신 내용으로 다시 편집</button></div>}
      {!!cleanupIds.length && <p className={styles.hint}>정리가 끝나지 않은 첨부는 게시할 수 없습니다. 첨부 취소를 다시 시도해주세요.</p>}
      <p className={styles.hint}>게시하면 로그인하지 않은 방문자도 글과 보고서를 바로 읽을 수 있습니다.</p>
      <button className={styles.primary} type="submit" disabled={busy || !!cleanupIds.length || conflict || preparing}>{busy ? "처리 중…" : targetId ? "수정 내용 게시" : "게시하기"}</button>
      <section className={styles.editorPreview} tabIndex={0} aria-label="방문자 읽기 화면">
        <h2>첨부 파일 미리보기</h2>
        <p className={styles.hint}>파일을 나누거나 내용을 다시 작성할 필요가 없습니다. 아래 문서가 그대로 게시됩니다.</p>
        {content && <div className={styles.articleIntro}>{content.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>}
        {files.filter((file) => file.reader_status !== "unsupported").map((file) => <ResourceDocumentReader key={file.id} file={file} preview onStatus={updateReaderStatus} />)}
        {preparing && <p role="status" className={styles.hint}>첨부 파일을 준비하고 있습니다. 완료되면 게시하기 버튼을 누르세요.</p>}
      </section>
    </form>}
  </ResourceLayout>;
}
