import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import styles from "./MatchupInlinePdf.module.css";

type MatchupInlinePdfProps = {
  url: string;
  title: string;
};

type PageStatus = "waiting" | "rendering" | "ready" | "error";

function PdfPage({
  pdf,
  pageNumber,
  title,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  title: string;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [surfaceWidth, setSurfaceWidth] = useState(0);
  const [status, setStatus] = useState<PageStatus>("waiting");

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return undefined;

    const updateWidth = (width: number) => setSurfaceWidth(Math.max(1, Math.floor(width)));
    updateWidth(surface.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) updateWidth(width);
    });
    observer.observe(surface);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "1400px 0px" },
    );
    observer.observe(surface);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!nearViewport || surfaceWidth < 1) return undefined;

    let disposed = false;
    let page: PDFPageProxy | null = null;
    let renderTask: RenderTask | null = null;

    const render = async () => {
      setStatus("rendering");
      try {
        page = await pdf.getPage(pageNumber);
        if (disposed) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const nextPageRatio = baseViewport.height / baseViewport.width;
        if (surfaceRef.current) {
          surfaceRef.current.style.aspectRatio = `${baseViewport.width} / ${baseViewport.height}`;
        }

        const cssScale = surfaceWidth / baseViewport.width;
        // 긴 보고서(20~30쪽)를 모두 읽어도 모바일/데스크톱 canvas bitmap이
        // 과도하게 메모리를 점유하지 않도록 화면 크기별 상한을 둔다.
        const pixelRatio = Math.min(window.devicePixelRatio || 1, surfaceWidth >= 700 ? 1 : 1.5);
        const viewport = page.getViewport({ scale: cssScale * pixelRatio });
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        canvas.style.width = `${surfaceWidth}px`;
        canvas.style.height = `${Math.round(surfaceWidth * nextPageRatio)}px`;

        renderTask = page.render({ canvas, viewport, background: "#ffffff" });
        await renderTask.promise;
        if (!disposed) setStatus("ready");
      } catch (error) {
        if (disposed || (error as { name?: string }).name === "RenderingCancelledException") return;
        setStatus("error");
      }
    };

    void render();
    return () => {
      disposed = true;
      renderTask?.cancel();
      page?.cleanup();
    };
  }, [nearViewport, pageNumber, pdf, surfaceWidth]);

  return (
    <section
      className={styles.page}
      data-testid="matchup-pdf-page"
      data-page-number={pageNumber}
      data-render-status={status}
      aria-label={`${title} ${pageNumber}쪽`}
    >
      <div className={styles.pageMeta} aria-hidden="true">
        <span>{String(pageNumber).padStart(2, "0")}</span>
        <span>{pdf.numPages}쪽 중</span>
      </div>
      <div ref={surfaceRef} className={styles.pageSurface}>
        {status !== "ready" && status !== "error" && (
          <div className={styles.pageLoading} role="status">
            <span className={styles.spinner} aria-hidden="true" />
            <span>{pageNumber}쪽을 불러오는 중</span>
          </div>
        )}
        {status === "error" && (
          <div className={styles.pageError} role="alert">
            <strong>{pageNumber}쪽을 표시하지 못했습니다</strong>
            <span>위의 원본 PDF 다운로드를 이용해주세요.</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          aria-label={`${title} ${pageNumber}쪽 내용`}
          data-testid="matchup-pdf-canvas"
        />
      </div>
    </section>
  );
}

export default function MatchupInlinePdf({ url, title }: MatchupInlinePdfProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let disposed = false;
    let loadingTask: ReturnType<(typeof import("pdfjs-dist"))["getDocument"]> | null = null;

    const load = async () => {
      setPdf(null);
      setError(false);
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        loadingTask = pdfjs.getDocument({ url });
        const loaded = await loadingTask.promise;
        if (disposed) return;
        setPdf(loaded);
      } catch {
        if (!disposed) setError(true);
      }
    };

    void load();
    return () => {
      disposed = true;
      void loadingTask?.destroy();
    };
  }, [url]);

  if (error) {
    return (
      <div className={styles.documentError} role="alert" data-testid="matchup-inline-pdf-error">
        <strong>본문을 바로 표시하지 못했습니다</strong>
        <span>원본은 위의 PDF 다운로드 버튼에서 확인할 수 있습니다.</span>
      </div>
    );
  }

  if (!pdf) {
    return (
      <div className={styles.documentLoading} role="status" data-testid="matchup-inline-pdf-loading">
        <div className={styles.loadingCopy}>
          <span className={styles.spinner} aria-hidden="true" />
          <strong>전체 자료를 준비하고 있습니다</strong>
          <span>잠시만 기다리면 첫 쪽부터 바로 이어집니다.</span>
        </div>
        <div className={styles.paperSkeleton} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={styles.document} data-testid="matchup-inline-pdf" data-page-count={pdf.numPages}>
      <div className={styles.readingGuide}>
        <strong>전체 {pdf.numPages}쪽</strong>
        <span>아래로 넘기면 모든 페이지가 순서대로 이어집니다.</span>
      </div>
      <div className={styles.pages}>
        {Array.from({ length: pdf.numPages }, (_, index) => (
          <PdfPage key={index + 1} pdf={pdf} pageNumber={index + 1} title={title} />
        ))}
      </div>
    </div>
  );
}
