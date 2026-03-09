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
  const [essayCount, setEssayCount] = useState<number | "">("");
  const [essayScore, setEssayScore] = useState<number | "">(5);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saveBusy, setSaveBusy] = useState(false);
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

  const totalScore = useMemo(
    () => sortedQuestions.reduce((sum, q) => sum + (q.score ?? 0), 0),
    [sortedQuestions]
  );
  const choiceTotalScore = choiceQuestions.reduce((sum, q) => sum + (q.score ?? 0), 0);
  const essayTotalScore = essayQuestions.reduce((sum, q) => sum + (q.score ?? 0), 0);

  useEffect(() => {
    if (!answerKey || !answerKey.answers) return;
    setDraft(normalizeAnswers(answerKey.answers));
  }, [answerKey?.id]);

  const initMut = useMutation({
    mutationFn: async () => {
      const cc = Number(choiceCount) || 0;
      const ec = Number(essayCount) || 0;
      const cs = Number(choiceScore) || 5;
      const es = Number(essayScore) || 5;
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
    <AdminModal open onClose={onClose} type="action" width={MODAL_WIDTH.wide}>
      <ModalHeader
        type="action"
        title="답안 등록"
        description="선택형·서술형 문항별 정답을 입력하고 저장합니다. 채점 시 사용됩니다."
      />

      <div className="modal-tabs-area">
        <Tabs
          value={activeTab}
          items={[
            { key: "answer", label: "답안 등록" },
            { key: "image", label: "이미지 등록" },
          ]}
          onChange={(key) => setActiveTab(key as "answer" | "image")}
        />
      </div>

      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact answer-key-panel">
          {activeTab === "answer" && (
            <>
          {/* 문항 구성 — 상단 통째 */}
          <div className="answer-key-section answer-key-section--full">
            <div className="ds-section__title">문항 구성</div>
            <div className="answer-key-structure">
              <div className="answer-key-structure__row">
                <label className="answer-key-field">
                  <span className="answer-key-field__label">객관식(선택형) 문항 수</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={choiceCount}
                    onChange={(e) =>
                      setChoiceCount(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    placeholder="예: 19"
                    className="ds-input"
                    style={{ width: 120 }}
                  />
                </label>
                <label className="answer-key-field">
                  <span className="answer-key-field__label">객관식 기본 점수</span>
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
                <label className="answer-key-field">
                  <span className="answer-key-field__label">주관식(서술형) 문항 수</span>
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
                    style={{ width: 120 }}
                  />
                </label>
                <label className="answer-key-field">
                  <span className="answer-key-field__label">주관식 기본 점수</span>
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
                <Button
                  type="button"
                  intent="secondary"
                  size="sm"
                  onClick={() => initMut.mutate()}
                  disabled={initMut.isPending}
                  loading={initMut.isPending}
                >
                  문항 반영
                </Button>
              </div>
              {hasQuestions && (
                <p className="answer-key-structure__summary">
                  현재 문항 <strong>{questions.length}</strong>개 (선택형 {effectiveChoiceCount}
                  문항, 서술형 {effectiveEssayCount}문항)
                </p>
              )}
            </div>
          </div>

          {!hasQuestions && (
            <div className="answer-key-empty">
              위에서 객관식·주관식 문항 수와 배점을 입력한 뒤 &quot;문항 반영&quot;을 누르면
              아래에 선택형·서술형 답안 입력란이 나타납니다.
            </div>
          )}

          {hasQuestions && (
            <div className="answer-key-two-panels">
              {/* 좌측: 객관식 */}
              <div className="answer-key-panel answer-key-panel--choice">
                <h3 className="answer-key-section__title">
                  선택형 ({choiceTotalScore}점) — {choiceQuestions.length}문항
                </h3>
                <ul className="answer-key-list">
                  {choiceQuestions.map((q) => (
                    <ChoiceRow
                      key={q.id}
                      question={q}
                      draft={draft[String(q.id)] ?? ""}
                      onChange={(value) =>
                        setDraft((prev) => ({ ...prev, [String(q.id)]: value }))
                      }
                    />
                  ))}
                </ul>
                <div className="answer-key-upload-links">
                  <button type="button" className="answer-key-link">
                    엑셀로 답안 업로드
                  </button>
                </div>
              </div>

              {/* 우측: 주관식 */}
              <div className="answer-key-panel answer-key-panel--essay">
                <h3 className="answer-key-section__title">
                  서술형 ({essayTotalScore}점) — {essayQuestions.length}문항
                </h3>
                <ul className="answer-key-list">
                  {essayQuestions.map((q) => (
                    <EssayRow
                      key={q.id}
                      question={q}
                      draft={draft[String(q.id)] ?? ""}
                      onChange={(value) =>
                        setDraft((prev) => ({ ...prev, [String(q.id)]: value }))
                      }
                    />
                  ))}
                </ul>
              </div>
            </div>
          )}
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
        left={
          <span className="answer-key-footer-hint">기본점수 0 점</span>
        }
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
}: {
  question: ExamQuestion;
  draft: string;
  onChange: (value: string) => void;
}) {
  return (
    <li className="answer-key-row answer-key-row--choice">
      <div className="answer-key-row__num">{question.number}</div>
      <div className="answer-key-row__bubbles">
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
      <div className="answer-key-row__score">{question.score} 점</div>
      <Button type="button" intent="ghost" size="sm" className="answer-key-row__exception">
        + 예외
      </Button>
    </li>
  );
}

function EssayRow({
  question,
  draft,
  onChange,
}: {
  question: ExamQuestion;
  draft: string;
  onChange: (value: string) => void;
}) {
  return (
    <li className="answer-key-row answer-key-row--essay">
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
      <div className="answer-key-row__score">{question.score} 점</div>
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
