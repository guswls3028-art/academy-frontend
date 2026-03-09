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

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
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
            { key: "image", label: "이미지 등록", disabled: true },
          ]}
          onChange={(key) => setActiveTab(key as "answer" | "image")}
        />
        <div className="answer-key-toolbar">
          <div className="ds-action-bar" data-align="left">
            <Button type="button" intent="ghost" size="sm">
              ① 연속된 번호
            </Button>
            <Button type="button" intent="ghost" size="sm">
              분리된 번호
            </Button>
            <Button type="button" intent="ghost" size="sm">
              답안만
            </Button>
            <Button type="button" intent="ghost" size="sm">
              유형도 입력
            </Button>
          </div>
          <Button type="button" intent="ghost" size="sm" iconOnly aria-label="다운로드">
            <DownloadIcon />
          </Button>
        </div>
      </div>

      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact answer-key-panel">
          <div className="answer-key-layout">
            <div className="answer-key-main">
              {/* 문항 구성 */}
              <div className="answer-key-section">
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
                <>
                  {choiceQuestions.length > 0 && (
                    <div className="answer-key-section">
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
                        <Button type="button" intent="ghost" size="sm">
                          양식
                        </Button>
                      </div>
                    </div>
                  )}

                  {essayQuestions.length > 0 && (
                    <div className="answer-key-section">
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
                  )}
                </>
              )}
            </div>

            <aside className="answer-key-sidebar">
              <Button type="button" intent="secondary" size="sm" className="answer-key-sidebar__btn">
                다른 차시에서 가져오기
              </Button>
              <div className="answer-key-drag-zone">+ 끌어서 업로드</div>
              {hasQuestions && (
                <>
                  <p className="answer-key-sidebar__summary">
                    선택형 {effectiveChoiceCount}문항, 서술형 {effectiveEssayCount}문항 등록됨
                  </p>
                  <p className="answer-key-sidebar__total">{Math.round(totalScore)} 점</p>
                </>
              )}
              <div className="answer-key-sidebar__actions">
                <Button type="button" intent="ghost" size="sm">
                  설정
                </Button>
                <Button type="button" intent="ghost" size="sm">
                  재채점 진행
                </Button>
                <Button type="button" intent="ghost" size="sm">
                  일괄 삭제
                </Button>
              </div>
            </aside>
          </div>
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
            {hasQuestions && (
              <Button
                intent="primary"
                onClick={handleSave}
                disabled={saveBusy}
                loading={saveBusy}
              >
                저장 (총 {Math.round(totalScore)}점)
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
      <div className="answer-key-row__radios">
        {CHOICES.map((c) => (
          <label key={c} className="answer-key-radio">
            <input
              type="radio"
              name={`q-${question.id}`}
              value={c}
              checked={draft === c}
              onChange={() => onChange(c)}
              className="answer-key-radio__input"
            />
            <span className="answer-key-radio__label">{c}</span>
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
