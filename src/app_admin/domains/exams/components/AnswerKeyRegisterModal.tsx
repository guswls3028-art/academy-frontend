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
import { ensureExamStructure } from "../api/adminExam";
import OmrSheetBuilder from "./omr/OmrSheetBuilder";
import {
  fetchExplanations,
  saveExplanationsBulk,
  type QuestionExplanation as ExplanationData,
} from "../api/explanation.api";
import ExamPdfUploadModal from "./ExamPdfUploadModal";
import "./AnswerKeyRegisterModal.css";

type Props = {
  open: boolean;
  onClose: () => void;
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
};

const EMPTY_QUESTIONS: ExamQuestion[] = [];
const EMPTY_EXPLANATIONS: ExplanationData[] = [];

const CHOICES = ["1", "2", "3", "4", "5"];
const MAX_EXAM_QUESTIONS = 500;
const MAX_OMR_MC_COUNT = 60;
const MAX_OMR_ESSAY_COUNT = 10;
const SCORE_ADJUSTMENT_KEY = "__score_adjustment__";
type CountDraft = number | "";
type ScoreDistributionMode = "integer" | "decimal";
type ScoreAdjustmentDraft = {
  objective: number;
  subjective: number;
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

function parseChoiceDraft(value: string): Set<string> {
  const tokens = String(value ?? "")
    .split(/\s*(?:[,;|]|또는|혹은|\bor\b)\s*/i)
    .map(normalizeChoiceToken)
    .filter((v) => CHOICES.includes(v));
  return new Set(tokens);
}

function formatChoiceDraft(values: Set<string>): string {
  return CHOICES.filter((choice) => values.has(choice)).join(",");
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
  const rounded = roundScore(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
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
  examId,
  structureOwnerId,
  canEditQuestions = true,
  lectureName = "",
  sessionName = "",
}: Props) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"answer" | "image" | "omr">("answer");
  const { data: exam } = useAdminExam(examId);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [ensuredExamId, setEnsuredExamId] = useState<number | null>(null);
  const [ensureAttemptedExamId, setEnsureAttemptedExamId] = useState<number | null>(null);
  const ensureStructureMut = useMutation({
    mutationFn: ensureExamStructure,
    onSuccess: (nextExam) => {
      qc.setQueryData(["admin-exam", examId], nextExam);
      setEnsuredExamId(examId);
      qc.invalidateQueries({ queryKey: ["exam-questions", examId] });
      qc.invalidateQueries({ queryKey: ["answer-key", examId] });
      qc.invalidateQueries({ queryKey: ["exam-explanations", examId] });
    },
    onError: (error: unknown) => {
      feedback.error(extractApiError(error, "시험 구조 준비 실패"));
    },
  });
  const needsStructureEnsure = open && exam?.exam_type === "regular";
  const structureReady = !needsStructureEnsure || ensuredExamId === examId;
  const effectiveStructureOwnerId = exam?.structure_owner_id ?? structureOwnerId;

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
    queryKey: ["exam-questions", examId],
    queryFn: () => fetchQuestionsByExam(examId).then((r) => r.data),
    enabled: open && Number.isFinite(examId) && structureReady,
  });
  const questions = questionsData ?? EMPTY_QUESTIONS;

  const { data: answerKeyList } = useQuery({
    queryKey: ["answer-key", examId],
    queryFn: async () => {
      try {
        return await fetchAnswerKeyByExam(examId);
      } catch (error: unknown) {
        if (getResponseStatus(error) === 404) return { data: [] };
        throw error;
      }
    },
    enabled: open && structureReady && questions.length > 0,
    retry: (_, error: unknown) => getResponseStatus(error) !== 404,
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
  const [choiceTotalInput, setChoiceTotalInput] = useState<number | "">("");
  const [essayCount, setEssayCount] = useState<CountDraft>("");
  const [essayCountInput, setEssayCountInput] = useState<CountDraft>("");
  /** 자동점수 부여. 기본값 OFF */
  const [essayAutoScore, setEssayAutoScore] = useState(false);
  const [essayScoreMode, setEssayScoreMode] = useState<ScoreDistributionMode>("integer");
  const [essayTotalInput, setEssayTotalInput] = useState<number | "">("");
  const [draft, setDraft] = useState<Record<string, string>>({});
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
    queryKey: ["exam-explanations", examId],
    queryFn: () => fetchExplanations(examId),
    enabled: open && Number.isFinite(examId) && structureReady && questions.length > 0,
  });
  const explanationsFromApi = explanationsData ?? EMPTY_EXPLANATIONS;

  const choiceBubbleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const essayInputRefs = useRef<(HTMLInputElement | null)[]>([]);

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
  const questionTotalScore = useMemo(
    () => sortedQuestions.reduce((sum, q) => sum + (scoreDraft[q.id] ?? q.score ?? 0), 0),
    [sortedQuestions, scoreDraft]
  );
  const canEditStructure = canEditQuestions && structureReady;
  const choiceTotalScore = choiceQuestions.reduce((sum, q) => sum + getScore(q), 0) + scoreAdjustmentDraft.objective;
  const essayTotalScore = essayQuestions.reduce((sum, q) => sum + getScore(q), 0) + scoreAdjustmentDraft.subjective;
  const totalScore = questionTotalScore + scoreAdjustmentDraft.objective + scoreAdjustmentDraft.subjective;

  useEffect(() => {
    if (!answerKey || !answerKey.answers) return;
    setDraft(normalizeAnswers(answerKey.answers));
    setScoreAdjustmentDraft(parseScoreAdjustment(answerKey.answers));
  }, [answerKey]);

  useEffect(() => {
    if (!answerKey || !answerKey.answers) return;
    // 기존 답안키 기반으로 선택형/서술형 수 자동 계산 (미설정 시에만)
    if (choiceCount === "" && essayCount === "" && sortedQuestions.length > 0) {
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
  }, [answerKey, choiceCount, essayCount, sortedQuestions]);

  /** 문항 목록 로드 시 점수 드래프트 동기화 */
  useEffect(() => {
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
  }, [sortedQuestions]);

  /** AI 추출 해설 + 문항 이미지를 explanationDraft에 자동 반영 */
  useEffect(() => {
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
        if (prev[q.id] && (prev[q.id].text || prev[q.id].problemImageUrl || prev[q.id].imageUrl)) continue;
        const apiExpl = explByQuestionId[q.id];
        const candidate = {
          text: apiExpl?.text ?? "",
          problemImageUrl: q.image_url ?? q.image ?? null,
          problemImageKey: q.image_key ?? null,
          imageUrl: apiExpl?.image_url ?? null,
          imageKey: apiExpl?.image_key ?? null,
        };
        const current = prev[q.id];
        if (
          current?.text === candidate.text &&
          current?.problemImageUrl === candidate.problemImageUrl &&
          current?.problemImageKey === candidate.problemImageKey &&
          current?.imageUrl === candidate.imageUrl &&
          current?.imageKey === candidate.imageKey
        ) {
          continue;
        }
        next[q.id] = candidate;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [explanationsFromApi, sortedQuestions]);

  const initMut = useMutation({
    mutationFn: async (overrides?: { choiceCount?: CountDraft; essayCount?: CountDraft }) => {
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
      let appliedCc: number;
      let appliedEc: number;
      if (overrides) {
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
      qc.setQueryData(["exam-questions", examId], list);
      const sorted = [...list].sort((a: ExamQuestion, b: ExamQuestion) => a.number - b.number);
      const choiceList = sorted.slice(0, appliedCc);
      const essayList = sorted.slice(appliedCc, appliedCc + appliedEc);

      const nextScoreDraft: Record<number, number> = {};
      const nextScoreAdjustment: ScoreAdjustmentDraft = { ...scoreAdjustmentDraft };
      if (choiceAutoScore && Number.isFinite(Number(choiceTotalInput)) && choiceTotalInput !== "") {
        const total = Math.max(0, Number(choiceTotalInput));
        const { scores, adjustment } = distributeTotalToScores(total, choiceList.length, choiceScoreMode);
        nextScoreAdjustment.objective = adjustment;
        choiceList.forEach((q: ExamQuestion, i: number) => {
          nextScoreDraft[q.id] = scores[i] ?? 0;
        });
      }
      if (essayAutoScore && Number.isFinite(Number(essayTotalInput)) && essayTotalInput !== "") {
        const total = Math.max(0, Number(essayTotalInput));
        const { scores, adjustment } = distributeTotalToScores(total, essayList.length, essayScoreMode);
        nextScoreAdjustment.subjective = adjustment;
        essayList.forEach((q: ExamQuestion, i: number) => {
          nextScoreDraft[q.id] = scores[i] ?? 0;
        });
      }
      setScoreAdjustmentDraft(nextScoreAdjustment);
      if (Object.keys(nextScoreDraft).length > 0) {
        setScoreDraft((prev) => ({ ...prev, ...nextScoreDraft }));
        if (canEditQuestions) {
          for (const q of sorted) {
            const score = nextScoreDraft[q.id];
            if (score !== undefined && Number.isFinite(score)) {
              await patchQuestionScore({ questionId: q.id, score });
            }
          }
        }
      }
      await qc.invalidateQueries({ queryKey: ["answer-key", examId] });
      await qc.invalidateQueries({ queryKey: ["exam-questions", examId] });
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
    initMut.mutate({ choiceCount: nextChoiceCount, essayCount: nextEssayCount });
  };

  const handleSave = async () => {
    if (!canEditStructure) {
      feedback.info("시험 구조가 준비되지 않아 아직 수정할 수 없습니다.");
      return;
    }
    setSaveBusy(true);
    try {
      const normalized = normalizeAnswers(draft);
      const essayIds = new Set(
        sortedQuestions.slice(effectiveChoiceCount, effectiveChoiceCount + effectiveEssayCount).map((q) => String(q.id))
      );
      essayIds.forEach((questionId) => {
        if (normalized[questionId] === "" || normalized[questionId] === undefined) normalized[questionId] = "해설참조";
      });
      const answersPayload = withScoreAdjustment(normalized, scoreAdjustmentDraft);
      const targetExamId = examId;
      if (!answerKey) {
        await createAnswerKey({ exam: targetExamId, answers: answersPayload });
      } else {
        await updateAnswerKey(answerKey.id, { exam: answerKey.exam, answers: answersPayload });
      }
      await qc.invalidateQueries({ queryKey: ["answer-key", examId] });
      if (canEditQuestions) {
        const toPatch = sortedQuestions.filter(
          (q) => Number.isFinite(scoreDraft[q.id] ?? q.score ?? 0) && (scoreDraft[q.id] ?? q.score ?? 0) !== (q.score ?? 0)
        );
        for (const q of toPatch) {
          const nextScore = scoreDraft[q.id] ?? q.score ?? 0;
          await patchQuestionScore({ questionId: q.id, score: nextScore });
        }
        await qc.invalidateQueries({ queryKey: ["exam-questions", examId] });
      }
      feedback.success(
        canEditQuestions ? "저장되었습니다." : "정답이 저장되었습니다. 문항·배점 수정은 템플릿 시험에서만 가능합니다."
      );
    } catch (error: unknown) {
      feedback.error(extractApiError(error, "저장 실패"));
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
          return d && (d.text || d.imageUrl || d.imageKey);
        })
        .map((q) => {
          const d = explanationDraft[q.id];
          const item: { question_id: number; text: string; image_key?: string } = {
            question_id: q.id,
            text: d?.text ?? "",
          };
          if (d?.imageKey) item.image_key = d.imageKey;
          return item;
        });
      if (items.length === 0) {
        feedback.info("저장할 해설이 없습니다.");
        return;
      }
      await saveExplanationsBulk(examId, items);
      qc.invalidateQueries({ queryKey: ["exam-explanations", examId] });
      qc.invalidateQueries({ queryKey: ["exam-questions", examId] });
      feedback.success(`해설 ${items.length}건 저장 완료`);
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
        activeTab === "answer" && hasQuestions && canEditStructure && !saveBusy ? handleSave : undefined
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
                { key: "omr", label: "OMR 답안지" },
              ]}
              onChange={(key) => setActiveTab(key as "answer" | "image" | "omr")}
            />
            <Button
              intent="ghost"
              size="sm"
              onClick={() => setPdfModalOpen(true)}
              disabled={!structureReady}
              title="시험지 PDF를 올리면 AI가 문항을 자동 인식합니다"
            >
              시험지 PDF 업로드
            </Button>
          </div>
        }
        description="선택형·서술형 문항별 정답을 입력하고 저장합니다. 채점 시 사용됩니다."
      />

      {/* PDF 업로드 통합 모달 — 현재 구조 소유자에 업로드 */}
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
          {structureReady && activeTab === "answer" && (
            <>
            {/* 등록된 답안 요약 영역 제거 — 아래 문항 목록에서 동일 정보 제공 */}
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
                        if (e.key === "Enter") {
                          e.preventDefault();
                          setChoiceCount(choiceCountInput);
                        }
                      }}
                      placeholder="예: 20"
                      className="ds-input answer-key-input--count"
                      disabled={!canEditStructure}
                    />
                  </label>
                  <label className={`answer-key-field answer-key-field--total ${!choiceAutoScore ? "answer-key-field--disabled" : ""}`}>
                    <span className="answer-key-field__label">총점</span>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={choiceTotalInput === "" ? "" : choiceTotalInput}
                      onChange={(e) =>
                        setChoiceTotalInput(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      placeholder="예: 80"
                      className="ds-input answer-key-input--score"
                      disabled={!canEditStructure || !choiceAutoScore}
                      aria-readonly={!canEditStructure || !choiceAutoScore}
                    />
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
                    <span className="answer-key-section-btn__title">서술형 ({formatScore(essayTotalScore)}점)</span>
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
                        if (e.key === "Enter") {
                          e.preventDefault();
                          setEssayCount(essayCountInput);
                        }
                      }}
                      placeholder="예: 1"
                      className="ds-input answer-key-input--count"
                      disabled={!canEditStructure}
                    />
                  </label>
                  <label className={`answer-key-field answer-key-field--total ${!essayAutoScore ? "answer-key-field--disabled" : ""}`}>
                    <span className="answer-key-field__label">총점</span>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={essayTotalInput === "" ? "" : essayTotalInput}
                      onChange={(e) =>
                        setEssayTotalInput(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      placeholder="예: 50"
                      className="ds-input answer-key-input--score"
                      disabled={!canEditStructure || !essayAutoScore}
                      aria-readonly={!canEditStructure || !essayAutoScore}
                    />
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
                          explanation={explanationDraft[q.id] ?? { text: "", problemImageUrl: null, problemImageKey: null, imageUrl: null, imageKey: null }}
                          onChange={(next) =>
                            setExplanationDraft((prev) => ({ ...prev, [q.id]: next }))
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
              lectureName={lectureName}
              sessionName={sessionName}
              choiceCount={effectiveChoiceCount}
              essayCount={effectiveEssayCount}
            />
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
                disabled={saveBusy || !canEditStructure}
                loading={saveBusy}
              >
                저장 (총 {formatScore(totalScore)}점)
              </Button>
            )}
            {activeTab === "image" && sortedQuestions.length > 0 && (
              <Button
                intent="primary"
                disabled={explanationSaveBusy}
                loading={explanationSaveBusy}
                onClick={handleSaveExplanations}
              >
                해설 저장
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
  bubblesRef?: (el: HTMLDivElement | null) => void;
  onMoveToNextRow?: (currentValue: string) => void;
  onMoveToPreviousRow?: () => void;
}) {
  const scoreTone = Math.min(10, Math.max(0, Math.floor(score)));
  const selectedChoices = parseChoiceDraft(draft);
  const firstSelected = CHOICES.find((choice) => selectedChoices.has(choice)) ?? "";
  const currentIndex = CHOICES.indexOf(firstSelected);
  const selectedIndex = currentIndex >= 0 ? currentIndex : 0;

  const toggleChoice = (choice: string) => {
    if (!editable) return;
    const next = new Set(selectedChoices);
    if (next.has(choice)) next.delete(choice);
    else next.add(choice);
    onChange(formatChoiceDraft(next));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editable) return;
    if (/^[1-5]$/.test(e.key)) {
      e.preventDefault();
      toggleChoice(e.key);
      return;
    }
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
      if (next) toggleChoice(next);
      return;
    }
  };

  return (
    <li className={`answer-key-row answer-key-row--choice ${showDividerAfter ? "answer-key-row--divider-after" : ""}`}>
      <div className="answer-key-row__num">{question.number}</div>
      <div
        ref={bubblesRef}
        className="answer-key-row__bubbles"
        role="group"
        aria-label={`${question.number}번 정답`}
        tabIndex={editable ? 0 : -1}
        onKeyDown={handleKeyDown}
      >
        {CHOICES.map((c) => (
          <label key={c} className="answer-key-omr-label">
            <input
              type="checkbox"
              name={`q-${question.id}`}
              value={c}
              checked={selectedChoices.has(c)}
              onChange={() => toggleChoice(c)}
              className="ds-sr-only"
              disabled={!editable}
            />
            <span
              className={`exam-omr-bubble ${selectedChoices.has(c) ? "exam-omr-bubble--selected" : ""}`}
              aria-hidden
            >
              {c}
            </span>
          </label>
        ))}
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
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="해설참조"
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
      onImageChange(URL.createObjectURL(file));
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

  const handleClick = useCallback(() => {
    containerRef.current?.focus();
  }, []);

  const handleDoubleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (imageUrl) {
    return (
      <div
        ref={containerRef}
        className="answer-key-explanation-cell answer-key-explanation-cell--image"
        tabIndex={0}
        onPaste={handlePaste}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <input ref={fileInputRef} type="file" accept="image/*" className="ds-sr-only" onChange={handleFile} />
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
    <div
      ref={containerRef}
      className="answer-key-explanation-cell answer-key-explanation-cell__placeholder-wrap"
      tabIndex={0}
      onPaste={handlePaste}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <input ref={fileInputRef} type="file" accept="image/*" className="ds-sr-only" onChange={handleFile} />
      <div className="answer-key-explanation-cell__placeholder answer-key-explanation-cell__placeholder--no-label">
        {uploading ? (
          <span className="answer-key-explanation-cell__placeholder-text answer-key-explanation-cell__placeholder-text--uploading">업로드 중…</span>
        ) : (
          <>
            <span className="answer-key-explanation-cell__placeholder-text">{label}</span>
            <span className="answer-key-explanation-cell__placeholder-hint">
              클릭 후 Ctrl+V 붙여넣기
              <br />
              더블클릭으로 파일 선택
            </span>
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
  const problemUrl = explanation.problemImageUrl ?? question.image_url ?? question.image ?? null;
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
}: {
  examId: number;
  examTitle: string;
  lectureName: string;
  sessionName: string;
  choiceCount: number;
  essayCount: number;
}) {
  const exceedsOmrLimit = choiceCount > MAX_OMR_MC_COUNT || essayCount > MAX_OMR_ESSAY_COUNT;
  return (
    <div className="answer-key-omr-tab">
      {exceedsOmrLimit && (
        <div className="answer-key-omr-limit-alert" role="status">
          OMR 답안지는 객관식 {MAX_OMR_MC_COUNT}문항, 서술형 {MAX_OMR_ESSAY_COUNT}문항까지 지원합니다.
          현재 시험은 객관식 {choiceCount}문항, 서술형 {essayCount}문항이라 OMR 미리보기와 PDF는 지원 범위까지만 표시됩니다.
        </div>
      )}
      <OmrSheetBuilder
        target={{ type: "exam", examId }}
        initialExamTitle={examTitle || ""}
        initialLectureName={lectureName || ""}
        initialSessionName={sessionName || ""}
        initialMcCount={choiceCount}
        initialEssayCount={essayCount}
        layout="modal"
      />
    </div>
  );
}
