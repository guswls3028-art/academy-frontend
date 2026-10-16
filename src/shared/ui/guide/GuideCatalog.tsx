import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router";
import type { GuideArticle } from "./types";
import styles from "./GuideCatalog.module.css";

type Props = {
  articles: GuideArticle[];
  title: string;
  description: string;
  scope: "admin" | "teacher" | "student";
  mode?: "app" | "public";
};

export default function GuideCatalog({ articles, title, description, scope, mode = "app" }: Props) {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const categories = [...new Set(articles.map((article) => article.category))];
  const requestedCategory = params.get("category") ?? "";
  const category = categories.includes(requestedCategory) ? requestedCategory : "";
  const topic = params.get("topic");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const contentsRef = useRef<HTMLElement>(null);
  const returnToContents = useRef(false);
  const previousTopic = useRef(topic);
  const selected = articles.find((article) => article.id === topic);
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const visible = articles.filter((article) => {
    if (category && article.category !== category) return false;
    const searchable = [article.title, article.summary, article.category, article.audience,
      ...(article.keywords ?? []), ...article.prerequisites, ...article.completion,
      ...article.steps.flatMap((step) => [step.title, step.description]),
      ...article.troubleshooting.flatMap((step) => [step.title, step.description])]
      .join(" ").toLocaleLowerCase();
    return terms.every((term) => searchable.includes(term));
  });

  function updateFilters(key: "q" | "category", value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete("topic");
    setParams(next, { replace: true, preventScrollReset: true });
  }

  function openArticle(id: string) {
    const next = new URLSearchParams(params);
    if (!visible.some((article) => article.id === id)) {
      next.delete("q");
      next.delete("category");
    }
    next.set("topic", id);
    setParams(next, { preventScrollReset: true });
  }

  function resetFilters() {
    const next = new URLSearchParams(params);
    next.delete("q"); next.delete("category"); next.delete("topic");
    setParams(next, { preventScrollReset: true });
  }

  function closeArticle() {
    const next = new URLSearchParams(params);
    next.delete("topic");
    returnToContents.current = true;
    setParams(next, { preventScrollReset: true });
  }

  useEffect(() => {
    if (returnToContents.current && !topic) {
      contentsRef.current?.focus({ preventScroll: true });
      contentsRef.current?.scrollIntoView({ block: "start" });
      returnToContents.current = false;
    }
    if (topic !== previousTopic.current && selected) {
      headingRef.current?.focus({ preventScroll: true });
      headingRef.current?.scrollIntoView({ block: "start" });
    }
    previousTopic.current = topic;
  }, [topic, selected]);

  const nextArticles = selected?.nextIds.flatMap((id) => {
    const article = articles.find((item) => item.id === id);
    return article ? [article] : [];
  }) ?? [];

  return (
    <div className={styles.catalog} data-scope={scope} data-mode={mode}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>사용 가이드 · A to Z</p>
        <h1>{title}</h1>
        <p>{description}</p>
        <ol className={styles.flow} aria-label="가이드 이용 순서">
          <li>기능 찾기</li><li>준비하기</li><li>따라하기</li><li>완료 확인</li>
        </ol>
      </header>

      <div className={styles.finder}>
        <label className={styles.searchLabel} htmlFor={`guide-search-${scope}`}>어떤 작업이 필요한가요?</label>
        <input id={`guide-search-${scope}`} type="search" value={query}
          placeholder="기능, 화면 이름, 막힌 상황 검색"
          onChange={(event) => updateFilters("q", event.target.value)} className={styles.search} />
        <div className={styles.categories} role="group" aria-label="가이드 분류">
          {["", ...categories].map((item) => (
            <button type="button" key={item} aria-pressed={category === item}
              onClick={() => updateFilters("category", item)}>{item || "전체"}</button>
          ))}
        </div>
      </div>

      {topic && !selected && (
        <div className={styles.empty} role="status">
          <p>{mode === "public" ? "이 안내를 찾을 수 없습니다. 역할을 확인하거나 전체 가이드에서 다시 선택해 주세요." : "이 안내를 찾을 수 없거나 현재 계정에서 이용할 수 없습니다."}</p>
          <button type="button" onClick={resetFilters}>전체 가이드 보기</button>
        </div>
      )}

      <div className={styles.workspace}>
        <nav className={styles.contents} aria-label="주요 기능 이용 순서" ref={contentsRef} tabIndex={-1}>
          <p className={styles.count} role="status">{visible.length}개 안내 · 위에서부터 따라오세요</p>
          {visible.length === 0 ? (
            <div className={styles.empty}>
              <p>일치하는 안내가 없습니다. 검색어를 줄이거나 다른 분류를 선택해 주세요.</p>
              <button type="button" onClick={resetFilters}>검색 초기화</button>
            </div>
          ) : visible.map((article) => (
            <button type="button" key={article.id} className={styles.topic}
              aria-current={article.id === topic ? "step" : undefined}
              onClick={() => openArticle(article.id)}>
              <span className={styles.number}>{String(articles.indexOf(article) + 1).padStart(2, "0")}</span>
              <span className={styles.topicText}><strong>{article.title}</strong><span>{article.summary}</span></span>
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </nav>

        {selected ? (
          <article className={styles.article} aria-labelledby={`guide-topic-${selected.id}`} key={selected.id}>
            <button type="button" className={styles.backToContents} onClick={closeArticle}>← 목차로 돌아가기</button>
            <p className={styles.eyebrow}>{selected.category} · {selected.audience}</p>
            <h2 id={`guide-topic-${selected.id}`} ref={headingRef} tabIndex={-1}>{selected.title}</h2>
            <p className={styles.summary}>{selected.summary}</p>
            {mode === "app" && <Link to={selected.path} className={styles.primaryLink}>{selected.title} 화면 열기 <span aria-hidden="true">↗</span></Link>}
            <section className={styles.preparation}>
              <h3>시작 전에</h3>
              <ul>{selected.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
            <section>
              <h3>순서대로 따라하기</h3>
              <ol className={styles.steps}>
                {selected.steps.map((step) => <li key={step.title}><h4>{step.title}</h4><p>{step.description}</p></li>)}
              </ol>
            </section>
            <section className={styles.completion}>
              <h3>여기까지 확인하면 완료</h3>
              <ul>{selected.completion.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
            <section className={styles.recovery}>
              <h3>막혔을 때</h3>
              {selected.troubleshooting.map((item) => (
                <details key={item.title}><summary>{item.title}</summary><p>{item.description}</p></details>
              ))}
            </section>
            {nextArticles.length > 0 && (
              <section className={styles.next} aria-label="다음 이용 흐름">
                <h3>다음으로 이어가기</h3>
                {nextArticles.map((item) => <button key={item.id} type="button" onClick={() => openArticle(item.id)}>{item.title} →</button>)}
              </section>
            )}
            <p className={styles.returnHint}>{mode === "public" ? "실제 업무 화면은 가입 후 해당 권한으로 로그인하여 이용합니다. 사용 전 궁금한 점은 상담으로 안내해 드립니다." : "실제 화면을 연 뒤 브라우저의 뒤로가기를 누르면 읽던 안내로 돌아옵니다."}</p>
          </article>
        ) : (
          <section className={styles.welcome} aria-label="가이드 시작 안내">
            <span className={styles.bookmark} aria-hidden="true">A → Z</span>
            <h2>처음부터, 또는 필요한 업무부터</h2>
            <p>목차에서 기능을 선택하면 준비사항부터 완료 확인까지 한 흐름으로 볼 수 있습니다. 화면을 열기 전에 안내를 먼저 읽어 주세요.</p>
            <p>검색어와 읽던 안내는 주소에 남아 새로고침하거나 뒤로 돌아와도 이어서 볼 수 있습니다.</p>
            {visible[0] && <button type="button" onClick={() => openArticle(visible[0].id)}>{query || category ? "첫 검색 결과 읽기" : "첫 단계부터 시작"} →</button>}
          </section>
        )}
      </div>
    </div>
  );
}
