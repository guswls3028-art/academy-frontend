/**
 * 답안 등록 모달 — 2번 예시 레이아웃: 탭(답안 등록 | 이미지 등록), 툴바, 2단(문항 영역 | 요약/액션), 선택형·서술형 행(+ 예외, 점수), 하단 액션바.
 * 디자인 시스템: ds-tabs, ds-button, ds-input, modal-tabs-area, modal-footer.
 */

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button, Tabs } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import { fetchQuestionsByExam, type ExamQuestion } from "../api/question.api";
import { initExamQuestions } from "../api/questionInit.api";
import {
  createAnswerKey,
  fetchAnswerKeyByExam,
  updateAnswerKey,
  type AnswerKey,
  type AnswerKeyValue,
} from "../api/answerKey.api";
import { patchQuestionScore } from "@admin/domains/materials/api/sheetQuestions";
import { useAdminExam } from "../hooks/useAdminExam";
import { ensureExamStructure, recalculateExam } from "../api/adminExam";
import { fetchOMRDefaults } from "../api/omr.api";
import OmrSheetBuilder from "./omr/OmrSheetBuilder";
import {
  fetchExplanations,
  saveExplanationsBulk,
  type QuestionExplanation as ExplanationData,
} from "../api/explanation.api";
import ExamPdfUploadModal from "./ExamPdfUploadModal";
import { adminExamsQueryKeys } from "../queryKeys";
import "./AnswerKeyRegisterModal.type-map.css";
import "./AnswerKeyRegisterModal.css";
import "./AnswerKeyRegisterModal.bubbles.css";
import "./AnswerKeyRegisterModal.mobile.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialTab?: "answer" | "image" | "omr";
  flowStep?: "answer" | "print";
  examId: number;
  structureOwnerId: number;
  /** false면 문항/배점 PATCH 생략(regular 시험에서 403 방지). 정답만 저장됨. */
  canEditQuestions?: boolean;
  /** 시험이 속한 강의명 (OMR 자동 주입) */
  lectureName?: string;
  /** 시험이 속한 차시명 (OMR 자동 주입) */
  sessionName?: string;
};

type ExplanationState = {
  text: string;
  problemImageUrl: string | null;
  problemImageKey: string | null;
  imageUrl: string | null;
  imageKey: string | null;
  dirty: boolean;
};

const EMPTY_QUESTIONS: ExamQuestion[] = [];
const EMPTY_EXPLANATIONS: ExplanationData[] = [];

const CHOICES = ["1", "2", "3", "4", "5"];
const MAX_EXAM_QUESTIONS = 500;
const MAX_OMR_MC_COUNT = 60;
const MAX_OMR_ESSAY_COUNT = 20;
const SCORE_ADJUSTMENT_KEY = "__score_adjustment__";
type CountDraft = number | "";
type ScoreInputDraft = string;
type ScoreDistributionMode = "integer" | "decimal";
type QuestionKind = "choice" | "essay";
type ScoreAdjustmentDraft = {
  objective: number;
  subjective: number;
};
type ApplyQuestionOverrides = {
  choiceCount?: CountDraft;
  essayCount?: CountDraft;
  choiceTotal?: number | null;
  essayTotal?: number | null;
  questionTypes?: QuestionKind[];
};

const CIRCLED_CHOICE_MAP: Record<string, string> = {
  "①": "1",
  "②": "2",
  "③": "3",
  "④": "4",
  "⑤": "5",
};

function normalizeChoiceToken(value: string): string {
  const token = String(value ?? "").trim();
  return CIRCLED_CHOICE_MAP[token] ?? token;
}

function isMathSubject(value: string | null | undefined): boolean {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");
  return normalized.includes("수학") || normalized.startsWith("math");
}

function normalizeNumericShortAnswer(value: string): string | null {
  const text = String(value ?? "").trim();
  if (!/^[0-9]{1,3}$/.test(text)) return null;
  const number = Number(text);
  return Number.isInteger(number) && number >= 0 && number <= 999 ? String(number) : null;
}

function parseChoiceDraft(value: string): Set<string> {
  const tokens = String(value ?? "")
    .split(/\s*(?:[,;|]|또는|혹은|\bor\b)\s*/i)
    .map(normalizeChoiceToken)
    .filter((v) => CHOICES.includes(v));
  return new Set(tokens);
}

/** A pipe separates acceptable mark sets; a comma requires marks together. */
function formatChoiceDraft(values: Set<string>, mode: "all" | "any" = "all"): string {
  const choices = CHOICES.filter((choice) => values.has(choice));
  if (mode === "all") return choices.join(",");
  return Array.from({ length: (1 << choices.length) - 1 }, (_, index) =>
    choices.filter((_, position) => ((index + 1) & (1 << position)) !== 0).join(",")
  ).join("|");
}

type ChoiceRule = "all" | "any" | "one-only" | "custom";

function choiceRuleForDraft(draft: string): ChoiceRule {
  if (!draft.trim()) return "all";
  const alternatives = draft.split(/\s*(?:\||또는|혹은|\bor\b)\s*/i).map((part) =>
    part.split(/\s*[,;+&]\s*/).map(normalizeChoiceToken)
  );
  if (alternatives.some((parts) =>
    parts.length === 0 || parts.some((part) => !CHOICES.includes(part)) || new Set(parts).size !== parts.length
  )) return "custom";
  if (alternatives.length === 1) return "all";
  const actual = new Set(alternatives.map((parts) => formatChoiceDraft(new Set(parts))));
  if (actual.size !== alternatives.length) return "custom";
  const selected = new Set(alternatives.flat());
  const expected = new Set(formatChoiceDraft(selected, "any").split("|"));
  if (actual.size === expected.size && [...actual].every((answer) => expected.has(answer))) return "any";
  if (alternatives.every((parts) => parts.length === 1)) return "one-only";
  return "custom";
}

function choiceRuleSummary(
  rule: ChoiceRule,
  labels: string[],
  acceptsAny: boolean,
  draft: string
): string {
  if (rule === "custom") return `기존 조합 정답 유지: ${draft}`;
  if (labels.length === 0) return acceptsAny
    ? "기본 정답과 예외 정답 번호를 선택해 주세요."
    : "정답 번호를 선택해 주세요.";
  if (acceptsAny) {
    if (labels.length === 1) return "예외로 인정할 번호를 추가로 선택해 주세요.";
    if (labels.length === 2) return `${labels[0]}번 또는 ${labels[1]}번, 둘 다 선택해도 정답`;
    return `${labels.join("·")} 중 하나 이상 선택하면 정답`;
  }
  if (rule === "one-only") return `${labels.join("·")} 중 하나만 선택해야 정답`;
  if (labels.length > 1) return `${labels.join("·")}을 모두 선택해야 정답`;
  return `${labels[0]}번 정답`;
}

function parseCountDraft(value: string): CountDraft {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return "";
  return Math.max(0, Math.trunc(parsed));
}

