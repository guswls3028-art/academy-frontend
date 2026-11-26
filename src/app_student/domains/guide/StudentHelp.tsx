import { Fragment, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { ArrowLeft, ChevronRight, HelpCircle, X } from "lucide-react";
import { useDialogSurface } from "@/shared/ui/overlays/useDialogSurface";
import { ICON } from "@/shared/ui/ds";
import { studentQuickGuide } from "./data/studentQuickGuide";
import styles from "./StudentHelp.module.css";

export function StudentHelp() {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<number | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const listScroll = useRef(0);
  const body = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  useDialogSurface(open, dialog, close);
  const article = topic === null ? null : studentQuickGuide[topic];

  function select(index: number) {
    listScroll.current = body.current?.scrollTop ?? 0;
    setTopic(index);
    requestAnimationFrame(() => { body.current?.scrollTo(0, 0); heading.current?.focus(); });
  }
  function back() {
    const previous = topic;
    setTopic(null);
    requestAnimationFrame(() => {
      body.current?.scrollTo(0, listScroll.current);
      body.current?.querySelector<HTMLButtonElement>(`[data-topic="${previous}"]`)?.focus({ preventScroll: true });
    });
  }
  return <>
    <button ref={trigger} type="button" className={`stu-topbar__iconBtn stu-topbar__iconBtn--muted ${styles.trigger}`}
      aria-label="학생 사용 가이드" aria-haspopup="dialog" aria-expanded={open}
      onClick={() => { setTopic(null); setOpen(true); }}>
      <HelpCircle size={ICON.md} aria-hidden />
    </button>
    {open && createPortal(<div className={styles.backdrop} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <section ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-label="학생 사용 가이드">
        <header className={styles.bar}>
          {article && <button type="button" onClick={back} aria-label="목차로 돌아가기"><ArrowLeft size={ICON.md} /></button>}
          <strong>학생 사용 가이드</strong>
          <button type="button" aria-label="가이드 닫기" onClick={close}><X size={ICON.md} /></button>
        </header>
        <div ref={body} className={styles.body}>
          {article ? <article className={styles.article}>
            <div><small className={styles.category}>{article.group}</small><h2 tabIndex={-1} ref={heading}>{article.title}</h2></div>
            <section><h3>시작 위치</h3><p>{article.start}</p></section>
            <section><h3>따라 하기</h3><ol>{article.steps.map(step => <li key={step}>{step}</li>)}</ol></section>
            <figure><img src={article.image} alt={article.alt} /><figcaption>이용 예시 · {article.alt}</figcaption></figure>
            <section><h3>완료 확인</h3><p>{article.done}</p></section>
            <section><h3>막혔을 때</h3><p>{article.recovery}</p></section>
          </article> : <>
            <h2>무엇을 하려 하나요?</h2>
            <div className={styles.list}>{studentQuickGuide.map((item, index) => (
              <Fragment key={item.title}>
                {studentQuickGuide[index - 1]?.group !== item.group && <h3 className={styles.category}>{item.group}</h3>}
                <button type="button" data-topic={index} onClick={() => select(index)}>{item.title}<ChevronRight size={ICON.sm} /></button>
              </Fragment>
            ))}</div>
            <Link to="/student/guide" onClick={close}>시험·클리닉 등 전체 가이드</Link>
          </>}
        </div>
      </section>
    </div>, trigger.current?.closest(".student-layout") ?? document.body)}
  </>;
}
