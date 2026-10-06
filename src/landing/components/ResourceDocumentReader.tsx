import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { prepareResourceReader, readResourceFile, resourceError, type ReaderBlock, type ResourceFile, type ResourceReader, type ReaderStatus } from "../api/publicResources";
import MatchupInlinePdf from "./MatchupInlinePdf";
import { ResourceFailure } from "./ResourceLayout";
import styles from "../pages/PublicResources.module.css";

const ResourceFormula = lazy(() => import("./ResourceFormula"));

function Blocks({ blocks, onError }: { blocks: ReaderBlock[]; onError: () => void }) {
  const result: ReactNode[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]; const key = index;
    if (block.kind === "paragraph") {
      const inline: ReactNode[] = [block.text];
      // DocLang separates equations from adjacent text. Keep those sentences
      // flowing on narrow screens instead of splitting every chemical formula.
      while (blocks[index + 1]?.kind === "formula") {
        const formula = blocks[++index];
        if (formula.kind === "formula") inline.push(<Suspense key={index} fallback={<span>{formula.text}</span>}><ResourceFormula text={formula.text} /></Suspense>);
        const after = blocks[index + 1];
        if (after?.kind === "paragraph") { inline.push(after.text); index += 1; } else break;
      }
      result.push(<p key={key}>{inline}</p>);
    } else if (block.kind === "formula") {
      result.push(<div className={styles.formula} key={key}><Suspense fallback={<span>{block.text}</span>}><ResourceFormula text={block.text} /></Suspense></div>);
    } else if (block.kind === "image") {
      result.push(<figure key={key}><img src={block.url} width={block.width} height={block.height} alt="보고서에 포함된 그림" loading="lazy" decoding="async" onError={onError} /></figure>);
    } else if (block.kind === "table") {
      result.push(<div className={styles.tableViewport} tabIndex={0} role="region" aria-label="보고서 표. 넓은 표는 좌우로 이동해 읽을 수 있습니다." key={key}>
        <table><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}><Blocks blocks={cell} onError={onError} /></td>)}</tr>)}</tbody></table>
      </div>);
    }
  }
  return <>{result}</>;
}

export default function ResourceDocumentReader({ file, preview = false, onStatus }: {
  file: ResourceFile; preview?: boolean; onStatus?: (id: string, status: ReaderStatus) => void;
}) {
  const [reader, setReader] = useState<ResourceReader | null>(null);
  const [error, setError] = useState(""); const [retry, setRetry] = useState(0);
  const [original, setOriginal] = useState(false); const [zoom, setZoom] = useState(100);
  const [nearViewport, setNearViewport] = useState(false);
  const surface = useRef<HTMLElement>(null); const statusCallback = useRef(onStatus);
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
    setError(""); setReader(null);
    async function load(start = false) {
      try {
        let result = start ? await prepareResourceReader(file.id) : await readResourceFile(file.id, preview);
        if (disposed) return;
        if (preview && result.status === "unprepared") result = await prepareResourceReader(file.id);
        if (disposed) return;
        if (!["ready", "pending", "unprepared", "unsupported", "failed"].includes(result.status)
          || (result.status === "ready" && (result.mode === "pages" ? !result.pdf_url
            : result.mode !== "article" || !Array.isArray(result.blocks) || !result.blocks.length))) {
          throw new Error("Invalid reader response");
        }
        setReader(result); statusCallback.current?.(file.id, result.status);
        if (result.status === "pending") timer = setTimeout(() => void load(), Math.min(15000, 3000 * 2 ** polls++));
      } catch (failure) {
        if (!disposed) setError(resourceError(failure, "본문을 불러오지 못했습니다. 연결을 확인하고 다시 시도해주세요."));
      }
    }
    void load(preview && retry > 0);
    return () => { disposed = true; clearTimeout(timer); };
  }, [file.id, preview, retry]);

  if (reader?.status === "unsupported") return null;
  const showPages = reader?.mode === "pages" || original;
  function reload() { setRetry((value) => value + 1); }
  return <section ref={surface} className={styles.documentReader} aria-label={`${file.filename} 본문`}>
    <div className={styles.readerHeading}><h2>{file.filename.replace(/\.[^.]+$/, "") || file.filename}</h2>
      {reader?.status === "ready" && reader.pdf_url && reader.mode === "article" && <div className={styles.readerModes} aria-label="읽기 방식">
        <button type="button" aria-pressed={!original} onClick={() => setOriginal(false)}>편하게 읽기</button>
        <button type="button" aria-pressed={original} onClick={() => setOriginal(true)}>원문 쪽 보기</button>
      </div>}
    </div>
    {error && <ResourceFailure message={error} onRetry={reload} />}
    {!error && !reader && <p role="status" className={styles.state}>본문을 불러오는 중입니다…</p>}
    {reader?.status === "pending" && <p role="status" className={styles.state}>문서 본문을 준비하고 있습니다. 글을 작성하는 동안 자동으로 갱신됩니다.</p>}
    {(reader?.status === "failed" || reader?.status === "unprepared") && <ResourceFailure message={reader.message || "본문을 아직 준비하지 못했습니다."} onRetry={reload} />}
    {reader?.status === "ready" && !showPages && <div className={styles.readableBody}><Blocks blocks={reader.blocks || []} onError={() => setError("본문의 그림을 불러오지 못했습니다. 다시 불러오면 이어서 읽을 수 있습니다.")} /></div>}
    {reader?.status === "ready" && showPages && reader.pdf_url && <>
      <div className={styles.readerTools} aria-label="문서 확대">
        <span>아래로 이어서 읽기</span>
        <button type="button" disabled={zoom === 100} onClick={() => setZoom((value) => Math.max(100, value - 25))} aria-label="문서 축소">−</button>
        <output aria-live="polite">{zoom}%</output>
        <button type="button" disabled={zoom === 300} onClick={() => setZoom((value) => Math.min(300, value + 25))} aria-label="문서 확대">+</button>
        <button type="button" onClick={reload}>본문 다시 불러오기</button>
      </div>
      <div className={styles.documentViewport} tabIndex={zoom > 100 ? 0 : undefined} role="region" aria-label="문서 본문. 확대하면 좌우로 이동할 수 있습니다.">
        <div className={styles[`zoom${zoom}`]}>
          {nearViewport ? <MatchupInlinePdf key={retry} url={reader.pdf_url} title={file.filename} onRetry={reload} accessibleText maxPages={100} /> : <p className={styles.state}>아래로 이동하면 보고서가 이어집니다.</p>}
        </div>
      </div>
    </>}
  </section>;
}
