// PATH: src/landing/components/PdfPageStack.tsx
// PDF를 페이지별 canvas로 렌더링해서 inline 세로 stack — 부모 페이지 scroll로 한번에 위→아래 읽기.
//
// 학원장 spec(2026-05-12): "그냥 간단하게 쭉 스크롤하면서 읽을수있기를 바랬는데" — iframe 안
// PDF scroll 제거 + 부모 자연 scroll로 카페 게시물처럼 읽기.
//
// pdfjs-dist 5.x dynamic import + worker URL `?url` import (Vite native).
// 페이지 수 많으면 IntersectionObserver로 lazy render (viewport 근접 시만 canvas draw).
/* eslint-disable no-restricted-syntax */

import { useEffect, useRef, useState } from "react";

interface Props {
  pdfUrl: string;
  /** 부모 컨테이너 max width — canvas 너비 결정. 기본 1100. */
  maxWidth?: number;
  /** 페이지 사이 gap (px) — cafe 게시물 분위기. 기본 12. */
  pageGap?: number;
  /** 페이지 background — 다크 톤 적합. */
  bg?: string;
  /** 페이지 border. */
  pageBorder?: string;
  /** loading 메시지 색 */
  textColor?: string;
}

interface PdfPage {
  pageNumber: number;
  width: number;
  height: number;
}

export default function PdfPageStack({
  pdfUrl,
  maxWidth = 1100,
  pageGap = 12,
  bg = "transparent",
  pageBorder = "rgba(0,0,0,0.08)",
  textColor = "#9CA3AF",
}: Props) {
  const [pages, setPages] = useState<PdfPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pdfDocRef = useRef<unknown>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderedPages = useRef<Set<number>>(new Set());

  // 1) PDF document load + 페이지 메타(width/height) 추출
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPages([]);
    renderedPages.current.clear();
    canvasRefs.current.clear();

    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        // Vite worker URL — production build에서도 자산 hash 자동 처리
        const workerSrc = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
        (pdfjsLib as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = workerSrc;

        const task = (pdfjsLib as { getDocument: (s: { url: string; withCredentials: boolean }) => { promise: Promise<unknown> } }).getDocument({
          url: pdfUrl,
          withCredentials: false,
        });
        const pdf = await task.promise as { numPages: number; getPage: (n: number) => Promise<{ getViewport: (s: { scale: number }) => { width: number; height: number } }> };
        if (cancelled) return;
        pdfDocRef.current = pdf;

        const metas: PdfPage[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const vp = page.getViewport({ scale: 1 });
          metas.push({ pageNumber: i, width: vp.width, height: vp.height });
        }
        if (cancelled) return;
        setPages(metas);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        const msg = (e as { message?: string })?.message || "PDF 로드 실패";
        setError(msg);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      const doc = pdfDocRef.current as { destroy?: () => void } | null;
      if (doc?.destroy) {
        try { doc.destroy(); } catch { /* noop */ }
      }
      pdfDocRef.current = null;
    };
  }, [pdfUrl]);

  // 2) IntersectionObserver — viewport 근접 시 canvas render
  useEffect(() => {
    if (pages.length === 0) return;
    const doc = pdfDocRef.current as { getPage: (n: number) => Promise<{ getViewport: (s: { scale: number }) => { width: number; height: number }; render: (s: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> } }> } | null;
    if (!doc) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const target = entry.target as HTMLElement;
          const pageNum = Number(target.dataset.pageNumber || 0);
          if (!pageNum) continue;
          if (renderedPages.current.has(pageNum)) {
            observer.unobserve(target);
            continue;
          }
          renderedPages.current.add(pageNum);
          observer.unobserve(target);
          // render this page
          renderPage(doc, pageNum);
        }
      },
      { rootMargin: "300px 0px 300px 0px", threshold: 0.01 },
    );

    const wrappers = containerRef.current?.querySelectorAll<HTMLElement>("[data-page-wrapper]");
    wrappers?.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages.length]);

  const renderPage = async (
    doc: { getPage: (n: number) => Promise<{ getViewport: (s: { scale: number }) => { width: number; height: number }; render: (s: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> } }> },
    pageNum: number,
  ) => {
    try {
      const canvas = canvasRefs.current.get(pageNum);
      if (!canvas) return;
      const page = await doc.getPage(pageNum);
      const containerWidth = Math.min(
        containerRef.current?.clientWidth || maxWidth,
        maxWidth,
      );
      const baseVp = page.getViewport({ scale: 1 });
      const scale = containerWidth / baseVp.width;
      // device pixel ratio scaling for crispness
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      const viewport = page.getViewport({ scale: scale * dpr });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${containerWidth}px`;
      canvas.style.height = `${(viewport.height / dpr)}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch {
      // page render fail은 silent — 다음 페이지 진행에 영향 X
    }
  };

  if (error) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: textColor, fontSize: 14 }}>
        PDF를 불러올 수 없어요. <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#D4A04C" }}>다운로드</a>해서 보세요.
      </div>
    );
  }
  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: textColor, fontSize: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{ width: 28, height: 28, border: "3px solid rgba(212,160,76,0.2)", borderTopColor: "#D4A04C", borderRadius: "50%", animation: "pdfSpin 0.6s linear infinite" }} />
        <span>보고서 불러오는 중…</span>
        <style>{`@keyframes pdfSpin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        background: bg,
        maxWidth,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: pageGap,
      }}
    >
      {pages.map((p) => {
        const containerWidth = Math.min(
          containerRef.current?.clientWidth || maxWidth,
          maxWidth,
        );
        const scale = containerWidth / p.width;
        const estimatedH = p.height * scale;
        return (
          <div
            key={p.pageNumber}
            data-page-wrapper
            data-page-number={p.pageNumber}
            style={{
              background: "#fff",
              borderRadius: 8,
              border: `1px solid ${pageBorder}`,
              boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
              overflow: "hidden",
              width: "100%",
              minHeight: estimatedH,
              position: "relative",
            }}
          >
            <canvas
              ref={(el) => {
                if (el) canvasRefs.current.set(p.pageNumber, el);
              }}
              style={{ display: "block", width: "100%", height: "auto" }}
            />
            <div style={{
              position: "absolute", bottom: 6, right: 10,
              fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.4)",
              background: "rgba(255,255,255,0.85)", padding: "2px 6px", borderRadius: 4,
            }}>{p.pageNumber} / {pages.length}</div>
          </div>
        );
      })}
    </div>
  );
}
