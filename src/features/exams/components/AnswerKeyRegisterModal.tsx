/**
 * 답안 등록 모달 — 2번 예시 레이아웃: 탭(답안 등록 | 이미지 등록), 툴바, 2단(문항 영역 | 요약/액션), 선택형·서술형 행(+ 예외, 점수), 하단 액션바.
 * 디자인 시스템: ds-tabs, ds-button, ds-input, modal-tabs-area, modal-footer.
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button, Tabs } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { fetchQuestionsByExam, type ExamQuestion } from "../api/questionApi";
import { initExamQuestions } from "../api/questionInitApi";
import {
  createAnswerKey,
  fetchAnswerKeyByExam,
  updateAnswerKey,
  type AnswerKey,
} from "../api/answerKeyApi";
import { patchQuestionScore } from "@/features/materials/api/sheetQuestions";
import "./AnswerKeyRegisterModal.css";

type Props = {
  open: boolean;
  onClose: () => void;
  examId: number;
  structureOwnerId: number;
};

const CHOICES = ["1", "2", "3", "4", "5"];

function normalizeAnswers(input: Record<string, string>) {
  const out: Record<string, string> = {};
  Object.entries(input || {}).forEach(([k, v]) => {
    out[String(k)] = String(v ?? "").trim();
  });
  return out;
}

export default function AnswerKeyRegisterModal({
  open,
  onClose,
  examId,
  structureOwnerId,
}: Props) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"answer" | "image">("answer");

  const { data: questions = [] } = useQuery({
    queryKey: ["exam-questions", examId],
    queryFn: () => fetchQuestionsByExam(examId).then((r) => r.data),
    enabled: open && Number.isFinite(examId),
  });

  const { data: answerKeyList } = useQuery({
    queryKey: ["answer-key", examId],
    queryFn: () => fetchAnswerKeyByExam(examId),
    enabled: open && questions.length > 0,
  });
  const answerKey = (answerKeyList?.data ?? [])[0] ?? null;

  const [choiceCount, setChoiceCount] = useState<number | "">("");
  const [choiceScore, setChoiceScore] = useState<number | "">(5);
  const [choiceNoDefaultScore, setChoiceNoDefaultScore] = useState(false);
  const [essayCount, setEssayCount] = useState<number | "">("");
  const [essayScore, setEssayScore] = useState<number | "">(5);
  const [essayNoDefaultScore, setEssayNoDefaultScore] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saveBusy, setSaveBusy] = useState(false);
  /** 문항별 점수 드래프트 (문항 반영 시 초기값은 question.score) */
  const [scoreDraft, setScoreDraft] = useState<Record<number, number>>({});
  /** 선택형/서술형 제목 클릭 시 문항 수·기본점수 편집 영역 표시 */
  const [choiceEditorOpen, setChoiceEditorOpen] = useState(false);
  const [essayEditorOpen, setEssayEditorOpen] = useState(false);
  /** 이미지 등록 탭: 문항별 해설 — 해설 텍스트 또는 해설 이미지 URL(객체 URL) */
  const [explanationDraft, setExplanationDraft] = useState<
    Record<number, { text: string; imageUrl: string | null }>
  >({});

  const sortedQuestions = useMemo(
    () => [...questions].sort((a, b) => a.number - b.number),
    [questions]
  );

  const effectiveChoiceCount =
    questions.length > 0 && (choiceCount === "" || essayCount === "")
      ? questions.length
      : Math.max(0, Number(choiceCount) || 0);
  const effectiveEssayCount =
    questions.length > 0 && (choiceCount === "" || essayCount === "")
      ? 0
      : Math.max(0, Number(essayCount) || 0);
  const choiceQuestions = sortedQuestions.slice(0, effectiveChoiceCount);
  const essayQuestions = sortedQuestions.slice(effectiveChoiceCount);

  const getScore = (q: ExamQuestion) => scoreDraft[q.id] ?? q.score ?? 0;
  const totalScore = useMemo(
    () => sortedQuestions.reduce((sum, q) => sum + (scoreDraft[q.id] ?? q.score ?? 0), 0),
    [sortedQuestions, scoreDraft]
  );
  const choiceTotalScore = choiceQuestions.reduce((sum, q) => sum + getScore(q), 0);
  const essayTotalScore = essayQuestions.reduce((sum, q) => sum + getScore(q), 0);

  useEffect(() => {
    if (!answerKey || !answerKey.answers) return;
    setDraft(normalizeAnswers(answerKey.answers));
  }, [answerKey?.id]);

  /** 문항 목록 로드 시 점수 드래프트 동기화 */
  const questionIdsKey = sortedQuestions.map((q) => q.id).join(",");
  useEffect(() => {
    if (sortedQuestions.length === 0) return;
    setScoreDraft((prev) => {
      const next = { ...prev };
      sortedQuestions.forEach((q) => {
        if (next[q.id] === undefined) next[q.id] = q.score ?? 0;
      });
      return next;
    });
  }, [questionIdsKey, sortedQuestions.length]);

  const initMut = useMutation({
    mutationFn: async () => {
      const cc = Number(choiceCount) || 0;
      const ec = Number(essayCount) || 0;
      const cs = choiceNoDefaultScore ? 0 : (Number(choiceScore) || 5);
      const es = essayNoDefaultScore ? 0 : (Number(essayScore) || 5);
      if (cc + ec === 0) throw new Error("객관식+주관식 문항 수 합이 1 이상이어야 합니다.");
      return initExamQuestions({
        examId,
        choice_count: cc,
        choice_score: cs,
        essay_count: ec,
        essay_score: es,
      });
    },
    onSuccess: async (result) => {
      const list = result?.data ?? [];
      qc.setQueryData(["exam-questions", examId], list);
      setScoreDraft((prev) => {
        const next = { ...prev };
        list.forEach((q: ExamQuestion) => {
          next[q.id] = q.score ?? 0;
        });
        return next;
      });
      setChoiceEditorOpen(false);
      setEssayEditorOpen(false);
      await qc.invalidateQueries({ queryKey: ["answer-key", examId] });
      feedback.success("문항이 반영되었습니다.");
    },
    onError: (e: any) => {
      feedback.error(e?.response?.data?.detail ?? "문항 반영 실패");
    },
  });

  const handleSave = async () => {
    setSaveBusy(true);
    try {
      const normalized = normalizeAnswers(draft);
      const targetExamId = examId;
      if (!answerKey) {
        await createAnswerKey({ exam: targetExamId, answers: normalized });
      } else {
        await updateAnswerKey(answerKey.id, { answers: normalized });
      }
      await qc.invalidateQueries({ queryKey: ["answer-key", examId] });
      for (const q of sortedQuestions) {
        const nextScore = scoreDraft[q.id] ?? q.score ?? 0;
        if (Number.isFinite(nextScore) && nextScore !== (q.score ?? 0)) {
          await patchQuestionScore({ questionId: q.id, score: nextScore });
        }
      }
      await qc.invalidateQueries({ queryKey: ["exam-questions", examId] });
      feedback.success("저장되었습니다.");
    } catch (e: any) {
      feedback.error(e?.response?.data?.detail ?? "저장 실패");
    } finally {
      setSaveBusy(false);
    }
  };

  if (!open) return null;

  const hasQuestions = questions.length > 0;

  return (
    <AdminModal open onClose={onClose} type="action" width={MODAL_WIDTH.answerKey}>
      <ModalHeader
        type="action"
        title={
          <div className="answer-key-modal-header-tabs">
            <Tabs
              value={activeTab}
              items={[
                { key: "answer", label: "답안 등록" },
                { key: "image", label: "이미지 등록" },
              ]}
              onChange={(key) => setActiveTab(key as "answer" | "image")}
            />
          </div>
        }
        description="선택형·서술형 문항별 정답을 입력하고 저장합니다. 채점 시 사용됩니다."
      />

      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact answer-key-panel">
          {activeTab === "answer" && (
            <>
            <div className="answer-key-two-panels">
              {/* 좌측: 선택형 — 제목 버튼 클릭 시 문항 수 변경 */}
              <div className="answer-key-panel answer-key-panel--choice">
                <button
                  type="button"
                  className="answer-key-section-btn"
                  onClick={() => {
                    setChoiceEditorOpen((v) => !v);
                    if (essayEditorOpen) setEssayEditorOpen(false);
                  }}
                  aria-expanded={choiceEditorOpen}
                >
                  선택형 ({choiceTotalScore}점) — {choiceQuestions.length}문항
                </button>
                {choiceEditorOpen && (
                  <div className="answer-key-inline-editor">
                    <label className="answer-key-field">
                      <span className="answer-key-field__label">문항 수</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={choiceCount}
                        onChange={(e) =>
                          setChoiceCount(e.target.value === "" ? "" : Number(e.target.value))
                        }
                        placeholder="예: 20"
                        className="ds-input"
                        style={{ width: 100 }}
                      />
                    </label>
                    <label className="answer-key-field">
                      <span className="answer-key-field__label">기본 점수</span>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={choiceScore}
                        onChange={(e) =>
                          setChoiceScore(e.target.value === "" ? "" : Number(e.target.value))
                        }
                        className="ds-input"
                        style={{ width: 80 }}
                      />
                    </label>
                    <label className="answer-key-field answer-key-field--checkbox">
                      <input
                        type="checkbox"
                        checked={choiceNoDefaultScore}
                        onChange={(e) => setChoiceNoDefaultScore(e.target.checked)}
                        className="ds-input"
                      />
                      <span className="answer-key-field__label">기본점수 미사용</span>
                    </label>
                    <Button
                      type="button"
                      intent="primary"
                      size="sm"
                      onClick={() => initMut.mutate()}
                      disabled={initMut.isPending}
                      loading={initMut.isPending}
                    >
                      문항 반영
                    </Button>
                  </div>
                )}
                <ul className="answer-key-list answer-key-list--choice-scroll">
                  {choiceQuestions.map((q, index) => (
                    <ChoiceRow
                      key={q.id}
                      question={q}
                      draft={draft[String(q.id)] ?? ""}
                      onChange={(value) =>
                        setDraft((prev) => ({ ...prev, [String(q.id)]: value }))
                      }
                      score={getScore(q)}
                      onScoreChange={(delta) =>
                        setScoreDraft((prev) => ({
                          ...prev,
                          [q.id]: Math.max(0, (prev[q.id] ?? q.score ?? 0) + delta),
                        }))
                      }
                      onScoreReset={() =>
                        setScoreDraft((prev) => ({ ...prev, [q.id]: 0 }))
                      }
                      showDividerAfter={(index + 1) % 5 === 0 && index < choiceQuestions.length - 1}
                    />
                  ))}
                </ul>
                <div className="answer-key-upload-links">
                  <button type="button" className="answer-key-link">
                    엑셀로 답안 업로드
                  </button>
                </div>
              </div>

              {/* 우측: 서술형 — 제목 버튼 클릭 시 문항 수 변경 */}
              <div className="answer-key-panel answer-key-panel--essay">
                <button
                  type="button"
                  className="answer-key-section-btn"
                  onClick={() => {
                    setEssayEditorOpen((v) => !v);
                    if (choiceEditorOpen) setChoiceEditorOpen(false);
                  }}
                  aria-expanded={essayEditorOpen}
                >
                  서술형 ({essayTotalScore}점) — {essayQuestions.length}문항
                </button>
                {essayEditorOpen && (
                  <div className="answer-key-inline-editor">
                    <label className="answer-key-field">
                      <span className="answer-key-field__label">문항 수</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={essayCount}
                        onChange={(e) =>
                          setEssayCount(e.target.value === "" ? "" : Number(e.target.value))
                        }
                        placeholder="예: 1"
                        className="ds-input"
                        style={{ width: 100 }}
                      />
                    </label>
                    <label className="answer-key-field">
                      <span className="answer-key-field__label">기본 점수</span>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={essayScore}
                        onChange={(e) =>
                          setEssayScore(e.target.value === "" ? "" : Number(e.target.value))
                        }
                        className="ds-input"
                        style={{ width: 80 }}
                      />
                    </label>
                    <label className="answer-key-field answer-key-field--checkbox">
                      <input
                        type="checkbox"
                        checked={essayNoDefaultScore}
                        onChange={(e) => setEssayNoDefaultScore(e.target.checked)}
                        className="ds-input"
                      />
                      <span className="answer-key-field__label">기본점수 미사용</span>
                    </label>
                    <Button
                      type="button"
                      intent="primary"
                      size="sm"
                      onClick={() => initMut.mutate()}
                      disabled={initMut.isPending}
                      loading={initMut.isPending}
                    >
                      문항 반영
                    </Button>
                  </div>
                )}
                <ul className="answer-key-list answer-key-list--essay-scroll">
                  {essayQuestions.map((q, index) => (
                    <EssayRow
                      key={q.id}
                      question={q}
                      draft={draft[String(q.id)] ?? ""}
                      onChange={(value) =>
                        setDraft((prev) => ({ ...prev, [String(q.id)]: value }))
                      }
                      score={getScore(q)}
                      onScoreChange={(delta) =>
                        setScoreDraft((prev) => ({
                          ...prev,
                          [q.id]: Math.max(0, (prev[q.id] ?? q.score ?? 0) + delta),
                        }))
                      }
                      onScoreReset={() =>
                        setScoreDraft((prev) => ({ ...prev, [q.id]: 0 }))
                      }
                      showDividerAfter={(index + 1) % 5 === 0 && index < essayQuestions.length - 1}
                    />
                  ))}
                </ul>
              </div>
            </div>
            </>
          )}

          {activeTab === "image" && (
            <div className="answer-key-image-tab">
              <h3 className="answer-key-section__title">문제 해설</h3>
              <p className="answer-key-image-tab__desc">
                문항별 문제 이미지와 해설(이미지 또는 텍스트)을 등록합니다.
              </p>
              {sortedQuestions.length === 0 ? (
                <div className="answer-key-empty">
                  먼저 &quot;답안 등록&quot; 탭에서 문항 수를 입력하고 문항 반영을 해주세요.
                </div>
              ) : (
                <div className="answer-key-explanation-table-wrap">
                  <table className="answer-key-explanation-table">
                    <thead>
                      <tr>
                        <th className="answer-key-explanation-table__th--problem">문제</th>
                        <th className="answer-key-explanation-table__th--explanation">해설</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedQuestions.map((q) => (
                        <ExplanationRow
                          key={q.id}
                          question={q}
                          explanation={explanationDraft[q.id] ?? { text: "", imageUrl: null }}
                          onChange={(next) =>
                            setExplanationDraft((prev) => ({ ...prev, [q.id]: next }))
                          }
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter
        left={null}
        right={
          <>
            <Button intent="secondary" onClick={onClose}>
              취소
            </Button>
            {activeTab === "answer" && hasQuestions && (
              <Button
                intent="primary"
                onClick={handleSave}
                disabled={saveBusy}
                loading={saveBusy}
              >
                저장 (총 {Math.round(totalScore)}점)
              </Button>
            )}
            {activeTab === "image" && sortedQuestions.length > 0 && (
              <Button
                intent="primary"
                onClick={() => feedback.info("해설 저장 기능은 API 연동 후 제공됩니다.")}
              >
                저장
              </Button>
            )}
          </>
        }
      />
    </AdminModal>
  );
}

function ChoiceRow({
  question,
  draft,
  onChange,
  score,
  onScoreChange,
  onScoreReset,
  showDividerAfter = false,
}: {
  question: ExamQuestion;
  draft: string;
  onChange: (value: string) => void;
  score: number;
  onScoreChange: (delta: number) => void;
  onScoreReset: () => void;
  showDividerAfter?: boolean;
}) {
  const currentIndex = CHOICES.indexOf(draft);
  const selectedIndex = currentIndex >= 0 ? currentIndex : 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const next = selectedIndex <= 0 ? CHOICES[0] : CHOICES[selectedIndex - 1];
      onChange(next);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next =
        selectedIndex >= CHOICES.length - 1 ? CHOICES[CHOICES.length - 1] : CHOICES[selectedIndex + 1];
      onChange(next);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const next = CHOICES[selectedIndex];
      if (next) onChange(next);
      return;
    }
  };

  return (
    <li className={`answer-key-row answer-key-row--choice ${showDividerAfter ? "answer-key-row--divider-after" : ""}`}>
      <div className="answer-key-row__num">{question.number}</div>
      <div
        className="answer-key-row__bubbles"
        role="radiogroup"
        aria-label={`${question.number}번 정답`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {CHOICES.map((c) => (
          <label key={c} className="answer-key-omr-label">
            <input
              type="radio"
              name={`q-${question.id}`}
              value={c}
              checked={draft === c}
              onChange={() => onChange(c)}
              className="ds-sr-only"
            />
            <span
              className={`exam-omr-bubble ${draft === c ? "exam-omr-bubble--selected" : ""}`}
              aria-hidden
            >
              {c}
            </span>
          </label>
        ))}
      </div>
      <div className="answer-key-row__score-ctrl">
        <span className="answer-key-row__score-val">{score}점</span>
        <div className="answer-key-row__score-btns">
          <button type="button" className="answer-key-score-btn" onClick={() => onScoreChange(1)}>+1</button>
          <button type="button" className="answer-key-score-btn" onClick={() => onScoreChange(2)}>+2</button>
          <button type="button" className="answer-key-score-btn" onClick={() => onScoreChange(5)}>+5</button>
          <button type="button" className="answer-key-score-btn answer-key-score-btn--reset" onClick={onScoreReset} aria-label="점수 초기화">
            <ResetIcon />
          </button>
        </div>
      </div>
    </li>
  );
}

function ResetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function EssayRow({
  question,
  draft,
  onChange,
  score,
  onScoreChange,
  onScoreReset,
  showDividerAfter = false,
}: {
  question: ExamQuestion;
  draft: string;
  onChange: (value: string) => void;
  score: number;
  onScoreChange: (delta: number) => void;
  onScoreReset: () => void;
  showDividerAfter?: boolean;
}) {
  return (
    <li className={`answer-key-row answer-key-row--essay ${showDividerAfter ? "answer-key-row--divider-after" : ""}`}>
      <div className="answer-key-row__num">{question.number}</div>
      <div className="answer-key-row__input-wrap">
        <input
          type="text"
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          placeholder="해설참조"
          className="ds-input answer-key-row__input"
        />
      </div>
      <div className="answer-key-row__score-ctrl">
        <span className="answer-key-row__score-val">{score}점</span>
        <div className="answer-key-row__score-btns">
          <button type="button" className="answer-key-score-btn" onClick={() => onScoreChange(1)}>+1</button>
          <button type="button" className="answer-key-score-btn" onClick={() => onScoreChange(2)}>+2</button>
          <button type="button" className="answer-key-score-btn" onClick={() => onScoreChange(5)}>+5</button>
          <button type="button" className="answer-key-score-btn answer-key-score-btn--reset" onClick={onScoreReset} aria-label="점수 초기화">
            <ResetIcon />
          </button>
        </div>
      </div>
    </li>
  );
}

type ExplanationState = { text: string; imageUrl: string | null };

function ExplanationRow({
  question,
  explanation,
  onChange,
}: {
  question: ExamQuestion;
  explanation: ExplanationState;
  onChange: (next: ExplanationState) => void;
}) {
  const label = typeof question.number === "number" ? String(question.number) : `S${question.number}`;
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onChange({ ...explanation, imageUrl: url });
    e.target.value = "";
  };
  const clearImage = () => onChange({ ...explanation, imageUrl: null });

  return (
    <tr className="answer-key-explanation-row">
      <td className="answer-key-explanation-table__td--problem">
        <div className="answer-key-explanation-cell answer-key-explanation-cell--problem">
          <span className="answer-key-explanation-cell__num">{label}</span>
          {question.image ? (
            <img
              src={question.image}
              alt={`문제 ${label}`}
              className="answer-key-explanation-cell__img"
            />
          ) : (
            <div className="answer-key-explanation-cell__placeholder">
              <span className="answer-key-explanation-cell__placeholder-text">문제 이미지</span>
              <span className="answer-key-explanation-cell__placeholder-hint">클릭 후 Ctrl+V</span>
            </div>
          )}
        </div>
      </td>
      <td className="answer-key-explanation-table__td--explanation">
        <div className="answer-key-explanation-cell answer-key-explanation-cell--explanation">
          {explanation.imageUrl ? (
            <div className="answer-key-explanation-cell__image-wrap">
              <img
                src={explanation.imageUrl}
                alt={`해설 ${label}`}
                className="answer-key-explanation-cell__img"
              />
              <Button type="button" intent="ghost" size="sm" onClick={clearImage}>
                변경
              </Button>
            </div>
          ) : (
            <>
              <textarea
                value={explanation.text}
                onChange={(e) => onChange({ ...explanation, text: e.target.value })}
                placeholder="해설 텍스트 또는 이미지 업로드"
                className="ds-input ds-textarea answer-key-explanation-cell__textarea"
                rows={3}
              />
              <label className="answer-key-explanation-cell__upload">
                <input type="file" accept="image/*" className="ds-sr-only" onChange={handleFile} />
                <span>이미지 업로드</span>
              </label>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
