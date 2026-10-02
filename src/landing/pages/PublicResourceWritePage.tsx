import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { createRandomUuid } from "@/shared/utils/randomUuid";
import ResourceLayout, { ResourceFailure } from "../components/ResourceLayout";
import { discardResourceFile, getResource, resourceError, resourceSize, saveResource, uploadResource, type ResourceCategory, type ResourceFile } from "../api/publicResources";
import { useResourcePublisher } from "../hooks/useResourcePublisher";
import styles from "./PublicResources.module.css";

export default function PublicResourceWritePage() {
  const { id } = useParams(); const navigate = useNavigate(); const publisher = useResourcePublisher();
  const [title, setTitle] = useState(""); const [category, setCategory] = useState<ResourceCategory>("matchup"); const [content, setContent] = useState("");
  const [files, setFiles] = useState<ResourceFile[]>([]); const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0); const busyRef = useRef(false); const pending = useRef(new Set<string>());
  const saved = useRef(false); const disposed = useRef(false); const [requestId] = useState(createRandomUuid);
  useEffect(() => {
    disposed.current = false;
    const pendingUploads = pending.current;
    return () => { disposed.current = true; if (!saved.current) for (const fileId of pendingUploads) void discardResourceFile(fileId).catch(() => undefined); };
  }, []);
  useEffect(() => {
    if (!id || publisher.state !== "allowed") return;
    let cancelled = false; setLoading(true); setLoadError("");
    getResource(id).then((post) => { if (!cancelled) { setTitle(post.title); setCategory(post.category); setContent(post.content); setFiles(post.files); } })
      .catch((failure) => { if (!cancelled) setLoadError(resourceError(failure, "수정할 자료를 불러오지 못했습니다.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, publisher.state, retry]);
  async function addFiles(selected: FileList | null) {
    if (!selected || busyRef.current) return;
    const queue = Array.from(selected);
    if (files.length + queue.length > 5) { setError("파일은 최대 5개까지 첨부할 수 있습니다."); return; }
    if (queue.some((file) => !/\.(pdf|hwp|hwpx)$/i.test(file.name) || file.size === 0 || file.size > 30 * 1024 * 1024)) { setError("비어 있지 않은 30MB 이하의 PDF·HWP·HWPX 파일을 선택해주세요."); return; }
    busyRef.current = true; setBusy(true); setError("");
    try {
      for (const source of queue) {
        const file = await uploadResource(source);
        pending.current.add(file.id);
        if (disposed.current) { await discardResourceFile(file.id); pending.current.delete(file.id); break; }
        setFiles((previous) => [...previous, file]);
      }
    } catch (failure) { if (!disposed.current) setError(resourceError(failure, "파일을 올리지 못했습니다. 이미 올라간 파일은 유지됩니다.")); }
    finally { busyRef.current = false; if (!disposed.current) setBusy(false); }
  }
  async function removeFile(file: ResourceFile) {
    if (busyRef.current) return; busyRef.current = true; setBusy(true); setError("");
    try { if (pending.current.has(file.id)) { await discardResourceFile(file.id); pending.current.delete(file.id); } setFiles((previous) => previous.filter((value) => value.id !== file.id)); }
    catch (failure) { setError(resourceError(failure, "첨부를 정리하지 못했습니다. 다시 시도해주세요.")); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function cancel() {
    if (busyRef.current) return; busyRef.current = true; setBusy(true); setError("");
    try { for (const fileId of pending.current) { await discardResourceFile(fileId); pending.current.delete(fileId); } navigate(id ? `/landing/resources/${id}` : "/landing/resources"); }
    catch (failure) { setError(resourceError(failure, "첨부 정리가 끝나지 않았습니다. 돌아가기를 다시 눌러주세요.")); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busyRef.current) return;
    if (!title.trim() || !files.length) { setError("제목과 첨부 파일을 확인해주세요."); return; }
    busyRef.current = true; setBusy(true); setError("");
    try {
      const post = await saveResource({ request_id: requestId, title: title.trim(), category, content, file_ids: files.map((file) => file.id) }, id);
      saved.current = true; pending.current.clear(); navigate(`/landing/resources/${post.id}`, { replace: true });
    } catch (failure) { setError(resourceError(failure, "게시하지 못했습니다. 입력한 내용은 유지됩니다. 다시 시도해주세요.")); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <ResourceLayout>
    <button className={styles.back} type="button" disabled={busy} onClick={() => void cancel()}>← 돌아가기</button>
    <h1>{id ? "자료 수정" : "자료 올리기"}</h1>
    {publisher.state === "loading" && <p role="status">게시 권한을 확인하는 중입니다…</p>}
    {publisher.state === "error" && <ResourceFailure message="게시 권한을 확인하지 못했습니다." onRetry={publisher.retry} />}
    {publisher.state === "denied" && <div className={styles.empty}><strong>지정된 두 게시자만 자료를 올릴 수 있습니다.</strong><p>자료 열람과 다운로드는 누구나 이용할 수 있습니다.</p><Link to="/landing/resources">자료게시판 보기</Link></div>}
    {publisher.state === "allowed" && loading && <p role="status">수정할 자료를 불러오는 중입니다…</p>}
    {loadError && <ResourceFailure message={loadError} onRetry={() => setRetry((value) => value + 1)} />}
    {publisher.state === "allowed" && !loading && !loadError && <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <label>분류<select value={category} disabled={busy} onChange={(event) => setCategory(event.target.value as ResourceCategory)}><option value="matchup">매치업</option><option value="analysis">분석자료</option></select></label>
      <label>제목<input required maxLength={200} value={title} disabled={busy} onChange={(event) => setTitle(event.target.value)} placeholder="자료 제목을 입력해주세요" /></label>
      <label>설명<textarea maxLength={20000} rows={6} value={content} disabled={busy} onChange={(event) => setContent(event.target.value)} placeholder="자료에 대한 안내를 적어주세요 (선택)" /></label>
      <div className={styles.upload}><label>첨부 자료<input type="file" accept=".pdf,.hwp,.hwpx" multiple disabled={busy || files.length >= 5} onChange={(event) => { void addFiles(event.target.files); event.target.value = ""; }} /></label>
        <p className={styles.hint}>PDF·HWP·HWPX / 파일당 30MB / 최대 5개. 올린 파일은 게시하기 전까지 공개되지 않습니다.</p>
        {files.map((file) => <div key={file.id} className={styles.file}><div><strong>{file.filename}</strong><span>{resourceSize(file.size)}</span></div><button type="button" disabled={busy} onClick={() => void removeFile(file)}>첨부 취소</button></div>)}
      </div>
      {error && <ResourceFailure message={error} />}
      <p className={styles.hint}>게시하면 로그인하지 않은 방문자도 본문과 첨부 파일을 볼 수 있습니다.</p>
      <button className={styles.primary} type="submit" disabled={busy}>{busy ? "처리 중…" : id ? "수정 내용 게시" : "게시하기"}</button>
    </form>}
  </ResourceLayout>;
}
