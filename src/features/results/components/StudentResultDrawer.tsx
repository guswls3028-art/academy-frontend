/**
 * 답안 상세 모달 — 중앙 오버레이 (936px)
 *
 * 시도 차수별 탭 (1차, 2차, 3차...) + 읽기/편집 모드
 * - 1차: ResultItem 기반 문항별 보기/편집. items 없으면 시험 문항으로 빈 슬롯 제공
 * - 2차+: 클리닉 재시험 총점 보기/편집
 */

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import CloseButton from "@/shared/ui/ds/CloseButton";
import { fetchAdminExamResultDetail, type ExamResultItem, type ExamResultDetail } from "../api/adminExamResultDetail";
import { fetchAttemptHistory, type AttemptHistoryResponse, type AttemptEntry } from "@/features/scores/api/attemptHistory";
import { patchExamItemScore } from "@/features/scores/api/patchItemScore";
import { feedback } from "@/shared/ui/feedback/feedback";
import WrongNotePanel from "./WrongNotePanel";
import "./StudentResultDrawer.css";

const CHOICES = ["1", "2", "3", "4", "5"];

function isChoiceAnswer(a: string): boolean {
  const t = String(a ?? "").trim();
  return t === "1" || t === "2" || t === "3" || t === "4" || t === "5";
}

function getScanImageUrl(items: ExamResultItem[]): string {
  for (const it of items) {
    const m = it.meta;
    const candidates = [m?.omr?.image_url, m?.omr?.imageUrl, m?.image_url, m?.imageUrl, m?.omr?.page_image_url];
    const hit = candidates.find((v) => typeof v === "string" && v.length > 0);
    if (hit) return hit;
  }
  return "";
}

type Props = {
  examId: number;
  enrollmentId: number;
  studentName: string;
  examTitle: string;
  onClose: () => void;
};