function countDraftToNumber(value: CountDraft): number | undefined {
  if (value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getResponseStatus(error: unknown): number | undefined {
  const response = isRecord(error) ? error.response : undefined;
  if (!isRecord(response)) return undefined;
  return typeof response.status === "number" ? response.status : undefined;
}

function isAnswerKey(value: unknown): value is AnswerKey {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "number" || typeof value.exam !== "number") return false;
  if (!isRecord(value.answers)) return false;
  return Object.entries(value.answers).every(
    ([key, answer]) =>
      key === SCORE_ADJUSTMENT_KEY
        ? isRecord(answer)
        : (
      typeof answer === "string" ||
      (Array.isArray(answer) && answer.every((item) => typeof item === "string" || typeof item === "number"))
        )
  );
}

function answerKeysFromResponse(response: unknown): AnswerKey[] {
  const body = isRecord(response) && "data" in response ? response.data : response;
  const list = Array.isArray(body)
    ? body
    : isRecord(body) && Array.isArray(body.results)
      ? body.results
      : [];
  return list.filter(isAnswerKey);
}

/** 총점을 문항 수만큼 분배. decimal 모드는 문항 배점을 1자리로 맞추고 잔여 총점을 기본점수로 둔다. */
function distributeTotalToScores(
  total: number,
  count: number,
  mode: ScoreDistributionMode
): { scores: number[]; adjustment: number } {
  if (count <= 0) return { scores: [], adjustment: 0 };
  const unit = mode === "decimal" ? 10 : 1;
  const totalUnits = Math.max(0, Math.round(total * unit));
  const baseUnits = Math.floor(totalUnits / count);
  const remainderUnits = totalUnits - baseUnits * count;
  const baseScore = baseUnits / unit;

  if (mode === "decimal") {
    return {
      scores: Array.from({ length: count }, () => baseScore),
      adjustment: roundScore(remainderUnits / unit),
    };
  }

  const lowCount = count - remainderUnits;
  const result: number[] = [];
  for (let i = 0; i < lowCount; i++) result.push(baseScore);
  for (let i = 0; i < remainderUnits; i++) result.push(baseScore + 1);
  return { scores: result, adjustment: 0 };
}

function roundScore(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function formatScore(value: number): string {
  return String(Math.round((value + Number.EPSILON) * 100) / 100);
}

function parseScoreInputDraft(value: ScoreInputDraft): number | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return roundScore(parsed);
}

function parseScoreAdjustment(input: Record<string, AnswerKeyValue>): ScoreAdjustmentDraft {
  const raw = input[SCORE_ADJUSTMENT_KEY];
  if (!isRecord(raw)) return { objective: 0, subjective: 0 };
  const objective = typeof raw.objective === "number" && Number.isFinite(raw.objective) ? raw.objective : 0;
  const subjective = typeof raw.subjective === "number" && Number.isFinite(raw.subjective) ? raw.subjective : 0;
  return {
    objective: Math.max(0, roundScore(objective)),
    subjective: Math.max(0, roundScore(subjective)),
  };
}

function withScoreAdjustment(
  answers: Record<string, string>,
  adjustment: ScoreAdjustmentDraft
): Record<string, AnswerKeyValue> {
  const payload: Record<string, AnswerKeyValue> = { ...answers };
  const objective = Math.max(0, roundScore(adjustment.objective));
  const subjective = Math.max(0, roundScore(adjustment.subjective));
  if (objective > 0 || subjective > 0) {
    payload[SCORE_ADJUSTMENT_KEY] = {
      ...(objective > 0 ? { objective } : {}),
      ...(subjective > 0 ? { subjective } : {}),
    };
  }
  return payload;
}

function answerValueToDraft(value: AnswerKeyValue | number | boolean | null | undefined): string {
  if (Array.isArray(value)) {
    return value.map((v) => String(v ?? "").trim()).filter(Boolean).join(",");
  }
  return String(value ?? "").trim();
}

function normalizeAnswers(input: Record<string, AnswerKeyValue>) {
  const out: Record<string, string> = {};
  Object.entries(input || {}).forEach(([k, v]) => {
    if (k === SCORE_ADJUSTMENT_KEY) return;
    out[String(k)] = answerValueToDraft(v);
  });
  return out;
}

export default function AnswerKeyRegisterModal({
  open,
  onClose,
  onSaved,
  initialTab = "answer",
  flowStep,
  examId,
  structureOwnerId,
  canEditQuestions = true,
  lectureName = "",
  sessionName = "",
}: Props) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"answer" | "image" | "omr">(initialTab);
  const [downloaded, setDownloaded] = useState(false);
  const { data: exam } = useAdminExam(examId);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [ensuredExamId, setEnsuredExamId] = useState<number | null>(null);
  const [ensureAttemptedExamId, setEnsureAttemptedExamId] = useState<number | null>(null);
  const ensureStructureMut = useMutation({
    mutationFn: ensureExamStructure,
    onSuccess: (nextExam) => {
      qc.setQueryData(adminExamsQueryKeys.adminExam(examId), nextExam);
      setEnsuredExamId(examId);
      qc.invalidateQueries({ queryKey: adminExamsQueryKeys.examQuestions(examId) });
      qc.invalidateQueries({ queryKey: adminExamsQueryKeys.answerKey(examId) });
      qc.invalidateQueries({ queryKey: adminExamsQueryKeys.examExplanations(examId) });
    },
    onError: (error: unknown) => {
      feedback.error(extractApiError(error, "시험 구조 준비 실패"));
    },
  });
  const needsStructureEnsure = open && exam?.exam_type === "regular";
  const structureReady = !needsStructureEnsure || ensuredExamId === examId;
  const effectiveStructureOwnerId = exam?.structure_owner_id ?? structureOwnerId;
  const isMathExam = isMathSubject(exam?.subject);

  useEffect(() => {
    if (!open) {
      setEnsuredExamId(null);
      setEnsureAttemptedExamId(null);
      return;
    }
    if (
      !needsStructureEnsure ||
      ensuredExamId === examId ||
      ensureAttemptedExamId === examId ||
      ensureStructureMut.isPending
    ) {
      return;
    }
    setEnsureAttemptedExamId(examId);
    ensureStructureMut.mutate(examId);
  }, [open, needsStructureEnsure, ensuredExamId, ensureAttemptedExamId, examId, ensureStructureMut]);

  const { data: questionsData } = useQuery({
    queryKey: adminExamsQueryKeys.examQuestions(examId),
    queryFn: () => fetchQuestionsByExam(examId).then((r) => r.data),
    enabled: open && Number.isFinite(examId) && structureReady,
  });
  const questions = questionsData ?? EMPTY_QUESTIONS;

  const { data: omrDefaults } = useQuery({
    queryKey: [...adminExamsQueryKeys.adminExam(examId), "answer-key-shape"],
    queryFn: () => fetchOMRDefaults(examId),
    enabled: open && Number.isFinite(examId) && structureReady,
  });

  const {
    data: answerKeyList,
    isSuccess: answerKeyLoaded,
    isError: answerKeyLoadFailed,
    isFetching: answerKeyFetching,
    refetch: refetchAnswerKey,
  } = useQuery({
    queryKey: adminExamsQueryKeys.answerKey(examId),
    queryFn: async () => {
      try {
        return await fetchAnswerKeyByExam(examId);
      } catch (error: unknown) {
        if (getResponseStatus(error) === 404) return { data: [] };
        throw error;
      }
    },
    enabled: open && structureReady && questions.length > 0,
    staleTime: 0,
    retry: (failureCount, error: unknown) => failureCount < 2 && getResponseStatus(error) !== 404,
  });
  /** DRF list는 pagination 시 { results: [] }, 미사용 시 [] — response.data 기준으로 파싱 */
  const answerKey = useMemo(() => {
    return answerKeysFromResponse(answerKeyList)[0] ?? null;
  }, [answerKeyList]);

  const [choiceCount, setChoiceCount] = useState<CountDraft>("");
  const [choiceCountInput, setChoiceCountInput] = useState<CountDraft>("");
  /** 자동점수 부여 ON이면 총점 입력 후 선택한 단위로 분배. 기본값 OFF */
  const [choiceAutoScore, setChoiceAutoScore] = useState(false);
  const [choiceScoreMode, setChoiceScoreMode] = useState<ScoreDistributionMode>("integer");
  const [choiceTotalInput, setChoiceTotalInput] = useState<ScoreInputDraft>("");
  const [essayCount, setEssayCount] = useState<CountDraft>("");
  const [essayCountInput, setEssayCountInput] = useState<CountDraft>("");
  /** 자동점수 부여. 기본값 OFF */
  const [essayAutoScore, setEssayAutoScore] = useState(false);
  const [essayScoreMode, setEssayScoreMode] = useState<ScoreDistributionMode>("integer");
  const [essayTotalInput, setEssayTotalInput] = useState<ScoreInputDraft>("");
  const [questionTypes, setQuestionTypes] = useState<QuestionKind[]>([]);
  const [typeMapExpanded, setTypeMapExpanded] = useState(false);
  const [totalCountInput, setTotalCountInput] = useState<CountDraft>("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [answerKeyHydrated, setAnswerKeyHydrated] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  /** 문항별 점수 드래프트 (문항 반영 시 초기값은 question.score) */
  const [scoreDraft, setScoreDraft] = useState<Record<number, number>>({});
  const [scoreAdjustmentDraft, setScoreAdjustmentDraft] = useState<ScoreAdjustmentDraft>({
    objective: 0,
    subjective: 0,
  });
  /** 이미지 등록 탭: 문항별 해설 — 해설 텍스트, 문제 이미지 URL, 해설 이미지 URL(객체 URL) */
  const [explanationDraft, setExplanationDraft] = useState<
    Record<number, ExplanationState>
  >({});
  const [explanationSaveBusy, setExplanationSaveBusy] = useState(false);

  /** 해설 데이터 로드 — AI 추출 결과 포함 */
  const { data: explanationsData } = useQuery({
    queryKey: adminExamsQueryKeys.examExplanations(examId),
    queryFn: () => fetchExplanations(examId),
    enabled: open && Number.isFinite(examId) && structureReady && questions.length > 0,
  });
  const explanationsFromApi = explanationsData ?? EMPTY_EXPLANATIONS;

  const choiceBubbleRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const essayInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const resetLocalDraftState = useCallback(() => {
    setActiveTab(initialTab);
    setDownloaded(false);
    setPdfModalOpen(false);
    setChoiceCount("");
    setChoiceCountInput("");
    setChoiceAutoScore(false);
    setChoiceScoreMode("integer");
    setChoiceTotalInput("");
    setEssayCount("");
    setEssayCountInput("");
    setEssayAutoScore(false);
    setEssayScoreMode("integer");
    setEssayTotalInput("");
    setQuestionTypes([]);
    setTypeMapExpanded(false);
    setTotalCountInput("");
    setDraft({});
    setAnswerKeyHydrated(false);
    setScoreDraft({});
    setScoreAdjustmentDraft({ objective: 0, subjective: 0 });
    setExplanationDraft({});
    setExplanationSaveBusy(false);
    setSaveBusy(false);
    choiceBubbleRefs.current = [];
    essayInputRefs.current = [];
  }, [initialTab]);

  useEffect(() => {
    resetLocalDraftState();
  }, [examId, open, resetLocalDraftState]);

  const sortedQuestions = useMemo(
    () => [...questions].sort((a, b) => a.number - b.number),
    [questions]
  );

  const isCountConfigured = choiceCount !== "" || essayCount !== "";
  const effectiveChoiceCount =
    choiceCount !== "" && essayCount !== ""
      ? Math.max(0, Number(choiceCount) || 0)
      : choiceCount !== ""
        ? Math.max(0, Number(choiceCount) || 0)
        : essayCount !== ""
          ? Math.max(0, questions.length - (Number(essayCount) || 0))
          : 0;
  const resolvedQuestionTypes = useMemo<QuestionKind[]>(() => {
    if (questionTypes.length === sortedQuestions.length) return questionTypes;
    return sortedQuestions.map((question, index) =>
      question.question_kind ?? (index < effectiveChoiceCount ? "choice" : "essay")
    );
  }, [effectiveChoiceCount, questionTypes, sortedQuestions]);
  const choiceQuestions = sortedQuestions.filter((_, index) => resolvedQuestionTypes[index] === "choice");
  const essayQuestions = sortedQuestions.filter((_, index) => resolvedQuestionTypes[index] === "essay");

  const getScore = (q: ExamQuestion) => scoreDraft[q.id] ?? q.score ?? 0;
  const questionTotalScore = useMemo(
    () => sortedQuestions.reduce((sum, q) => sum + (scoreDraft[q.id] ?? q.score ?? 0), 0),
    [sortedQuestions, scoreDraft]
  );
  const canEditStructure = canEditQuestions && structureReady;
  const choiceTotalScore = choiceQuestions.reduce((sum, q) => sum + getScore(q), 0) + scoreAdjustmentDraft.objective;
  const essayTotalScore = essayQuestions.reduce((sum, q) => sum + getScore(q), 0) + scoreAdjustmentDraft.subjective;
  const totalScore = questionTotalScore + scoreAdjustmentDraft.objective + scoreAdjustmentDraft.subjective;
  const examMaxScore = Number(exam?.max_score);
  const guidedScoreMismatch = flowStep === "answer" && Number.isFinite(examMaxScore)
    && examMaxScore > 0 && Math.abs(totalScore - examMaxScore) > 0.01;

  const alignGuidedScores = () => {
    const count = sortedQuestions.length;
    const targetCents = Math.round((examMaxScore - scoreAdjustmentDraft.objective - scoreAdjustmentDraft.subjective) * 100);
    if (count < 1 || targetCents < 0) {
      feedback.error("문항 수와 기본점수를 확인한 뒤 배점을 맞춰 주세요.");
      return;
    }
    const unitCents = targetCents % 10 === 0 ? 10 : 1;
    const targetUnits = targetCents / unitCents;
    const baseUnits = Math.floor(targetUnits / count);
    const remainder = targetUnits % count;
    setScoreDraft((current) => ({
      ...current,
      ...Object.fromEntries(sortedQuestions.map((question, index) => [
        question.id,
        ((baseUnits + (index < remainder ? 1 : 0)) * unitCents) / 100,
      ])),
    }));
  };

  useEffect(() => {
    if (!open || !structureReady || !answerKeyLoaded || answerKeyFetching || answerKeyHydrated) return;
    // Initial loading must not expose a fabricated empty key. Later refetches
    // must not replace the operator's unsaved answers or score adjustment.
    setDraft(normalizeAnswers(answerKey?.answers ?? {}));
    setScoreAdjustmentDraft(parseScoreAdjustment(answerKey?.answers ?? {}));
    setAnswerKeyHydrated(true);
  }, [answerKey, answerKeyLoaded, answerKeyFetching, answerKeyHydrated, open, structureReady]);

  useEffect(() => {
    if (!open) return;
    if (!answerKey || !answerKey.answers) return;
    // 시트 계약을 먼저 사용해 숫자 단답 1~5를 객관식으로 오인하지 않는다.
    if (choiceCount === "" && essayCount === "" && sortedQuestions.length > 0) {
      if (omrDefaults) {
        setChoiceCount(omrDefaults.mc_count);
        setChoiceCountInput(omrDefaults.mc_count);
        setEssayCount(omrDefaults.essay_count);
        setEssayCountInput(omrDefaults.essay_count);
        return;
      }
      const normalized = normalizeAnswers(answerKey.answers);
      let choiceCnt = 0;
      for (const q of sortedQuestions) {
        const ans = (normalized[String(q.id)] ?? "").trim();
        if (parseChoiceDraft(ans).size > 0) {
          choiceCnt++;
        }
      }
      // 연속된 앞 N개가 선택형인 경우에만 자동 분할 (섞여 있으면 전체 선택형)
      const essayCnt = sortedQuestions.length - choiceCnt;
      setChoiceCount(choiceCnt > 0 ? choiceCnt : sortedQuestions.length);
      setChoiceCountInput(choiceCnt > 0 ? choiceCnt : sortedQuestions.length);
      setEssayCount(essayCnt > 0 ? essayCnt : 0);
      setEssayCountInput(essayCnt > 0 ? essayCnt : 0);
    }
  }, [answerKey, choiceCount, essayCount, omrDefaults, open, sortedQuestions]);

  useEffect(() => {
    if (!open || sortedQuestions.length === 0) return;
    const fallbackChoiceCount = omrDefaults?.mc_count ?? sortedQuestions.length;
    const nextTypes = sortedQuestions.map((question, index) =>
      question.question_kind ?? omrDefaults?.question_types?.[index] ?? (
        index < fallbackChoiceCount ? "choice" : "essay"
      )
    );
    setQuestionTypes((previous) =>
      previous.length === nextTypes.length && previous.every((kind, index) => kind === nextTypes[index])
        ? previous
        : nextTypes
    );
    setTotalCountInput(sortedQuestions.length);
  }, [omrDefaults, open, sortedQuestions]);

  /** 문항 목록 로드 시 점수 드래프트 동기화 */
  useEffect(() => {
    if (!open) return;
    if (sortedQuestions.length === 0) return;
    setScoreDraft((prev) => {
      let changed = false;
      const next = { ...prev };
      sortedQuestions.forEach((q) => {
        if (next[q.id] === undefined) {
          next[q.id] = q.score ?? 0;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [open, sortedQuestions]);

  /** AI 추출 해설 + 문항 이미지를 explanationDraft에 자동 반영 */
  useEffect(() => {
    if (!open) return;
    if (sortedQuestions.length === 0) return;
    setExplanationDraft((prev) => {
      let changed = false;
      const next = { ...prev };
      // 해설 API 데이터 → question_id 기준으로 매핑
      const explByQuestionId: Record<number, ExplanationData> = {};
      for (const e of explanationsFromApi) {
        explByQuestionId[e.question] = e;
      }
      for (const q of sortedQuestions) {
        // 이미 사용자가 수동 수정한 draft가 있으면 유지
        if (prev[q.id]?.dirty) continue;
        const apiExpl = explByQuestionId[q.id];
        const candidate = {
          text: apiExpl?.text ?? "",
          problemImageUrl: q.image_url ?? q.image ?? null,
          problemImageKey: q.image_key ?? null,
          imageUrl: apiExpl?.image_url ?? null,
          imageKey: apiExpl?.image_key ?? null,
          dirty: false,
        };
        const current = prev[q.id];
        if (
          current?.text === candidate.text &&
          current?.problemImageUrl === candidate.problemImageUrl &&
          current?.problemImageKey === candidate.problemImageKey &&
          current?.imageUrl === candidate.imageUrl &&
          current?.imageKey === candidate.imageKey &&
          current?.dirty === candidate.dirty
        ) {
          continue;
        }
        next[q.id] = candidate;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [explanationsFromApi, open, sortedQuestions]);

  const initMut = useMutation({
    mutationFn: async (overrides?: ApplyQuestionOverrides) => {
      if (overrides?.questionTypes) {
        if (overrides.questionTypes.length < 1) throw new Error("문항 수는 1개 이상이어야 합니다.");
        if (overrides.questionTypes.length > MAX_EXAM_QUESTIONS) {
          throw new Error(`문항 수는 최대 ${MAX_EXAM_QUESTIONS}문항입니다.`);
        }
        return initExamQuestions({
          examId,
          question_types: overrides.questionTypes,
        });
      }
      const total = questions.length;
      let cc: number;
      let ec: number;
      if (overrides) {
        const oc = overrides.choiceCount;
        const oe = overrides.essayCount;
        cc = oc !== "" && oc !== undefined ? Math.max(0, Number(oc) || 0) : Math.max(0, total - (Number(oe) || 0));
        ec = oe !== "" && oe !== undefined ? Math.max(0, Number(oe) || 0) : Math.max(0, total - (Number(oc) || 0));
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
      cc = Math.trunc(cc);
      ec = Math.trunc(ec);
      if (cc + ec === 0) throw new Error("객관식+주관식 문항 수 합이 1 이상이어야 합니다.");
      if (cc + ec > MAX_EXAM_QUESTIONS) {
        throw new Error(`객관식+주관식 문항 수 합은 최대 ${MAX_EXAM_QUESTIONS}문항입니다.`);
      }
      return initExamQuestions({
        examId,
        choice_count: cc,
        essay_count: ec,
      });
    },
    onSuccess: async (result, overrides) => {
      const list = result?.data ?? [];
      const appliedTypes: QuestionKind[] = overrides?.questionTypes ?? list.map(
        (question, index) => question.question_kind ?? (
          index < Number(choiceCount || list.length) ? "choice" : "essay"
        )
      );
      let appliedCc: number;
      let appliedEc: number;
      if (overrides?.questionTypes) {
        appliedCc = appliedTypes.filter((kind) => kind === "choice").length;
        appliedEc = appliedTypes.length - appliedCc;
      } else if (overrides) {
        const oc = overrides.choiceCount;
        const oe = overrides.essayCount;
        appliedCc = oc !== "" && oc !== undefined ? Math.max(0, Number(oc) || 0) : Math.max(0, list.length - (Number(oe) || 0));
        appliedEc = oe !== "" && oe !== undefined ? Math.max(0, Number(oe) || 0) : Math.max(0, list.length - (Number(oc) || 0));
      } else {
        appliedCc =
          choiceCount !== ""
            ? Math.max(0, Number(choiceCount) || 0)
            : Math.max(0, list.length - (Number(essayCount) || 0));
        appliedEc =
          essayCount !== ""
            ? Math.max(0, Number(essayCount) || 0)
            : Math.max(0, list.length - (Number(choiceCount) || 0));
      }
      appliedCc = Math.trunc(appliedCc);
      appliedEc = Math.trunc(appliedEc);
      setChoiceCount(appliedCc);
      setEssayCount(appliedEc);
      setChoiceCountInput(appliedCc);
      setEssayCountInput(appliedEc);
      setQuestionTypes(appliedTypes);
      setTotalCountInput(list.length);
      qc.setQueryData(adminExamsQueryKeys.examQuestions(examId), list);
      const sorted = [...list].sort((a: ExamQuestion, b: ExamQuestion) => a.number - b.number);
      const choiceList = sorted.filter((_, index) => appliedTypes[index] === "choice");
      const essayList = sorted.filter((_, index) => appliedTypes[index] === "essay");

      const nextScoreDraft: Record<number, number> = {};
      const nextScoreAdjustment: ScoreAdjustmentDraft = { ...scoreAdjustmentDraft };
      setDraft((prev) => {
        const validQuestionIds = new Set(sorted.map((q: ExamQuestion) => String(q.id)));
        const next: Record<string, string> = {};
        for (const [key, value] of Object.entries(prev)) {
          if (validQuestionIds.has(key)) next[key] = value;
        }
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });

      const choiceTotal = overrides?.choiceTotal ?? parseScoreInputDraft(choiceTotalInput);
      const essayTotal = overrides?.essayTotal ?? parseScoreInputDraft(essayTotalInput);
      if (choiceAutoScore && choiceTotal !== null) {
        const total = Math.max(0, choiceTotal);
        const { scores, adjustment } = distributeTotalToScores(total, choiceList.length, choiceScoreMode);
        nextScoreAdjustment.objective = adjustment;
        choiceList.forEach((q: ExamQuestion, i: number) => {
          nextScoreDraft[q.id] = scores[i] ?? 0;
        });
      }
      if (essayAutoScore && essayTotal !== null) {
        const total = Math.max(0, essayTotal);
        const { scores, adjustment } = distributeTotalToScores(total, essayList.length, essayScoreMode);
        nextScoreAdjustment.subjective = adjustment;
        essayList.forEach((q: ExamQuestion, i: number) => {
          nextScoreDraft[q.id] = scores[i] ?? 0;
        });
      }
      setScoreAdjustmentDraft(nextScoreAdjustment);
      setScoreDraft((prev) => {
        const next: Record<number, number> = {};
        sorted.forEach((q: ExamQuestion) => {
          next[q.id] = nextScoreDraft[q.id] ?? prev[q.id] ?? q.score ?? 0;
        });
        return next;
      });
      if (Object.keys(nextScoreDraft).length > 0) {
        if (canEditQuestions) {
          for (const q of sorted) {
            const score = nextScoreDraft[q.id];
            if (score !== undefined && Number.isFinite(score)) {
              await patchQuestionScore({ questionId: q.id, score });
            }
          }
        }
      }
      await qc.invalidateQueries({ queryKey: adminExamsQueryKeys.answerKey(examId) });
      await qc.invalidateQueries({ queryKey: adminExamsQueryKeys.examQuestions(examId) });
      await qc.invalidateQueries({
        queryKey: [...adminExamsQueryKeys.adminExam(examId), "answer-key-shape"],
      });
      feedback.success("적용되었습니다.");
    },
    onError: (error: unknown) => {
      feedback.error(extractApiError(error, "적용 실패"));
    },
  });

  /** 적용 클릭: 자동점수 ON이면 총점 필수 검증, 선택형만 설정 시 서술형 0으로 전달 */
  const handleApply = () => {
    if (!canEditStructure) {
      feedback.info("시험 구조가 준비되지 않아 아직 수정할 수 없습니다.");
      return;
    }
    const parsedChoiceTotal = parseScoreInputDraft(choiceTotalInput);
    const parsedEssayTotal = parseScoreInputDraft(essayTotalInput);
    if (choiceTotalInput.trim() !== "" && parsedChoiceTotal === null) {
      feedback.error("선택형 총점을 숫자로 입력해 주세요.");
      return;
    }
    if (essayTotalInput.trim() !== "" && parsedEssayTotal === null) {
      feedback.error("서술형 총점을 숫자로 입력해 주세요.");
      return;
    }
    if (!choiceAutoScore && parsedChoiceTotal !== null && parsedChoiceTotal < choiceQuestions.reduce((sum, q) => sum + getScore(q), 0)) {
      feedback.error("선택형 총점이 문항별 배점 합계보다 작습니다. 배점을 먼저 조정해 주세요.");
      return;
    }
    if (!essayAutoScore && parsedEssayTotal !== null && parsedEssayTotal < essayQuestions.reduce((sum, q) => sum + getScore(q), 0)) {
      feedback.error("서술형 총점이 문항별 배점 합계보다 작습니다. 배점을 먼저 조정해 주세요.");
      return;
    }
    if (choiceAutoScore) {
      if (parsedChoiceTotal === null) {
        feedback.error("자동점수 부여(사용) 시 선택형 총점을 입력해 주세요.");
        return;
      }
    }
    if (essayAutoScore) {
      if (parsedEssayTotal === null) {
        feedback.error("자동점수 부여(사용) 시 서술형 총점을 입력해 주세요.");
        return;
      }
    }
    const choiceVal = countDraftToNumber(choiceCountInput);
    const essayVal = countDraftToNumber(essayCountInput);
    if (choiceVal === undefined && essayVal === undefined) {
      feedback.error("객관식 또는 서술형 문항 수를 입력해 주세요.");
      return;
    }
    const nextChoiceCount = choiceVal !== undefined
      ? choiceVal
      : Math.max(0, questions.length - (essayVal ?? 0));
    const nextEssayCount = essayVal !== undefined ? essayVal : 0;
    const nextTotal = nextChoiceCount + nextEssayCount;
    if (nextTotal < 1) {
      feedback.error("객관식+주관식 문항 수 합이 1 이상이어야 합니다.");
      return;
    }
    if (nextTotal > MAX_EXAM_QUESTIONS) {
      feedback.error(`객관식+주관식 문항 수 합은 최대 ${MAX_EXAM_QUESTIONS}문항입니다.`);
      return;
    }
    setChoiceCount(nextChoiceCount);
    setEssayCount(nextEssayCount);
    setChoiceCountInput(nextChoiceCount);
    setEssayCountInput(nextEssayCount);
    const nextQuestionTypes: QuestionKind[] = [
      ...Array<QuestionKind>(nextChoiceCount).fill("choice"),
      ...Array<QuestionKind>(nextEssayCount).fill("essay"),
    ];
    setQuestionTypes(nextQuestionTypes);
    initMut.mutate({
      choiceCount: nextChoiceCount,
      essayCount: nextEssayCount,
      choiceTotal: parsedChoiceTotal,
      essayTotal: parsedEssayTotal,
      questionTypes: nextQuestionTypes,
    });
  };

  const applyQuestionTypePlan = () => {
    if (!canEditStructure) return;
    const total = countDraftToNumber(totalCountInput);
    if (total === undefined || total < 1 || total > MAX_EXAM_QUESTIONS) {
      feedback.error(`전체 문항 수를 1~${MAX_EXAM_QUESTIONS} 사이로 입력해 주세요.`);
      return;
    }
    const nextTypes = Array.from(
      { length: total },
      (_, index): QuestionKind => questionTypes[index] ?? resolvedQuestionTypes[index] ?? "choice"
    );
    setQuestionTypes(nextTypes);
    initMut.mutate({ questionTypes: nextTypes });
  };

  const handleApplyEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.stopPropagation();
    handleApply();
  };

  const handleSave = async () => {
    if (!canEditStructure) {
      feedback.info("시험 구조가 준비되지 않아 아직 수정할 수 없습니다.");
      return;
    }
    const manualChoiceTarget = choiceAutoScore || choiceTotalInput.trim() === "" ? null : parseScoreInputDraft(choiceTotalInput);
    const manualEssayTarget = essayAutoScore || essayTotalInput.trim() === "" ? null : parseScoreInputDraft(essayTotalInput);
    if ((!choiceAutoScore && choiceTotalInput.trim() !== "" && manualChoiceTarget === null)
      || (!essayAutoScore && essayTotalInput.trim() !== "" && manualEssayTarget === null)) {
      feedback.error("수동 총점을 숫자로 입력해 주세요.");
      return;
    }
    if ((manualChoiceTarget !== null && Math.abs(choiceTotalScore - manualChoiceTarget) > 0.01)
      || (manualEssayTarget !== null && Math.abs(essayTotalScore - manualEssayTarget) > 0.01)) {
      feedback.error("수동 총점과 문항별 배점 합계를 맞춰 주세요. 자동 배점을 사용하면 균등 배점할 수 있습니다.");
      return;
    }
    if (flowStep === "answer") {
      const missingChoice = choiceQuestions.find((question) =>
        parseChoiceDraft(draft[String(question.id)] ?? "").size === 0
      );
      if (missingChoice) {
        feedback.error(`${missingChoice.number}번 객관식 정답을 입력한 뒤 저장해 주세요.`);
        return;
      }
      if (guidedScoreMismatch) {
        feedback.error(`문항 배점 합계 ${formatScore(totalScore)}점을 시험 만점 ${formatScore(examMaxScore)}점과 맞춰 주세요.`);
        return;
      }
    }
    setSaveBusy(true);
    let patchedScoreCount = 0;
    try {
      const shouldPersistQuestionTypes =
        questionTypes.length === sortedQuestions.length &&
        sortedQuestions.some((question, index) => question.question_kind !== questionTypes[index]);
      if (shouldPersistQuestionTypes) {
        const { data: updatedQuestions } = await initExamQuestions({
          examId,
          question_types: questionTypes,
        });
        qc.setQueryData(adminExamsQueryKeys.examQuestions(examId), updatedQuestions);
        await qc.invalidateQueries({
          queryKey: [...adminExamsQueryKeys.adminExam(examId), "answer-key-shape"],
        });
      }
      const normalized = normalizeAnswers(draft);
      const currentQuestionIds = new Set(sortedQuestions.map((q) => String(q.id)));
      const currentAnswers: Record<string, string> = {};
      for (const [questionId, answer] of Object.entries(normalized)) {
        if (currentQuestionIds.has(questionId)) currentAnswers[questionId] = answer;
      }
      const essayIds = new Set(essayQuestions.map((q) => String(q.id)));
      if (isMathExam) {
        for (const questionId of essayIds) {
          const normalizedAnswer = normalizeNumericShortAnswer(currentAnswers[questionId] ?? "");
          if (normalizedAnswer === null) {
            const questionNumber = sortedQuestions.find((q) => String(q.id) === questionId)?.number;
            feedback.error(`${questionNumber ?? "단답형"}번 정답을 0~999 사이의 정수로 입력해 주세요.`);
            return;
          }
          currentAnswers[questionId] = normalizedAnswer;
        }
      } else {
        essayIds.forEach((questionId) => {
          if (currentAnswers[questionId] === "" || currentAnswers[questionId] === undefined) currentAnswers[questionId] = "해설참조";
        });
      }
      const answersPayload = withScoreAdjustment(currentAnswers, scoreAdjustmentDraft);
      const targetExamId = examId;
      const toPatch = canEditQuestions
        ? sortedQuestions.filter(
          (q) => Number.isFinite(scoreDraft[q.id] ?? q.score ?? 0) && (scoreDraft[q.id] ?? q.score ?? 0) !== (q.score ?? 0)
        )
        : [];
      for (const q of toPatch) {
        const nextScore = scoreDraft[q.id] ?? q.score ?? 0;
        await patchQuestionScore({ questionId: q.id, score: nextScore });
        patchedScoreCount += 1;
      }
      // The answer-key endpoint regrades immediately, so it must see the final weights.
      const savedKey = !answerKey
        ? await createAnswerKey({ exam: targetExamId, answers: answersPayload })
        : await updateAnswerKey(answerKey.id, { exam: answerKey.exam, answers: answersPayload });
      const regrade = savedKey.data.regrade ?? (toPatch.length > 0 ? [await recalculateExam(examId)] : undefined);
      await Promise.all([
        qc.invalidateQueries({ queryKey: adminExamsQueryKeys.answerKey(examId) }),
        ...(toPatch.length > 0 ? [qc.invalidateQueries({ queryKey: adminExamsQueryKeys.examQuestions(examId) })] : []),
      ]);
      await Promise.all([
        qc.invalidateQueries({ queryKey: adminExamsQueryKeys.adminExamResultsRoot(examId) }),
        qc.invalidateQueries({ queryKey: adminExamsQueryKeys.adminExamSummary(examId) }),
        qc.invalidateQueries({ queryKey: adminExamsQueryKeys.examQuestionStats(examId) }),
        qc.invalidateQueries({ queryKey: adminExamsQueryKeys.sessionScoresRoot() }),
        qc.invalidateQueries({ queryKey: adminExamsQueryKeys.clinicTargetsRoot() }),
        qc.invalidateQueries({ queryKey: adminExamsQueryKeys.adminSubmissions }),
        qc.invalidateQueries({ queryKey: adminExamsQueryKeys.adminPendingSubmissions }),
      ]);
      const reviewCount = regrade?.reduce((total, item) => total + (item.needs_review?.length ?? 0), 0) ?? 0;
      const failedCount = regrade?.reduce((total, item) => total + item.failed.length, 0) ?? 0;
      feedback.clear();
      if (!regrade) {
        feedback.success(
          canEditQuestions ? "저장되었습니다." : "정답이 저장되었습니다. 문항·배점 수정은 템플릿 시험에서만 가능합니다."
        );
      } else if (failedCount > 0) {
        feedback.warning(`답안과 배점을 저장했습니다. 재채점 실패 ${failedCount}건은 시험 결과에서 확인해 주세요.`);
      } else if (reviewCount > 0) {
        feedback.warning(`정답을 저장하고 자동 재채점했습니다. 수기 보정 ${reviewCount}건은 확인이 필요합니다.`);
      } else {
        feedback.success(
          canEditQuestions ? "저장·재채점되었습니다." : "정답을 저장하고 기존 성적을 재채점했습니다."
        );
      }
      onSaved?.();
    } catch (error: unknown) {
      const detail = extractApiError(error, "저장 실패");
      if (patchedScoreCount > 0) {
        await Promise.allSettled([
          qc.invalidateQueries({ queryKey: adminExamsQueryKeys.examQuestions(examId) }),
          qc.invalidateQueries({ queryKey: adminExamsQueryKeys.answerKey(examId) }),
          qc.invalidateQueries({ queryKey: adminExamsQueryKeys.adminExamResultsRoot(examId) }),
        ]);
      }
      feedback.error(patchedScoreCount > 0
        ? `${detail} 배점이 일부 저장됐을 수 있습니다. 다시 열어 확인하고 전체 재채점해 주세요.`
        : detail);
    } finally {
      setSaveBusy(false);
    }
  };

  const handleSaveExplanations = async () => {
    setExplanationSaveBusy(true);
    try {
      const items = sortedQuestions
        .filter((q) => {
          const d = explanationDraft[q.id];
          return d && (
            d.text ||
            d.imageUrl ||
            d.imageKey ||
            d.problemImageUrl ||
            d.problemImageKey ||
            (q.image_key && !d.problemImageKey)
          );
        })
        .map((q) => {
          const d = explanationDraft[q.id];
          const item: {
            question_id: number;
            text: string;
            image_key?: string;
            problem_image_key?: string;
          } = {
            question_id: q.id,
            text: d?.text ?? "",
            problem_image_key: d?.problemImageKey ?? "",
          };
          if (d?.imageKey) item.image_key = d.imageKey;
          return item;
        });
      if (items.length === 0) {
        feedback.info("저장할 해설이 없습니다.");
        return;
      }
      await saveExplanationsBulk(examId, items);
      await Promise.all([
        qc.invalidateQueries({ queryKey: adminExamsQueryKeys.examExplanations(examId) }),
        qc.invalidateQueries({ queryKey: adminExamsQueryKeys.examQuestions(examId) }),
      ]);
      setExplanationDraft((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([questionId, value]) => [
            questionId,
            { ...value, dirty: false },
          ]),
        ),
      );
      feedback.success(`이미지·해설 ${items.length}건 저장 완료`);
    } catch (error: unknown) {
      feedback.error(extractApiError(error, "해설 저장 실패"));
    } finally {
      setExplanationSaveBusy(false);
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
        activeTab === "answer" && hasQuestions && answerKeyHydrated && canEditStructure && !saveBusy && !initMut.isPending
          ? handleSave
          : undefined
      }
    >
      <ModalHeader
        type="action"
        title={flowStep ? (
          <strong>{flowStep === "answer" ? "2. 답안 등록" : "3. OMR 답안지 다운로드"}</strong>
        ) : (
          <div className="answer-key-modal-header-tabs">
            <Tabs
              value={activeTab}
              items={[
                { key: "answer", label: "답안 등록" },
                { key: "image", label: "이미지 등록" },
                { key: "omr", label: "OMR 답안지" },
              ]}
              onChange={(key) => setActiveTab(key as "answer" | "image" | "omr")}
            />
            <Button
              intent="ghost"
              size="sm"
              onClick={() => setPdfModalOpen(true)}
              disabled={!structureReady}
              title="시험 자료 원본을 올리면 지원 형식은 AI가 문항을 자동 인식합니다"
            >
              시험 자료 업로드
            </Button>
          </div>
        )}
        description={flowStep === "answer"
          ? "문항 유형과 정답을 입력한 뒤 저장하세요. 저장하면 인쇄용 답안지가 열립니다."
          : flowStep === "print"
            ? "문항 수와 시험명을 확인하고 인쇄용 OMR 답안지 PDF를 다운로드하세요."
            : "선택형·서술형 문항별 정답을 입력하고 저장합니다. 채점 시 사용됩니다."}
      />

      {/* 시험 자료 업로드 통합 모달 — 현재 구조 소유자에 업로드 */}
      <ExamPdfUploadModal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        examId={effectiveStructureOwnerId}
      />

      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact answer-key-panel">
          {!structureReady && (
            <div className="answer-key-empty">
              시험 구조를 준비하는 중입니다.
            </div>
          )}
          {structureReady && activeTab === "answer" && hasQuestions && !answerKeyHydrated && (
            <div className="answer-key-empty" role={answerKeyLoadFailed ? "alert" : "status"}>
              {answerKeyLoadFailed ? (
                <>
                  <p>답안을 불러오지 못했습니다. 다시 불러온 뒤 수정해 주세요.</p>
                  <Button intent="secondary" size="sm" onClick={() => { void refetchAnswerKey(); }}>
                    답안 다시 불러오기
                  </Button>
                </>
              ) : "답안을 불러오는 중입니다."}
            </div>
          )}
          {structureReady && activeTab === "answer" && (!hasQuestions || answerKeyHydrated) && (
            <>
            {/* 등록된 답안 요약 영역 제거 — 아래 문항 목록에서 동일 정보 제공 */}
            <section className="answer-key-type-map" aria-labelledby="answer-key-type-map-title">
              <div className="answer-key-type-map__header">
                <div>
                  <strong id="answer-key-type-map-title">문항별 유형</strong>
                  <p>전체 {sortedQuestions.length}문항 · 선택형 {choiceQuestions.length} · 서술형 {essayQuestions.length}</p>
                </div>
                <div className="answer-key-type-map__actions">
                  <label className="answer-key-field">
                    <span className="answer-key-field__label">전체 문항 수</span>
                    <input
                      type="number"
                      min={1}
                      max={MAX_EXAM_QUESTIONS}
                      value={totalCountInput}
                      onChange={(event) => setTotalCountInput(parseCountDraft(event.target.value))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") applyQuestionTypePlan();
                      }}
                      className="ds-input answer-key-input--count"
                      disabled={!canEditStructure}
                    />
                  </label>
                  <Button
                    type="button"
                    intent="primary"
                    size="sm"
                    onClick={applyQuestionTypePlan}
                    disabled={!canEditStructure || initMut.isPending}
                    loading={initMut.isPending}
                  >
                    유형 저장
                  </Button>
                </div>
              </div>
              {questionTypes.length > 0 && typeMapExpanded && (
                <div className="answer-key-type-map__grid" role="group" aria-label="문항별 유형">
                  {questionTypes.map((kind, index) => (
                    <button
                      key={index}
                      type="button"
                      className={`answer-key-type-chip answer-key-type-chip--${kind}`}
                      onClick={() => setQuestionTypes((current) => current.map(
                        (value, itemIndex) => itemIndex === index
                          ? (value === "choice" ? "essay" : "choice")
                          : value
                      ))}
                      disabled={!canEditStructure || initMut.isPending}
                      aria-label={`${index + 1}번 ${kind === "choice" ? "객관식" : "서술형"}. 눌러서 변경`}
                    >
                      <span>{index + 1}</span>
                      <small>{kind === "choice" ? "객관식" : "서술형"}</small>
                    </button>
                  ))}
                </div>
              )}
              <div className="answer-key-type-map__legend">
                <span><i className="is-choice" />객관식 {questionTypes.filter((kind) => kind === "choice").length}</span>
                <span><i className="is-essay" />서술형 {questionTypes.filter((kind) => kind === "essay").length}</span>
              </div>
              {questionTypes.length > 0 && (
                <button type="button" className="answer-key-type-map__expand" aria-expanded={typeMapExpanded} onClick={() => setTypeMapExpanded((value) => !value)}>
                  {typeMapExpanded ? "문항 유형 접기" : "문항별 유형 편집"}
                </button>
              )}
            </section>
            {guidedScoreMismatch && sortedQuestions.length > 0 && (
              <div className="answer-key-score-guide" role="status">
                <span>문항 배점 합계 {formatScore(totalScore)}점 · 시험 만점 {formatScore(examMaxScore)}점</span>
                <Button type="button" intent="secondary" size="sm" onClick={alignGuidedScores} disabled={!canEditStructure}>
                  만점에 맞게 균등 배점
                </Button>
              </div>
            )}
            <div className="answer-key-two-panels">
              {/* 좌측: 선택형 — 문항 수 메뉴 상시 표시 */}
              <div className="answer-key-panel answer-key-panel--choice">
                <div className="answer-key-section-header">
                  <div className="answer-key-section-btn answer-key-section-btn--label-only">
                    <span className="answer-key-section-btn__title">선택형 ({formatScore(choiceTotalScore)}점)</span>
                    <span className="answer-key-section-badge" aria-label="문항 수">
                      {choiceQuestions.length}문항
                    </span>
                    {scoreAdjustmentDraft.objective > 0 && (
                      <span className="answer-key-section-badge" aria-label="기본점수">
                        기본 {formatScore(scoreAdjustmentDraft.objective)}점
                      </span>
                    )}
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
                      setScoreAdjustmentDraft((prev) => ({ ...prev, objective: 0 }));
                      feedback.info("선택형 답안·배점이 초기화되었습니다. (문항 수 설정은 유지)");
                    }}
                    disabled={!canEditStructure}
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
                      max={MAX_EXAM_QUESTIONS}
                      step={1}
                      value={choiceCountInput === "" ? "" : choiceCountInput}
                      onChange={(e) =>
                        setChoiceCountInput(parseCountDraft(e.target.value))
                      }
                      onKeyDown={(e) => {
                        handleApplyEnter(e);
                      }}
                      placeholder="예: 20"
                      className="ds-input answer-key-input--count"
                      disabled={!canEditStructure}
                    />
                  </label>
                  <label className="answer-key-field answer-key-field--total">
                    <span className="answer-key-field__label">{choiceAutoScore ? "총점" : "목표 총점"}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={choiceTotalInput}
                      onChange={(e) => setChoiceTotalInput(e.target.value)}
                      onKeyDown={handleApplyEnter}
                      placeholder="예: 80"
                      className="ds-input answer-key-input--score"
                      disabled={!canEditStructure}
                    />
                    {!choiceAutoScore && choiceTotalInput.trim() !== "" && (
                      <small role="status">현재 {formatScore(choiceTotalScore)}점 / 목표 {choiceTotalInput}점</small>
                    )}
                  </label>
                  <div className="answer-key-field">
                    <span className="answer-key-field__label">자동점수 부여</span>
                    <div className="answer-key-default-score-toggle" role="group" aria-label="자동점수 부여">
                      <button
                        type="button"
                        className={`answer-key-toggle-btn ${choiceAutoScore ? "is-active" : ""}`}
                        onClick={() => setChoiceAutoScore(true)}
                        disabled={!canEditStructure}
                      >
                        사용
                      </button>
                      <button
                        type="button"
                        className={`answer-key-toggle-btn ${!choiceAutoScore ? "is-active" : ""}`}
                        onClick={() => setChoiceAutoScore(false)}
                        disabled={!canEditStructure}
                      >
                        미사용
                      </button>
                    </div>
                  </div>
                  <div className={`answer-key-field ${!choiceAutoScore ? "answer-key-field--disabled" : ""}`}>
                    <span className="answer-key-field__label">배점 단위</span>
                    <div className="answer-key-default-score-toggle" role="group" aria-label="선택형 배점 단위">
                      <button
                        type="button"
                        className={`answer-key-toggle-btn ${choiceScoreMode === "integer" ? "is-active" : ""}`}
                        onClick={() => setChoiceScoreMode("integer")}
                        disabled={!canEditStructure || !choiceAutoScore}
                      >
                        정수
                      </button>
                      <button
                        type="button"
                        className={`answer-key-toggle-btn ${choiceScoreMode === "decimal" ? "is-active" : ""}`}
                        onClick={() => setChoiceScoreMode("decimal")}
                        disabled={!canEditStructure || !choiceAutoScore}
                      >
                        소수 1자리
                      </button>
                    </div>
                  </div>
                  <Button
                    type="button"
                    intent="primary"
                    size="sm"
                    onClick={handleApply}
                    disabled={!canEditStructure || initMut.isPending}
                    loading={initMut.isPending}
                  >
                    적용
                  </Button>
                </div>
                <ul className="answer-key-list answer-key-list--choice-scroll">
                  {choiceQuestions.length === 0 && !isCountConfigured && questions.length > 0 && (
                    <li className="answer-key-empty-hint">문항 수를 입력하고 <strong>적용</strong>을 눌러주세요.</li>
                  )}
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
                      editable={canEditStructure}
                      showDividerAfter={(index + 1) % 5 === 0 && index < choiceQuestions.length - 1}
                      bubblesRef={(el) => {
                        if (choiceBubbleRefs.current.length <= index) choiceBubbleRefs.current.length = index + 1;
                        choiceBubbleRefs.current[index] = el;
                      }}
                      onMoveToNextRow={() => choiceBubbleRefs.current[index + 1]?.focus()}
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
                    <span className="answer-key-section-btn__title">
                      {isMathExam ? "단답형 0~999" : "서술형"} ({formatScore(essayTotalScore)}점)
                    </span>
                    <span className="answer-key-section-badge" aria-label="문항 수">
                      {essayQuestions.length}문항
                    </span>
                    {scoreAdjustmentDraft.subjective > 0 && (
                      <span className="answer-key-section-badge" aria-label="기본점수">
                        기본 {formatScore(scoreAdjustmentDraft.subjective)}점
                      </span>
                    )}
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
                      setScoreAdjustmentDraft((prev) => ({ ...prev, subjective: 0 }));
                      feedback.info("서술형 답안·배점이 초기화되었습니다. (문항 수 설정은 유지)");
                    }}
                    disabled={!canEditStructure}
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
                      max={MAX_EXAM_QUESTIONS}
                      step={1}
                      value={essayCountInput === "" ? "" : essayCountInput}
                      onChange={(e) =>
                        setEssayCountInput(parseCountDraft(e.target.value))
                      }
                      onKeyDown={(e) => {
                        handleApplyEnter(e);
                      }}
                      placeholder="예: 1"
                      className="ds-input answer-key-input--count"
                      disabled={!canEditStructure}
                    />
                  </label>
                  <label className="answer-key-field answer-key-field--total">
                    <span className="answer-key-field__label">{essayAutoScore ? "총점" : "목표 총점"}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={essayTotalInput}
                      onChange={(e) => setEssayTotalInput(e.target.value)}
                      onKeyDown={handleApplyEnter}
                      placeholder="예: 50"
                      className="ds-input answer-key-input--score"
                      disabled={!canEditStructure}
                    />
                    {!essayAutoScore && essayTotalInput.trim() !== "" && (
                      <small role="status">현재 {formatScore(essayTotalScore)}점 / 목표 {essayTotalInput}점</small>
                    )}
                  </label>
                  <div className="answer-key-field">
                    <span className="answer-key-field__label">자동점수 부여</span>
                    <div className="answer-key-default-score-toggle" role="group" aria-label="자동점수 부여">
                      <button
                        type="button"
                        className={`answer-key-toggle-btn ${essayAutoScore ? "is-active" : ""}`}
                        onClick={() => setEssayAutoScore(true)}
                        disabled={!canEditStructure}
                      >
                        사용
                      </button>
                      <button
                        type="button"
                        className={`answer-key-toggle-btn ${!essayAutoScore ? "is-active" : ""}`}
                        onClick={() => setEssayAutoScore(false)}
                        disabled={!canEditStructure}
                      >
                        미사용
                      </button>
                    </div>
                  </div>
                  <div className={`answer-key-field ${!essayAutoScore ? "answer-key-field--disabled" : ""}`}>
                    <span className="answer-key-field__label">배점 단위</span>
                    <div className="answer-key-default-score-toggle" role="group" aria-label="서술형 배점 단위">
                      <button
                        type="button"
                        className={`answer-key-toggle-btn ${essayScoreMode === "integer" ? "is-active" : ""}`}
                        onClick={() => setEssayScoreMode("integer")}
                        disabled={!canEditStructure || !essayAutoScore}
                      >
                        정수
                      </button>
                      <button
                        type="button"
                        className={`answer-key-toggle-btn ${essayScoreMode === "decimal" ? "is-active" : ""}`}
                        onClick={() => setEssayScoreMode("decimal")}
                        disabled={!canEditStructure || !essayAutoScore}
                      >
                        소수 1자리
                      </button>
                    </div>
                  </div>
                  <Button
                    type="button"
                    intent="primary"
                    size="sm"
                    onClick={handleApply}
                    disabled={!canEditStructure || initMut.isPending}
                    loading={initMut.isPending}
                  >
                    적용
                  </Button>
                </div>
                <ul className="answer-key-list answer-key-list--essay-scroll">
                  {essayQuestions.length === 0 && !isCountConfigured && questions.length > 0 && (
                    <li className="answer-key-empty-hint">문항 수를 입력하고 <strong>적용</strong>을 눌러주세요.</li>
                  )}
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
                      editable={canEditStructure}
                      numericOnly={isMathExam}
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

          {structureReady && activeTab === "image" && (
            <div className="answer-key-image-tab">
              {sortedQuestions.length === 0 ? (
                <div className="answer-key-empty">
                  먼저 &quot;답안 등록&quot; 탭에서 문항 수를 입력하고 문항 반영을 해주세요.
                </div>
              ) : (
                <>
                <div className="answer-key-image-tab__note">
                  <strong>문제 이미지는 오답노트에 자동으로 들어갑니다.</strong>
                  <span>문항별로 잘라 올리면 학생의 틀린 문제만 모아 PDF로 만들 수 있습니다.</span>
                </div>
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
                          examId={examId}
                          explanation={explanationDraft[q.id] ?? { text: "", problemImageUrl: null, problemImageKey: null, imageUrl: null, imageKey: null, dirty: false }}
                          onChange={(next) =>
                            setExplanationDraft((prev) => ({
                              ...prev,
                              [q.id]: { ...next, dirty: true },
                            }))
                          }
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </div>
          )}

          {structureReady && activeTab === "omr" && (
            <OmrSettingsTab
              examId={examId}
              examTitle={exam?.title || ""}
              lectureName={lectureName || omrDefaults?.lecture_name || ""}
              sessionName={sessionName || omrDefaults?.session_name || ""}
              choiceCount={choiceQuestions.length}
              essayCount={essayQuestions.length}
              questionTypes={resolvedQuestionTypes}
              guidedPrint={flowStep === "print"}
              onDownloaded={() => setDownloaded(true)}
            />
          )}
        </div>
      </ModalBody>

      <ModalFooter
        left={flowStep === "answer"
          ? <span>저장 후 답안지 다운로드로 이어집니다.</span>
          : flowStep === "print"
            ? <span role="status">{downloaded ? "답안지 다운로드 완료" : "PDF를 다운로드한 뒤 설정 화면으로 돌아가세요."}</span>
            : null}
        right={
          <>
            <Button intent="secondary" onClick={onClose}>
              {flowStep === "answer" ? "나중에" : flowStep === "print" ? "설정 화면으로" : "취소"}
            </Button>
            {activeTab === "answer" && hasQuestions && answerKeyHydrated && (
              <Button
                intent="primary"
                onClick={handleSave}
                disabled={saveBusy || initMut.isPending || !canEditStructure}
                loading={saveBusy}
              >
                {flowStep === "answer" ? "답안 저장하고 다음" : `저장 (총 ${formatScore(totalScore)}점)`}
              </Button>
            )}
            {activeTab === "image" && sortedQuestions.length > 0 && (
              <Button
                intent="primary"
                disabled={explanationSaveBusy}
                loading={explanationSaveBusy}
                onClick={handleSaveExplanations}
              >
                이미지·해설 저장
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
  editable,
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
  editable: boolean;
  showDividerAfter?: boolean;
  bubblesRef?: (el: HTMLButtonElement | null) => void;
  onMoveToNextRow?: () => void;
  onMoveToPreviousRow?: () => void;
}) {
  const scoreTone = Math.min(10, Math.max(0, Math.floor(score)));
  const selectedChoices = parseChoiceDraft(draft);
  const choiceRule = choiceRuleForDraft(draft);
  const [addingException, setAddingException] = useState(false);
  const acceptsAny = choiceRule === "any" || (choiceRule === "all" && addingException);
  const selectedLabels = CHOICES.filter((choice) => selectedChoices.has(choice));
  const [activeIndex, setActiveIndex] = useState(0);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const toggleChoice = (choice: string) => {
    if (!editable || choiceRule === "custom") return;
    const next = new Set(selectedChoices);
    if (next.has(choice)) next.delete(choice);
    else next.add(choice);
    if (choiceRule === "one-only") onChange(CHOICES.filter((item) => next.has(item)).join("|"));
    else {
      if (acceptsAny) setAddingException(true);
      onChange(formatChoiceDraft(next, acceptsAny ? "any" : "all"));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editable) return;
    if (e.target !== e.currentTarget) return;
    if (/^[1-5]$/.test(e.key)) {
      e.preventDefault();
      const next = CHOICES.indexOf(e.key);
      setActiveIndex(next);
      buttonRefs.current[next]?.focus();
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const next = Math.max(0, activeIndex - 1);
      setActiveIndex(next);
      buttonRefs.current[next]?.focus();
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = Math.min(CHOICES.length - 1, activeIndex + 1);
      setActiveIndex(next);
      buttonRefs.current[next]?.focus();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      onMoveToNextRow?.();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onMoveToPreviousRow?.();
      return;
    }
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const next = CHOICES[activeIndex];
      if (next) toggleChoice(next);
      return;
    }
  };

  return (
    <li className={`answer-key-row answer-key-row--choice ${showDividerAfter ? "answer-key-row--divider-after" : ""}`}>
      <div className="answer-key-row__num">{question.number}</div>
      <div className="answer-key-row__answer">
      <div
        className="answer-key-row__bubbles"
        role="group"
        aria-label={`${question.number}번 정답. 방향키로 이동, Enter 또는 스페이스로 선택`}
      >
        {CHOICES.map((c, index) => (
          <button
            key={c}
            ref={(el) => {
              buttonRefs.current[index] = el;
              if (index === activeIndex) bubblesRef?.(el);
            }}
            type="button"
            className={`answer-key-omr-label ${activeIndex === index ? "answer-key-omr-label--active" : ""}`}
            role="checkbox"
            aria-label={`${question.number}번 ${c}번 선택지`}
            aria-checked={selectedChoices.has(c)}
            tabIndex={editable && choiceRule !== "custom" && activeIndex === index ? 0 : -1}
            onKeyDown={handleKeyDown}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              setActiveIndex(index);
              toggleChoice(c);
              event.currentTarget.focus({ preventScroll: true });
            }}
            disabled={!editable || choiceRule === "custom"}
          >
            <span
              className={`exam-omr-bubble ${selectedChoices.has(c) ? "exam-omr-bubble--selected" : ""}`}
              aria-hidden
            >
              {c}
            </span>
          </button>
        ))}
      </div>
      <div className="answer-key-row__rule">
        <span className="answer-key-row__rule-summary">
          {choiceRuleSummary(choiceRule, selectedLabels, acceptsAny, draft)}
        </span>
        {editable && choiceRule === "custom" && (
          <button type="button" className="answer-key-row__rule-action" onClick={() => { setAddingException(false); onChange(""); }}>
            정답 규칙 다시 설정
          </button>
        )}
        {editable && choiceRule === "one-only" && (
          <button type="button" className="answer-key-row__rule-action" onClick={() => onChange(formatChoiceDraft(selectedChoices, "any"))}>
            함께 선택해도 정답 처리
          </button>
        )}
        {editable && choiceRule !== "custom" && choiceRule !== "one-only" && (acceptsAny ? (
          <button type="button" className="answer-key-row__rule-action" onClick={() => { setAddingException(false); onChange(formatChoiceDraft(selectedChoices)); }}>
            {selectedChoices.size > 1 ? "모두 선택해야 정답으로 변경" : "예외 추가 취소"}
          </button>
        ) : (
          <button type="button" className="answer-key-row__rule-action" onClick={() => {
            setAddingException(true);
            if (selectedChoices.size > 1) onChange(formatChoiceDraft(selectedChoices, "any"));
          }}>
            + 예외 정답
          </button>
        ))}
      </div>
      </div>
      <div className="answer-key-row__score-ctrl">
        <span className={`answer-key-row__score-val answer-key-row__score-val--${scoreTone}`}>{formatScore(score)}점</span>
        <div className="answer-key-row__score-btns">
          <button type="button" className="answer-key-score-btn answer-key-score-btn--plus1" onClick={() => onScoreChange(1)} disabled={!editable}>+1</button>
          <button type="button" className="answer-key-score-btn answer-key-score-btn--plus2" onClick={() => onScoreChange(2)} disabled={!editable}>+2</button>
          <button type="button" className="answer-key-score-btn answer-key-score-btn--plus5" onClick={() => onScoreChange(5)} disabled={!editable}>+5</button>
          <button type="button" className="answer-key-score-btn answer-key-score-btn--reset" onClick={onScoreReset} aria-label="점수 초기화" disabled={!editable}>
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
  editable,
  numericOnly = false,
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
  editable: boolean;
  numericOnly?: boolean;
  showDividerAfter?: boolean;
  inputRef?: (el: HTMLInputElement | null) => void;
  onMoveToNextRow?: () => void;
  onMoveToPreviousRow?: () => void;
}) {
  const scoreTone = Math.min(10, Math.max(0, Math.floor(score)));
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!editable) return;
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
          inputMode={numericOnly ? "numeric" : "text"}
          pattern={numericOnly ? "[0-9]*" : undefined}
          value={draft}
          onChange={(e) => onChange(
            numericOnly ? e.target.value.replace(/\D/g, "").slice(0, 3) : e.target.value
          )}
          onKeyDown={handleKeyDown}
          placeholder={numericOnly ? "0~999" : "해설참조"}
          maxLength={numericOnly ? 3 : undefined}
          aria-label={`${question.number}번 ${numericOnly ? "단답형" : "서술형"} 정답`}
          className="ds-input answer-key-row__input"
          disabled={!editable}
        />
      </div>
      <div className="answer-key-row__score-ctrl">
        <span className={`answer-key-row__score-val answer-key-row__score-val--${scoreTone}`}>{formatScore(score)}점</span>
        <div className="answer-key-row__score-btns">
          <button type="button" className="answer-key-score-btn answer-key-score-btn--plus1" onClick={() => onScoreChange(1)} disabled={!editable}>+1</button>
          <button type="button" className="answer-key-score-btn answer-key-score-btn--plus2" onClick={() => onScoreChange(2)} disabled={!editable}>+2</button>
          <button type="button" className="answer-key-score-btn answer-key-score-btn--plus5" onClick={() => onScoreChange(5)} disabled={!editable}>+5</button>
          <button type="button" className="answer-key-score-btn answer-key-score-btn--reset" onClick={onScoreReset} aria-label="점수 초기화" disabled={!editable}>
            <ResetIcon />
          </button>
        </div>
      </div>
    </li>
  );
}

// ExplanationState is defined at top level, above the component

/** 문제 이미지·해설 이미지 공통 셀 — 클릭: 포커스(Ctrl+V 붙여넣기), 더블클릭: 파일 선택 */
function ImageCell({
  label,
  imageUrl,
  onImageChange,
  onClear,
  examId,
}: {
  label: string;
  imageUrl: string | null;
  onImageChange: (url: string, key?: string) => void;
  onClear: () => void;
  examId?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const uploadAndSet = useCallback(async (file: File) => {
    if (!examId) {
      onImageChange(URL.createObjectURL(file));
      return;
    }
    setUploading(true);
    try {
      const { uploadExamImage } = await import("../api/examAsset.api");
      const { image_url, image_key } = await uploadExamImage(examId, file);
      onImageChange(image_url, image_key);
    } catch {
      feedback.error("이미지를 업로드하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setUploading(false);
    }
  }, [examId, onImageChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const file = e.clipboardData?.files?.[0];
    if (!file?.type.startsWith("image/")) return;
    e.preventDefault();
    uploadAndSet(file);
  }, [uploadAndSet]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadAndSet(file);
    e.target.value = "";
  }, [uploadAndSet]);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (imageUrl) {
    return (
      <div
        ref={containerRef}
        className="answer-key-explanation-cell answer-key-explanation-cell--image"
        tabIndex={0}
        aria-label={`${label} 붙여넣기 영역`}
        onPaste={handlePaste}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="ds-sr-only"
          aria-label={`${label} 파일 선택`}
          onChange={handleFile}
        />
        <div className="answer-key-explanation-cell__image-wrap">
          <img src={imageUrl} alt={label} className="answer-key-explanation-cell__img" />
          <div className="answer-key-explanation-cell__image-actions">
            <Button type="button" intent="ghost" size="sm" onClick={openFilePicker}>
              변경
            </Button>
            <Button type="button" intent="ghost" size="sm" onClick={onClear}>
              삭제
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="answer-key-explanation-cell answer-key-explanation-cell__placeholder-wrap"
      tabIndex={0}
      aria-label={`${label} 붙여넣기 영역`}
      onPaste={handlePaste}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="ds-sr-only"
        aria-label={`${label} 파일 선택`}
        onChange={handleFile}
      />
      <div className="answer-key-explanation-cell__placeholder answer-key-explanation-cell__placeholder--no-label">
        {uploading ? (
          <span className="answer-key-explanation-cell__placeholder-text answer-key-explanation-cell__placeholder-text--uploading">업로드 중…</span>
        ) : (
          <>
            <span className="answer-key-explanation-cell__placeholder-text">{label}</span>
            <span className="answer-key-explanation-cell__placeholder-hint">
              Ctrl+V로 붙여넣거나
            </span>
            <Button type="button" intent="ghost" size="sm" onClick={openFilePicker}>
              파일 선택
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ExplanationRow({
  question,
  examId,
  explanation,
  onChange,
}: {
  question: ExamQuestion;
  examId: number;
  explanation: ExplanationState;
  onChange: (next: ExplanationState) => void;
}) {
  const label = typeof question.number === "number" ? String(question.number) : `S${question.number}`;
  const problemUrl = explanation.problemImageUrl;
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
            examId={examId}
            onImageChange={(url, key) => onChange({ ...explanation, problemImageUrl: url, problemImageKey: key ?? explanation.problemImageKey })}
            onClear={() => onChange({ ...explanation, problemImageUrl: null, problemImageKey: null })}
          />
        </div>
      </td>
      <td className="answer-key-explanation-table__td--explanation">
        <div className="answer-key-explanation-cell answer-key-explanation-cell--explanation">
          <ImageCell
            label="해설 이미지"
            imageUrl={explanationUrl}
            examId={examId}
            onImageChange={(url, key) => onChange({ ...explanation, imageUrl: url, imageKey: key ?? explanation.imageKey })}
            onClear={() => onChange({ ...explanation, imageUrl: null, imageKey: null })}
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

/** OMR 답안지 탭 — 백엔드 SSOT 기반 설정 + 미리보기 + PDF 다운로드 */
function OmrSettingsTab({
  examId,
  examTitle,
  lectureName,
  sessionName,
  choiceCount,
  essayCount,
  questionTypes,
  guidedPrint,
  onDownloaded,
}: {
  examId: number;
  examTitle: string;
  lectureName: string;
  sessionName: string;
  choiceCount: number;
  essayCount: number;
  questionTypes: QuestionKind[];
  guidedPrint?: boolean;
  onDownloaded?: () => void;
}) {
  const exceedsOmrLimit = choiceCount > MAX_OMR_MC_COUNT || essayCount > MAX_OMR_ESSAY_COUNT;
  return (
    <div className="answer-key-omr-tab">
      {exceedsOmrLimit && (
        <div className="answer-key-omr-limit-alert" role="status">
          OMR 답안지는 객관식 {MAX_OMR_MC_COUNT}문항, 서답형 {MAX_OMR_ESSAY_COUNT}문항까지 지원합니다.
          현재 시험은 객관식 {choiceCount}문항, 서답형 {essayCount}문항이라 OMR 미리보기와 PDF는 지원 범위까지만 표시됩니다.
        </div>
      )}
      <OmrSheetBuilder
        target={{ type: "exam", examId }}
        initialExamTitle={examTitle || ""}
        initialLectureName={lectureName || ""}
        initialSessionName={sessionName || ""}
        initialMcCount={choiceCount}
        initialEssayCount={essayCount}
        initialQuestionTypes={questionTypes}
        layout="modal"
        guidedPrint={guidedPrint}
        onDownloaded={onDownloaded}
      />
    </div>
  );
}
