import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import ResourceLayout, { ResourceFailure } from "../components/ResourceLayout";
import MatchupInlinePdf from "../components/MatchupInlinePdf";
import { deleteResource, getResource, resourceError, resourceFileLink, resourceSize, type ResourceFile, type ResourcePost } from "../api/publicResources";
import { useResourcePublisher } from "../hooks/useResourcePublisher";
import styles from "./PublicResources.module.css";

export default function PublicResourceDetailPage() {
  const { id = "" } = useParams(); const navigate = useNavigate(); const publisher = useResourcePublisher();
  const [post, setPost] = useState<ResourcePost | null>(null); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(""); const [retry, setRetry] = useState(0);
  const [preview, setPreview] = useState<{ url: string; file: ResourceFile } | null>(null);
  useEffect(() => {
    let disposed = false; setLoading(true); setError(""); setPost(null); setPreview(null);
    getResource(id).then((result) => { if (!disposed) setPost(result); }).catch((failure: unknown) => {
      if (!disposed) setError((failure as { response?: { status?: number } })?.response?.status === 404 ? "삭제됐거나 공개되지 않은 자료입니다." : "자료를 불러오지 못했습니다.");
    }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [id, retry]);
  async function openFile(file: ResourceFile, inline: boolean) {
    if (busy) return; setBusy(file.id); setActionError("");
    try {
      const url = await resourceFileLink(file.id);
      if (inline) setPreview({ url, file });
      else { const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.filename; anchor.rel = "noopener"; document.body.appendChild(anchor); anchor.click(); anchor.remove(); }
    } catch (failure) { setActionError(resourceError(failure, "파일을 준비하지 못했습니다. 다시 눌러주세요.")); }
    finally { setBusy(""); }
  }
  async function removePost() {
    if (!post || busy || !window.confirm("이 자료를 삭제하시겠습니까? 삭제하면 방문자가 더 이상 볼 수 없습니다.")) return;
    setBusy("delete"); setActionError("");
    try { await deleteResource(post.id); navigate("/landing/resources", { replace: true }); }
    catch (failure) { setActionError(resourceError(failure, "삭제하지 못했습니다. 다시 시도해주세요.")); }
    finally { setBusy(""); }
  }
  return <ResourceLayout>
    <Link to="/landing/resources" className={styles.back}>← 자료게시판</Link>
    {loading && <p className={styles.state} role="status">자료를 불러오는 중입니다…</p>}
    {error && <ResourceFailure message={error} onRetry={() => setRetry((value) => value + 1)} />}
    {post && <article className={styles.article}>
      <p className={styles.eyebrow}>{post.category === "matchup" ? "매치업" : "분석자료"}</p><h1>{post.title}</h1>
      <div className={styles.meta}><span>{post.author_display_name}</span><time dateTime={post.created_at}>{new Date(post.created_at).toLocaleDateString("ko-KR")}</time></div>
      {publisher.state === "allowed" && <div className={styles.actions}><Link to={`/landing/resources/${post.id}/edit`}>수정</Link><button type="button" disabled={!!busy} onClick={() => void removePost()}>삭제</button></div>}
      {publisher.state === "error" && <ResourceFailure message="게시 권한을 확인하지 못했습니다." onRetry={publisher.retry} />}
      {post.content && <p className={styles.body}>{post.content}</p>}
      <section className={styles.attachments} aria-label="첨부 파일"><h2>첨부 자료</h2>
        {post.files.map((file) => <div className={styles.file} key={file.id}><div><strong>{file.filename}</strong><span>{file.extension.toUpperCase()} · {resourceSize(file.size)}</span></div>
          <div className={styles.fileActions}>{file.extension === "pdf" && <button type="button" disabled={!!busy} onClick={() => void openFile(file, true)}>PDF 미리보기</button>}
            <button type="button" disabled={!!busy} onClick={() => void openFile(file, false)}>{busy === file.id ? "준비 중…" : "원본 다운로드"}</button></div>
        </div>)}
        {post.files.some((file) => file.extension !== "pdf") && <p className={styles.hint}>HWP·HWPX는 내려받은 뒤 한글 또는 호환 프로그램에서 열어주세요.</p>}
      </section>
      {actionError && <ResourceFailure message={actionError} />}
      {preview && <section className={styles.preview} aria-label="PDF 미리보기"><div className={styles.previewHead}><h2>{preview.file.filename}</h2><button type="button" disabled={!!busy} onClick={() => void openFile(preview.file, true)}>미리보기 다시 불러오기</button></div><MatchupInlinePdf url={preview.url} title={preview.file.filename} /></section>}
    </article>}
  </ResourceLayout>;
}
