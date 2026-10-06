import { useEffect, useState } from "react";
import { Link } from "react-router";
import ResourceLayout, { ResourceFailure } from "../components/ResourceLayout";
import { listResources, type ResourceCategory, type ResourcePage } from "../api/publicResources";
import { useResourcePublisher } from "../hooks/useResourcePublisher";
import styles from "./PublicResources.module.css";

function ResourceArticles({ category }: { category?: ResourceCategory }) {
  const [data, setData] = useState<ResourcePage | null>(null);
  const [page, setPage] = useState(1); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); const [retry, setRetry] = useState(0);
  useEffect(() => {
    let disposed = false; setLoading(true); setError(false);
    listResources(category, page).then((result) => {
      if (!disposed) setData((previous) => ({ ...result, results: page === 1 ? result.results : [...(previous?.results ?? []), ...result.results].filter((post, index, rows) => rows.findIndex((row) => row.id === post.id) === index) }));
    }).catch(() => { if (!disposed) setError(true); }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [category, page, retry]);
  return <section aria-label="게시글 목록" aria-busy={loading}>
    <div className={styles.articleCards}>{data?.results.map((post) => <Link to={`/landing/resources/${post.id}`} key={post.id} className={styles.articleCard}>
      <p className={styles.eyebrow}>{post.category === "matchup" ? "매치업" : "분석자료"}</p>
      <h2>{post.title}</h2>
      {post.content && <p className={styles.excerpt}>{post.content.slice(0, 240)}</p>}
      <div className={styles.meta}><span>{post.author_display_name}</span><time dateTime={post.created_at}>{new Date(post.created_at).toLocaleDateString("ko-KR")}</time></div>
      <span className={styles.readMore}>글 읽기 <span aria-hidden="true">↗</span></span>
    </Link>)}</div>
    {loading && <p className={styles.state} role="status">글을 불러오는 중입니다…</p>}
    {error && <ResourceFailure message="글을 불러오지 못했습니다." onRetry={() => { if (page > 1) { setPage(1); setData(null); } setRetry((value) => value + 1); }} />}
    {!loading && !error && !data?.results.length && <div className={styles.empty}><strong>아직 등록된 글이 없습니다</strong><p>새로운 매치업 보고서와 분석 이야기를 이곳에서 바로 읽을 수 있습니다.</p></div>}
    {data?.next && !error && <button className={styles.more} type="button" disabled={loading} onClick={() => setPage((value) => value + 1)}>글 더 보기</button>}
  </section>;
}

export default function PublicResourcesPage() {
  const publisher = useResourcePublisher();
  const [category, setCategory] = useState<ResourceCategory>();
  return <ResourceLayout>
    <div className={styles.intro}><div><p className={styles.eyebrow}>시험을 읽고, 배움을 연결합니다</p><h1>매치업 · 분석자료</h1><p>출제 흐름부터 학습 방향까지.<br />선생님이 정리한 보고서와 분석을 이곳에서 바로 읽어보세요.</p></div>
      {publisher.state === "allowed" && <Link className={styles.primary} to="/landing/resources/write">글 올리기</Link>}
    </div>
    {publisher.state === "error" && <ResourceFailure message="게시 권한을 확인하지 못했습니다." onRetry={publisher.retry} />}
    <div className={styles.categoryFilters} aria-label="글 분류">
      {([[undefined, "전체"], ["matchup", "매치업"], ["analysis", "분석자료"]] as const).map(([value, label]) => <button type="button" key={label} aria-pressed={category === value} onClick={() => setCategory(value)}>{label}</button>)}
    </div>
    <ResourceArticles key={category || "all"} category={category} />
  </ResourceLayout>;
}