export default function StudentResultDrawer({ examId, enrollmentId, studentName, examTitle, onClose }: Props) {
  const qc = useQueryClient();
  const [mainTab, setMainTab] = useState<"answer" | "wrong">("answer");
  const [selectedAttempt, setSelectedAttempt] = useState(1);
  const [isEditMode, setIsEditMode] = useState(false);

  // 1차 상세 (ResultItem 기반)
  const { data: detail, isLoading: detailLoading, error: detailError } = useQuery({
    queryKey: ["admin-exam-detail", examId, enrollmentId],
    queryFn: () => fetchAdminExamResultDetail(examId, enrollmentId),
    enabled: Number.isFinite(examId) && Number.isFinite(enrollmentId),
  });

  // 시도 이력 (1차, 2차, 3차...)
  const { data: attemptData } = useQuery({
    queryKey: ["attempt-history", "exam", examId, enrollmentId],
    queryFn: () => fetchAttemptHistory({ enrollment_id: enrollmentId, exam_id: examId }),
    enabled: Number.isFinite(examId) && Number.isFinite(enrollmentId),
  });

  // 시험 문항 목록 (1차 items 비어있을 때 빈 슬롯용)
  const { data: examQuestions = [] } = useQuery({
    queryKey: ["exam-questions", examId],
    queryFn: async () => {
      const res = await (await import("@/shared/api/axios")).default.get(`/exams/${examId}/questions/`);
      return (res.data as { id: number; number: number; score: number }[]).sort((a, b) => a.number - b.number);
    },
    enabled: Number.isFinite(examId),
  });

  const attempts = attemptData?.attempts ?? [];
  const maxAttempt = attempts.length > 0 ? Math.max(...attempts.map((a) => a.attempt_index)) : 1;

  const items1st = detail?.items ?? [];
  const choiceItems = useMemo(() => items1st.filter((it) => isChoiceAnswer(it.answer)), [items1st]);
  const essayItems = useMemo(() => items1st.filter((it) => !isChoiceAnswer(it.answer)), [items1st]);
  const scanImageUrl = useMemo(() => getScanImageUrl(items1st), [items1st]);

  // items 비어있을 때 시험 문항으로 빈 슬롯 생성
  const emptySlotItems: ExamResultItem[] = useMemo(() => {
    if (items1st.length > 0) return [];
    return examQuestions.map((q) => ({
      question_id: q.id,
      answer: "",
      is_correct: false,
      score: 0,
      max_score: q.score,
      is_editable: true,
    }));
  }, [items1st, examQuestions]);

  const effectiveItems = items1st.length > 0 ? items1st : emptySlotItems;
  const effectiveChoice = effectiveItems.filter((it) => isChoiceAnswer(it.answer));
  const effectiveEssay = effectiveItems.filter((it) => !isChoiceAnswer(it.answer));

  const invalidateAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["admin-exam-detail", examId, enrollmentId] });
    qc.invalidateQueries({ queryKey: ["attempt-history", "exam", examId, enrollmentId] });
    qc.invalidateQueries({ queryKey: ["session-scores"] });
  }, [qc, examId, enrollmentId]);

  // 선택된 시도의 데이터
  const selectedAttemptEntry = attempts.find((a) => a.attempt_index === selectedAttempt);

  return (
    <>
      <div className="srd-modal-backdrop" onClick={onClose} aria-hidden />
      <div className="srd-modal-wrap">
        <div className="srd-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
          <CloseButton className="srd-modal__close" onClick={onClose} />

          {/* Header */}
          <header className="srd-modal__header">
            <div className="srd-modal__header-inner">
              <h1 className="srd-modal__title">{examTitle} 답안 상세</h1>
              <span className="srd-modal__student-badge">{studentName}</span>
            </div>
            <div className="srd-modal__header-actions">
              {selectedAttempt === 1 && !isEditMode ? (
                <button
                  type="button"
                  className="srd-modal__edit-btn"
                  onClick={() => { setMainTab("answer"); setIsEditMode(true); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                  수정
                </button>
              ) : isEditMode ? (
                <button type="button" className="srd-modal__view-btn" onClick={() => setIsEditMode(false)}>
                  수정 완료
                </button>
              ) : null}
            </div>
          </header>

          {/* 시도 차수 탭 — 항상 표시 */}
          <div className="srd-modal__attempt-tabs">
            {Array.from({ length: maxAttempt }, (_, i) => i + 1).map((n) => {
              const entry = attempts.find((a) => a.attempt_index === n);
              return (
                <button
                  key={n}
                  type="button"
                  className={`srd-attempt-tab ${selectedAttempt === n ? "srd-attempt-tab--active" : ""} ${entry?.passed ? "srd-attempt-tab--pass" : ""}`}
                  onClick={() => { setSelectedAttempt(n); setIsEditMode(false); }}
                >
                  {n}차{n === 1 ? " 응시" : " 재시험"}
                  {entry && (
                    <span className={`srd-attempt-tab__score ${entry.passed ? "srd-attempt-tab__score--pass" : "srd-attempt-tab__score--fail"}`}>
                      {entry.score ?? "—"}점
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 메인 탭 (답안지/오답노트) — 1차만 */}
          {selectedAttempt === 1 && (
            <div className="srd-modal__tabs">
              <div className="srd-modal__tab-bar">
                <button type="button" className={`srd-modal__tab ${mainTab === "answer" ? "srd-modal__tab--active" : ""}`} onClick={() => { setMainTab("answer"); setIsEditMode(false); }}>
                  답안지
                </button>
                <button type="button" className={`srd-modal__tab ${mainTab === "wrong" ? "srd-modal__tab--active" : ""}`} onClick={() => { setMainTab("wrong"); setIsEditMode(false); }}>
                  오답노트
                </button>
              </div>
            </div>
          )}

          {/* Body */}
          <div className="srd-modal__body">
            {selectedAttempt === 1 && mainTab === "answer" && (
              <>
                {detailLoading && <div className="srd-modal__loading">불러오는 중…</div>}
                {detailError && <div className="srd-modal__error">조회 실패</div>}
                {!detailLoading && !detailError && !isEditMode && (
                  <ReadModeContent
                    scanImageUrl={scanImageUrl}
                    items={effectiveItems}
                    totalScore={detail?.total_score ?? 0}
                    maxScore={detail?.max_score ?? 0}
                    isEmpty={items1st.length === 0 && emptySlotItems.length === 0}
                  />
                )}
                {!detailLoading && !detailError && isEditMode && (
                  <EditModeContent
                    examId={examId}
                    enrollmentId={enrollmentId}
                    items={effectiveItems}
                    scanImageUrl={scanImageUrl}
                    onSaved={invalidateAll}
                  />
                )}
              </>
            )}

            {selectedAttempt === 1 && mainTab === "wrong" && (
              <WrongNotePanel enrollmentId={enrollmentId} examId={examId} />
            )}

            {selectedAttempt >= 2 && selectedAttemptEntry && (
              <RetakeAttemptView attempt={selectedAttemptEntry} maxScore={attemptData?.max_score ?? 0} passScore={attemptData?.pass_score ?? 0} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════ */
/* 읽기 모드                                           */
/* ═══════════════════════════════════════════════════ */

function ReadModeContent({ scanImageUrl, items, totalScore, maxScore, isEmpty }: {
  scanImageUrl: string;
  items: ExamResultItem[];
  totalScore: number;
  maxScore: number;
  isEmpty: boolean;
}) {
  const choiceItems = items.filter((it) => isChoiceAnswer(it.answer));
  const essayItems = items.filter((it) => !isChoiceAnswer(it.answer));
  const unansweredItems = items.filter((it) => !it.answer || it.answer.trim() === "");

  return (
    <div className="srd-read">
      {/* 스캔 이미지 */}
      <section className="srd-read__section">
        <h3 className="srd-read__section-title">스캔 이미지</h3>
        {scanImageUrl ? (
          <div className="srd-read__scan">
            <img src={scanImageUrl} alt="답안지 스캔" className="srd-read__scan-img" />
            <a href={scanImageUrl} target="_blank" rel="noopener noreferrer" className="srd-read__scan-link">새 창에서 보기</a>
          </div>
        ) : (
          <div className="srd-read__scan-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            <span>제출된 스캔 이미지가 없습니다</span>
          </div>
        )}
      </section>

      {isEmpty ? (
        <div className="srd-modal__empty-edit">
          <p>문항별 데이터가 아직 없습니다.</p>
          <p className="srd-modal__empty-edit-sub">상단의 <strong>수정</strong> 버튼을 눌러 문항별 점수를 직접 입력할 수 있습니다.</p>
        </div>
      ) : (
        <>
          {/* 2컬럼 */}
          <div className="srd-read__columns">
            <section className="srd-read__column">
              <h3 className="srd-read__section-title">선택형 답안 <span className="srd-read__count">{choiceItems.length}문항</span></h3>
              {choiceItems.length > 0 ? (
                <ul className="srd-read__choice-list">
                  {choiceItems.map((it) => (
                    <li key={it.question_id} className="srd-read__choice-row">
                      <span className="srd-read__q-num">{it.question_id}</span>
                      <div className="srd-read__bubbles">
                        {CHOICES.map((c) => {
                          const sel = String(it.answer ?? "").trim() === c;
                          return (
                            <span key={c} className={`srd-read__bubble ${sel ? (it.is_correct ? "srd-read__bubble--correct" : "srd-read__bubble--wrong") : ""}`}>
                              {c}
                              {sel && !it.is_correct && <span className="srd-read__bubble-x">✕</span>}
                            </span>
                          );
                        })}
                      </div>
                      <span className={`srd-read__q-score ${it.is_correct ? "srd-read__q-score--pass" : "srd-read__q-score--fail"}`}>{it.score}/{it.max_score}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="srd-read__empty">선택형 문항 없음</p>}
            </section>

            <section className="srd-read__column">
              <h3 className="srd-read__section-title">서술형 답안 <span className="srd-read__count">{essayItems.length + unansweredItems.length}문항</span></h3>
              {(essayItems.length > 0 || unansweredItems.length > 0) ? (
                <ul className="srd-read__essay-list">
                  {[...essayItems, ...unansweredItems.filter((it) => !essayItems.includes(it))].map((it) => (
                    <li key={it.question_id} className="srd-read__essay-row">
                      <span className="srd-read__q-num">{it.question_id}</span>
                      <span className="srd-read__essay-answer">{it.answer || "—"}</span>
                      <span className={`srd-read__q-score ${it.is_correct ? "srd-read__q-score--pass" : "srd-read__q-score--fail"}`}>{it.score}/{it.max_score}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="srd-read__empty">서술형 문항 없음</p>}
            </section>
          </div>

          <div className="srd-read__total">총점 : {totalScore} / {maxScore}점</div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/* 2차+ 재시험 뷰                                      */
/* ═══════════════════════════════════════════════════ */

function RetakeAttemptView({ attempt, maxScore, passScore }: { attempt: AttemptEntry; maxScore: number; passScore: number | null }) {
  return (
    <div className="srd-retake-view">
      <div className={`srd-retake-view__card ${attempt.passed ? "srd-retake-view__card--pass" : "srd-retake-view__card--fail"}`}>
        <div className="srd-retake-view__header">
          <span className="srd-retake-view__label">{attempt.attempt_index}차 재시험 결과</span>
          <span className={`srd-retake-view__badge ${attempt.passed ? "srd-retake-view__badge--pass" : "srd-retake-view__badge--fail"}`}>
            {attempt.passed ? "합격" : "불합격"}
          </span>
        </div>
        <div className="srd-retake-view__score">
          <span className="srd-retake-view__score-val">{attempt.score ?? "—"}</span>
          <span className="srd-retake-view__score-max">/ {maxScore}</span>
          {attempt.score != null && maxScore > 0 && (
            <span className="srd-retake-view__pct">{Math.round((attempt.score / maxScore) * 100)}%</span>
          )}
        </div>
        {passScore != null && (
          <div className="srd-retake-view__cutline">합격 기준: {passScore}점</div>
        )}
        <div className="srd-retake-view__note">
          재시험은 총점만 기록됩니다. 문항별 상세는 1차 응시에서 확인하세요.
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/* 편집 모드 — 1차 응시 문항별 점수 수정                  */
/* ═══════════════════════════════════════════════════ */

const SCORE_COLORS: Record<number, string> = {
  0: "#9ca3af", 1: "#b91c1c", 2: "#c2410c", 3: "#b45309", 4: "#a16207",
  5: "#15803d", 6: "#0d9488", 7: "#0b7285", 8: "#1d4ed8", 9: "#6d28d9", 10: "#be185d",
};

function getScoreColor(s: number): string {
  return SCORE_COLORS[Math.min(10, Math.max(0, Math.round(s)))] ?? SCORE_COLORS[5];
}

function EditModeContent({ examId, enrollmentId, items, scanImageUrl, onSaved }: {
  examId: number;
  enrollmentId: number;
  items: ExamResultItem[];
  scanImageUrl: string;
  onSaved: () => void;
}) {
  const [scores, setScores] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    for (const it of items) init[it.question_id] = it.score ?? 0;
    return init;
  });

  const essayRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const saveMutation = useMutation({
    mutationFn: (params: { questionId: number; score: number }) =>
      patchExamItemScore({ examId, enrollmentId, questionId: params.questionId, score: params.score }),
    onSuccess: () => onSaved(),
    onError: () => feedback.error("점수 저장에 실패했습니다."),
  });

  const saveScore = useCallback((qid: number, val: number) => {
    const item = items.find((it) => it.question_id === qid);
    if (!item) return;
    const clamped = Math.max(0, Math.min(val, item.max_score));
    setScores((prev) => ({ ...prev, [qid]: clamped }));
    saveMutation.mutate({ questionId: qid, score: clamped });
  }, [items, saveMutation]);

  const adjustScore = useCallback((qid: number, delta: number) => {
    saveScore(qid, (scores[qid] ?? 0) + delta);
  }, [scores, saveScore]);

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const totalMax = items.reduce((a, it) => a + it.max_score, 0);

  // 문항 번호 순 정렬
  const sorted = useMemo(() => [...items].sort((a, b) => a.question_id - b.question_id), [items]);

  return (
    <div className="srd-edit">
      {/* 스캔 이미지 */}
      <div className="srd-edit__scan-ref">
        {scanImageUrl ? (
          <img src={scanImageUrl} alt="스캔 참고" className="srd-edit__scan-img" />
        ) : (
          <div className="srd-read__scan-empty">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            <span>스캔 이미지 없음</span>
          </div>
        )}
      </div>

      {/* 문항별 점수 편집 — 단일 리스트 (문항 번호 순) */}
      <div className="srd-edit__list-header">
        <span className="srd-edit__list-header-num">번호</span>
        <span className="srd-edit__list-header-answer">답안</span>
        <span className="srd-edit__list-header-score">점수</span>
        <span className="srd-edit__list-header-ctrl">조절</span>
      </div>
      <div className="srd-edit__list">
        {sorted.map((it, idx) => {
          const score = scores[it.question_id] ?? 0;
          const isDivider = (idx + 1) % 5 === 0 && idx < sorted.length - 1;
          return (
            <div key={it.question_id} className={`srd-edit__row ${isDivider ? "srd-edit__row--divider" : ""}`}>
              <span className="srd-edit__q-num">{it.question_id}</span>
              <span className="srd-edit__q-answer" title={it.answer || "—"}>
                {it.answer ? (isChoiceAnswer(it.answer) ? `${it.answer}번` : it.answer) : "—"}
              </span>
              <div className="srd-edit__essay-score-wrap">
                <input
                  ref={(el) => { essayRefs.current[it.question_id] = el; }}
                  type="number"
                  className="srd-edit__essay-input"
                  value={score}
                  onChange={(e) => {
                    const v = e.target.value === "" ? 0 : parseFloat(e.target.value);
                    if (!isNaN(v)) setScores((prev) => ({ ...prev, [it.question_id]: Math.max(0, Math.min(v, it.max_score)) }));
                  }}
                  onBlur={() => saveScore(it.question_id, scores[it.question_id] ?? 0)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveScore(it.question_id, scores[it.question_id] ?? 0);
                      const nextItem = sorted[idx + 1];
                      if (nextItem) essayRefs.current[nextItem.question_id]?.focus();
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      const nextItem = sorted[idx + 1];
                      if (nextItem) essayRefs.current[nextItem.question_id]?.focus();
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      const prevItem = sorted[idx - 1];
                      if (prevItem) essayRefs.current[prevItem.question_id]?.focus();
                    }
                  }}
                  min={0}
                  max={it.max_score}
                  step="any"
                />
                <span className="srd-edit__essay-max">/ {it.max_score}</span>
              </div>
              <ScoreControl score={score} maxScore={it.max_score} onAdjust={(d) => adjustScore(it.question_id, d)} onReset={() => saveScore(it.question_id, it.score ?? 0)} />
            </div>
          );
        })}
      </div>

      <div className="srd-edit__total">총점 : {totalScore} / {totalMax}점</div>
    </div>
  );
}

function ScoreControl({ score, maxScore, onAdjust, onReset }: { score: number; maxScore: number; onAdjust: (d: number) => void; onReset: () => void }) {
  return (
    <div className="srd-score-ctrl">
      <span className="srd-score-ctrl__val" style={{ color: getScoreColor(score) }}>{score}점</span>
      <div className="srd-score-ctrl__btns">
        <button type="button" className="srd-score-btn srd-score-btn--p1" onClick={() => onAdjust(1)} disabled={score >= maxScore}>+1</button>
        <button type="button" className="srd-score-btn srd-score-btn--p2" onClick={() => onAdjust(2)} disabled={score >= maxScore}>+2</button>
        <button type="button" className="srd-score-btn srd-score-btn--p5" onClick={() => onAdjust(5)} disabled={score >= maxScore}>+5</button>
        <button type="button" className="srd-score-btn srd-score-btn--reset" onClick={onReset} title="초기화">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
