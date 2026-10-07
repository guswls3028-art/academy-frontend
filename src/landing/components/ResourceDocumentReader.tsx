import { useEffect, useRef, useState } from "react";
import { prepareResourceReader, readResourceFile, resourceError, type ReaderBlock, type ResourceFile, type ResourceReader, type ReaderStatus } from "../api/publicResources";
import { lazy, Suspense } from "react";
import ResourcePageImages, { hasPageImages } from "./ResourcePageImages";
import { ResourceFailure } from "./ResourceLayout";
import styles from "../pages/PublicResources.module.css";

const MatchupInlinePdf = lazy(() => import("./MatchupInlinePdf"));

function Blocks({ blocks, onError }: { blocks: ReaderBlock[]; onError: () => void }) {
  return <>{blocks.map((block, index) => block.kind === "paragraph"
    ? <p key={index}>{block.text}</p>
    : <figure key={index}><img src={block.url} width={block.width} height={block.height} alt="첨부 이미지" loading="lazy" decoding="async" onError={onError} /></figure>)}</>;

}

export default function ResourceDocumentReader({ file, preview = false, onStatus }: {
  file: ResourceFile; preview?: boolean; onStatus?: (id: string, status: ReaderStatus) => void;
}) {
  const [reader, setReader] = useState<ResourceReader | null>(null);
  const [error, setError] = useState(""); const [retry, setRetry] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [nearViewport, setNearViewport] = useState(false);
  const surface = useRef<HTMLElement>(null); const statusCallback = useRef(onStatus);
  const readerFile = useRef(file.id); const lastImageRefresh = useRef(0);
  statusCallback.current = onStatus;

  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setNearViewport(true); observer.disconnect(); }
    }, { rootMargin: "500px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let disposed = false; let timer: ReturnType<typeof setTimeout> | undefined; let polls = 0;
    setError("");
    if (readerFile.current !== file.id) { setReader(null); setZoom(100); readerFile.current = file.id; }
    async function load(start = false) {
      try {
        let result = start ? await prepareResourceReader(file.id) : await readResourceFile(file.id, preview);
        if (disposed) return;
        if (preview && (result.status === "unprepared" || (result.status === "ready" && result.mode === "pages" && !hasPageImages(result.blocks, result.pages)))) result = await prepareResourceReader(file.id);
        if (disposed) return;
        if (!["ready", "pending", "unprepared", "unsupported", "failed"].includes(result.status)
          || (result.status === "ready" && (result.mode === "pages" ? !hasPageImages(result.blocks, result.pages) && !result.pdf_url
            : result.mode !== "article" || !Array.isArray(result.blocks) || !result.blocks.length))) {
          throw new Error("Invalid reader response");
        }
        setError("");
        setReader(result); statusCallback.current?.(file.id, result.status);
        clearTimeout(timer);
        if (result.status === "pending") timer = setTimeout(() => void load(), Math.min(15000, 3000 * 2 ** polls++));
        else if (result.status === "ready") timer = setTimeout(() => void load(), 240_000);
      } catch (failure) {
        if (!disposed) {
          setError(resourceError(failure, "본문을 불러오지 못했습니다. 연결을 확인하고 다시 시도해주세요."));
          if ([403, 404].includes((failure as { response?: { status?: number } })?.response?.status || 0)) setReader(null);
          timer = setTimeout(() => void load(), 15_000);
        }
      }
    }
    void load(preview && retry > 0);
    function resume() { if (document.visibilityState === "visible") void load(); }
    document.addEventListener("visibilitychange", resume);
    return () => { disposed = true; clearTimeout(timer); document.removeEventListener("visibilitychange", resume); };
  }, [file.id, preview, retry]);

  if (reader?.status === "unsupported") return null;
  const showPages = reader?.mode === "pages";
  function reload() { setRetry((value) => value + 1); }
  function refreshImage() {
    if (Date.now() - lastImageRefresh.current < 10_000) return;
    lastImageRefresh.current = Date.now(); reload();
  }
  return <section ref={surface} className={styles.documentReader} aria-label={`${file.filename} 본문`}>
    <div className={styles.readerHeading}><h2>{file.filename.replace(/\.[^.]+$/, "") || file.filename}</h2>
    </div>
    {error && <ResourceFailure message={error} onRetry={reload} />}
    {!error && !reader && <p role="status" className={styles.state}>본문을 불러오는 중입니다…</p>}
    {reader?.status === "pending" && <p role="status" className={styles.state}>첨부 파일을 준비하고 있습니다. 완료되면 자동으로 표시됩니다.</p>}
    {(reader?.status === "failed" || reader?.status === "unprepared") && <ResourceFailure message={reader.message || "본문을 아직 준비하지 못했습니다."} onRetry={reload} />}
    {reader?.status === "ready" && !showPages && <div className={styles.readableBody}><Blocks blocks={reader.blocks || []} onError={() => setError("본문의 그림을 불러오지 못했습니다. 다시 불러오면 이어서 읽을 수 있습니다.")} /></div>}
    {reader?.status === "ready" && showPages && <>
      <div className={styles.readerTools} aria-label="문서 확대">
        <span>아래로 내려 문서 전체 읽기</span>
        <button type="button" disabled={zoom === 100} onClick={() => setZoom((value) => Math.max(100, value - 25))} aria-label="문서 축소">−</button>
        <output aria-live="polite">{zoom}%</output>
        <button type="button" disabled={zoom === 300} onClick={() => setZoom((value) => Math.min(300, value + 25))} aria-label="문서 확대">+</button>
        <button type="button" onClick={reload}>다시 불러오기</button>
      </div>
      <div className={styles.documentViewport} tabIndex={zoom > 100 ? 0 : undefined} role="region" aria-label="문서 본문. 확대하면 좌우로 이동할 수 있습니다.">
        <div className={styles[`zoom${zoom}`]}>
          {nearViewport ? hasPageImages(reader.blocks, reader.pages)
            ? <ResourcePageImages pages={reader.blocks} title={file.filename} attempt={retry} onRetry={reload} onError={refreshImage} />
            : reader.pdf_url && <Suspense fallback={<p className={styles.state}>본문을 불러오는 중입니다…</p>}><MatchupInlinePdf key={retry} url={reader.pdf_url} title={file.filename} onRetry={reload} accessibleText maxPages={100} /></Suspense>
            : <p className={styles.state}>아래로 이동하면 보고서가 이어집니다.</p>}
        </div>
      </div>
    </>}
  </section>;
}
