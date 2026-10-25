import { useId, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import books from "./content/feature-guide-books.json";
import summary from "./content/feature-guide-summary.json";
import styles from "./FeatureGuideReader.module.css";

type BookKey = "summary" | "detail";
type GuidePage = (typeof books.summary.pages)[number];

function PageImage({ page, enlarged = false }: { page: GuidePage; enlarged?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (failed) return (
    <div className={styles.failure} role="status">
      <p>설명서 이미지를 불러오지 못했습니다. 다시 불러오거나 아래 글 안내를 확인해 주세요.</p>
      <button type="button" onClick={() => { setAttempt(attempt + 1); setFailed(false); }}>이미지 다시 불러오기</button>
    </div>
  );
  const source = (url: string) => attempt ? `${url}?retry=${attempt}` : url;
  const sizes = enlarged ? undefined : "(max-width: 700px) calc(100vw - 48px), (max-width: 1240px) 90vw, 1180px";
  return <picture key={attempt}>
    <source type="image/webp" sizes={sizes} srcSet={enlarged ? source(page.largeSrc) : `${source(page.src)} 1000w, ${source(page.largeSrc)} 2200w`} />
    <img src={source(enlarged ? page.fallbackLargeSrc : page.fallbackSrc)}
      srcSet={enlarged ? undefined : `${source(page.fallbackSrc)} 1000w, ${source(page.fallbackLargeSrc)} 2200w`}
      sizes={sizes} width={page.width} height={page.height} alt={page.title} decoding="async"
      loading={enlarged ? "eager" : "lazy"} onError={() => setFailed(true)} />
  </picture>;
}

/** Public, synthetic-only documentation; does not grant access to product actions. */
export default function FeatureGuideReader({ mode = "app" }: { mode?: "app" | "public" }) {
  const [params, setParams] = useSearchParams();
  const bookKey: BookKey = params.get("guideBook") === "detail" ? "detail" : "summary";
  const book = books[bookKey];
  const requestedPage = Number(params.get("guidePage"));
  const pageNumber = Number.isInteger(requestedPage) && requestedPage >= 1
    ? Math.min(requestedPage, book.pages.length) : 1;
  const page = book.pages[pageNumber - 1];
  const headingId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const enlargeButton = useRef<HTMLButtonElement>(null);
  const [enlarged, setEnlarged] = useState(false);

  function selectPage(nextBook: BookKey | null, nextPage: number | ((book: BookKey, current: number) => number)) {
    // Keep a search/topic change that reached the URL before this render committed.
    const next = new URLSearchParams(window.location.search);
    const currentBook = next.get("guideBook") === "detail" ? "detail" : "summary";
    const selectedBook = nextBook ?? currentBook;
    const requested = Number(next.get("guidePage"));
    const currentPage = Number.isInteger(requested) && requested >= 1
      ? Math.min(requested, books[currentBook].pages.length) : 1;
    const selectedPage = typeof nextPage === "function" ? nextPage(currentBook, currentPage) : nextPage;
    next.set("guideBook", selectedBook);
    next.set("guidePage", String(Math.max(1, Math.min(selectedPage, books[selectedBook].pages.length))));
    setParams(next, { preventScrollReset: true });
  }

  function enlarge() {
    if (typeof dialog.current?.showModal !== "function") {
      window.open(page.fallbackLargeSrc, "_blank", "noopener,noreferrer");
      return;
    }
    setEnlarged(true);
    dialog.current.showModal();
  }

  return (
    <section className={styles.reader} data-mode={mode} aria-labelledby={headingId}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>실제 프로그램 화면 · 2026.10.25 기준</p>
        <h2 id={headingId}>기능 둘러보기</h2>
        <p>알림톡·영상·엑셀·정오표를 실제 사용 순서로 확인하세요. 현재 제공 기능과 도입 시 검수, 맞춤 개발 범위를 구분했습니다.</p>
        <p className={styles.note}>개인정보 없는 예시 데이터입니다. 아래 이미지는 한 쪽씩 읽고, 큰 글씨로 확대할 수 있습니다.</p>
      </header>

      <div className={styles.books} role="group" aria-label="설명서 선택">
        <button type="button" aria-pressed={bookKey === "summary"} onClick={() => selectPage("summary", 1)}>핵심 요약 5쪽</button>
        <button type="button" aria-pressed={bookKey === "detail"} onClick={() => selectPage("detail", 1)}>상세 설명 43쪽</button>
      </div>
      <nav className={styles.shortcuts} aria-label="핵심 기능 바로 읽기">
        {summary.features.map((feature, index) => (
          <button type="button" key={feature.id} onClick={() => selectPage(null, (currentBook) => currentBook === "summary" ? index + 2 : feature.detailPage)}>{feature.title}</button>
        ))}
      </nav>
      <div className={styles.toolbar}>
        <label>설명서 페이지
          <select value={pageNumber} onChange={(event) => selectPage(null, Number(event.target.value))}>
            {book.pages.map((item, index) => <option key={item.src} value={index + 1}>{index + 1}. {item.title}</option>)}
          </select>
        </label>
        <button ref={enlargeButton} type="button" onClick={enlarge}>글씨 크게 보기 ↗</button>
      </div>
      <figure className={styles.figure}>
        <PageImage key={page.src} page={page} />
        <figcaption aria-live="polite">{book.title} · {pageNumber} / {book.pages.length}쪽 — {page.title}</figcaption>
      </figure>
      <div className={styles.controls}>
        <button type="button" disabled={pageNumber === 1} onClick={() => selectPage(null, (_, current) => current - 1)}>← 이전 쪽</button>
        <span>{pageNumber} / {book.pages.length}</span>
        <button type="button" disabled={pageNumber === book.pages.length} onClick={() => selectPage(null, (_, current) => current + 1)}>다음 쪽 →</button>
      </div>
      <details className={styles.textGuide}>
        <summary>현재 기능·도입 검수·맞춤 개발 범위를 글로 읽기</summary>
        {summary.features.map((feature, index) => (
          <article key={feature.id}>
            <h3>{feature.title}</h3>
            <p>{feature.subtitle}</p><p className={styles.flow}>{feature.flow}</p>
            <div className={styles.columns}>
              {([
                ["현재 제공하는 기능", feature.available],
                ["도입 시 추가 검수", feature.verification],
                ["맞춤 개발 협의", feature.customization],
              ] as const).map(([title, items]) => <div key={title}><h4>{title}</h4><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></div>)}
            </div>
            <p><strong>{feature.condition}</strong></p>
            <p className={styles.note}>{feature.evidence}</p>
            <button type="button" onClick={() => selectPage("summary", index + 2)}>이 기능 요약 화면 보기</button>{" "}
            <button type="button" onClick={() => selectPage("detail", feature.detailPage)}>사용 순서 상세 화면 보기</button>
          </article>
        ))}
      </details>
      <div className={styles.downloads}>
        <span>파일로 전달할 때</span>
        <a href={books.summary.pdf} download="학원플러스_핵심기능_5페이지_요약.pdf">요약본 PDF 내려받기</a>
        <a href={books.detail.pdf} download="학원플러스_주요기능_상세설명서.pdf">상세 설명서 PDF 내려받기</a>
      </div>
      <dialog ref={dialog} className={styles.lightbox} aria-label="설명서 글씨 확대"
        onClose={() => { setEnlarged(false); enlargeButton.current?.focus(); }}>
        <div className={styles.lightboxHeader}><strong>{pageNumber}쪽 · {page.title}</strong><button type="button" onClick={() => dialog.current?.close()}>닫기 ✕</button></div>
        <p>화면 안에서 가로·세로로 움직여 큰 글씨를 읽으세요.</p>
        <div className={styles.zoomScroll}>{enlarged && <PageImage key={page.largeSrc} page={page} enlarged />}</div>
        <a href={page.fallbackLargeSrc} download={`학원플러스_${book.title}_${pageNumber}쪽.jpg`}>이 쪽 이미지 내려받기</a>
      </dialog>
    </section>
  );
}
