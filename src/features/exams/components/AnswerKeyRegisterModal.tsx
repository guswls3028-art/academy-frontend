/**
 * 답안 등록 모달 — 2번 예시 레이아웃: 탭(답안 등록 | 이미지 등록), 툴바, 2단(문항 영역 | 요약/액션), 선택형·서술형 행(+ 예외, 점수), 하단 액션바.
 * 디자인 시스템: ds-tabs, ds-button, ds-input, modal-tabs-area, modal-footer.
 */

import { useEffect, useMemo, useState, useRef } from "react";
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
  /** false면 문항/배점 PATCH 생략(regular 시험에서 403 방지). 정답만 저장됨. */
  canEditQuestions?: boolean;
};

const CHOICES = ["1", "2", "3", "4", "5"];

/** 총점을 문항 수만큼 정수로 균등 분배. 나누어떨어지지 않으면 낮은 점수가 앞문항부터 (예: 80점 17문항 → 4점×5문항, 5점×12문항) */
function distributeTotalToScores(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  const lowCount = count - remainder;
  const result: number[] = [];
  for (let i = 0; i < lowCount; i++) result.push(base);
  for (let i = 0; i < remainder; i++) result.push(base + 1);
  return result;
}

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
  canEditQuestions = true,
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
    queryFn: async () => {
      try {
        return await fetchAnswerKeyByExam(examId);
      } catch (e: any) {
        if (e?.response?.status === 404) return { data: [] };
        throw e;
      }
    },
    enabled: open && questions.length > 0,
    retry: (_, error: any) => error?.response?.status !== 404,
  });
  /** DRF list는 pagination 시 { results: [] }, 미사용 시 [] — response.data 기준으로 파싱 */
  const answerKey = useMemo(() => {
    const body = answerKeyList && typeof answerKeyList === "object" && "data" in answerKeyList ? (answerKeyList as { data: unknown }).data : answerKeyList;
    const raw = body as unknown;
    const list = Array.isArray(raw) ? raw : (raw && typeof raw === "object" && "results" in raw ? (raw as { results: AnswerKey[] }).results : []);
    return (list as AnswerKey[])[0] ?? null;
  }, [answerKeyList]);

  const [choiceCount, setChoiceCount] = useState<number | "">("");
  const [choiceCountInput, setChoiceCountInput] = useState<number | "">("");
  /** 자동점수 부여 ON이면 총점 입력 후 정수 분배. 기본값 OFF */
  const [choiceAutoScore, setChoiceAutoScore] = useState(false);
  const [choiceTotalInput, setChoiceTotalInput] = useState<number | "">("");
  const [essayCount, setEssayCount] = useState<number | "">("");
  const [essayCountInput, setEssayCountInput] = useState<number | "">("");
  /** 자동점수 부여. 기본값 OFF */
  const [essayAutoScore, setEssayAutoScore] = useState(false);
  const [essayTotalInput, setEssayTotalInput] = useState<number | "">("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saveBusy, setSaveBusy] = useState(false);
  /** 문항별 점수 드래프트 (문항 반영 시 초기값은 question.score) */
  const [scoreDraft, setScoreDraft] = useState<Record<number, number>>({});
  /** 이미지 등록 탭: 문항별 해설 — 해설 텍스트, 문제 이미지 URL, 해설 이미지 URL(객체 URL) */
  const [explanationDraft, setExplanationDraft] = useState<
    Record<number, { text: string; problemImageUrl: string | null; imageUrl: string | null }>
  >({});

  const choiceBubbleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const essayInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const sortedQuestions = useMemo(
    () => [...questions].sort((a, b) => a.number - b.number),
    [questions]
  );

  const effectiveChoiceCount =
    choiceCount !== "" && essayCount !== ""
      ? Math.max(0, Number(choiceCount) || 0)
      : choiceCount !== ""
        ? Math.max(0, Number(choiceCount) || 0)
        : essayCount !== ""
          ? Math.max(0, questions.length - (Number(essayCount) || 0))
          : questions.length;
  const effectiveEssayCount =
    choiceCount !== "" && essayCount !== ""
      ? Math.max(0, Number(essayCount) || 0)
      : essayCount !== ""
        ? Math.max(0, Number(essayCount) || 0)
        : choiceCount !== ""
          ? Math.max(0, questions.length - (Number(choiceCount) || 0))
          : 0;
  const choiceQuestions = sortedQuestions.slice(0, effectiveChoiceCount);
  const essayQuestions = sortedQuestions.slice(effectiveChoiceCount, effectiveChoiceCount + effectiveEssayCount);

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
    mutationFn: async (overrides?: { choiceCount?: number | ""; essayCount?: number | "" }) => {
      const total = questions.length;
      let cc: number;
      let ec: number;
      if (overrides) {
        const oc = overrides.choiceCount;
        const oe = overrides.essayCount;
        cc = oc !== "" ? Math.max(0, Number(oc) || 0) : Math.max(0, total - (Number(oe) || 0));
        ec = oe !== "" ? Math.max(0, Number(oe) || 0) : Math.max(0, total - (Number(oc) || 0));
      } else {
        cc =
          choiceCount !== ""
            ? Math.max(0, Number(choiceCount) || 0)
            : Math.max(0, total - (Number(essayCount) || 0));
        ec =
          essayCount !== ""
            ? Math.max(0, Number(essayCount) || 0)
            : Math.max(0, total - (Number(choiceCount) || 0));
      }
      if (cc + ec === 0) throw new Error("객관식+주관식 문항 수 합이 1 이상이어야 합니다.");
      return initExamQuestions({
        examId,
        choice_count: cc,
        choice_score: 0,
        essay_count: ec,
        essay_score: 0,
      });
    },
    onSuccess: async (result) => {
      const list = result?.data ?? [];
      const appliedCc =
        choiceCount !== ""
          ? Math.max(0, Number(choiceCount) || 0)
          : Math.max(0, list.length - (Number(essayCount) || 0));
      const appliedEc =
        essayCount !== ""
          ? Math.max(0, Number(essayCount) || 0)
          : Math.max(0, list.length - (Number(choiceCount) || 0));
      setChoiceCount(appliedCc);
      setEssayCount(appliedEc);
      qc.setQueryData(["exam-questions", examId], list);
      const sorted = [...list].sort((a: ExamQuestion, b: ExamQuestion) => a.number - b.number);
      const choiceList = sorted.slice(0, appliedCc);
      const essayList = sorted.slice(appliedCc, appliedCc + appliedEc);

      const nextScoreDraft: Record<number, number> = {};
      if (choiceAutoScore && Number.isFinite(Number(choiceTotalInput)) && choiceTotalInput !== "") {
        const total = Math.max(0, Number(choiceTotalInput));
        const scores = distributeTotalToScores(total, choiceList.length);
        choiceList.forEach((q: ExamQuestion, i: number) => {
          nextScoreDraft[q.id] = scores[i] ?? 0;
        });
      } else {
        choiceList.forEach((q: ExamQuestion) => {
          nextScoreDraft[q.id] = 0;
        });
      }
      if (essayAutoScore && Number.isFinite(Number(essayTotalInput)) && essayTotalInput !== "") {
        const total = Math.max(0, Number(essayTotalInput));
        const scores = distributeTotalToScores(total, essayList.length);
        essayList.forEach((q: ExamQuestion, i: number) => {
          nextScoreDraft[q.id] = scores[i] ?? 0;
        });
      } else {
        essayList.forEach((q: ExamQuestion) => {
          nextScoreDraft[q.id] = 0;
        });
      }
      setScoreDraft((prev) => ({ ...prev, ...nextScoreDraft }));
      if (canEditQuestions) {
        for (const q of sorted) {
          const score = nextScoreDraft[q.id];
          if (score !== undefined && Number.isFinite(score)) {
            await patchQuestionScore({ questionId: q.id, score });
          }
        }
      }
      await qc.invalidateQueries({ queryKey: ["answer-key", examId] });
      await qc.invalidateQueries({ queryKey: ["exam-questions", examId] });
      feedback.success("적용되었습니다.");
    },
    onError: (e: any) => {
      feedback.error(e?.response?.data?.detail ?? "적용 실패");
    },
  });

  /** 적용 클릭: 자동점수 ON이면 총점 필수 검증, 선택형만 설정 시 서술형 0으로 전달 */
  const handleApply = (source: "choice" | "essay") => {
    if (choiceAutoScore) {
      const v = choiceTotalInput;
      if (v === "" || v === undefined || !Number.isFinite(Number(v)) || Number(v) < 0) {
        feedback.error("자동점수 부여(사용) 시 선택형 총점을 입력해 주세요.");
        return;
      }
    }
    if (essayAutoScore) {
      const v = essayTotalInput;
      if (v === "" || v === undefined || !Number.isFinite(Number(v)) || Number(v) < 0) {
        feedback.error("자동점수 부여(사용) 시 서술형 총점을 입력해 주세요.");
        return;
      }
    }
    setChoiceCount(choiceCountInput);
    setEssayCount(essayCountInput);
    const choiceVal = choiceCountInput !== "" ? Number(choiceCountInput) : undefined;
    const essayVal = essayCountInput !== "" ? Number(essayCountInput) : undefined;
    let payload: { choiceCount: number | ""; essayCount: number | "" } = {
      choiceCount: choiceCountInput,
      essayCount: essayCountInput,
    };
    if (choiceVal !== undefined && essayCountInput === "") {
      payload = { choiceCount: choiceCountInput, essayCount: 0 };
    } else if (essayVal !== undefined && choiceCountInput === "") {
      payload = { choiceCount: Math.max(0, questions.length - essayVal), essayCount: essayCountInput };
    }
    initMut.mutate(payload);
  };

  const handleSave = async () => {
    setSaveBusy(true);
    const stepLog = (msg: string, data?: unknown) => {
      if (import.meta.env.DEV) {
        console.log("[AnswerKeyRegister] " + msg, data ?? "");
      }
    };
    stepLog("handleSave 시작", { canEditQuestions, examId, hasAnswerKey: !!answerKey });
    try {
      const normalized = normalizeAnswers(draft);
      const essayIds = new Set(
        sortedQuestions.slice(effectiveChoiceCount, effectiveChoiceCount + effectiveEssayCount).map((q) => String(q.id))
      );
      essayIds.forEach((id) => {
        if (normalized[id] === "" || normalized[id] === undefined) normalized[id] = "해설참조";
      });
      const targetExamId = examId;
      if (!answerKey) {
        stepLog("createAnswerKey 호출", { exam: targetExamId, answerKeys: Object.keys(normalized).length });
        await createAnswerKey({ exam: targetExamId, answers: normalized });
      } else {
        stepLog("updateAnswerKey 호출", { id: answerKey.id, exam: answerKey.exam, answerKeys: Object.keys(normalized).length });
        await updateAnswerKey(answerKey.id, { exam: answerKey.exam, answers: normalized });
      }
      await qc.invalidateQueries({ queryKey: ["answer-key", examId] });
      if (canEditQuestions) {
        const toPatch = sortedQuestions.filter(
          (q) => Number.isFinite(scoreDraft[q.id] ?? q.score ?? 0) && (scoreDraft[q.id] ?? q.score ?? 0) !== (q.score ?? 0)
        );
        stepLog("문항 점수 PATCH", { count: toPatch.length, canEditQuestions });
        for (const q of toPatch) {
          const nextScore = scoreDraft[q.id] ?? q.score ?? 0;
          await patchQuestionScore({ questionId: q.id, score: nextScore });
        }
        await qc.invalidateQueries({ queryKey: ["exam-questions", examId] });
      } else {
        stepLog("문항 점수 PATCH 생략 (regular 시험)", { canEditQuestions });
      }
      feedback.success(
        canEditQuestions ? "저장되었습니다." : "정답이 저장되었습니다. 문항·배점 수정은 템플릿 시험에서만 가능합니다."
      );
    } catch (e: any) {
      const raw = e?.response?.data;
      const detail = raw?.detail ?? raw ?? e?.message;
      stepLog("저장 실패", { status: e?.response?.status, detail });
      const msg =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.join(", ")
            : detail && typeof detail === "object" && "detail" in detail
              ? String((detail as { detail: unknown }).detail)
              : "저장 실패";
      feedback.error(msg);
    } finally {
      setSaveBusy(false);
    }
  };

  if (!open) return null;

  const hasQuestions = questions.length > 0;

  return (
    <AdminModal
      open
      onClose={onClose}
      type="action"
      width={MODAL_WIDTH.answerKey}
      onEnterConfirm={
        activeTab === "answer" && hasQuestions && !saveBusy ? handleSave : undefined
      }
    >
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
              {/* 좌측: 선택형 — 문항 수 메뉴 상시 표시 */}
              <div className="answer-key-panel answer-key-panel--choice">
                <div className="answer-key-section-header">
                  <div className="answer-key-section-btn answer-key-section-btn--label-only">
                    <span className="answer-key-section-btn__title">선택형 ({choiceTotalScore}점)</span>
                    <span className="answer-key-section-badge" aria-label="문항 수">
                      {choiceQuestions.length}문항
                    </span>
                  </div>
                  <button
                    type="button"
                    className="answer-key-section-reset-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDraft((prev) => {
                        const next = { ...prev };
                        choiceQuestions.forEach((q) => {
                          next[String(q.id)] = "";
                        });
                        return next;
                      });
                      setScoreDraft((prev) => {
                        const next = { ...prev };
                        choiceQuestions.forEach((q) => {
                          next[q.id] = 0;
                        });
                        return next;
                      });
                      feedback.info("선택형 답안·배점이 초기화되었습니다. (문항 수 설정은 유지)");
                    }}
                    aria-label="선택형 셋팅 초기화 (배점 포함, 문항 수 제외)"
                    title="선택형 답안·배점 초기화 (문항 수는 그대로)"
                  >
                    <ResetIcon />
                  </button>
                </div>
                <div className="answer-key-inline-editor">
                  <label className="answer-key-field">
                    <span className="answer-key-field__label">문항 수</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={choiceCountInput === "" ? "" : choiceCountInput}
                      onChange={(e) =>
                        setChoiceCountInput(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          setChoiceCount(choiceCountInput);
                        }
                      }}
                      placeholder="예: 20"
                      className="ds-input"
                      style={{ width: 100 }}
                    />
                  </label>
                  <label className={`answer-key-field answer-key-field--total ${!choiceAutoScore ? "answer-key-field--disabled" : ""}`}>
                    <span className="answer-key-field__label">총점</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={choiceTotalInput === "" ? "" : choiceTotalInput}
                      onChange={(e) =>
                        setChoiceTotalInput(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      placeholder="예: 80"
                      className="ds-input"
                      style={{ width: 80 }}
                      disabled={!choiceAutoScore}
                      aria-readonly={!choiceAutoScore}
                    />
                  </label>
                  <div className="answer-key-field">
                    <span className="answer-key-field__label">자동점수 부여</span>
                    <div className="answer-key-default-score-toggle" role="group" aria-label="자동점수 부여">
                      <button
                        type="button"
                        className={`answer-key-toggle-btn ${choiceAutoScore ? "is-active" : ""}`}
                        onClick={() => setChoiceAutoScore(true)}
                      >
                        사용
                      </button>
                      <button
                        type="button"
                        className={`answer-key-toggle-btn ${!choiceAutoScore ? "is-active" : ""}`}
                        onClick={() => setChoiceAutoScore(false)}
                      >
                        미사용
                      </button>
                    </div>
                  </div>
                  <Button
                    type="button"
                    intent="primary"
                    size="sm"
                    onClick={() => handleApply("choice")}
                    disabled={initMut.isPending}
                    loading={initMut.isPending}
                  >
                    적용
                  </Button>
                </div>
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
                      bubblesRef={(el) => {
                        if (choiceBubbleRefs.current.length <= index) choiceBubbleRefs.current.length = index + 1;
                        choiceBubbleRefs.current[index] = el;
                      }}
                      onMoveToNextRow={(currentValue) => {
                        const nextQ = choiceQuestions[index + 1];
                        if (nextQ) {
                          setDraft((prev) => ({ ...prev, [String(nextQ.id)]: currentValue }));
                          choiceBubbleRefs.current[index + 1]?.focus();
                        }
                      }}
                      onMoveToPreviousRow={() => {
                        choiceBubbleRefs.current[index - 1]?.focus();
                      }}
                    />
                  ))}
                </ul>
                <div className="answer-key-upload-links">
                  <button type="button" className="answer-key-link">
                    엑셀로 답안 업로드
                  </button>
                </div>
              </div>

              {/* 우측: 서술형 — 문항 수 메뉴 상시 표시 */}
              <div className="answer-key-panel answer-key-panel--essay">
                <div className="answer-key-section-header">
                  <div className="answer-key-section-btn answer-key-section-btn--label-only">
                    <span className="answer-key-section-btn__title">서술형 ({essayTotalScore}점)</span>
                    <span className="answer-key-section-badge" aria-label="문항 수">
                      {essayQuestions.length}문항
                    </span>
                  </div>
                  <button
                    type="button"
                    className="answer-key-section-reset-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDraft((prev) => {
                        const next = { ...prev };
                        essayQuestions.forEach((q) => {
                          next[String(q.id)] = "";
                        });
                        return next;
                      });
                      setScoreDraft((prev) => {
                        const next = { ...prev };
                        essayQuestions.forEach((q) => {
                          next[q.id] = 0;
                        });
                        return next;
                      });
                      feedback.info("서술형 답안·배점이 초기화되었습니다. (문항 수 설정은 유지)");
                    }}
                    aria-label="서술형 셋팅 초기화 (배점 포함, 문항 수 제외)"
                    title="서술형 답안·배점 초기화 (문항 수는 그대로)"
                  >
                    <ResetIcon />
                  </button>
                </div>
                <div className="answer-key-inline-editor">
                  <label className="answer-key-field">
                    <span className="answer-key-field__label">문항 수</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={essayCountInput === "" ? "" : essayCountInput}
                      onChange={(e) =>
                        setEssayCountInput(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          setEssayCount(essayCountInput);
                        }
                      }}
                      placeholder="예: 1"
                      className="ds-input"
                      style={{ width: 100 }}
                    />
                  </label>
                  <label className={`answer-key-field answer-key-field--total ${!essayAutoScore ? "answer-key-field--disabled" : ""}`}>
                    <span className="answer-key-field__label">총점</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={essayTotalInput === "" ? "" : essayTotalInput}
                      onChange={(e) =>
                        setEssayTotalInput(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      placeholder="예: 50"
                      className="ds-input"
                      style={{ width: 80 }}
                      disabled={!essayAutoScore}
                      aria-readonly={!essayAutoScore}
                    />
                  </label>
                  <div className="answer-key-field">
                    <span className="answer-key-field__label">자동점수 부여</span>
                    <div className="answer-key-default-score-toggle" role="group" aria-label="자동점수 부여">
                      <button
                        type="button"
                        className={`answer-key-toggle-btn ${essayAutoScore ? "is-active" : ""}`}
                        onClick={() => setEssayAutoScore(true)}
                      >
                        사용
                      </button>
                      <button
                        type="button"
                        className={`answer-key-toggle-btn ${!essayAutoScore ? "is-active" : ""}`}
                        onClick={() => setEssayAutoScore(false)}
                      >
                        미사용
                      </button>
                    </div>
                  </div>
                  <Button
                    type="button"
                    intent="primary"
                    size="sm"
                    onClick={() => handleApply("essay")}
                    disabled={initMut.isPending}
                    loading={initMut.isPending}
                  >
                    적용
                  </Button>
                </div>
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
                      showDividerAfter={false}
                      inputRef={(el) => {
                        if (essayInputRefs.current.length <= index) essayInputRefs.current.length = index + 1;
                        essayInputRefs.current[index] = el;
                      }}
                      onMoveToNextRow={() => essayInputRefs.current[index + 1]?.focus()}
                      onMoveToPreviousRow={() => essayInputRefs.current[index - 1]?.focus()}
                    />
                  ))}
                </ul>
              </div>
            </div>
            </>
          )}

          {activeTab === "image" && (
            <div className="answer-key-image-tab">
              {sortedQuestions.length === 0 ? (
                <div className="answer-key-empty">
                  먼저 &quot;답안 등록&quot; 탭에서 문항 수를 입력하고 문항 반영을 해주세요.
                </div>
              ) : (
                <div className="answer-key-explanation-table-wrap">
                  <table className="answer-key-explanation-table">
                    <thead>
                      <tr>
                        <th className="answer-key-explanation-table__th--num">문항</th>
                        <th className="answer-key-explanation-table__th--problem">문제 이미지</th>
                        <th className="answer-key-explanation-table__th--explanation">해설 이미지</th>
                        <th className="answer-key-explanation-table__th--explanation-text">해설 텍스트</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedQuestions.map((q) => (
                        <ExplanationRow
                          key={q.id}
                          question={q}
                          explanation={explanationDraft[q.id] ?? { text: "", problemImageUrl: null, imageUrl: null }}
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
  bubblesRef,
  onMoveToNextRow,
  onMoveToPreviousRow,
}: {
  question: ExamQuestion;
  draft: string;
  onChange: (value: string) => void;
  score: number;
  onScoreChange: (delta: number) => void;
  onScoreReset: () => void;
  showDividerAfter?: boolean;
  bubblesRef?: (el: HTMLDivElement | null) => void;
  onMoveToNextRow?: (currentValue: string) => void;
  onMoveToPreviousRow?: () => void;
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
    if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const value = draft || CHOICES[0];
      onMoveToNextRow?.(value);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onMoveToPreviousRow?.();
      return;
    }
    if (e.key === " ") {
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
        ref={bubblesRef}
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
        <span className={`answer-key-row__score-val answer-key-row__score-val--${Math.min(10, Math.max(0, score))}`}>{score}점</span>
        <div className="answer-key-row__score-btns">
          <button type="button" className="answer-key-score-btn answer-key-score-btn--plus1" onClick={() => onScoreChange(1)}>+1</button>
          <button type="button" className="answer-key-score-btn answer-key-score-btn--plus2" onClick={() => onScoreChange(2)}>+2</button>
          <button type="button" className="answer-key-score-btn answer-key-score-btn--plus5" onClick={() => onScoreChange(5)}>+5</button>
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
  inputRef,
  onMoveToNextRow,
  onMoveToPreviousRow,
}: {
  question: ExamQuestion;
  draft: string;
  onChange: (value: string) => void;
  score: number;
  onScoreChange: (delta: number) => void;
  onScoreReset: () => void;
  showDividerAfter?: boolean;
  inputRef?: (el: HTMLInputElement | null) => void;
  onMoveToNextRow?: () => void;
  onMoveToPreviousRow?: () => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      onMoveToNextRow?.();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onMoveToPreviousRow?.();
    }
  };

  return (
    <li className={`answer-key-row answer-key-row--essay ${showDividerAfter ? "answer-key-row--divider-after" : ""}`}>
      <div className="answer-key-row__num">{question.number}</div>
      <div className="answer-key-row__input-wrap">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="해설참조"
          className="ds-input answer-key-row__input"
        />
      </div>
      <div className="answer-key-row__score-ctrl">
        <span className={`answer-key-row__score-val answer-key-row__score-val--${Math.min(10, Math.max(0, score))}`}>{score}점</span>
        <div className="answer-key-row__score-btns">
          <button type="button" className="answer-key-score-btn answer-key-score-btn--plus1" onClick={() => onScoreChange(1)}>+1</button>
          <button type="button" className="answer-key-score-btn answer-key-score-btn--plus2" onClick={() => onScoreChange(2)}>+2</button>
          <button type="button" className="answer-key-score-btn answer-key-score-btn--plus5" onClick={() => onScoreChange(5)}>+5</button>
          <button type="button" className="answer-key-score-btn answer-key-score-btn--reset" onClick={onScoreReset} aria-label="점수 초기화">
            <ResetIcon />
          </button>
        </div>
      </div>
    </li>
  );
}

type ExplanationState = { text: string; problemImageUrl: string | null; imageUrl: string | null };

/** 문제 이미지·해설 이미지 공통 셀 — 붙여넣기(Ctrl+V) + 파일 업로드 동일 로직·디자인 */
function ImageCell({
  label,
  imageUrl,
  onImageChange,
  onClear,
}: {
  label: string;
  imageUrl: string | null;
  onImageChange: (url: string) => void;
  onClear: () => void;
}) {
  const handlePaste = (e: React.ClipboardEvent) => {
    const file = e.clipboardData?.files?.[0];
    if (!file?.type.startsWith("image/")) return;
    e.preventDefault();
    onImageChange(URL.createObjectURL(file));
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onImageChange(URL.createObjectURL(file));
    e.target.value = "";
  };

  if (imageUrl) {
    return (
      <div className="answer-key-explanation-cell answer-key-explanation-cell--image" onPaste={handlePaste}>
        <div className="answer-key-explanation-cell__image-wrap">
          <img src={imageUrl} alt={label} className="answer-key-explanation-cell__img" />
          <Button type="button" intent="ghost" size="sm" onClick={onClear}>
            변경
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="answer-key-explanation-cell answer-key-explanation-cell__placeholder-wrap" onPaste={handlePaste}>
      <label className="answer-key-explanation-cell__placeholder">
        <input type="file" accept="image/*" className="ds-sr-only" onChange={handleFile} />
        <span className="answer-key-explanation-cell__placeholder-text">{label}</span>
        <span className="answer-key-explanation-cell__placeholder-hint">
          클릭 후 Ctrl+V 또는
          <br />
          클릭하여 업로드
        </span>
      </label>
    </div>
  );
}

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
  const problemUrl = explanation.problemImageUrl ?? question.image ?? null;
  const explanationUrl = explanation.imageUrl;

  return (
    <tr className="answer-key-explanation-row">
      <td className="answer-key-explanation-table__td--num">
        <span className="answer-key-explanation-cell__num">{label}</span>
      </td>
      <td className="answer-key-explanation-table__td--problem">
        <div className="answer-key-explanation-cell">
          <ImageCell
            label="문제 이미지"
            imageUrl={problemUrl}
            onImageChange={(url) => onChange({ ...explanation, problemImageUrl: url })}
            onClear={() => onChange({ ...explanation, problemImageUrl: null })}
          />
        </div>
      </td>
      <td className="answer-key-explanation-table__td--explanation">
        <div className="answer-key-explanation-cell answer-key-explanation-cell--explanation">
          <ImageCell
            label="해설 이미지"
            imageUrl={explanationUrl}
            onImageChange={(url) => onChange({ ...explanation, imageUrl: url })}
            onClear={() => onChange({ ...explanation, imageUrl: null })}
          />
        </div>
      </td>
      <td className="answer-key-explanation-table__td--explanation-text">
        <div className="answer-key-explanation-cell answer-key-explanation-cell--explanation">
          <textarea
            value={explanation.text}
            onChange={(e) => onChange({ ...explanation, text: e.target.value })}
            placeholder="해설 텍스트 입력"
            className="ds-input ds-textarea answer-key-explanation-cell__textarea"
            rows={3}
          />
        </div>
      </td>
    </tr>
  );
}
