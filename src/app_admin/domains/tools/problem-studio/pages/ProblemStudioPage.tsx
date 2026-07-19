// PATH: src/app_admin/domains/tools/problem-studio/pages/ProblemStudioPage.tsx
// 문제 제작 스튜디오 — 원본 이관과 선생님 검수용 산출물 출력.

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import {
  ArrowRight,
  Copy,
  Download,
  Eye,
  FileCheck2,
  FileInput,
  FileText,
  Plus,
  Printer,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Badge, Button, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { cx } from "@/shared/utils/cx";
import { downloadPresignedUrl } from "@/shared/utils/safeDownload";
import {
  buildWorksheetPreviewHtml,
  downloadWorksheetPdf,
  openWorksheetPrintWindow,
  type WorksheetDraft,
  type WorksheetPdfKind,
  type WorksheetQuestion,
} from "../utils/worksheetPdf";
import {
  downloadHangulDraft,
  type HangulSourceFile,
} from "../utils/worksheetDocument";
import {
  createProblemStudioHangulHandoff,
  createProblemStudioJob,
  createProblemStudioTransferJob,
  getProblemStudioHangulCompanionDownload,
  getProblemStudioJob,
  getProblemStudioTransferJob,
  type ProblemStudioGeneratedQuestion,
  type ProblemStudioGeneratePayload,
  type ProblemStudioGenerateResponse,
  type ProblemStudioTransferJobResult,
  type ProblemStudioTransferJobStatusResponse,
} from "../api/problemStudio.api";
import styles from "./ProblemStudioPage.module.css";

type RewriteMode = "same-type" | "trap" | "concept";

type RewriteModeItem = {
  key: RewriteMode;
  label: string;
  detail: string;
};

type SourceFileEntry = HangulSourceFile & {
  id: string;
  extractedChars?: number;
  warning?: string | null;
};

const DRAFT_KEY = "problem-studio:worksheet-draft:v1";
const SOURCE_ACCEPT = ".pdf,.hwp,.hwpx,.doc,.docx,.zip,.png,.jpg,.jpeg,.webp,.bmp";
const MAX_SOURCE_FILES = 40;
const MAX_SOURCE_FILE_BYTES = 120 * 1024 * 1024;
const MAX_SOURCE_TOTAL_BYTES = 512 * 1024 * 1024;
const DEFAULT_PROMPT = "문제 이미지나 파일을 올리면 한글 초안에 그대로 옮겨집니다.";
const DEFAULT_CHOICES = "① 보기 1\n② 보기 2\n③ 보기 3\n④ 보기 4\n⑤ 보기 5";
const DEFAULT_ANSWER = "①";
const DEFAULT_EXPLANATION = "해설을 입력하면 해설지 PDF에만 표시됩니다.";
const JOB_POLL_INTERVAL_MS = 1500;
const JOB_TIMEOUT_MS = 900_000;
const TRANSFER_JOB_TIMEOUT_MS = 1_800_000;

const BETA_REWRITE_MODES: RewriteModeItem[] = [
  { key: "same-type", label: "유사 유형", detail: "같은 풀이 구조" },
  { key: "trap", label: "함정 보강", detail: "오답 유도 포인트" },
  { key: "concept", label: "개념형", detail: "짧은 개념 확인" },
];

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function createQuestion(seed: Partial<WorksheetQuestion> = {}): WorksheetQuestion {
  return {
    id: makeId("q"),
    prompt: "",
    choices: "",
    answer: "",
    explanation: "",
    attachments: [],
    ...seed,
  };
}

function defaultDraft(): WorksheetDraft {
  return {
    title: "단원 확인 문제",
    className: "",
    subject: "수학",
    date: today(),
    teacher: "",
    instructions: "풀이 과정이 필요한 문항은 빈칸에 과정을 함께 적으세요.",
    questions: [
      createQuestion({
        prompt: DEFAULT_PROMPT,
        choices: DEFAULT_CHOICES,
        answer: DEFAULT_ANSWER,
        explanation: DEFAULT_EXPLANATION,
      }),
    ],
  };
}

function isDraft(value: unknown): value is WorksheetDraft {
  if (value == null || typeof value !== "object") return false;
  const draft = value as Partial<WorksheetDraft>;
  return typeof draft.title === "string" && Array.isArray(draft.questions);
}

function loadDraft(): WorksheetDraft {
  if (typeof window === "undefined") return defaultDraft();
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return defaultDraft();
    const parsed = JSON.parse(raw) as unknown;
    if (!isDraft(parsed)) return defaultDraft();
    return {
      ...defaultDraft(),
      ...parsed,
      questions: parsed.questions.map((q) => ({
        ...createQuestion(),
        ...q,
        attachments: Array.isArray(q.attachments) ? q.attachments : [],
      })),
    };
  } catch {
    return defaultDraft();
  }
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || /\.(png|jpe?g|webp|bmp)$/i.test(file.name);
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function formatFileSize(size: number): string {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)}MB`;
  if (size >= 1024) return `${Math.ceil(size / 1024)}KB`;
  return `${size}B`;
}

function describeSourceKind(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".hwp")) return "HWP";
  if (name.endsWith(".hwpx")) return "HWPX";
  if (name.endsWith(".doc") || name.endsWith(".docx")) return "Word";
  if (name.endsWith(".zip")) return "ZIP";
  if (isPdfFile(file)) return "PDF";
  if (isImageFile(file)) return "스캔/이미지";
  return "기타";
}

function toSourceFileEntry(file: File): SourceFileEntry {
  return {
    id: makeId("src"),
    name: file.name,
    kind: describeSourceKind(file),
    sizeLabel: formatFileSize(file.size),
  };
}

function generatedToQuestion(item: ProblemStudioGeneratedQuestion): WorksheetQuestion {
  return createQuestion({
    prompt: item.prompt,
    choices: item.choices.join("\n"),
    answer: item.answer,
    explanation: item.explanation,
  });
}

function parseQuestionsFromText(text: string): WorksheetQuestion[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const blocks = trimmed
    .split(/\n(?=\s*(?:\d{1,2}[.)]|문제\s*\d{1,2}|Q\s*\d{1,2})\s*)/i)
    .map((block) => block.trim())
    .filter(Boolean);
  return blocks.map((block) => createQuestion({
    prompt: block.replace(/^\s*(?:\d{1,2}[.)]|문제\s*\d{1,2}|Q\s*\d{1,2})\s*/i, ""),
  }));
}

function hasRealQuestion(q: WorksheetQuestion): boolean {
  if (
    q.prompt === DEFAULT_PROMPT
    && q.choices === DEFAULT_CHOICES
    && q.answer === DEFAULT_ANSWER
    && q.explanation === DEFAULT_EXPLANATION
    && q.attachments.length === 0
  ) {
    return false;
  }
  return Boolean(q.prompt.trim() || q.choices.trim() || q.answer.trim() || q.explanation.trim() || q.attachments.length > 0);
}

function mergeImportedQuestions(current: WorksheetQuestion[], imported: WorksheetQuestion[]): WorksheetQuestion[] {
  if (current.every((question) => !hasRealQuestion(question))) return imported;
  return [...current, ...imported];
}

function toSourceEntries(files: Array<HangulSourceFile & { extractedChars?: number; warning?: string | null }>): SourceFileEntry[] {
  return files.map((file) => ({
    id: makeId("src"),
    name: file.name,
    kind: file.kind,
    sizeLabel: file.sizeLabel,
    extractedChars: file.extractedChars,
    warning: file.warning,
  }));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForProblemStudioJob(jobId: string): Promise<ProblemStudioGenerateResponse> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < JOB_TIMEOUT_MS) {
    const status = await getProblemStudioJob(jobId);
    if (status.status === "DONE") {
      if (status.result) return status.result;
      throw new Error("한글 이관 결과를 불러오지 못했습니다.");
    }
    if (["FAILED", "REJECTED_BAD_INPUT"].includes(status.status)) {
      throw new Error(status.error || "한글 이관 작업을 완료하지 못했습니다.");
    }
    await sleep(JOB_POLL_INTERVAL_MS);
  }
  throw new Error("한글 이관 작업이 오래 걸리고 있습니다. 잠시 뒤 다시 확인해 주세요.");
}

function problemStudioTransferStatusLabel(status: ProblemStudioTransferJobStatusResponse): string {
  const progress = status.progress;
  const step = progress?.step_name_display || progress?.step_name || "처리 중";
  const percent = typeof progress?.percent === "number" ? Math.round(progress.percent) : null;
  if (percent != null) return `${step} ${percent}%`;
  if (status.status === "PENDING") return "대기 중";
  if (status.status === "RUNNING") return step;
  return status.status;
}

async function waitForProblemStudioTransferJob(
  jobId: string,
  onProgress: (status: ProblemStudioTransferJobStatusResponse) => void,
): Promise<ProblemStudioTransferJobResult> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < TRANSFER_JOB_TIMEOUT_MS) {
    const status = await getProblemStudioTransferJob(jobId);
    onProgress(status);
    if (status.status === "DONE") {
      if (status.result?.download_url) return status.result;
      throw new Error("원본 이관 결과 다운로드 링크를 불러오지 못했습니다.");
    }
    if (["FAILED", "REJECTED_BAD_INPUT", "FALLBACK_TO_GPU", "REVIEW_REQUIRED"].includes(status.status)) {
      throw new Error(status.error_message || "원본 이관 작업을 완료하지 못했습니다.");
    }
    await sleep(JOB_POLL_INTERVAL_MS);
  }
  throw new Error("원본 이관 작업이 오래 걸리고 있습니다. 잠시 뒤 다시 확인해 주세요.");
}

export default function ProblemStudioPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sourceFiles, setSourceFiles] = useState<SourceFileEntry[]>([]);
  const [sourceFileBlobs, setSourceFileBlobs] = useState<File[]>([]);
  const [templateName] = useState("매치업 기존 양식");
  const [notePolicy, setNotePolicy] = useState("원본을 한글 검수 파일로 그대로 옮긴 초안입니다. 선생님이 파일에서 직접 수정합니다.");
  const [draft, setDraft] = useState<WorksheetDraft>(() => loadDraft());
  const [pasteText, setPasteText] = useState("");
  const [rewriteMode, setRewriteMode] = useState<RewriteMode>("same-type");
  const [rewriteCount, setRewriteCount] = useState(3);
  const [importing, setImporting] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [generationNote, setGenerationNote] = useState("파일이나 이미지를 올리면 한글 이관 초안을 만들 수 있습니다.");
  const [generationWarnings, setGenerationWarnings] = useState<string[]>([]);
  const [pdfLoading, setPdfLoading] = useState<WorksheetPdfKind | null>(null);
  const [transferResult, setTransferResult] = useState<ProblemStudioTransferJobResult | null>(null);
  const [transferJobId, setTransferJobId] = useState<string | null>(null);
  const [companionDownloading, setCompanionDownloading] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // 이미지가 많은 초안은 localStorage 한도를 넘을 수 있다. 저장 실패는 출력 기능을 막지 않는다.
    }
  }, [draft]);

  const previewHtml = useMemo(() => buildWorksheetPreviewHtml(draft, "questions"), [draft]);
  const realQuestions = useMemo(() => draft.questions.filter(hasRealQuestion), [draft.questions]);

  const patchDraft = (patch: Partial<WorksheetDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const buildQuestionPayload = () => [
    ...realQuestions.map((q) => ({
      prompt: q.prompt,
      choices: q.choices,
      answer: q.answer,
      explanation: q.explanation,
    })),
    ...(pasteText.trim() ? [{ prompt: pasteText, choices: "", answer: "", explanation: "" }] : []),
  ];

  const patchQuestion = (id: string, patch: Partial<WorksheetQuestion>) => {
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    }));
  };

  const addQuestion = () => {
    setDraft((prev) => ({ ...prev, questions: [...prev.questions, createQuestion()] }));
  };

  const duplicateQuestion = (question: WorksheetQuestion) => {
    setDraft((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          ...question,
          id: makeId("q"),
          attachments: question.attachments.map((att) => ({ ...att, id: makeId("att") })),
        },
      ],
    }));
  };

  const removeQuestion = (id: string) => {
    setDraft((prev) => {
      const next = prev.questions.filter((q) => q.id !== id);
      return { ...prev, questions: next.length > 0 ? next : [createQuestion()] };
    });
  };

  const removeAttachment = (questionId: string, attachmentId: string) => {
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (
        q.id === questionId
          ? { ...q, attachments: q.attachments.filter((att) => att.id !== attachmentId) }
          : q
      )),
    }));
  };

  const registerSourceFiles = (files: File[]) => {
    if (files.length === 0) return;
    const nextCount = sourceFileBlobs.length + files.length;
    if (nextCount > MAX_SOURCE_FILES) {
      feedback.warning(`파일은 최대 ${MAX_SOURCE_FILES}개까지 올릴 수 있습니다.`);
      return;
    }
    const tooLarge = files.find((file) => file.size > MAX_SOURCE_FILE_BYTES);
    if (tooLarge) {
      feedback.warning(`${tooLarge.name}은 120MB를 넘어서 올릴 수 없습니다.`);
      return;
    }
    const totalBytes = [...sourceFileBlobs, ...files].reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_SOURCE_TOTAL_BYTES) {
      feedback.warning("전체 파일 용량은 512MB까지 올릴 수 있습니다.");
      return;
    }
    const supported = files.filter((file) => (
      isImageFile(file)
      || isPdfFile(file)
      || /\.(hwp|hwpx|doc|docx|zip)$/i.test(file.name)
    ));
    if (supported.length !== files.length) {
      feedback.warning("지원하지 않는 파일은 제외했습니다.");
    }
    if (supported.length === 0) return;
    setSourceFiles((prev) => [...prev, ...supported.map(toSourceFileEntry)]);
    setSourceFileBlobs((prev) => [...prev, ...supported]);
    setTransferResult(null);
    setTransferJobId(null);
    setGenerationNote(`${supported.length}개 원본 등록 · AI 타이핑 준비`);
    feedback.success(`${supported.length}개 원본을 등록했습니다.`);
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    setImporting(true);
    try {
      registerSourceFiles(files);
    } finally {
      setImporting(false);
    }
  };

  const handleSourceDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    registerSourceFiles(Array.from(event.dataTransfer.files));
  };

  const handleParseText = () => {
    const parsed = parseQuestionsFromText(pasteText);
    if (parsed.length === 0) {
      feedback.warning("붙여넣은 문제 텍스트가 없습니다.");
      return;
    }
    setDraft((prev) => ({ ...prev, questions: mergeImportedQuestions(prev.questions, parsed) }));
    setPasteText("");
    feedback.success(`${parsed.length}개 문항을 추가했습니다.`);
  };

  const handleTransferOriginal = async () => {
    if (sourceFileBlobs.length === 0) {
      feedback.warning("AI가 타이핑할 원본 파일을 먼저 올려 주세요.");
      return;
    }
    setTransferring(true);
    setGenerationWarnings([]);
    try {
      const payload: ProblemStudioGeneratePayload = {
        title: draft.title,
        class_name: draft.className,
        subject: draft.subject,
        template_name: templateName,
        variant_mode: "copy",
        variant_count: 1,
        note_policy: notePolicy,
        use_ai: true,
        transfer_only: true,
        ai_transcription: true,
        questions: buildQuestionPayload(),
      };
      setGenerationNote("원본을 안전하게 업로드하는 중");
      const job = await createProblemStudioTransferJob(payload, sourceFileBlobs);
      const pendingSourceFiles = job.source_files.length > 0
        ? toSourceEntries(job.source_files)
        : sourceFiles;
      setSourceFiles(pendingSourceFiles);
      setGenerationWarnings(job.warnings);
      setGenerationNote(`AI 타이핑 대기 · ${job.job_id.slice(0, 8)}`);

      const result = await waitForProblemStudioTransferJob(job.job_id, (jobStatus) => {
        setGenerationNote(`AI 타이핑 중 · ${job.job_id.slice(0, 8)} · ${problemStudioTransferStatusLabel(jobStatus)}`);
      });
      setTransferResult(result);
      setTransferJobId(job.job_id);
      const transferWarnings = [
        (result.fallback_ocr_units || 0) > 0 ? `${result.fallback_ocr_units}쪽은 AI 대신 로컬 OCR로 처리했습니다.` : "",
        result.warning_count > 0 ? `변환 경고 ${result.warning_count}건은 ZIP 안의 검수표에서 확인하세요.` : "",
        result.ocr_candidate_count > 0 ? `수식·표·도형 등 남은 검수 후보 ${result.ocr_candidate_count}건이 있습니다.` : "",
        result.structure_limit_reached ? "구조화 한도 80개를 넘어 나머지는 원본 보존 문서에서 확인해야 합니다." : "",
      ].filter(Boolean);
      setGenerationWarnings(transferWarnings);
      setGenerationNote(
        `검수본 준비 완료 · AI ${result.ai_transcribed_units || 0}쪽 · 구조화 ${result.structured_item_count}개`,
      );
      feedback.success("한글 검수본이 준비됐습니다. 다운로드 버튼을 눌러 저장하세요.");
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : "AI 타이핑을 완료할 수 없습니다.");
    } finally {
      setTransferring(false);
    }
  };

  const handlePreparedDownload = async () => {
    if (!transferJobId) {
      feedback.warning("먼저 AI 타이핑을 완료해 주세요.");
      return;
    }
    try {
      const status = await getProblemStudioTransferJob(transferJobId);
      if (status.status !== "DONE" || !status.result?.download_url) {
        throw new Error("검수본 다운로드 링크를 새로 만들지 못했습니다.");
      }
      setTransferResult(status.result);
      downloadPresignedUrl(status.result.download_url, status.result.filename);
      feedback.success("한글 검수본 ZIP을 저장했습니다.");
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : "검수본을 내려받지 못했습니다.");
    }
  };

  const handleOpenInHangul = async () => {
    if (!transferJobId) {
      feedback.warning("먼저 AI 타이핑을 완료해 주세요.");
      return;
    }
    if (typeof navigator !== "undefined" && !/Windows/i.test(navigator.userAgent)) {
      feedback.warning("한글 연결은 Windows PC에서 사용할 수 있습니다.");
      return;
    }
    try {
      const handoff = await createProblemStudioHangulHandoff(transferJobId);
      window.location.assign(handoff.protocol_url);
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : "한글 연결 프로그램을 열 수 없습니다.");
    }
  };

  const handleCompanionDownload = async () => {
    setCompanionDownloading(true);
    try {
      const companion = await getProblemStudioHangulCompanionDownload();
      downloadPresignedUrl(companion.download_url, companion.filename);
      feedback.success(`한글 연결 프로그램 v${companion.version} ZIP을 저장했습니다.`);
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : "한글 연결 프로그램을 내려받지 못했습니다.");
    } finally {
      setCompanionDownloading(false);
    }
  };

  const handleBetaRewrite = async () => {
    const hasDraftText = realQuestions.some((q) => q.prompt.trim() || q.choices.trim() || q.answer.trim() || q.explanation.trim()) || pasteText.trim();
    if (sourceFileBlobs.length === 0 && !hasDraftText) {
      feedback.warning("재작성할 원본 텍스트나 문서 파일을 먼저 넣어 주세요.");
      return;
    }
    setRewriting(true);
    setGenerationWarnings([]);
    try {
      const payload: ProblemStudioGeneratePayload = {
        title: draft.title,
        class_name: draft.className,
        subject: draft.subject,
        template_name: templateName,
        variant_mode: rewriteMode,
        variant_count: rewriteCount,
        note_policy: notePolicy,
        use_ai: true,
        transfer_only: false,
        questions: buildQuestionPayload(),
      };
      setGenerationNote("Beta 재작성 후보 생성 중");
      const job = await createProblemStudioJob(payload, sourceFileBlobs);
      const pendingSourceFiles = job.source_files.length > 0 ? toSourceEntries(job.source_files) : sourceFiles;
      setSourceFiles(pendingSourceFiles);
      setGenerationWarnings(job.warnings);
      setGenerationNote(`Beta 재작성 처리 중 · ${job.job_id.slice(0, 8)}`);

      const response = await waitForProblemStudioJob(job.job_id);
      const nextSourceFiles = response.source_files.length > 0 ? toSourceEntries(response.source_files) : pendingSourceFiles;
      const generated = response.questions.map(generatedToQuestion);
      const nextDraft = {
        ...draft,
        questions: generated.length > 0 ? generated : draft.questions,
      };

      setDraft(nextDraft);
      setSourceFiles(nextSourceFiles);
      setPasteText("");
      setGenerationWarnings(response.warnings);
      setGenerationNote(`Beta 재작성 · ${response.mode_label} 후보 ${generated.length}개`);
      downloadHangulDraft(nextDraft, {
        sourceFiles: nextSourceFiles,
        templateName,
        variantLabel: `Beta 재작성 · ${response.mode_label}`,
        notePolicy,
      });
      if (response.generation_engine === "ai") {
        feedback.success("Beta 재작성 후보를 저장했습니다.");
      } else {
        feedback.warning("AI 생성이 불안정해 규칙 기반 후보로 저장했습니다.");
      }
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : "Beta 재작성 후보를 만들 수 없습니다.");
    } finally {
      setRewriting(false);
    }
  };

  const handleDownload = async (kind: WorksheetPdfKind) => {
    if (draft.questions.every((q) => !hasRealQuestion(q))) {
      feedback.warning("출력할 문항을 먼저 입력하세요.");
      return;
    }
    setPdfLoading(kind);
    try {
      await downloadWorksheetPdf(draft, kind);
      feedback.success("PDF 파일 생성을 시작했습니다.");
    } catch (error) {
      feedback.warning("직접 PDF 생성에 실패해 인쇄 저장 창을 엽니다.");
      try {
        openWorksheetPrintWindow(draft, kind);
      } catch {
        feedback.error(error instanceof Error ? error.message : "PDF를 만들 수 없습니다.");
      }
    } finally {
      setPdfLoading(null);
    }
  };

  const handlePrint = (kind: WorksheetPdfKind) => {
    try {
      openWorksheetPrintWindow(draft, kind);
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : "인쇄 창을 열 수 없습니다.");
    }
  };

  const handleHangulDownload = () => {
    try {
      downloadHangulDraft(draft, {
        sourceFiles,
        templateName,
        variantLabel: "원본 이관 · 편집 초안",
        notePolicy,
      });
      feedback.success("한글 호환 검수 초안을 저장했습니다.");
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : "한글 초안을 만들 수 없습니다.");
    }
  };

  const resetDraft = () => {
    if (!window.confirm("현재 초안을 비우고 새 문제지를 시작할까요?")) return;
    const next = defaultDraft();
    setDraft(next);
    setSourceFiles([]);
    setSourceFileBlobs([]);
    setPasteText("");
    setGenerationWarnings([]);
    setTransferResult(null);
    setTransferJobId(null);
    setGenerationNote("아직 생성 전입니다.");
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.builderHero} aria-labelledby="worksheet-builder-title">
        <div className={styles.builderHeroText}>
          <Badge tone="primary" size="md">AI 시험지 타이핑</Badge>
          <h2 id="worksheet-builder-title" className={styles.title}>사진만 올리면, 한글 검수본까지</h2>
          <p className={styles.lead}>
            AI가 문제를 풀거나 바꾸지 않고 보이는 원문을 그대로 타이핑합니다. 결과는 편집 가능한 HWPX와 원본 대조용 문서를 함께 제공합니다.
          </p>
        </div>
        <div className={styles.processRail} aria-label="AI 시험지 타이핑 3단계">
          <span><b>1</b> 원본 업로드</span>
          <ArrowRight aria-hidden size={16} />
          <span><b>2</b> AI 타이핑</span>
          <ArrowRight aria-hidden size={16} />
          <span><b>3</b> 한글 검수</span>
        </div>
      </section>

      <section className={styles.builderShell}>
        <div className={styles.editorColumn}>
          <section className={styles.panel} aria-labelledby="source-title">
            <div className={styles.panelHeader}>
              <div>
                <h3 id="source-title">1. 원본 올리기</h3>
                <p>스캔 사진, PDF, HWP/HWPX, Word, ZIP을 최대 40개·전체 512MB까지 처리합니다.</p>
              </div>
              <Button
                type="button"
                intent="primary"
                size="sm"
                loading={importing}
                leftIcon={<Upload size={ICON_FOR_BUTTON.sm} />}
                onClick={() => fileInputRef.current?.click()}
              >
                파일 선택
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={SOURCE_ACCEPT}
              multiple
              className={styles.hiddenInput}
              onChange={handleFiles}
            />
            <div className={styles.sourceGrid}>
              <div
                className={styles.sourceDrop}
                role="button"
                tabIndex={0}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleSourceDrop}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click();
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={ICON.lg} />
                <strong>여기에 시험지를 놓으세요</strong>
                <span>PDF·사진은 서버에서 바로 처리해 브라우저가 무거워지지 않습니다.</span>
                <Button
                  type="button"
                  intent="secondary"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  내 컴퓨터에서 찾기
                </Button>
              </div>
              <div className={styles.sourceList}>
                <strong>등록된 소스</strong>
                {sourceFiles.length === 0 ? (
                  <p>아직 원본이 없습니다. 파일은 새로고침하면 사라지며, 서버 전송 전에는 외부로 보내지지 않습니다.</p>
                ) : (
                  <div className={styles.filePills}>
                    {sourceFiles.map((file) => (
                      <span key={file.id} className={styles.filePill}>
                        <FileText size={ICON.xs} />
                        <span>{file.name}</span>
                        <em>
                          {file.kind} · {file.sizeLabel}
                          {typeof file.extractedChars === "number" ? ` · 추출 ${file.extractedChars.toLocaleString()}자` : ""}
                          {file.warning ? " · 확인 필요" : ""}
                        </em>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="generation-title">
            <div className={styles.panelHeader}>
              <div>
                <h3 id="generation-title">2. AI 타이핑</h3>
                <p>풀이·정답 추론 없이 원문을 옮깁니다. 수식·표·도형과 [판독불가] 표시는 원본과 꼭 대조하세요.</p>
              </div>
            </div>
            <div className={styles.generationControls}>
              <Field label="미주 기본 문구" wide>
                <textarea value={notePolicy} onChange={(e) => setNotePolicy(e.target.value)} rows={2} />
              </Field>
            </div>
            <p className={styles.privacyNote}>
              시작하면 텍스트가 없는 이미지 페이지를 외부 AI 처리업체로 전송합니다. 임시 원본 묶음은 작업 종료 시 삭제합니다.
            </p>
            <div className={styles.generationStatus} data-warning={generationWarnings.length > 0 ? "true" : "false"}>
              <FileCheck2 size={ICON.sm} />
              <div>
                <strong>{generationNote}</strong>
                {generationWarnings.length > 0 ? (
                  <span>{generationWarnings.slice(0, 2).join(" · ")}</span>
                ) : (
                  <span>완료 후 편집 가능한 HWPX, 원본 보존 문서, 검수 체크리스트를 한 번에 내려받을 수 있습니다.</span>
                )}
              </div>
            </div>
          </section>

          <details className={styles.betaPanel}>
            <summary className={styles.optionalSummary}>
              <span>
                <strong>Beta 재작성</strong>
                <small>검수용 후보 생성</small>
              </span>
            </summary>
            <div className={styles.betaBody}>
              <div className={styles.betaHeader}>
                <Badge tone="warning" size="sm">Beta</Badge>
                <p>생성 결과는 초안으로만 저장됩니다. 최종 배포 전 정답과 표현을 확인하세요.</p>
              </div>
              <div className={styles.betaModeGrid} role="radiogroup" aria-label="재작성 방식">
                {BETA_REWRITE_MODES.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="radio"
                    aria-checked={rewriteMode === item.key}
                    className={cx(styles.betaModeButton, rewriteMode === item.key && styles.betaModeActive)}
                    onClick={() => setRewriteMode(item.key)}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </button>
                ))}
              </div>
              <div className={styles.betaActions}>
                <Field label="후보 수">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={rewriteCount}
                    onChange={(event) => setRewriteCount(Math.max(1, Math.min(10, Number(event.target.value) || 1)))}
                  />
                </Field>
                <Button
                  type="button"
                  intent="secondary"
                  size="md"
                  loading={rewriting}
                  leftIcon={<Sparkles size={ICON_FOR_BUTTON.md} />}
                  onClick={handleBetaRewrite}
                >
                  후보 만들기
                </Button>
              </div>
            </div>
          </details>

          <section className={styles.panel} aria-labelledby="worksheet-meta-title">
            <div className={styles.panelHeader}>
              <div>
                <h3 id="worksheet-meta-title">3. 결과물 정보</h3>
                <p>반명까지 넣어 한글 파일명과 문서 헤더에 반영합니다.</p>
              </div>
              <Badge tone="teal" size="md">자동 저장</Badge>
            </div>
            <div className={styles.formGrid}>
              <Field label="제목">
                <input value={draft.title} onChange={(e) => patchDraft({ title: e.target.value })} />
              </Field>
              <Field label="반명">
                <input value={draft.className} onChange={(e) => patchDraft({ className: e.target.value })} placeholder="예: 중2A / 고1 내신반" />
              </Field>
              <Field label="과목">
                <input value={draft.subject} onChange={(e) => patchDraft({ subject: e.target.value })} />
              </Field>
            </div>
            <details className={styles.fieldOptions}>
              <summary>날짜, 담당, 안내문</summary>
              <div className={styles.formGrid}>
                <Field label="날짜">
                  <input type="date" value={draft.date} onChange={(e) => patchDraft({ date: e.target.value })} />
                </Field>
                <Field label="담당">
                  <input value={draft.teacher} onChange={(e) => patchDraft({ teacher: e.target.value })} placeholder="선택" />
                </Field>
                <Field label="안내문" wide>
                  <textarea value={draft.instructions} onChange={(e) => patchDraft({ instructions: e.target.value })} rows={2} />
                </Field>
              </div>
            </details>
          </section>

          <details className={styles.optionalPanel}>
            <summary className={styles.optionalSummary}>
              <span>
                <strong>검수 편집 옵션</strong>
                <small>텍스트 보정, 문항 직접 수정, 정답/해설 입력</small>
              </span>
            </summary>
            <div className={styles.optionalBody}>
              <section className={styles.panel} aria-labelledby="import-title">
                <div className={styles.panelHeader}>
                  <div>
                    <h3 id="import-title">검수용 텍스트 보정</h3>
                    <p>자동 추출 후 사람이 고칠 수 있는 영역입니다. 현재는 붙여넣은 텍스트를 문항으로 나눕니다.</p>
                  </div>
                </div>
                <div className={styles.pasteBox}>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={4}
                    placeholder={"1. 문제 내용을 붙여넣으세요.\n2. 번호가 있으면 문항별로 자동 분리합니다."}
                  />
                  <Button
                    type="button"
                    intent="secondary"
                    size="sm"
                    leftIcon={<FileInput size={ICON_FOR_BUTTON.sm} />}
                    onClick={handleParseText}
                  >
                    텍스트를 문항으로 나누기
                  </Button>
                </div>
              </section>

              <section className={styles.panel} aria-labelledby="questions-title">
                <div className={styles.panelHeader}>
                  <div>
                    <h3 id="questions-title">문항 편집</h3>
                    <p>해설은 해설지에만, 정답은 정답표와 해설지에만 출력됩니다.</p>
                  </div>
                  <Button type="button" intent="secondary" size="sm" leftIcon={<Plus size={ICON_FOR_BUTTON.sm} />} onClick={addQuestion}>
                    문항 추가
                  </Button>
                </div>

                <div className={styles.questionList}>
                  {draft.questions.map((question, index) => (
                    <article key={question.id} className={styles.questionCard}>
                      <div className={styles.questionToolbar}>
                        <div className={styles.questionIndex}>
                          <span>{index + 1}</span>
                          <strong>문항 {index + 1}</strong>
                        </div>
                        <div className={styles.questionActions}>
                          <button type="button" title="복제" aria-label="문항 복제" onClick={() => duplicateQuestion(question)}>
                            <Copy size={ICON.sm} />
                          </button>
                          <button type="button" title="삭제" aria-label="문항 삭제" onClick={() => removeQuestion(question.id)}>
                            <Trash2 size={ICON.sm} />
                          </button>
                        </div>
                      </div>

                      {question.attachments.length > 0 && (
                        <div className={styles.attachmentGrid}>
                          {question.attachments.map((att) => (
                            <figure key={att.id} className={styles.attachmentThumb}>
                              <img src={att.dataUrl} alt={att.pageLabel || att.name} />
                              <figcaption>
                                <span>{att.pageLabel || att.name}</span>
                                <button type="button" onClick={() => removeAttachment(question.id, att.id)} aria-label="첨부 이미지 삭제">
                                  <Trash2 size={ICON.xs} />
                                </button>
                              </figcaption>
                            </figure>
                          ))}
                        </div>
                      )}

                      <Field label="문제">
                        <textarea value={question.prompt} onChange={(e) => patchQuestion(question.id, { prompt: e.target.value })} rows={4} />
                      </Field>
                      <div className={styles.questionSubGrid}>
                        <Field label="보기">
                          <textarea value={question.choices} onChange={(e) => patchQuestion(question.id, { choices: e.target.value })} rows={4} placeholder="한 줄에 보기 하나씩 입력" />
                        </Field>
                        <div className={styles.answerStack}>
                          <Field label="정답">
                            <input value={question.answer} onChange={(e) => patchQuestion(question.id, { answer: e.target.value })} placeholder="예: ③ / x=2" />
                          </Field>
                          <Field label="해설">
                            <textarea value={question.explanation} onChange={(e) => patchQuestion(question.id, { explanation: e.target.value })} rows={4} />
                          </Field>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </details>
        </div>

        <aside className={styles.outputColumn}>
          <section className={styles.panel} aria-labelledby="output-title">
            <div className={styles.panelHeader}>
              <div>
                <h3 id="output-title">3. 한글 검수본</h3>
                <p>AI 타이핑이 끝나도 자동 저장하지 않습니다. 결과를 확인한 뒤 직접 내려받아 주세요.</p>
              </div>
            </div>
            <div className={styles.reviewBundle}>
              <FileCheck2 size={ICON.sm} />
              <span>
                {transferResult
                  ? `준비 완료 · AI ${transferResult.ai_transcribed_units || 0}쪽 · 검수 후보 ${transferResult.ocr_candidate_count}건`
                  : "HWPX 검수본 · 원본 대조 문서 · 체크리스트 · 변환리포트 포함"}
              </span>
            </div>
            <div className={styles.outputButtons}>
              <Button
                type="button"
                intent="primary"
                size="md"
                loading={transferring}
                leftIcon={<Sparkles size={ICON_FOR_BUTTON.md} />}
                onClick={handleTransferOriginal}
              >
                AI 타이핑 시작
              </Button>
              <div className={styles.companionSetup}>
                <Button
                  type="button"
                  intent="secondary"
                  size="md"
                  loading={companionDownloading}
                  leftIcon={<Download size={ICON_FOR_BUTTON.md} />}
                  onClick={handleCompanionDownload}
                >
                  Windows 연결 프로그램 설치
                </Button>
                <p>
                  처음 한 번만 ZIP을 풀고 <strong>Academy.HangulCompanion.exe</strong>를 실행하세요.
                  관리자 권한은 필요하지 않습니다.
                </p>
              </div>
              {transferResult && (
                <>
                  <Button
                    type="button"
                    intent="secondary"
                    size="md"
                    leftIcon={<Download size={ICON_FOR_BUTTON.md} />}
                    onClick={handlePreparedDownload}
                  >
                    검수본 ZIP 내려받기
                  </Button>
                  <Button
                    type="button"
                    intent="ghost"
                    size="md"
                    leftIcon={<FileInput size={ICON_FOR_BUTTON.md} />}
                    onClick={handleOpenInHangul}
                  >
                    한글에서 열기
                  </Button>
                  <p className={styles.companionNote}>설치된 Windows PC의 한글 문서로 안전하게 전달합니다.</p>
                </>
              )}
              <Button
                type="button"
                intent="secondary"
                size="md"
                leftIcon={<FileCheck2 size={ICON_FOR_BUTTON.md} />}
                onClick={handleHangulDownload}
              >
                편집 초안 저장(.doc)
              </Button>
              <Button
                type="button"
                intent="ghost"
                size="sm"
                leftIcon={<RotateCcw size={ICON_FOR_BUTTON.sm} />}
                onClick={resetDraft}
              >
                새 초안
              </Button>
            </div>
          </section>

          <details className={styles.optionalPanel}>
            <summary className={styles.optionalSummary}>
              <span>
                <strong>출력 미리보기</strong>
                <small>문제지, 정답표, 해설지 저장과 인쇄 확인</small>
              </span>
            </summary>
            <div className={styles.optionalBody}>
              <div className={styles.outputButtons}>
                <Button
                  type="button"
                  intent="secondary"
                  size="md"
                  loading={pdfLoading === "questions"}
                  leftIcon={<Download size={ICON_FOR_BUTTON.md} />}
                  onClick={() => handleDownload("questions")}
                >
                  문제지 PDF 저장
                </Button>
                <Button
                  type="button"
                  intent="secondary"
                  size="md"
                  loading={pdfLoading === "answers"}
                  leftIcon={<Download size={ICON_FOR_BUTTON.md} />}
                  onClick={() => handleDownload("answers")}
                >
                  정답표 PDF 저장
                </Button>
                <Button
                  type="button"
                  intent="secondary"
                  size="md"
                  loading={pdfLoading === "explanations"}
                  leftIcon={<Download size={ICON_FOR_BUTTON.md} />}
                  onClick={() => handleDownload("explanations")}
                >
                  해설지 PDF 저장
                </Button>
                <Button
                  type="button"
                  intent="ghost"
                  size="sm"
                  leftIcon={<Printer size={ICON_FOR_BUTTON.sm} />}
                  onClick={() => handlePrint("questions")}
                >
                  인쇄창으로 열기
                </Button>
              </div>
              <section className={styles.previewPanel} aria-labelledby="preview-title">
                <div className={styles.previewHeader}>
                  <div>
                    <h3 id="preview-title">학생용 문서 미리보기</h3>
                    <p>출력될 문제지 화면을 인쇄 전에 확인합니다.</p>
                  </div>
                  <Eye size={ICON.md} />
                </div>
                <div className={styles.previewCanvas}>
                  <div className={styles.previewChrome} aria-hidden>
                    <span className={styles.previewDots}>
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>문제지 미리보기</span>
                    <strong>A4</strong>
                  </div>
                  <iframe className={styles.previewFrame} srcDoc={previewHtml} title="문제지 미리보기" sandbox="allow-same-origin" />
                </div>
              </section>
            </div>
          </details>
        </aside>
      </section>

    </div>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={cx(styles.field, wide && styles.fieldWide)}>
      <span>{label}</span>
      {children}
    </label>
  );
}
