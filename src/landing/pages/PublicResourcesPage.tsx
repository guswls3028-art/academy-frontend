import { useEffect, useState } from "react";
import { Link } from "react-router";
import ResourceLayout, { ResourceFailure } from "../components/ResourceLayout";
import { listResources, type ResourceCategory, type ResourcePage } from "../api/publicResources";
import { useResourcePublisher } from "../hooks/useResourcePublisher";
import styles from "./PublicResources.module.css";

function ResourceColumn({ category, title, description }: { category: ResourceCategory; title: string; description: string }) {
  const [data, setData] = useState<ResourcePage | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let disposed = false; setLoading(true); setError(false);
    listResources(category, page).then((result) => {
      if (!disposed) setData((previous) => ({ ...result, results: page === 1 ? result.results : [...(previous?.results ?? []), ...result.results].filter((post, index, rows) => rows.findIndex((row) => row.id === post.id) === index) }));
    }).catch(() => { if (!disposed) setError(true); }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [category, page, retry]);
  return <section className={styles.column} aria-labelledby={`resource-${category}`}>
    <div className={styles.columnHead}><h2 id={`resource-${category}`}>{title}</h2><span>{data ? `${data.count}개` : ""}</span></div>
    <p className={styles.description}>{description}</p>
    {data?.results.map((post) => <Link to={`/landing/resources/${post.id}`} key={post.id} className={styles.post}>
      <h3>{post.title}</h3><div className={styles.meta}><span>{post.author_display_name}</span><time dateTime={post.created_at}>{new Date(post.created_at).toLocaleDateString("ko-KR")}</time></div>
      <div className={styles.formats}>{[...new Set(post.files.map((file) => file.extension))].map((extension) => <span key={extension}>{extension.toUpperCase() || "파일"}</span>)}<small>첨부 {post.files.length}개</small></div>
    </Link>)}
    {loading && <p className={styles.state} role="status">자료를 불러오는 중입니다…</p>}
    {error && <ResourceFailure message="자료를 불러오지 못했습니다." onRetry={() => setRetry((value) => value + 1)} />}
    {!loading && !error && !data?.results.length && <div className={styles.empty}><strong>아직 등록된 자료가 없습니다</strong><p>새로운 자료가 올라오면 여기서 확인하실 수 있습니다.</p></div>}
    {data?.next && !error && <button className={styles.more} type="button" disabled={loading} onClick={() => setPage((value) => value + 1)}>자료 더 보기</button>}
  </section>;
}

export default function PublicResourcesPage() {
  const publisher = useResourcePublisher();
  return <ResourceLayout>
    <div className={styles.intro}><div><p className={styles.eyebrow}>함께 보는 학습 자료</p><h1>매치업 · 분석자료</h1><p>매치업 보고서와 정리된 분석자료를 확인하고 원본 파일을 내려받으세요.</p></div>
      {publisher.state === "allowed" && <Link className={styles.primary} to="/landing/resources/write">자료 올리기</Link>}
    </div>
    {publisher.state === "error" && <ResourceFailure message="게시 권한을 확인하지 못했습니다." onRetry={publisher.retry} />}
    <div className={styles.columns}>
      <ResourceColumn category="matchup" title="매치업" description="교정·정리된 매치업 보고서" />
      <ResourceColumn category="analysis" title="분석자료" description="시험과 학습 내용을 가공한 분석자료" />
    </div>
  </ResourceLayout>;
}
