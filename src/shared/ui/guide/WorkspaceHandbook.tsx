import { useId, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { handbooks, type HandbookPage } from "./handbookData";
import teacherPdf from "./documents/teacher-pc.pdf?url";
import studentPdf from "./documents/student-app.pdf?url";
import FeatureGuideReader from "./FeatureGuideReader";
import styles from "./WorkspaceHandbook.module.css";

function HandbookIllustration({ page }: { page: HandbookPage }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if ("example" in page) return <div className={styles.example}>
    <strong>{page.example.title}</strong>
    <dl>{page.example.rows.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl>
  </div>;
  return <figure className={styles.figure}>
    {failed ? <div role="status">화면 예시를 불러오지 못했습니다. 아래 순서로 계속 읽을 수 있습니다.{" "}
      <button type="button" onClick={() => { setAttempt(attempt + 1); setFailed(false); }}>그림 다시 보기</button>
    </div> : <a href={page.fullImage ?? page.image} target="_blank" rel="noreferrer" aria-label={`${page.title} 그림 크게 보기 (새 창)`}>
      <img src={attempt ? `${page.image}?retry=${attempt}` : page.image} alt={page.alt} onError={() => setFailed(true)} />
      <span aria-hidden="true">그림 크게 보기 ↗</span>
    </a>}
    <figcaption>{page.alt}</figcaption>
  </figure>;
}

function selection(params: URLSearchParams): { key: keyof typeof handbooks; index: number } {
  const key = params.get("handbook") === "student" ? "student" : "teacher";
  const number = Number(params.get("sheet"));
  const total = handbooks[key].pages.length;
  const index = Number.isSafeInteger(number) ? Math.max(0, Math.min(number - 1, total - 1)) : 0;
  return { key, index };
}

type MenuItem = { to: string; label: string };

export default function WorkspaceHandbook({ mobileTeacher = false, menuItems }: { mobileTeacher?: boolean; menuItems?: MenuItem[] }) {
  const [params, setParams] = useSearchParams();
  const { key, index } = selection(params);
  const book = handbooks[key];
  const page = book.pages[index];
  const menu = key === "teacher" && menuItems?.find((item) => item.to === page.menuPath);
  const headingId = useId();
  const sheetHeading = useRef<HTMLHeadingElement>(null);
  const focusAfterTurn = useRef(false);
  const [featureOpen, setFeatureOpen] = useState(false);
  const legacyLink = params.has("guideBook") || params.has("guidePage");
  const legacyOpen = legacyLink || featureOpen;

  useLayoutEffect(() => {
    if (!focusAfterTurn.current) return;
    focusAfterTurn.current = false;
    const heading = sheetHeading.current;
    heading?.focus({ preventScroll: true });
    if (heading && heading.getBoundingClientRect().top < 0) heading.scrollIntoView({ block: "start" });
  }, [key, index]);

  function turn(nextKey: keyof typeof handbooks, nextIndex: number) {
    if (nextKey === key && nextIndex === index) return;
    const next = new URLSearchParams(window.location.search);
    next.set("handbook", nextKey);
    next.set("sheet", String(nextIndex + 1));
    focusAfterTurn.current = true;
    setParams(next, { preventScrollReset: true });
  }

  function step(offset: number) {
    const current = selection(new URLSearchParams(window.location.search));
    turn(current.key, Math.max(0, Math.min(current.index + offset, handbooks[current.key].pages.length - 1)));
  }

  return <>
    <section className={styles.reader} data-book={key} aria-labelledby={headingId}>
      <header className={styles.header}>
        <h2 id={headingId}>그림으로 보는 사용 가이드</h2>
        <div className={styles.toolbar}>
          <div className={styles.switcher} role="group" aria-label="읽을 가이드">
            {(["teacher", "student"] as const).map((id) => <button type="button" key={id} aria-pressed={key === id}
              onClick={() => turn(id, 0)}>{handbooks[id].title}</button>)}
          </div>
          <a className={styles.download} href={key === "teacher" ? teacherPdf : studentPdf}
            download={`학원플러스_${key === "teacher" ? "선생님_PC" : "학생앱"}_가이드.pdf`}>{book.title} PDF 다운로드</a>
        </div>
      </header>
      <div className={styles.paper}>
        <nav className={styles.contents} aria-label={`${book.title} 목차`}>
          <strong>목차</strong>
          <ol>{book.pages.map((entry, i) => <li key={entry.title}><button type="button" aria-current={i === index ? "page" : undefined}
            onClick={() => turn(key, i)}><span>{String(i + 1).padStart(2, "0")}</span>{entry.title}</button></li>)}</ol>
        </nav>
        <div className={styles.sheet}>
          <label className={styles.mobileContents}>목차
            <select value={index} onChange={(event) => turn(key, Number(event.target.value))}>
              {book.pages.map((entry, i) => <option value={i} key={entry.title}>{i + 1}. {entry.title}</option>)}
            </select>
          </label>
          <nav className={styles.pager} aria-label="가이드 쪽 이동">
            <button type="button" disabled={index === 0} onClick={() => step(-1)}>← 이전 쪽</button>
            <span aria-live="polite">{index + 1} / {book.pages.length}쪽</span>
            <button type="button" disabled={index === book.pages.length - 1} onClick={() => step(1)}>다음 쪽 →</button>
          </nav>
          <div className={styles.spread} key={key + index}>
            <div className={styles.entry}>
              <p className={styles.route}>{page.start}</p>
              {menu && <a className={styles.menuLink} href={menu.to} target="_blank" rel="noreferrer">
                {menu.label} 메뉴 열기 <span>(새 탭)</span>
              </a>}
            </div>
            <h3 ref={sheetHeading} tabIndex={-1}>{page.title}</h3>
            {mobileTeacher && key === "teacher" && index === 0 &&
              <p className={styles.orientation}>PC 버전의 화면을 기준으로 설명합니다. 선생님 모바일에서는 메뉴의 ‘전체 업무’를 열면 같은 화면으로 이동합니다.</p>}
            <div className={styles.lesson}>
              <HandbookIllustration page={page} />
              <div>
                <ol className={styles.steps}>{page.steps.map((text) => <li key={text}>{text}</li>)}</ol>
                <p className={styles.done}><strong>완료 확인</strong> {page.done}
                  {page.resultImage && <a className={styles.resultLink} href={page.resultImage.fullImage} target="_blank"
                    rel="noreferrer" aria-label="등록 완료 화면 보기 (새 탭)">등록 완료 화면 보기 ↗</a>}
                </p>
                <details className={styles.help}><summary>막혔을 때</summary><p>{page.recovery}</p></details>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <details className={styles.more} open={legacyLink || undefined} onToggle={(event) => setFeatureOpen(event.currentTarget.open)}>
      <summary>알림톡·영상·엑셀·정오표 상세 설명서</summary>
      {legacyOpen && <FeatureGuideReader />}
    </details>
  </>;
}
