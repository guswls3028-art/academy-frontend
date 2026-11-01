import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { ExamResultItem } from "../api/adminExamResultDetail";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  CHOICE_LABELS,
  choiceAnswerMatches,
  choiceTokens,
  formatChoiceAnswer,
  requiredChoiceTokens,
} from "../utils/choiceAnswerMatching";
import { useAnswerEditQueue, type AnswerEditController } from "./useAnswerEditQueue";

export default function StudentResultAnswerEditor({ sessionId, examId, enrollmentId, choiceItems, essayItems, allItems, correctAnswers, qNumMap, onDone, onSaveSuccess, controllerRef, isFinishing }: {
  sessionId?: number;
  examId: number;
  enrollmentId: number;
  choiceItems: ExamResultItem[];
  essayItems: ExamResultItem[];
  allItems: ExamResultItem[];
  correctAnswers: Record<string, string>;
  qNumMap: Map<number, number>;
  onDone: () => void;
  onSaveSuccess: () => void;
  controllerRef: RefObject<AnswerEditController | null>;
  isFinishing: boolean;
}) {
  const queue = useAnswerEditQueue({ sessionId, examId, enrollmentId,
    questionIds: allItems.map((item) => item.question_id), onSaveSuccess });
  const { flush, hasPending } = queue;
  useEffect(() => {
    const controller = { flush, hasPending };
    controllerRef.current = controller;
    return () => {
      // Preserve the last handle while an SPA transition drains queued saves.
      if (!controller.hasPending() && controllerRef.current === controller) controllerRef.current = null;
    };
  }, [controllerRef, flush, hasPending]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (hasPending()) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasPending]);
  const [answers, setAnswers] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    for (const it of allItems) init[it.question_id] = it.answer ?? "";
    for (const row of queue.restored) init[row.questionId] = row.answer ?? "";
    return init;
  });
  const [scores, setScores] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    for (const it of allItems) init[it.question_id] = it.score ?? 0;
    for (const row of queue.restored) init[row.questionId] = row.score;
    return init;
  });

  const scoreRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const enqueueSave = queue.enqueue;

  const getCorrectAnswer = (qid: number) => correctAnswers[String(qid)] ?? "";

  const handleBubbleClick = useCallback((qid: number, choice: string) => {
    const currentAnswer = answers[qid] ?? "";
    const nextChoices = new Set(requiredChoiceTokens(currentAnswer));
    if (nextChoices.has(choice)) nextChoices.delete(choice);
    else nextChoices.add(choice);
    const newAnswer = formatChoiceAnswer([...nextChoices]);
    setAnswers((prev) => ({ ...prev, [qid]: newAnswer }));

    const correct = correctAnswers[String(qid)] ?? "";
    const item = allItems.find((it) => it.question_id === qid);
    const maxScore = item?.max_score ?? 0;
    let newScore: number;
    if (newAnswer === "") newScore = 0;
    else if (!correct) newScore = scores[qid] ?? 0;
    else if (choiceAnswerMatches(newAnswer, correct)) newScore = maxScore;
    else newScore = 0;
    setScores((prev) => ({ ...prev, [qid]: newScore }));
    enqueueSave({ questionId: qid, score: newScore, answer: newAnswer });
  }, [answers, correctAnswers, allItems, scores, enqueueSave]);

  const handleEssayBlur = useCallback((qid: number) => {
    enqueueSave({ questionId: qid, score: scores[qid] ?? 0, answer: answers[qid] ?? "" });
  }, [answers, scores, enqueueSave]);

  const handleScoreBlur = useCallback((qid: number) => {
    enqueueSave({ questionId: qid, score: scores[qid] ?? 0, answer: answers[qid] ?? "" });
  }, [answers, scores, enqueueSave]);

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const totalMax = allItems.reduce((a, it) => a + it.max_score, 0);

  return (
    <div className="srd-edit">
      {queue.storageError && <div className="srd-modal__error" role="alert">{queue.storageError}</div>}
      {queue.error && <div className="srd-modal__error" role="alert">
        <span>{queue.error}</span>{" "}
        <Button intent="secondary" size="sm" disabled={queue.isSaving} onClick={() => {
          void queue.retry().catch(() => feedback.error("아직 저장하지 못했습니다. 입력값은 유지됩니다."));
        }}>다시 저장</Button>
      </div>}
      {queue.isSaving && <div role="status">답안을 저장하는 중…</div>}
      {/* sticky 총점 */}
      <div className="srd-edit__total-bar">
        <span className="srd-edit__total-label">총점</span>
        <span className="srd-edit__total-score">{totalScore}</span>
        <span className="srd-edit__total-max">/ {totalMax}점</span>
        {totalMax > 0 && <span className="srd-edit__total-pct">({Math.round((totalScore / totalMax) * 100)}%)</span>}
      </div>

      {/* 2단 레이아웃 */}
      <div className="srd-edit__columns">
        {/* 선택형 패널 */}
        {choiceItems.length > 0 && (
          <section className="srd-edit__panel">
            <h3 className="srd-edit__panel-title">선택형 <span className="srd-edit__panel-badge">{choiceItems.length}문항</span></h3>
            <div className="srd-edit__choice-list">
              {choiceItems.map((it, idx) => {
                const qid = it.question_id;
                const answer = answers[qid] ?? "";
                const correct = getCorrectAnswer(qid);
                const isDivider = (idx + 1) % 5 === 0 && idx < choiceItems.length - 1;
                return (
                  <div key={qid} className={`srd-edit__choice-row ${isDivider ? "srd-edit__choice-row--divider" : ""}`}>
                    <span className="srd-edit__q-num">{qNumMap.get(qid) ?? (idx + 1)}</span>
                    <div className="srd-edit__bubbles">
                      {CHOICE_LABELS.map((c) => {
                        const sel = requiredChoiceTokens(answer).includes(c);
                        const isCorrectChoice = choiceAnswerMatches(answer, correct);
                        const correctChoices = choiceTokens(correct);
                        const isWrong = answer !== "" && correct !== "" && !isCorrectChoice;
                        let cls = "";
                        if (!correct && sel) cls = "srd-edit__bubble--neutral";
                        else if (sel && isCorrectChoice) cls = "srd-edit__bubble--correct";
                        else if (sel && isWrong) cls = "srd-edit__bubble--wrong";
                        else if (correctChoices.includes(c) && isWrong) cls = "srd-edit__bubble--answer";
                        return (
                          <button key={c} type="button" className={`srd-edit__bubble ${cls}`} onClick={() => handleBubbleClick(qid, c)}>{c}</button>
                        );
                      })}
                    </div>
                    <span className="srd-edit__choice-result">
                      {answer ? (correct ? (choiceAnswerMatches(answer, correct) ? <span className="srd-edit__mark--ok">○</span> : <span className="srd-edit__mark--x">✕</span>) : <span className="srd-edit__mark--score">{scores[qid] ?? 0}/{it.max_score}</span>) : <span className="srd-edit__mark--empty">—</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 서술형 패널 */}
        {essayItems.length > 0 && (
          <section className="srd-edit__panel">
            <h3 className="srd-edit__panel-title">서술형 <span className="srd-edit__panel-badge">{essayItems.length}문항</span></h3>
            <div className="srd-edit__essay-list">
              {essayItems.map((it, idx) => {
                const qid = it.question_id;
                const answer = answers[qid] ?? "";
                const score = scores[qid] ?? 0;
                const correct = getCorrectAnswer(qid);
                return (
                  <div key={qid} className="srd-edit__essay-row">
                    <span className="srd-edit__q-num">{qNumMap.get(qid) ?? (idx + 1)}</span>
                    <input
                      type="text"
                      className="srd-edit__essay-input"
                      value={answer}
                      onChange={(e) => {
                        setAnswers((prev) => ({ ...prev, [qid]: e.target.value }));
                        queue.stage({ questionId: qid, score: scores[qid] ?? 0, answer: e.target.value });
                      }}
                      onBlur={() => handleEssayBlur(qid)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); scoreRefs.current[qid]?.focus(); } }}
                      placeholder="답안"
                    />
                    <div className="srd-edit__essay-score-wrap">
                      <input
                        ref={(el) => { scoreRefs.current[qid] = el; }}
                        type="number"
                        className="srd-edit__score-input"
                        aria-label={`${qNumMap.get(qid) ?? idx + 1}번 서술형 점수`}
                        value={score}
                        onChange={(e) => {
                          const v = e.target.value === "" ? 0 : parseFloat(e.target.value);
                          if (!isNaN(v)) {
                            const next = Math.max(0, Math.min(v, it.max_score));
                            setScores((prev) => ({ ...prev, [qid]: next }));
                            queue.stage({ questionId: qid, score: next, answer: answers[qid] ?? "" });
                          }
                        }}
                        onBlur={() => handleScoreBlur(qid)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleScoreBlur(qid); } }}
                        min={0} max={it.max_score} step="any"
                      />
                      <span className="srd-edit__score-max">/{it.max_score}</span>
                    </div>
                    {correct && (
                      <div className="srd-edit__essay-hint">정답: {correct}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* 하단 완료 버튼 */}
      <div className="srd-edit__footer">
        <button type="button" className="srd-edit__done-btn" disabled={isFinishing} onClick={onDone}>
          {isFinishing ? "저장 확인 중…" : "수정 완료"}
        </button>
      </div>
    </div>
  );
}
