import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowDown, Download, Link2 } from "lucide-react";
import { ICON_FOR_BUTTON } from "@/shared/ui/ds/iconSize";
import ResourceLayout, { ResourceFailure } from "../components/ResourceLayout";
import ResourceDocumentReader from "../components/ResourceDocumentReader";
import { deleteResource, getResource, resourceError, resourceFileLink, resourceSize, type ResourceFile, type ResourcePost } from "../api/publicResources";
import { useResourcePublisher } from "../hooks/useResourcePublisher";
import styles from "./PublicResources.module.css";

export default function PublicResourceDetailPage() {
  const { id = "" } = useParams(); const navigate = useNavigate(); const publisher = useResourcePublisher();
  const [post, setPost] = useState<ResourcePost | null>(null); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(""); const [retry, setRetry] = useState(0);
  const [shareMessage, setShareMessage] = useState(""); const busyRef = useRef(false);
  useEffect(() => {
    let disposed = false; setLoading(true); setError(""); setPost(null); setShareMessage("");
    getResource(id).then((result) => { if (!disposed) setPost(result); }).catch((failure: unknown) => {
      if (!disposed) setError((failure as { response?: { status?: number } })?.response?.status === 404 ? "삭제됐거나 공개되지 않은 글입니다." : "글을 불러오지 못했습니다.");
    }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [id, retry]);
  async function download(file: ResourceFile) {
    if (busyRef.current) return; busyRef.current = true; setBusy(file.id); setActionError("");
    try {
      const url = await resourceFileLink(file.id);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.filename; anchor.rel = "noopener"; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    } catch (failure) { setActionError(resourceError(failure, "원본을 준비하지 못했습니다. 다시 눌러주세요.")); }
    finally { busyRef.current = false; setBusy(""); }
  }
  async function removePost() {
    if (!post || busyRef.current || !window.confirm("이 글을 삭제하시겠습니까? 삭제하면 방문자가 더 이상 볼 수 없습니다.")) return;
    busyRef.current = true; setBusy("delete"); setActionError("");
    try { await deleteResource(post.id); navigate("/landing/resources", { replace: true }); }
    catch (failure) { setActionError(resourceError(failure, "삭제하지 못했습니다. 다시 시도해주세요.")); }
    finally { busyRef.current = false; setBusy(""); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); setShareMessage("글 링크를 복사했습니다."); }
    catch { setShareMessage("브라우저 주소창의 글 주소를 복사해 공유해주세요."); }
  }
  return <ResourceLayout pageTitle={post?.title}>
    <Link to="/landing/resources" className={styles.back}>← 매치업 · 분석자료</Link>
    {loading && <p className={styles.state} role="status">글을 불러오는 중입니다…</p>}
    {error && <ResourceFailure message={error} onRetry={() => setRetry((value) => value + 1)} />}
    {post && <article className={styles.article}>
      <header className={styles.articleHeader}>
        <p className={styles.eyebrow}>{post.category === "matchup" ? "매치업" : "분석자료"}</p><h1>{post.title}</h1>
        <div className={styles.articleMeta}>
          <div className={styles.meta}><span>{post.author_display_name}</span><time dateTime={post.created_at}>{new Date(post.created_at).toLocaleDateString("ko-KR")}</time></div>
          <button type="button" className={styles.shareButton} onClick={() => void copyLink()}><Link2 size={ICON_FOR_BUTTON.sm} aria-hidden="true" />글 링크 복사</button>
        </div>
        {publisher.state === "allowed" && <div className={styles.actions}><Link to={`/landing/resources/${post.id}/edit`}>수정</Link><button type="button" disabled={!!busy} onClick={() => void removePost()}>삭제</button></div>}
        {shareMessage && <p role="status" className={styles.hint}>{shareMessage}</p>}
      </header>
      {!!post.files.length && <section className={styles.originals} aria-label="자료 다운로드">
        <div className={styles.originalsHeading}><h2>첨부 자료 <span>{post.files.length}</span></h2>
          {post.files.some((file) => file.reader_status !== "unsupported") && <a href="#resource-reading"><ArrowDown size={ICON_FOR_BUTTON.sm} aria-hidden="true" />본문 바로보기</a>}
        </div>
        {post.files.map((file) => <div className={styles.downloadRow} key={file.id}>
          <div className={styles.downloadInfo}><strong>{file.filename}</strong><span>{file.extension.toUpperCase() || "파일"} · {resourceSize(file.size)}</span></div>
          <button type="button" className={`${styles.primary} ${styles.downloadButton}`} disabled={!!busy} aria-busy={busy === file.id} aria-label={`${file.filename} ${file.extension.toLowerCase() === "pdf" ? "PDF 다운로드" : "원본 다운로드"}`} onClick={() => void download(file)}>
            <Download size={ICON_FOR_BUTTON.md} aria-hidden="true" />{busy === file.id ? "준비 중…" : file.extension.toLowerCase() === "pdf" ? "PDF 다운로드" : "원본 다운로드"}
          </button>
        </div>)}
        <p className={styles.downloadHint}>파일을 저장해 원하는 뷰어로 볼 수 있습니다.</p>
      </section>}
      {actionError && <ResourceFailure message={actionError} />}
      {publisher.state === "error" && <ResourceFailure message="게시 권한을 확인하지 못했습니다." onRetry={publisher.retry} />}
      <div id="resource-reading" className={styles.readingStart} tabIndex={-1}>
      {post.content && <div className={styles.articleIntro}>{post.content.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>}
      {post.files.filter((file) => file.reader_status !== "unsupported").map((file) => <ResourceDocumentReader key={file.id} file={file} />)}
      </div>
      <Link to="/landing/resources" className={styles.articleEnd}>다른 글 읽기 →</Link>
    </article>}
  </ResourceLayout>;
}
