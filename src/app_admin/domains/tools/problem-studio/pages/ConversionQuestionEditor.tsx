import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Badge, Button } from "@/shared/ui/ds";
import type { Conversion, ConversionQuestion, QuestionContent } from "../api/conversions.api";
import styles from "./ConversionStudioPage.module.css";

function content(question: ConversionQuestion): QuestionContent {
  return { prompt: question.prompt, choices: question.choices, answer: question.answer, explanation: question.explanation, crop: question.crop, page_index: question.page_index };
}

export default function ConversionQuestionEditor({ conversion, question, busy, onSave, onAction, onReview, onClose, onMove, canPrevious, canNext, onDirty }: {
  conversion: Conversion; question: ConversionQuestion; busy: boolean;
  onSave: (value: QuestionContent) => Promise<boolean>;
  onAction: (action: string, instruction?: string) => void;
  onReview: (action: string) => void; onClose: () => void; onMove: (delta: number) => void;
  canPrevious: boolean; canNext: boolean; onDirty: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => content(question));
  const [saved, setSaved] = useState(() => JSON.stringify(content(question)));
  const [instruction, setInstruction] = useState("");
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const dragStart = useRef<[number, number] | null>(null);
  const inFlight = useRef(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(draft) !== saved;
  const serverChanged = JSON.stringify(content(question)) !== saved && dirty;
  const page = draft.page_index === null ? null : conversion.document?.pages[draft.page_index];
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  async function save() {
    if (!dirty || inFlight.current || busy) return;
    const snapshot = structuredClone(draft);
    inFlight.current = true;
    setSaving(true);
    const success = await onSave(snapshot);
    setSaveError(!success);
    if (success) setSaved(JSON.stringify(snapshot));
    inFlight.current = false;
    setSaving(false);
  }
  function position(event: PointerEvent<HTMLDivElement>): [number, number] {
    const box = imageRef.current!.getBoundingClientRect();
    return [Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)), Math.max(0, Math.min(1, (event.clientY - box.top) / box.height))];
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!selecting || busy) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = position(event);
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    const [x, y] = position(event), [sx, sy] = dragStart.current;
    if (Math.abs(x - sx) < .002 || Math.abs(y - sy) < .002) return;
    setDraft(value => ({ ...value, crop: [Math.min(sx, x), Math.min(sy, y), Math.abs(x - sx), Math.abs(y - sy)] }));
  }
  return <section className={styles.editor} aria-label={`${question.number}번 문항 편집`}>
    <header className={styles.editorHeader}>
      <div><Button intent="ghost" onClick={onClose}>목록으로</Button><strong>{question.number}번 문항</strong></div>
      <div className={styles.actions}><span role="status">{saving ? "저장 중…" : saveError ? "저장 실패 · 입력 보관 중" : dirty ? "저장할 변경 있음" : "저장됨"}</span>
        <Button size="sm" onClick={save} loading={saving} disabled={!dirty || busy}>저장</Button>
        <Button size="sm" disabled={!canPrevious || busy || saving} onClick={() => onMove(-1)}>이전</Button>
        <Button size="sm" disabled={!canNext || busy || saving} onClick={() => onMove(1)}>다음</Button>
      </div>
    </header>
    <div className={styles.editorColumns}>
      <div className={styles.sourcePane}>
        <div className={styles.paneHeading}><h3>원본</h3>{page && <Button size="sm" intent={selecting ? "primary" : "secondary"} onClick={() => setSelecting(!selecting)}>{selecting ? "범위 선택 마침" : "그림 범위 선택"}</Button>}</div>
        <p className={styles.muted}>{question.source_name}{page?.page_number ? ` · ${page.page_number}쪽` : ""}</p>
        <select aria-label="대조할 원본 페이지" value={draft.page_index ?? ""} disabled={busy} onChange={event => setDraft(value => ({ ...value, page_index: event.target.value === "" ? null : Number(event.target.value), crop: null }))}><option value="">원본 페이지 선택</option>{conversion.document?.pages.map((source, index) => source && <option key={index} value={index}>{source.source_name} · {source.page_number}쪽</option>)}</select>
        {page ? <div ref={imageRef} className={styles.sourceImage} data-selecting={selecting} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => { dragStart.current = null; }} onPointerCancel={() => { dragStart.current = null; }}>
          <img src={page.url} alt={`${question.source_name} 원본 ${page.page_number}쪽`} draggable={false} />
          {draft.crop && (
            // eslint-disable-next-line no-restricted-syntax -- The selection rectangle follows the user's normalized pointer coordinates.
            <div className={styles.crop} style={{ left: `${draft.crop[0] * 100}%`, top: `${draft.crop[1] * 100}%`, width: `${draft.crop[2] * 100}%`, height: `${draft.crop[3] * 100}%` }} />
          )}
        </div> : <p>이 문항의 원본 이미지를 연결하지 못했습니다. 원본 파일과 대조해 주세요.</p>}
        {page && <details className={styles.cropControls}><summary>그림 범위 직접 입력</summary><p>왼쪽·위·너비·높이를 원본의 백분율로 입력하세요.</p><div className={styles.cropInputs}>{["왼쪽", "위", "너비", "높이"].map((label, index) => <label key={label}>{label}<input type="number" min={0} max={100} step={0.1} value={Math.round((draft.crop ?? [0, 0, 1, 1])[index] * 1000) / 10} onChange={event => { const crop: [number, number, number, number] = [...(draft.crop ?? [0, 0, 1, 1])]; crop[index] = Number(event.target.value) / 100; setDraft(value => ({ ...value, crop })); }} /></label>)}</div><Button size="sm" onClick={() => setDraft(value => ({ ...value, crop: null }))}>범위 초기화</Button></details>}
      </div>
      <div className={styles.editPane}>
        <div className={styles.paneHeading}><h3>변환 결과</h3><Badge tone={question.reviewed ? "success" : "warning"}>{question.reviewed ? "확인 완료" : "확인 필요"}</Badge></div>
        {serverChanged && <details open className={styles.proposal}><summary>다른 화면에서 저장한 최신 내용</summary><p>{question.prompt}</p><p>{question.choices.join("\n")}</p><p>정답: {question.answer}</p><p>{question.explanation}</p><p>아래 입력과 비교한 뒤 저장하면 현재 수정 내용이 반영됩니다.</p></details>}
        {question.review_flags.length > 0 && <ul className={styles.reviewFlags}>{question.review_flags.map((flag, index) => <li key={index}>{flag}</li>)}</ul>}
        <fieldset disabled={busy} className={styles.fields} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) void save(); }}>
          <label>문항<textarea rows={8} value={draft.prompt} onChange={event => setDraft(value => ({ ...value, prompt: event.target.value }))} /></label>
          <label>보기 <span>한 줄에 하나씩</span><textarea rows={5} value={draft.choices.join("\n")} onChange={event => setDraft(value => ({ ...value, choices: event.target.value.split("\n") }))} /></label>
          <label>정답<input value={draft.answer} onChange={event => setDraft(value => ({ ...value, answer: event.target.value }))} /></label>
          <label>해설<textarea rows={6} value={draft.explanation} onChange={event => setDraft(value => ({ ...value, explanation: event.target.value }))} /></label>
        </fieldset>
        {(question.redrawn || question.visual) && <figure className={styles.figure}><img src={(question.redrawn || question.visual)!.url} alt={`${question.number}번 문항 그림`} /><figcaption>{question.redrawn ? "다시 그린 그림 · 원본 대조 필요" : "원본에서 가져온 그림"}</figcaption></figure>}
        <div className={styles.correction}><label>이렇게 고쳐 주세요<input placeholder="예: 두 번째 보기의 아래첨자를 원본과 맞춰 주세요" maxLength={2000} value={instruction} onChange={event => setInstruction(event.target.value)} /></label>
          <div className={styles.actions}><Button disabled={busy || dirty || !instruction.trim()} onClick={() => onAction("correct", instruction)}>AI로 고치기</Button><Button disabled={busy || dirty} onClick={() => onAction("reanalyze")}>이 문항 다시 분석</Button><Button disabled={busy || dirty || (!question.visual && !draft.crop)} onClick={() => onAction("redraw")}>그림 다시 그리기</Button></div>
          <p className={styles.muted}>{dirty ? "수정 내용을 저장하면 AI 작업을 시작할 수 있습니다." : "AI 수정은 제안으로 보관됩니다. 내용을 보고 적용하세요."}</p>
        </div>
        {question.proposal && <section className={styles.proposal} aria-label="AI 수정 제안"><h3>AI 수정 제안</h3>{question.proposal.choices && <p>{question.proposal.choices.join("\n")}</p>}{["prompt", "answer", "explanation"].map(key => { const value = question.proposal?.[key as keyof QuestionContent]; return typeof value === "string" ? <p key={key}>{value}</p> : null; })}{question.proposal.redrawn && <img src={question.proposal.redrawn.url} alt="다시 그린 그림 제안" />}<div className={styles.actions}><Button intent="primary" disabled={busy || dirty} onClick={() => onReview("apply_proposal")}>제안 적용</Button><Button disabled={busy || dirty} onClick={() => onReview("discard_proposal")}>현재 내용 유지</Button></div></section>}
        <Button intent="primary" disabled={busy || dirty || saving} onClick={() => onReview("accept")}>원본 대조 완료 · 그대로 둠</Button>
      </div>
    </div>
  </section>;
}
