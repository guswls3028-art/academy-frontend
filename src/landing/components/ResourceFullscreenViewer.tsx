import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import { ICON } from "@/shared/ui/ds/iconSize";
import type { ReaderBlock } from "../api/publicResources";
import styles from "./ResourceFullscreenViewer.module.css";

type ImagePage = Extract<ReaderBlock, { kind: "image" }>;

export default function ResourceFullscreenViewer({ pages, title, attempt, error, returnFocus, onRetry, onError, onClose }: {
  pages?: ImagePage[]; title: string; attempt: number; error: string;
  returnFocus: () => HTMLElement | null;
  onRetry: () => void; onError: () => void; onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [status, setStatus] = useState("waiting");
  const [controlsVisible, setControlsVisible] = useState(true);
  const headingId = useId();
  const historyKey = `resource-viewer-${headingId}`;
  const closing = useRef(false);
  const shell = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const controlsTimer = useRef<number | undefined>(undefined);
  const keyboard = useRef(false);
  const close = useRef(onClose); close.current = onClose;
  const touch = useRef<{ x: number; y: number } | null>(null);
  const ignoreClickUntil = useRef(0);
  const current = Math.min(index, Math.max(0, (pages?.length || 1) - 1));
  const page = pages?.[current];

  const showControls = useCallback(() => {
    window.clearTimeout(controlsTimer.current);
    setControlsVisible(true);
    if (status === "ready" && !error && !keyboard.current) {
      controlsTimer.current = window.setTimeout(() => setControlsVisible(false), 2200);
    }
  }, [status, error]);

  useEffect(() => {
    showControls();
    return () => window.clearTimeout(controlsTimer.current);
  }, [showControls, current, attempt, page?.url]);

  useEffect(() => {
    const focused = document.activeElement as HTMLElement | null;
    const scrollY = window.scrollY;
    const articleUrl = window.location.href;
    const scrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const body = document.body;
    const previous = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow };
    const app = document.getElementById("root");
    const previousHidden = app?.getAttribute("aria-hidden");
    body.style.position = "fixed"; body.style.top = `-${scrollY}px`; body.style.width = "100%"; body.style.overflow = "hidden";
    closeButton.current?.focus({ preventScroll: true });
    app?.setAttribute("aria-hidden", "true");
    // Defer one tick so StrictMode's mount rehearsal cannot leave a history entry.
    const historyTimer = window.setTimeout(() => window.history.pushState({ ...window.history.state, resourceViewer: historyKey }, "", window.location.href), 0);
    const back = () => close.current();
    window.addEventListener("popstate", back);
    return () => {
      window.clearTimeout(historyTimer);
      window.removeEventListener("popstate", back);
      Object.assign(body.style, previous);
      if (app) {
        if (previousHidden === null || previousHidden === undefined) app.removeAttribute("aria-hidden");
        else app.setAttribute("aria-hidden", previousHidden);
      }
      if (window.history.state?.resourceViewer === historyKey) window.history.back();
      window.history.scrollRestoration = scrollRestoration;
      const restoreArticle = () => {
        if (window.location.href !== articleUrl) return;
        window.scrollTo(0, scrollY);
        (returnFocus() || focused)?.focus({ preventScroll: true });
      };
      restoreArticle();
      // Back's native scroll restoration can run after popstate/React cleanup.
      window.requestAnimationFrame(() => {
        if (!document.querySelector('[data-testid="resource-fullscreen-viewer"]')) restoreArticle();
      });
    };
  }, [historyKey, returnFocus]);

  useLayoutEffect(() => {
    function fit() {
      if (shell.current) shell.current.style.height = `${window.innerHeight}px`;
      if (!viewport.current || !paper.current || !page) return;
      const stage = viewport.current;
      const base = Math.min(stage.clientWidth, stage.clientHeight * page.width / page.height);
      const width = base * zoom / 100;
      paper.current.style.width = `${width}px`;
      paper.current.style.height = `${width * page.height / page.width}px`;
    }
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [page, zoom]);

  useLayoutEffect(() => {
    setStatus(image.current?.complete && image.current.naturalWidth > 0 ? "ready" : "waiting");
  }, [page?.url, attempt, current]);

  const turn = useCallback((next: number) => {
    setIndex(Math.max(0, Math.min((pages?.length || 1) - 1, next)));
    setZoom(100); touch.current = null;
    if (viewport.current) { viewport.current.scrollTop = 0; viewport.current.scrollLeft = 0; }
  }, [pages?.length]);

  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (window.history.state?.resourceViewer === historyKey) window.history.back();
    else close.current();
  }, [historyKey]);

  function toggleControls() {
    keyboard.current = false;
    if (!controlsVisible || status !== "ready" || error) showControls();
    else { window.clearTimeout(controlsTimer.current); setControlsVisible(false); }
  }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      keyboard.current = true; showControls();
      if (event.key === "Escape") { event.preventDefault(); requestClose(); }
      else if (event.key === "Tab") {
        const focusable = Array.from(shell.current?.querySelectorAll<HTMLElement>("button:not(:disabled), select:not(:disabled), [tabindex='0']") || []);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (!shell.current?.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      } else if (zoom === 100 && (event.target as HTMLElement).tagName !== "SELECT") {
        if (event.key === "ArrowLeft") { event.preventDefault(); turn(current - 1); }
        if (event.key === "ArrowRight") { event.preventDefault(); turn(current + 1); }
      }
    };
    // Touch/rotation may blur focus to body in Safari; modal keys must still work.
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [current, zoom, showControls, turn, requestClose]);

  return createPortal(<div ref={shell} className={styles.viewer} data-testid="resource-fullscreen-viewer" data-controls-visible={controlsVisible} role="dialog" aria-modal="true" aria-labelledby={headingId}
    onPointerDown={(event) => {
      keyboard.current = false;
      if ((event.target as HTMLElement).closest("button, select, header, footer")) showControls();
    }}
    onFocusCapture={() => { if (keyboard.current) showControls(); }}>
    <header className={`${styles.header} ${controlsVisible ? "" : styles.controlsHidden}`}>
      <h2 id={headingId}>{title.replace(/\.[^.]+$/, "")}<span>전체화면 보기</span></h2>
      <button ref={closeButton} type="button" className={styles.iconButton} onClick={requestClose} aria-label="전체화면 닫기"><X size={ICON.lg} /></button>
    </header>
    {error && <div className={styles.notice} role="alert">{error}<button type="button" onClick={onRetry}>다시 불러오기</button></div>}
    <div ref={viewport} className={`${styles.viewport} ${zoom > 100 ? styles.panning : ""}`} tabIndex={0} role="region" aria-label="전체화면 문서. 확대하면 문서를 이동할 수 있습니다."
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button") || Date.now() < ignoreClickUntil.current) return;
        toggleControls();
      }}
      onTouchStart={(event) => {
        keyboard.current = false;
        touch.current = event.touches.length === 1 && !(event.target as HTMLElement).closest("button") ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
      }}
      onTouchMove={(event) => { if (event.touches.length !== 1) touch.current = null; }}
      onTouchCancel={() => { touch.current = null; }}
      onTouchEnd={(event) => {
        const start = touch.current; touch.current = null;
        if (!start || !event.changedTouches.length) return;
        const dx = event.changedTouches[0].clientX - start.x, dy = event.changedTouches[0].clientY - start.y;
        // Browsers can omit click after swiping; use the native tap and ignore its compatibility click.
        ignoreClickUntil.current = Date.now() + 500;
        if (zoom === 100 && Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(current + (dx < 0 ? 1 : -1));
        else if (Math.abs(dx) <= 12 && Math.abs(dy) <= 12) toggleControls();
      }}>
      {page ? <figure ref={paper} className={styles.paper} data-testid="resource-viewer-page" data-page-number={current + 1} data-render-status={status}>
        <img ref={image} key={`${current}:${attempt}:${page.url}`} className={styles.pageImage} src={page.url} width={page.width} height={page.height}
          alt={`${title} ${current + 1}쪽`} decoding="async" draggable={false}
          onLoad={() => setStatus("ready")} onError={() => { setStatus("error"); onError(); }} />
        {status === "waiting" && <div className={styles.status} role="status"><span className={styles.spinner} />{current + 1}쪽을 불러오는 중입니다…</div>}
        {status === "error" && <div className={styles.status} role="alert"><strong>이 쪽을 불러오지 못했습니다</strong><button type="button" onClick={onRetry}>다시 불러오기</button></div>}
        {page.text && <span className={styles.accessibleText}>{page.text}</span>}
      </figure> : !error && <div className={styles.empty} role="status">문서를 불러오는 중입니다…</div>}
    </div>
    <footer className={`${styles.footer} ${controlsVisible ? "" : styles.controlsHidden}`}>
      <div className={styles.controls}>
        <nav className={styles.pager} aria-label="문서 페이지">
          <button type="button" className={styles.iconButton} disabled={!page || current === 0} onClick={() => turn(current - 1)} aria-label="이전 쪽"><ChevronLeft size={ICON.lg} /></button>
          <label className={styles.pageSelect}><span className={styles.accessibleText}>페이지 선택</span><select aria-label="페이지 선택" value={current} disabled={!page} onChange={(event) => turn(Number(event.target.value))}>
            {(pages || []).map((_, number) => <option key={number} value={number}>{number + 1} / {pages?.length}</option>)}
          </select></label>
          <button type="button" className={styles.iconButton} disabled={!page || current === (pages?.length || 1) - 1} onClick={() => turn(current + 1)} aria-label="다음 쪽"><ChevronRight size={ICON.lg} /></button>
        </nav>
        <div className={styles.zoom} aria-label="전체화면 확대">
          <button type="button" className={styles.iconButton} disabled={!page || zoom === 100} onClick={() => setZoom(Math.max(100, zoom - 25))} aria-label="전체화면 축소"><Minus size={ICON.md} /></button>
          <button type="button" className={styles.fit} onClick={() => { setZoom(100); if (viewport.current) { viewport.current.scrollTop = 0; viewport.current.scrollLeft = 0; } }} aria-label="화면에 맞추기" title="화면에 맞추기"><output aria-live="polite">{zoom}%</output></button>
          <button type="button" className={styles.iconButton} disabled={!page || zoom === 300} onClick={() => setZoom(Math.min(300, zoom + 25))} aria-label="전체화면 확대"><Plus size={ICON.md} /></button>
        </div>
      </div>
      <p className={styles.hint} aria-live="polite">{zoom === 100 ? "좌우로 밀어 넘기기 · 화면을 탭하면 버튼이 나타납니다" : "확대한 문서를 밀어 이동하세요 · 배율을 누르면 화면에 맞춰집니다"}</p>
    </footer>
  </div>, document.body);
}
