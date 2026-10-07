import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReaderBlock } from "../api/publicResources";
import styles from "./MatchupInlinePdf.module.css";
import imageStyles from "./ResourcePageImages.module.css";

type ImagePage = Extract<ReaderBlock, { kind: "image" }>;

function PageImage({ page, number, total, title, attempt, onRetry, onError }: {
  page: ImagePage; number: number; total: number; title: string; attempt: number; onRetry: () => void; onError: () => void;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState("waiting");
  useLayoutEffect(() => {
    if (surface.current) surface.current.style.paddingBottom = `${page.height / page.width * 100}%`;
  }, [page.width, page.height]);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      setVisible(entries.some((entry) => entry.isIntersecting));
    }, { rootMargin: "400px 0px" });
    if (surface.current) observer.observe(surface.current);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    setStatus(visible && image.current?.complete && image.current.naturalWidth > 0 ? "ready" : "waiting");
  }, [visible, attempt]);
  return <section className={styles.page} data-testid="resource-page-image" data-page-number={number} data-render-status={status} aria-label={`${title} ${number}쪽`}>
    <div className={styles.pageMeta}><span>{String(number).padStart(2, "0")}</span><span>{total}쪽 중</span></div>
    <div ref={surface} className={imageStyles.surface}>
      {visible && <img ref={image} key={attempt} className={imageStyles.image} src={page.url} alt={`${title} ${number}쪽`} width={page.width} height={page.height}
        decoding="async" onLoad={() => setStatus("ready")} onError={() => { setStatus("error"); onError(); }} />}
      {status === "waiting" && <div className={styles.pageLoading} role="status"><span className={styles.spinner} />{number}쪽을 불러오는 중입니다…</div>}
      {status === "error" && <div className={styles.pageError} role="alert"><strong>{number}쪽을 불러오지 못했습니다</strong><span>연결을 확인하고 다시 불러오면 이어서 읽을 수 있습니다.</span><button type="button" onClick={onRetry}>본문 다시 불러오기</button></div>}
    </div>
    {page.text && <div className={styles.accessibleText}>{page.text}</div>}
  </section>;
}

export default function ResourcePageImages({ pages, title, attempt, onRetry, onError }: {
  pages: ImagePage[]; title: string; attempt: number; onRetry: () => void; onError: () => void;
}) {
  return <div className={`${styles.document} ${imageStyles.document}`}>
    <div className={styles.readingGuide}><strong>전체 {pages.length}쪽</strong><span>아래로 넘기면 모든 페이지가 순서대로 이어집니다.</span></div>
    <div className={`${styles.pages} ${imageStyles.pages}`}>{pages.map((page, index) => <PageImage key={index} page={page} number={index + 1} total={pages.length} title={title} attempt={attempt} onRetry={onRetry} onError={onError} />)}</div>
  </div>;
}
