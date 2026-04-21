/**
 * 답안 상세 모달 — 성적 확인/입력 전용
 *
 * 상태 분기 (중간 랜딩 없이 바로 콘텐츠):
 * A. 기존 데이터 있음 → 읽기 모드(점수 리스트) + "수정" → 인라인 편집
 * B. 데이터 없음 + 문항 존재 → 바로 편집 모드(빈 폼)
 * C. 문항 미등록 → 안내 카드
 *
 * 편집 모드: 2단 레이아웃 (선택형 | 서술형), sticky 총점, 하단 완료 버튼
 */

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import CloseButton from "@/shared/ui/ds/CloseButton";
import { fetchAdminExamResultDetail, type ExamResultItem } from "../api/adminExamResultDetail";
import { fetchAttemptHistory, type AttemptEntry } from "@admin/domains/scores/api/attemptHistory";
import { patchExamItemScore } from "@admin/domains/scores/api/patchItemScore";
import { feedback } from "@/shared/ui/feedback/feedback";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
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
    const candidates: unknown[] = [
      m?.omr?.image_url,
      m?.omr?.imageUrl,
      m?.image_url,
      m?.imageUrl,
      m?.omr?.page_image_url,
    ];
    const hit = candidates.find((v) => typeof v === "string" && v.length > 0);
    if (typeof hit === "string") return hit;
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
  const [scanExpanded, setScanExpanded] = useState(false);

  const { data: detail, isLoading: detailLoading, error: detailError } = useQuery({
    queryKey: ["admin-exam-detail", examId, enrollmentId],
    queryFn: () => fetchAdminExamResultDetail(examId, enrollmentId),
    enabled: Number.isFinite(examId) && Number.isFinite(enrollmentId),
  });

  const { data: attemptData } = useQuery({
    queryKey: ["attempt-history", "exam", examId, enrollmentId],
    queryFn: () => fetchAttemptHistory({ enrollment_id: enrollmentId, exam_id: examId }),
    enabled: Number.isFinite(examId) && Number.isFinite(enrollmentId),
  });

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
  const scanImageUrl = useMemo(
    () => detail?.scan_image_url || getScanImageUrl(items1st),
    [detail?.scan_image_url, items1st],
  );

  const mergedItems: ExamResultItem[] = useMemo(() => {
    const itemMap = new Map(items1st.map((it) => [it.question_id, it]));
    if (examQuestions.length > 0) {
      return examQuestions.map((q) => itemMap.get(q.id) ?? {
        question_id: q.id, answer: "", is_correct: false, score: 0, max_score: q.score, is_editable: true,
      });
    }
    const ca = detail?.correct_answers ?? {};
    const caKeys = Object.keys(ca).map(Number).filter((n) => !isNaN(n)).sort((a, b) => a - b);
    if (caKeys.length > 0) {
      const maxS = detail?.max_score ?? 0;
      const perQ = caKeys.length > 0 ? maxS / caKeys.length : 1;
      return caKeys.map((qid) => itemMap.get(qid) ?? {
        question_id: qid, answer: "", is_correct: false, score: 0, max_score: perQ, is_editable: true,
      });
    }
    return items1st;
  }, [items1st, examQuestions, detail]);

  const hasData = items1st.length > 0 && items1st.some((it) => (it.answer && it.answer.trim() !== "") || it.score > 0);
  const hasQuestions = mergedItems.length > 0;

  const qNumMap = useMemo(() => {
    const map = new Map<number, number>();
    if (examQuestions.length > 0) {
      for (const q of examQuestions) map.set(q.id, q.number);
    } else {
      mergedItems.forEach((it, idx) => map.set(it.question_id, idx + 1));
    }
    return map;
  }, [examQuestions, mergedItems]);

  const correctAnswersMap = detail?.correct_answers ?? {};

  const invalidateAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["admin-exam-detail", examId, enrollmentId] });
    qc.invalidateQueries({ queryKey: ["attempt-history", "exam", examId, enrollmentId] });
    qc.invalidateQueries({ queryKey: ["session-scores"] });
  }, [qc, examId, enrollmentId]);

  const selectedAttemptEntry = attempts.find((a) => a.attempt_index === selectedAttempt);

  const enterEdit = () => { setMainTab("answer"); setIsEditMode(true); };
  const exitEdit = () => { setIsEditMode(false); invalidateAll(); };

  // 상태 B: 최초 로드 시 데이터 없으면 바로 편집 모드 진입
  const initialAutoEdit = useRef(false);
  useEffect(() => {
    if (!detailLoading && !detailError && hasQuestions && !hasData && !initialAutoEdit.current) {
      initialAutoEdit.current = true;
      setIsEditMode(true);
    }
  }, [detailLoading, detailError, hasQuestions, hasData]);

  // 정오답 로컬 판정
  const isItemCorrect = useCallback((it: ExamResultItem) => {
    const ca = correctAnswersMap[String(it.question_id)] ?? "";
    if (ca && isChoiceAnswer(it.answer)) return String(it.answer).trim() === ca.trim();
    return it.is_correct;
  }, [correctAnswersMap]);

  // 선택형/서술형 분리
  const { choiceItems, essayItems } = useMemo(() => {
    const choice: ExamResultItem[] = [];
    const essay: ExamResultItem[] = [];
    for (const it of mergedItems) {
      const ca = correctAnswersMap[String(it.question_id)] ?? "";
      if (ca === "" || isChoiceAnswer(ca)) choice.push(it);
      else essay.push(it);
    }
    return { choiceItems: choice, essayItems: essay };
  }, [mergedItems, correctAnswersMap]);

  const totalScore = detail?.total_score ?? 0;
  const maxScore = detail?.max_score ?? 0;

  return (
    <>
      <div className="srd-modal-backdrop" onClick={onClose} aria-hidden />
      <div className="srd-modal-wrap">
        <div className="srd-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
          <CloseButton className="srd-modal__close" onClick={onClose} />

          {/* ── 헤더 ── */}
          <header className="srd-modal__header">
            <div className="srd-modal__header-inner">
              <h1 className="srd-modal__title">{examTitle} 답안 상세</h1>
              <span className="srd-modal__student-badge"><StudentNameWithLectureChip name={studentName} enrollmentId={enrollmentId} /></span>
            </div>
            {/* 편집 모드 표시 */}
            {isEditMode && !hasData && (
              <span className="srd-modal__mode-label">새 입력</span>
            )}
            {/* 편집 모드에서 완료 */}
            {isEditMode && (
              <button type="button" className="srd-modal__done-btn" onClick={exitEdit}>완료</button>
            )}
          </header>

          {/* ── 시도 차수 탭 (2차 이상 있을 때만) ── */}
          {maxAttempt >= 2 && (
            <div className="srd-modal__attempt-tabs">
              {Array.from({ length: maxAttempt }, (_, i) => i + 1).map((n) => {
                const entry = attempts.find((a) => a.attempt_index === n);
                return (
                  <button
                    key={n}
                    type="button"
                    className={`srd-attempt-tab ${selectedAttempt === n ? "srd-attempt-tab--active" : ""} ${entry?.passed === true ? "srd-attempt-tab--pass" : ""}`}
                    onClick={() => { setSelectedAttempt(n); setIsEditMode(false); }}
                  >
                    {n}차{n === 1 ? " 응시" : " 재시험"}
                    {entry && (
                      <span className={`srd-attempt-tab__score ${entry.passed === true ? "srd-attempt-tab__score--pass" : entry.passed === false ? "srd-attempt-tab__score--fail" : ""}`}>
                        {entry.score ?? "—"}점
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── 메인 탭 (답안지/오답노트) — 1차 + 읽기 모드 ── */}
          {selectedAttempt === 1 && !isEditMode && hasData && (
            <div className="srd-modal__tabs">
              <div className="srd-modal__tab-bar">
                <button type="button" className={`srd-modal__tab ${mainTab === "answer" ? "srd-modal__tab--active" : ""}`} onClick={() => setMainTab("answer")}>답안지</button>
                <button type="button" className={`srd-modal__tab ${mainTab === "wrong" ? "srd-modal__tab--active" : ""}`} onClick={() => setMainTab("wrong")}>오답노트</button>
              </div>
            </div>
          )}

          {/* ── 스캔 이미지 접이식 배너 ── */}
          {scanImageUrl && selectedAttempt === 1 && mainTab === "answer" && (
            <div className={`srd-scan-banner ${scanExpanded ? "srd-scan-banner--expanded" : ""}`}>
              <button type="button" className="srd-scan-banner__toggle" onClick={() => setScanExpanded(!scanExpanded)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
                스캔 이미지
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`srd-scan-banner__chevron ${scanExpanded ? "srd-scan-banner__chevron--up" : ""}`}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {scanExpanded && (
                <div className="srd-scan-banner__content">
                  <img src={scanImageUrl} alt="답안지 스캔" className="srd-scan-banner__img" />
                  <a href={scanImageUrl} target="_blank" rel="noopener noreferrer" className="srd-scan-banner__link">새 창에서 보기</a>
                </div>
              )}
            </div>
          )}

          {/* ── Body ── */}
          <div className="srd-modal__body">
            {selectedAttempt === 1 && mainTab === "answer" && (
              <>
                {detailLoading && <div className="srd-modal__loading">불러오는 중…</div>}
                {detailError && <div className="srd-modal__error">조회 실패</div>}

                {!detailLoading && !detailError && !isEditMode && (
                  hasData ? (
                    /* ── 상태 A: 읽기 모드 — 즉시 문항 리스트 ── */
                    <ReadModeContent
                      choiceItems={choiceItems}
                      essayItems={essayItems}
                      totalScore={totalScore}
                      maxScore={maxScore}
                      qNumMap={qNumMap}
                      correctAnswers={correctAnswersMap}
                      isItemCorrect={isItemCorrect}
                      onEdit={enterEdit}
                    />
                  ) : hasQuestions ? (
                    /* ── 상태 B: 데이터 없음 + 문항 있음 → 입력 유도 ── */
                    <div className="srd-stateB">
                      <p className="srd-stateB__desc">아직 입력된 답안이 없습니다.</p>
                      <button type="button" className="srd-stateB__btn" onClick={enterEdit}>답안 입력 시작</button>
                    </div>
                  ) : (
                    /* ── 상태 C: 문항 미등록 ── */
                    <StateC_NoQuestions examId={examId} examTitle={examTitle} onClose={onClose} />
                  )
                )}

                {!detailLoading && !detailError && isEditMode && (
                  <EditModeContent
                    examId={examId}
                    enrollmentId={enrollmentId}
                    choiceItems={choiceItems}
                    essayItems={essayItems}
                    allItems={mergedItems}
                    correctAnswers={correctAnswersMap}
                    qNumMap={qNumMap}
                    onDone={exitEdit}
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
/* 읽기 모드 — 2단 (선택형 | 서술형) + 총점 상단         */
/* ═══════════════════════════════════════════════════ */

function ReadModeContent({ choiceItems, essayItems, totalScore, maxScore, qNumMap, correctAnswers, isItemCorrect, onEdit }: {
  choiceItems: ExamResultItem[];
  essayItems: ExamResultItem[];
  totalScore: number;
  maxScore: number;
  qNumMap: Map<number, number>;
  correctAnswers: Record<string, string>;
  isItemCorrect: (it: ExamResultItem) => boolean;
  onEdit: () => void;
}) {
  const pct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const choiceCorrect = choiceItems.filter((it) => it.answer && isItemCorrect(it)).length;

  return (
    <div className="srd-read">
      {/* 총점 요약 바 */}
      <div className="srd-read__score-bar">
        <div className="srd-read__score-main">
          <span className="srd-read__score-val">{totalScore}</span>
          <span className="srd-read__score-max">/ {maxScore}점</span>
          <span className="srd-read__score-pct">({pct}%)</span>
        </div>
        <div className="srd-read__score-detail">
          {choiceItems.length > 0 && <span>선택 {choiceCorrect}/{choiceItems.length}</span>}
          {essayItems.length > 0 && <span>서술 {essayItems.reduce((s, it) => s + it.score, 0)}/{essayItems.reduce((s, it) => s + it.max_score, 0)}</span>}
        </div>
      </div>

      {/* 2단 레이아웃 */}
      <div className="srd-read__columns">
        {/* 선택형 */}
        {choiceItems.length > 0 && (
          <section className="srd-read__panel">
            <h3 className="srd-read__panel-title">선택형 <span className="srd-read__badge">{choiceItems.length}</span></h3>
            <div className="srd-read__choice-grid">
              {choiceItems.map((it) => {
                const correct = isItemCorrect(it);
                const num = qNumMap.get(it.question_id) ?? it.question_id;
                const ca = correctAnswers[String(it.question_id)] ?? "";
                const showCorrectAnswer = it.answer && !correct && ca;
                return (
                  <div key={it.question_id} className={`srd-read__choice-cell ${it.answer ? (correct ? "srd-read__choice-cell--correct" : "srd-read__choice-cell--wrong") : "srd-read__choice-cell--empty"}`}>
                    <span className="srd-read__choice-num">{num}</span>
                    <span className="srd-read__choice-ans">{it.answer || "—"}</span>
                    {showCorrectAnswer && <span className="srd-read__choice-correct">{ca}</span>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 서술형 */}
        {essayItems.length > 0 && (
          <section className="srd-read__panel">
            <h3 className="srd-read__panel-title">서술형 <span className="srd-read__badge">{essayItems.length}</span></h3>
            <div className="srd-read__essay-list">
              {essayItems.map((it) => {
                const num = qNumMap.get(it.question_id) ?? it.question_id;
                return (
                  <div key={it.question_id} className="srd-read__essay-row">
                    <span className="srd-read__essay-num">{num}</span>
                    <span className="srd-read__essay-ans">{it.answer || "—"}</span>
                    <span className={`srd-read__essay-score ${it.score > 0 ? "srd-read__essay-score--has" : ""}`}>
                      {it.score}/{it.max_score}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* 하단 수정 CTA */}
      <div className="srd-read__footer">
        <button type="button" className="srd-read__edit-btn" onClick={onEdit}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          성적 수정
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/* 상태 C: 문항 미등록                                  */
/* ═══════════════════════════════════════════════════ */

function StateC_NoQuestions({ examId, examTitle, onClose }: { examId: number; examTitle: string; onClose: () => void }) {
  const navigate = useNavigate();
  const { lectureId, sessionId } = useParams<{ lectureId: string; sessionId: string }>();

  return (
    <div className="srd-stateC">
      <div className="srd-stateC__icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      </div>
      <h3 className="srd-stateC__title">문항이 아직 등록되지 않았습니다</h3>
      <p className="srd-stateC__desc">
        성적을 입력하려면 먼저 시험 설정에서 문항과 답안을 등록해주세요.
      </p>
      <button
        type="button"
        className="srd-stateC__btn"
        onClick={() => {
          onClose();
          if (lectureId && sessionId) navigate(`/admin/lectures/${lectureId}/sessions/${sessionId}/exams?examId=${examId}`);
          else navigate("/admin/lectures");
        }}
      >
        시험 설정으로 이동
      </button>
      <p className="srd-stateC__path">해당 강의 &gt; 차시 &gt; {examTitle} &gt; 시험 설정 &gt; 답안 등록</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/* 2차+ 재시험 뷰                                      */
/* ═══════════════════════════════════════════════════ */

function RetakeAttemptView({ attempt, maxScore, passScore }: { attempt: AttemptEntry; maxScore: number; passScore: number | null }) {
  return (
    <div className="srd-retake-view">
      <div className={`srd-retake-view__card ${attempt.passed === null ? "" : attempt.passed ? "srd-retake-view__card--pass" : "srd-retake-view__card--fail"}`}>
        <div className="srd-retake-view__header">
          <span className="srd-retake-view__label">{attempt.attempt_index}차 재시험 결과</span>
          <span className={`srd-retake-view__badge ${attempt.passed === null ? "" : attempt.passed ? "srd-retake-view__badge--pass" : "srd-retake-view__badge--fail"}`}>
            {attempt.passed === null ? "미정" : attempt.passed ? "합격" : "불합격"}
          </span>
        </div>
        <div className="srd-retake-view__score">
          <span className="srd-retake-view__score-val">{attempt.score ?? "—"}</span>
          <span className="srd-retake-view__score-max">/ {maxScore}</span>
          {attempt.score != null && maxScore > 0 && (
            <span className="srd-retake-view__pct">{Math.round((attempt.score / maxScore) * 100)}%</span>
          )}
        </div>
        {passScore != null && <div className="srd-retake-view__cutline">합격 기준: {passScore}점</div>}
        <div className="srd-retake-view__note">재시험은 총점만 기록됩니다. 문항별 상세는 1차 응시에서 확인하세요.</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/* 편집 모드 — 2단 (선택형 | 서술형) + sticky 총점       */
/* ═══════════════════════════════════════════════════ */

function EditModeContent({ examId, enrollmentId, choiceItems, essayItems, allItems, correctAnswers, qNumMap, onDone }: {
  examId: number;
  enrollmentId: number;
  choiceItems: ExamResultItem[];
  essayItems: ExamResultItem[];
  allItems: ExamResultItem[];
  correctAnswers: Record<string, string>;
  qNumMap: Map<number, number>;
  onDone: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    for (const it of allItems) init[it.question_id] = it.answer ?? "";
    return init;
  });
  const [scores, setScores] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    for (const it of allItems) init[it.question_id] = it.score ?? 0;
    return init;
  });

  const scoreRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const saveMutation = useMutation({
    mutationFn: (params: { questionId: number; score: number; answer?: string }) =>
      patchExamItemScore({ examId, enrollmentId, questionId: params.questionId, score: params.score, answer: params.answer }),
    onError: () => feedback.error("저장에 실패했습니다."),
  });

  const getCorrectAnswer = (qid: number) => correctAnswers[String(qid)] ?? "";

  const handleBubbleClick = useCallback((qid: number, choice: string) => {
    const currentAnswer = answers[qid] ?? "";
    const newAnswer = currentAnswer === choice ? "" : choice;
    setAnswers((prev) => ({ ...prev, [qid]: newAnswer }));

    const correct = correctAnswers[String(qid)] ?? "";
    const item = allItems.find((it) => it.question_id === qid);
    const maxScore = item?.max_score ?? 0;
    let newScore: number;
    if (newAnswer === "") newScore = 0;
    else if (!correct) newScore = scores[qid] ?? 0;
    else if (newAnswer === correct) newScore = maxScore;
    else newScore = 0;
    setScores((prev) => ({ ...prev, [qid]: newScore }));
    saveMutation.mutate({ questionId: qid, score: newScore, answer: newAnswer });
  }, [answers, correctAnswers, allItems, scores, saveMutation]);

  const handleEssayBlur = useCallback((qid: number) => {
    saveMutation.mutate({ questionId: qid, score: scores[qid] ?? 0, answer: answers[qid] ?? "" });
  }, [answers, scores, saveMutation]);

  const handleScoreBlur = useCallback((qid: number) => {
    saveMutation.mutate({ questionId: qid, score: scores[qid] ?? 0, answer: answers[qid] ?? "" });
  }, [answers, scores, saveMutation]);

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const totalMax = allItems.reduce((a, it) => a + it.max_score, 0);

  return (
    <div className="srd-edit">
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
                      {CHOICES.map((c) => {
                        const sel = answer === c;
                        const isWrong = answer !== "" && correct !== "" && answer !== correct;
                        let cls = "";
                        if (!correct && sel) cls = "srd-edit__bubble--neutral";
                        else if (sel && answer === correct) cls = "srd-edit__bubble--correct";
                        else if (sel && isWrong) cls = "srd-edit__bubble--wrong";
                        else if (correct === c && isWrong) cls = "srd-edit__bubble--answer";
                        return (
                          <button key={c} type="button" className={`srd-edit__bubble ${cls}`} onClick={() => handleBubbleClick(qid, c)}>{c}</button>
                        );
                      })}
                    </div>
                    <span className="srd-edit__choice-result">
                      {answer ? (correct ? (answer === correct ? <span className="srd-edit__mark--ok">○</span> : <span className="srd-edit__mark--x">✕</span>) : <span className="srd-edit__mark--score">{scores[qid] ?? 0}/{it.max_score}</span>) : <span className="srd-edit__mark--empty">—</span>}
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
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [qid]: e.target.value }))}
                      onBlur={() => handleEssayBlur(qid)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); scoreRefs.current[qid]?.focus(); } }}
                      placeholder="답안"
                    />
                    <div className="srd-edit__essay-score-wrap">
                      <input
                        ref={(el) => { scoreRefs.current[qid] = el; }}
                        type="number"
                        className="srd-edit__score-input"
                        value={score}
                        onChange={(e) => {
                          const v = e.target.value === "" ? 0 : parseFloat(e.target.value);
                          if (!isNaN(v)) setScores((prev) => ({ ...prev, [qid]: Math.max(0, Math.min(v, it.max_score)) }));
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
        <button type="button" className="srd-edit__done-btn" onClick={onDone}>
          수정 완료
        </button>
      </div>
    </div>
  );
}
