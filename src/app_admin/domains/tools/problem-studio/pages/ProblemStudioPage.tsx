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
import useAuth from "@/auth/hooks/useAuth";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import {
  buildWorksheetPreviewHtml,
  downloadWorksheetPdf,
  openWorksheetPrintWindow,
  type WorksheetDraft,
  type WorksheetPdfKind,
  type WorksheetQuestion,
  type WorksheetTypography,
} from "../utils/worksheetPdf";
import {
  downloadHangulDraft,
  type HangulSourceFile,
} from "../utils/worksheetDocument";
import {
  addProblemStudioVoiceSample,
  createProblemStudioExplanationRun,
  createProblemStudioHangulHandoff,
  createProblemStudioJob,
  createProblemStudioTransferJob,
  createProblemStudioVoiceProfile,
  deleteProblemStudioFont,
  getProblemStudioHangulCompanionDownload,
  getProblemStudioBetaAccess,
  getProblemStudioDocumentStyle,
  getProblemStudioExplanationRun,
  getProblemStudioFonts,
  getProblemStudioJob,
  getProblemStudioTransferJob,
  getProblemStudioVoiceProfiles,
  reviewProblemStudioGeneration,
  resumeProblemStudioExplanationRun,
  saveProblemStudioDocumentStyle,
  uploadProblemStudioFont,
  type ProblemStudioDocumentStyle,
  type ProblemStudioBetaAccess,
  type ProblemStudioExplanationRunStatus,
  type ProblemStudioFontCatalog,
  type ProblemStudioGeneratedQuestion,
  type ProblemStudioGeneratePayload,
  type ProblemStudioGenerateResponse,
  type ProblemStudioPageLayout,
  type ProblemStudioTransferJobResult,
  type ProblemStudioTransferJobStatusResponse,
  type ProblemStudioVoiceProfile,
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

const LEGACY_DRAFT_KEY = "problem-studio:worksheet-draft:v1";
const LEGACY_EXPLANATION_RUN_KEY = "problem-studio:explanation-run:v1";
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
const TRANSFER_JOB_TIMEOUT_MS = 3_660_000;
const EXPLANATION_RUN_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DOCUMENT_STYLE: ProblemStudioDocumentStyle = {
  title_font: "builtin:hamchorom-dotum",
  body_font: "builtin:hamchorom-batang",
  title_size_pt: 20,
  body_size_pt: 10.5,
  body_width_ratio_percent: 100,
  body_letter_spacing_percent: 0,
  line_spacing_percent: 155,
  question_spacing_pt: 10,
  match_source_style: true,
};

function normalizeDocumentStyle(
  value: Partial<ProblemStudioDocumentStyle> | null | undefined,
): ProblemStudioDocumentStyle {
  return {
    ...DEFAULT_DOCUMENT_STYLE,
    ...(value ?? {}),
  };
}

const DEFAULT_PAGE_LAYOUT: ProblemStudioPageLayout = {
  mode: "source",
  margin_top_mm: 12,
  margin_bottom_mm: 12,
  margin_left_mm: 12,
  margin_right_mm: 12,
  column_gap_mm: 8,
  center_line: true,
  center_line_style: "DASH",
};
const EMPTY_FONT_CATALOG: ProblemStudioFontCatalog = {
  built_in_fonts: [
    { key: "hamchorom-batang", label: "함초롬바탕", family_name: "함초롬바탕" },
    { key: "hamchorom-dotum", label: "함초롬돋움", family_name: "함초롬돋움" },
    { key: "malgun-gothic", label: "맑은 고딕", family_name: "맑은 고딕" },
    { key: "batang", label: "바탕", family_name: "바탕" },
    { key: "dotum", label: "돋움", family_name: "돋움" },
    { key: "gulim", label: "굴림", family_name: "굴림" },
  ],
  custom_fonts: [],
};

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

function safeStorageGet(key: string | null): string | null {
  if (!key || typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string | null, value: string): boolean {
  if (!key || typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeStorageRemove(key: string | null): void {
  if (!key || typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage can be blocked by browser policy. Server state remains authoritative.
  }
}

function readStoredDraft(key: string | null): WorksheetDraft | null {
  try {
    const raw = safeStorageGet(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isDraft(parsed)) return null;
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
    return null;
  }
}

function loadDraft(key: string | null): WorksheetDraft {
  return readStoredDraft(key) ?? defaultDraft();
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

async function waitForProblemStudioExplanationRun(
  runId: string,
  onProgress: (status: ProblemStudioExplanationRunStatus) => void,
  shouldContinue: () => boolean = () => true,
): Promise<ProblemStudioExplanationRunStatus> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < EXPLANATION_RUN_TIMEOUT_MS && shouldContinue()) {
    const status = await getProblemStudioExplanationRun(runId);
    onProgress(status);
    if (status.status === "DONE") {
      if (status.result?.download_url) return status;
      throw new Error("정답·해설 PDF 다운로드 링크를 불러오지 못했습니다.");
    }
    if (status.status === "FAILED") {
      throw new Error(status.error_message || "정답·해설 PDF 작업을 완료하지 못했습니다.");
    }
    await sleep(2_500);
  }
  throw new Error("정답·해설 생성은 계속 진행 중입니다. 이 화면을 다시 열면 이어서 확인합니다.");
}

export default function ProblemStudioPage() {
  const { user } = useAuth();
  const tenantCode = getTenantCodeForApiRequest();
  const storageScope = tenantCode && user?.id ? `${tenantCode}:u${user.id}` : null;
  const draftStorageKey = storageScope
    ? `${LEGACY_DRAFT_KEY}:${storageScope}`
    : null;
  const explanationRunStorageKey = storageScope
    ? `${LEGACY_EXPLANATION_RUN_KEY}:${storageScope}`
    : null;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fontInputRef = useRef<HTMLInputElement | null>(null);
  const [sourceFiles, setSourceFiles] = useState<SourceFileEntry[]>([]);
  const [sourceFileBlobs, setSourceFileBlobs] = useState<File[]>([]);
  const [templateName] = useState("매치업 기존 양식");
  const [notePolicy, setNotePolicy] = useState("핵심 조건을 먼저 짚고, 정답 근거와 대표 오답 이유를 수업에서 설명하듯 간결하게 작성합니다.");
  const [draft, setDraft] = useState<WorksheetDraft>(() => loadDraft(draftStorageKey));
  const [activeDraftStorageKey, setActiveDraftStorageKey] = useState(draftStorageKey);
  const [legacyDraftAvailable, setLegacyDraftAvailable] = useState(() => (
    readStoredDraft(LEGACY_DRAFT_KEY) != null
  ));
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
  const [externalAiConfirmed, setExternalAiConfirmed] = useState(false);
  const [learnSourceTone, setLearnSourceTone] = useState(false);
  const [fontCatalog, setFontCatalog] = useState<ProblemStudioFontCatalog>(EMPTY_FONT_CATALOG);
  const [documentStyle, setDocumentStyle] = useState<ProblemStudioDocumentStyle>(DEFAULT_DOCUMENT_STYLE);
  const [pageLayout, setPageLayout] = useState<ProblemStudioPageLayout>(DEFAULT_PAGE_LAYOUT);
  const [styleLoading, setStyleLoading] = useState(true);
  const [styleSaving, setStyleSaving] = useState(false);
  const [fontUploading, setFontUploading] = useState(false);
  const [fontLicenseBasis, setFontLicenseBasis] = useState<"purchased" | "free" | "academy" | "other">("academy");
  const [fontRightsConfirmed, setFontRightsConfirmed] = useState(false);
  const [voiceProfiles, setVoiceProfiles] = useState<ProblemStudioVoiceProfile[]>([]);
  const [selectedVoiceProfileId, setSelectedVoiceProfileId] = useState("");
  const [voiceProfileName, setVoiceProfileName] = useState("내 해설 문체");
  const [voiceProfileCreating, setVoiceProfileCreating] = useState(false);
  const [voiceSampleScope, setVoiceSampleScope] = useState<"style" | "content_reference">("style");
  const [voiceSampleText, setVoiceSampleText] = useState("");
  const [voiceSampleRightsConfirmed, setVoiceSampleRightsConfirmed] = useState(false);
  const [voiceSampleSaving, setVoiceSampleSaving] = useState(false);
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const [generationVoiceProfileId, setGenerationVoiceProfileId] = useState<string | null>(null);
  const [generationDetails, setGenerationDetails] = useState<ProblemStudioGeneratedQuestion[]>([]);
  const [generationQuestionIndexById, setGenerationQuestionIndexById] = useState<Record<string, number>>({});
  const [reviewedQuestionIndexes, setReviewedQuestionIndexes] = useState<Set<number>>(() => new Set());
  const [reviewingQuestionIndex, setReviewingQuestionIndex] = useState<number | null>(null);
  const [betaAccess, setBetaAccess] = useState<ProblemStudioBetaAccess | null>(null);
  const [explanationRun, setExplanationRun] = useState<ProblemStudioExplanationRunStatus | null>(null);
  const [explanationRunning, setExplanationRunning] = useState(false);

  useEffect(() => {
    if (draftStorageKey === activeDraftStorageKey) return;
    setDraft(loadDraft(draftStorageKey));
    setLegacyDraftAvailable(readStoredDraft(LEGACY_DRAFT_KEY) != null);
    setActiveDraftStorageKey(draftStorageKey);
  }, [activeDraftStorageKey, draftStorageKey]);

  useEffect(() => {
    if (draftStorageKey !== activeDraftStorageKey) return;
    // 이미지가 많은 초안이나 저장소 차단은 출력 기능을 막지 않는다.
    safeStorageSet(draftStorageKey, JSON.stringify(draft));
  }, [activeDraftStorageKey, draft, draftStorageKey]);

  useEffect(() => {
    let active = true;
    const loadTypography = async () => {
      setStyleLoading(true);
      try {
        const [fonts, preference, profiles, beta] = await Promise.all([
          getProblemStudioFonts(),
          getProblemStudioDocumentStyle(),
          getProblemStudioVoiceProfiles(),
          getProblemStudioBetaAccess().catch(() => null),
        ]);
        if (!active) return;
        setFontCatalog(fonts);
        setDocumentStyle(normalizeDocumentStyle(preference));
        setVoiceProfiles(profiles);
        if (beta) setBetaAccess(beta);
        setSelectedVoiceProfileId(
          profiles.find((profile) => profile.is_default)?.id || profiles[0]?.id || "",
        );
      } catch (error) {
        if (active) {
          feedback.warning(error instanceof Error ? error.message : "문서·문체 설정을 불러오지 못했습니다.");
        }
      } finally {
        if (active) setStyleLoading(false);
      }
    };
    void loadTypography();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!explanationRunStorageKey) return undefined;
    const scopedRunId = safeStorageGet(explanationRunStorageKey);
    const legacyRunId = scopedRunId ? null : safeStorageGet(LEGACY_EXPLANATION_RUN_KEY);
    const runId = scopedRunId ?? legacyRunId;
    if (!runId) return undefined;
    let active = true;
    const restoreRun = async () => {
      try {
        const current = await getProblemStudioExplanationRun(runId);
        if (!active) return;
        if (legacyRunId && safeStorageSet(explanationRunStorageKey, runId)) {
          safeStorageRemove(LEGACY_EXPLANATION_RUN_KEY);
        }
        setExplanationRun(current);
        setBetaAccess(current.beta_access);
        if (!["PENDING", "RUNNING"].includes(current.status)) return;
        setExplanationRunning(true);
        await waitForProblemStudioExplanationRun(
          runId,
          (next) => {
            if (!active) return;
            setExplanationRun(next);
            setBetaAccess(next.beta_access);
          },
          () => active,
        );
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "정답·해설 작업 상태를 불러오지 못했습니다.";
        if (message.includes("찾을 수 없습니다")) {
          safeStorageRemove(explanationRunStorageKey);
          // A legacy key has no owner metadata. A 404 can mean that another
          // signed-in account owns it, so retain it until an authorized read
          // proves the current account can safely migrate the pointer.
          setExplanationRun(null);
        } else if (!message.includes("계속 진행 중")) {
          feedback.warning(message);
        }
      } finally {
        if (active) setExplanationRunning(false);
      }
    };
    void restoreRun();
    return () => {
      active = false;
    };
  }, [explanationRunStorageKey]);

  const typography = useMemo<WorksheetTypography>(() => {
    const resolveFont = (selection: string, fallback: string) => {
      if (selection.startsWith("asset:")) {
        const asset = fontCatalog.custom_fonts.find((font) => `asset:${font.id}` === selection);
        if (asset) return { family: asset.family_name, url: asset.preview_url };
      }
      const key = selection.replace(/^builtin:/, "");
      const builtIn = fontCatalog.built_in_fonts.find((font) => font.key === key);
      return { family: builtIn?.family_name || fallback, url: undefined };
    };
    const titleFont = resolveFont(documentStyle.title_font, "함초롬돋움");
    const bodyFont = resolveFont(documentStyle.body_font, "함초롬바탕");
    return {
      titleFontFamily: titleFont.family,
      bodyFontFamily: bodyFont.family,
      titleFontUrl: titleFont.url,
      bodyFontUrl: bodyFont.url,
      titleSizePt: documentStyle.title_size_pt,
      bodySizePt: documentStyle.body_size_pt,
      lineSpacingPercent: documentStyle.line_spacing_percent,
      questionSpacingPt: documentStyle.question_spacing_pt,
    };
  }, [documentStyle, fontCatalog]);

  const previewHtml = useMemo(
    () => buildWorksheetPreviewHtml(draft, "questions", typography),
    [draft, typography],
  );
  const realQuestions = useMemo(() => draft.questions.filter(hasRealQuestion), [draft.questions]);

  const patchDraft = (patch: Partial<WorksheetDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const patchDocumentStyle = (patch: Partial<ProblemStudioDocumentStyle>) => {
    setDocumentStyle((prev) => ({ ...prev, ...patch }));
    setTransferResult(null);
    setTransferJobId(null);
  };

  const patchPageLayout = (patch: Partial<ProblemStudioPageLayout>) => {
    setPageLayout((prev) => ({ ...prev, ...patch }));
    setTransferResult(null);
    setTransferJobId(null);
  };

  const handleSaveDocumentStyle = async () => {
    setStyleSaving(true);
    try {
      const saved = await saveProblemStudioDocumentStyle(documentStyle);
      setDocumentStyle(normalizeDocumentStyle(saved));
      feedback.success("내 문서 스타일을 저장했습니다.");
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : "문서 스타일을 저장하지 못했습니다.");
    } finally {
      setStyleSaving(false);
    }
  };

  const handleFontUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!fontRightsConfirmed) {
      feedback.warning("글꼴 사용 권리를 먼저 확인해 주세요.");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    form.append("display_name", file.name.replace(/\.(ttf|otf)$/i, ""));
    form.append("license_basis", fontLicenseBasis);
    form.append("rights_confirmed", "true");
    setFontUploading(true);
    try {
      const font = await uploadProblemStudioFont(form);
      setFontCatalog((prev) => ({
        ...prev,
        custom_fonts: [...prev.custom_fonts, font],
      }));
      patchDocumentStyle({ body_font: `asset:${font.id}` });
      setFontRightsConfirmed(false);
      feedback.success(`${font.display_name}을 내 글꼴에 등록하고 본문 글꼴로 선택했습니다.`);
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : "글꼴을 올리지 못했습니다.");
    } finally {
      setFontUploading(false);
    }
  };

  const handleDeleteFont = async (fontId: string) => {
    const font = fontCatalog.custom_fonts.find((item) => item.id === fontId);
    if (!font || !window.confirm(`${font.display_name}을 내 글꼴에서 삭제할까요?`)) return;
    try {
      await deleteProblemStudioFont(fontId);
      setFontCatalog((prev) => ({
        ...prev,
        custom_fonts: prev.custom_fonts.filter((item) => item.id !== fontId),
      }));
      setDocumentStyle((prev) => ({
        ...prev,
        title_font: prev.title_font === `asset:${fontId}` ? DEFAULT_DOCUMENT_STYLE.title_font : prev.title_font,
        body_font: prev.body_font === `asset:${fontId}` ? DEFAULT_DOCUMENT_STYLE.body_font : prev.body_font,
      }));
      feedback.success("내 글꼴에서 삭제했습니다.");
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : "글꼴을 삭제하지 못했습니다.");
    }
  };

  const handleCreateVoiceProfile = async () => {
    if (!voiceProfileName.trim()) {
      feedback.warning("문체 프로필 이름을 입력해 주세요.");
      return;
    }
    setVoiceProfileCreating(true);
    try {
      const profile = await createProblemStudioVoiceProfile({
        name: voiceProfileName.trim(),
        subject: draft.subject,
        style_instructions: "핵심 개념을 먼저 설명하고, 오답이 되는 이유를 마지막에 짚습니다.",
        is_default: voiceProfiles.length === 0,
      });
      setVoiceProfiles((prev) => [...prev, profile]);
      setSelectedVoiceProfileId(profile.id);
      feedback.success("내 해설 문체 프로필을 만들었습니다.");
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : "문체 프로필을 만들지 못했습니다.");
    } finally {
      setVoiceProfileCreating(false);
    }
  };

  const handleAddVoiceSample = async () => {
    if (!selectedVoiceProfileId) {
      feedback.warning("먼저 내 문체 프로필을 만들어 주세요.");
      return;
    }
    if (!voiceSampleText.trim()) {
      feedback.warning(
        voiceSampleScope === "style"
          ? "직접 작성한 해설을 입력해 주세요."
          : "내용 참고에 사용할 문제를 입력해 주세요.",
      );
      return;
    }
    if (!voiceSampleRightsConfirmed) {
      feedback.warning("자료 사용 권리를 확인해 주세요.");
      return;
    }
    setVoiceSampleSaving(true);
    try {
      const result = await addProblemStudioVoiceSample(selectedVoiceProfileId, {
        usage_scope: voiceSampleScope,
        origin: voiceSampleScope === "style" ? "teacher_authored" : "publisher_reference",
        source_label: voiceSampleScope === "style" ? "선생님 직접 작성 해설" : "업로드 자료 내용 참고",
        problem_text: voiceSampleScope === "content_reference" ? voiceSampleText.trim() : "",
        explanation: voiceSampleScope === "style" ? voiceSampleText.trim() : "",
        rights_confirmed: true,
        rights_note: "문제 제작 화면에서 선생님이 직접 확인",
      });
      setVoiceProfiles((prev) => prev.map((profile) => (
        profile.id === result.profile.id ? result.profile : profile
      )));
      setVoiceSampleText("");
      setVoiceSampleRightsConfirmed(false);
      feedback.success(
        result.created
          ? voiceSampleScope === "style"
            ? "내 해설 문체 샘플을 추가했습니다."
            : "자료를 내용 참고 전용으로 추가했습니다."
          : "이미 등록된 샘플입니다.",
      );
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : "문체 샘플을 추가하지 못했습니다.");
    } finally {
      setVoiceSampleSaving(false);
    }
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

  const handleApproveGeneratedQuestion = async (question: WorksheetQuestion, index: number) => {
    if (!generationJobId || !generationVoiceProfileId) {
      feedback.warning("문체 프로필로 만든 생성 결과만 학습에 반영할 수 있습니다.");
      return;
    }
    const original = generationDetails[index];
    if (!original) {
      feedback.warning("원본 생성 결과를 찾을 수 없습니다.");
      return;
    }
    const finalChoices = question.choices
      .split("\n")
      .map((choice) => choice.trim())
      .filter(Boolean);
    const changed = (
      question.prompt.trim() !== original.prompt.trim()
      || question.answer.trim() !== original.answer.trim()
      || question.explanation.trim() !== original.explanation.trim()
      || finalChoices.join("\n") !== original.choices.map((choice) => choice.trim()).filter(Boolean).join("\n")
    );
    setReviewingQuestionIndex(index);
    try {
      const result = await reviewProblemStudioGeneration(generationJobId, {
        question_index: index,
        outcome: changed ? "edited" : "approved",
        final_question: {
          prompt: question.prompt,
          choices: finalChoices,
          answer: question.answer,
          explanation: question.explanation,
        },
        learn_from_this: true,
        rights_confirmed: true,
      });
      setVoiceProfiles((prev) => prev.map((profile) => (
        profile.id === result.profile.id ? result.profile : profile
      )));
      setReviewedQuestionIndexes((prev) => new Set(prev).add(index));
      feedback.success(
        result.created
          ? "검수한 문제·해설을 승인하고 내 문체에 반영했습니다."
          : "이미 승인한 문항입니다.",
      );
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : "검수 결과를 저장하지 못했습니다.");
    } finally {
      setReviewingQuestionIndex(null);
    }
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

  const monitorExplanationRun = async (runId: string) => {
    const completed = await waitForProblemStudioExplanationRun(runId, (status) => {
      setExplanationRun(status);
      setBetaAccess(status.beta_access);
    });
    setExplanationRun(completed);
    setBetaAccess(completed.beta_access);
    return completed;
  };

  const handleExplanationRun = async () => {
    if (sourceFileBlobs.length !== 1 || !isPdfFile(sourceFileBlobs[0])) {
      feedback.warning("정답·해설 PDF Beta는 PDF 한 파일만 선택해 주세요.");
      return;
    }
    if (!externalAiConfirmed) {
      feedback.warning("글로벌 AI 처리 안내를 확인해 주세요.");
      return;
    }
    if (betaAccess?.can_start === false) {
      feedback.warning("테넌트 무료 체험 3회를 모두 사용했습니다.");
      return;
    }
    setExplanationRunning(true);
    try {
      const started = await createProblemStudioExplanationRun(
        { subject: draft.subject, note_policy: notePolicy },
        sourceFileBlobs[0],
      );
      // Persistence is best-effort. A blocked/quota-full storage must not turn a
      // successfully started server job into a false failure or duplicate retry.
      safeStorageSet(explanationRunStorageKey, started.run_id);
      setExplanationRun(started);
      setBetaAccess(started.beta_access);
      const completed = await monitorExplanationRun(started.run_id);
      feedback.success(
        `정답·해설 PDF가 준비됐습니다. ${completed.result?.review_required_count || 0}개 표시 문항을 먼저 검수하세요.`,
      );
    } catch (error) {
      try {
        setBetaAccess(await getProblemStudioBetaAccess());
      } catch {
        // 작업 오류 안내를 우선한다.
      }
      feedback.error(error instanceof Error ? error.message : "정답·해설 PDF를 만들 수 없습니다.");
    } finally {
      setExplanationRunning(false);
    }
  };

  const handleExplanationResume = async () => {
    if (!explanationRun?.run_id) return;
    setExplanationRunning(true);
    try {
      const resumed = await resumeProblemStudioExplanationRun(explanationRun.run_id);
      setExplanationRun(resumed);
      setBetaAccess(resumed.beta_access);
      const completed = await monitorExplanationRun(resumed.run_id);
      feedback.success(
        `정답·해설 PDF가 준비됐습니다. ${completed.result?.review_required_count || 0}개 표시 문항을 먼저 검수하세요.`,
      );
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : "정답·해설 작업을 재개할 수 없습니다.");
    } finally {
      setExplanationRunning(false);
    }
  };

  const handleExplanationDownload = async () => {
    if (!explanationRun?.run_id) return;
    try {
      const refreshed = await getProblemStudioExplanationRun(explanationRun.run_id);
      setExplanationRun(refreshed);
      setBetaAccess(refreshed.beta_access);
      if (refreshed.status !== "DONE" || !refreshed.result?.download_url) {
        throw new Error("정답·해설 PDF 다운로드 링크를 새로 만들지 못했습니다.");
      }
      downloadPresignedUrl(refreshed.result.download_url, refreshed.result.filename);
      feedback.success("정답·해설 PDF를 저장했습니다.");
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : "정답·해설 PDF를 내려받지 못했습니다.");
    }
  };

  const handleTransferOriginal = async () => {
    if (sourceFileBlobs.length === 0) {
      feedback.warning("AI가 타이핑할 원본 파일을 먼저 올려 주세요.");
      return;
    }
    if (!externalAiConfirmed) {
      feedback.warning("글로벌 AI 처리 안내를 확인해 주세요.");
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
        auto_explanations: false,
        learn_source_explanation_style: learnSourceTone,
        source_style_rights_confirmed: learnSourceTone,
        document_style: documentStyle,
        page_layout: pageLayout,
        voice_profile_id: selectedVoiceProfileId || undefined,
        questions: buildQuestionPayload(),
      };
      setGenerationNote("원본을 안전하게 업로드하는 중");
      const job = await createProblemStudioTransferJob(payload, sourceFileBlobs);
      if (job.beta_access) setBetaAccess(job.beta_access);
      const pendingSourceFiles = job.source_files.length > 0
        ? toSourceEntries(job.source_files)
        : sourceFiles;
      setSourceFiles(pendingSourceFiles);
      setGenerationWarnings(job.warnings);
      setGenerationNote(`AI 타이핑 대기 · ${job.job_id.slice(0, 8)}`);

      const result = await waitForProblemStudioTransferJob(job.job_id, (jobStatus) => {
        if (jobStatus.beta_access) setBetaAccess(jobStatus.beta_access);
        setGenerationNote(`AI 타이핑 중 · ${job.job_id.slice(0, 8)} · ${problemStudioTransferStatusLabel(jobStatus)}`);
      });
      setTransferResult(result);
      setTransferJobId(job.job_id);
      const transferWarnings = [
        (result.fallback_ocr_units || 0) > 0 ? `${result.fallback_ocr_units}쪽은 AI 대신 로컬 OCR로 처리했습니다.` : "",
        result.warning_count > 0 ? `변환 경고 ${result.warning_count}건은 ZIP 안의 검수표에서 확인하세요.` : "",
        result.ocr_candidate_count > 0 ? `수식·표·도형 등 남은 검수 후보 ${result.ocr_candidate_count}건이 있습니다.` : "",
        result.structure_limit_reached ? "Beta 구조화 한도 1,000개를 넘어 나머지는 원본 보존 문서에서 확인해야 합니다." : "",
        result.reconstruction_quality && result.reconstruction_quality.gate !== "benchmark_candidate"
          ? "표·박스·그림의 자동 재배치가 완성 기준에 못 미쳐 원본충실 대조본과 함께 확인해야 합니다."
          : "",
      ].filter(Boolean);
      setGenerationWarnings(transferWarnings);
      setGenerationNote(
        `편집본 준비 완료 · AI 타이핑 ${result.ai_transcribed_units || 0}쪽 · ${result.detected_layout?.column_count || 1}단`,
      );
      feedback.success("편집용 문제지와 원본 대조본이 준비됐습니다.");
    } catch (error) {
      try {
        setBetaAccess(await getProblemStudioBetaAccess());
      } catch {
        // 작업 오류 안내를 우선하며, 잔여 횟수 재조회 실패는 다음 화면 진입에서 복구한다.
      }
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
    if (!externalAiConfirmed) {
      feedback.warning("글로벌 AI 처리 안내를 확인해 주세요.");
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
        learn_source_explanation_style: learnSourceTone && sourceFileBlobs.length > 0,
        source_style_rights_confirmed: learnSourceTone && sourceFileBlobs.length > 0,
        document_style: documentStyle,
        voice_profile_id: selectedVoiceProfileId || undefined,
        questions: buildQuestionPayload(),
      };
      setGenerationNote("Beta 재작성 후보 생성 중");
      const job = await createProblemStudioJob(payload, sourceFileBlobs);
      setGenerationJobId(job.job_id);
      setGenerationVoiceProfileId(null);
      setGenerationDetails([]);
      setGenerationQuestionIndexById({});
      setReviewedQuestionIndexes(new Set());
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
      setGenerationDetails(response.questions);
      setGenerationQuestionIndexById(Object.fromEntries(
        generated.map((question, index) => [question.id, index]),
      ));
      setGenerationVoiceProfileId(response.voice_profile?.id || null);
      setSourceFiles(nextSourceFiles);
      setPasteText("");
      setGenerationWarnings(response.warnings);
      setGenerationNote(`Beta 재작성 · ${response.mode_label} 후보 ${generated.length}개`);
      downloadHangulDraft(nextDraft, {
        sourceFiles: nextSourceFiles,
        templateName,
        variantLabel: `Beta 재작성 · ${response.mode_label}`,
        notePolicy,
        typography,
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
      await downloadWorksheetPdf(draft, kind, typography);
      feedback.success("PDF 파일 생성을 시작했습니다.");
    } catch (error) {
      feedback.warning("직접 PDF 생성에 실패해 인쇄 저장 창을 엽니다.");
      try {
        openWorksheetPrintWindow(draft, kind, typography);
      } catch {
        feedback.error(error instanceof Error ? error.message : "PDF를 만들 수 없습니다.");
      }
    } finally {
      setPdfLoading(null);
    }
  };

  const handlePrint = (kind: WorksheetPdfKind) => {
    try {
      openWorksheetPrintWindow(draft, kind, typography);
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
        typography,
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
    setGenerationJobId(null);
    setGenerationVoiceProfileId(null);
    setGenerationDetails([]);
    setGenerationQuestionIndexById({});
    setReviewedQuestionIndexes(new Set());
    setExternalAiConfirmed(false);
    setGenerationNote("아직 생성 전입니다.");
    safeStorageSet(draftStorageKey, JSON.stringify(next));
  };

  const importLegacyDraft = () => {
    const previousDraft = readStoredDraft(LEGACY_DRAFT_KEY);
    if (!previousDraft) {
      setLegacyDraftAvailable(false);
      feedback.warning("가져올 이전 초안을 찾지 못했습니다.");
      return;
    }
    if (!draftStorageKey) {
      feedback.warning("계정 정보를 확인한 뒤 다시 시도해 주세요.");
      return;
    }
    if (!window.confirm("이 브라우저의 이전 초안을 현재 계정으로 가져올까요? 현재 초안은 덮어씁니다. 공용 PC라면 작성 계정을 먼저 확인해 주세요.")) {
      return;
    }
    setDraft(previousDraft);
    if (safeStorageSet(draftStorageKey, JSON.stringify(previousDraft))) {
      safeStorageRemove(LEGACY_DRAFT_KEY);
      setLegacyDraftAvailable(false);
      feedback.success("이전 초안을 현재 계정으로 가져왔습니다.");
    } else {
      feedback.warning("현재 화면에는 초안을 열었지만 브라우저에 다시 저장하지 못했습니다.");
    }
  };

  const explanationProgress = explanationRun?.progress;
  const explanationStatusText = explanationRun?.status === "DONE"
    ? `완료 · ${explanationRun.result?.question_count || 0}문항 · 검수 표시 ${explanationRun.result?.review_required_count || 0}개`
    : explanationRun?.status === "FAILED"
      ? `중단됨 · ${explanationRun.error_message || "재개할 수 있습니다."}`
      : explanationProgress
        ? `${explanationProgress.step_name_display} · ${explanationProgress.percent}%`
        : "PDF 한 권을 올리면 원본 뒤에 정답·해설 부록을 붙입니다.";

  return (
    <div className={styles.page}>
      <section className={styles.builderHero} aria-labelledby="worksheet-builder-title">
        <div className={styles.builderHeroText}>
          <div className={styles.heroBadges}>
            <Badge tone="primary" size="md">AI 문제집 정답·해설</Badge>
            <Badge tone="warning" size="md">Beta</Badge>
          </div>
          <h2 id="worksheet-builder-title" className={styles.title}>문제집 한 권을, 검수 가능한 정답·해설 PDF로</h2>
          <p className={styles.lead}>
            원본 페이지는 건드리지 않고 뒤에 정답·해설 부록을 붙입니다. 빈 정답은 두 번 풀어 비교하고,
            불일치 문항은 PDF에 검수 필요로 표시합니다. 편집용 HWPX는 별도로 만들 수 있습니다.
          </p>
          <div className={styles.betaTrial} role="status">
            <strong>
              {betaAccess
                ? `테넌트 무료 체험 ${betaAccess.remaining_runs}/${betaAccess.free_run_limit}회 남음`
                : "테넌트 무료 체험 3회"}
            </strong>
            <span>완료된 문제집 단위로 차감되며, AI 정답·해설은 선생님 검수가 필요합니다.</span>
          </div>
        </div>
        <div className={styles.processRail} aria-label="정답·해설 PDF 3단계">
          <span><b>1</b> 문항 분석</span>
          <ArrowRight aria-hidden size={16} />
          <span><b>2</b> 해설·검산</span>
          <ArrowRight aria-hidden size={16} />
          <span><b>3</b> PDF 검수</span>
        </div>
      </section>

      {legacyDraftAvailable ? (
        <aside className={styles.draftRecovery} role="status" aria-label="이전 문제지 초안 복구">
          <RotateCcw size={ICON.md} aria-hidden="true" />
          <div className={styles.draftRecoveryCopy}>
            <strong>계정 분리 전 초안이 이 브라우저에 남아 있습니다.</strong>
            <span>공용 PC라면 작성 계정을 확인한 뒤 현재 계정으로 가져오세요. 내용은 가져오기 전까지 열지 않습니다.</span>
          </div>
          <div className={styles.draftRecoveryActions}>
            <Button type="button" intent="secondary" size="sm" onClick={importLegacyDraft}>
              이전 초안 가져오기
            </Button>
            <Button type="button" intent="ghost" size="sm" onClick={() => setLegacyDraftAvailable(false)}>
              나중에
            </Button>
          </div>
        </aside>
      ) : null}

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
                <h3 id="generation-title">2. AI 재작성 + 자동 해설</h3>
                <p>문제·선지는 원문 그대로 옮기고, 정답·해설만 선택한 선생님 문체로 별도 작성합니다.</p>
              </div>
            </div>
            <div className={styles.generationControls}>
              <Field label="사용할 해설 문체">
                <select
                  value={selectedVoiceProfileId}
                  onChange={(event) => setSelectedVoiceProfileId(event.target.value)}
                >
                  <option value="">기본 해설 문체</option>
                  {voiceProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name} · 문체 {profile.style_sample_count} · 참고 {profile.reference_sample_count}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="해설 작성 지침" wide>
                <textarea value={notePolicy} onChange={(e) => setNotePolicy(e.target.value)} rows={2} />
              </Field>
            </div>
            <label className={styles.aiTransferConsent}>
              <input
                type="checkbox"
                checked={learnSourceTone}
                disabled={sourceFileBlobs.length === 0}
                onChange={(event) => setLearnSourceTone(event.target.checked)}
              />
              <span>
                업로드한 해설은 제가 직접 작성했거나 문체 적용에 사용하도록 승인받은 자료입니다.
                이번 생성 작업에서만 임시 문체 샘플로 사용합니다.
              </span>
            </label>
            <p className={styles.privacyNote}>
              선택하지 않으면 업로드 자료의 문제·개념·풀이 구조만 참고하고, 출판 교재의 문체는 따라 하지 않습니다.
              임시 문체 샘플은 프로필에 저장되거나 다른 사용자에게 공유되지 않습니다.
            </p>
            <p className={styles.privacyNote}>
              텍스트 추출이 어려운 이미지 페이지와 전사된 문제·선택한 문체 샘플은 Amazon Bedrock 글로벌 추론으로 암호화 전송되며,
              전 세계 AWS 상용 리전에서 일시 처리될 수 있습니다. 임시 원본 묶음은 작업 종료 시 삭제되고,
              AWS는 Nova 입력·출력을 기본적으로 저장하거나 모델 학습에 사용하지 않습니다.
            </p>
            <label className={styles.aiTransferConsent}>
              <input
                type="checkbox"
                checked={externalAiConfirmed}
                onChange={(event) => setExternalAiConfirmed(event.target.checked)}
              />
              <span>
                시험지에서 불필요한 개인정보를 가렸고 글로벌 AI 처리 안내를 확인했습니다.{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer">개인정보 처리방침 보기</a>
              </span>
            </label>
            <div className={styles.generationStatus} data-warning={generationWarnings.length > 0 ? "true" : "false"}>
              <FileCheck2 size={ICON.sm} />
              <div>
                <strong>{generationNote}</strong>
                {generationWarnings.length > 0 ? (
                  <span>{generationWarnings.slice(0, 2).join(" · ")}</span>
                ) : (
                  <span>완료 후 원본 규격 문제지 HWPX, 선생님 문체 해설지 HWPX, 원본 보존 문서를 한 번에 받습니다.</span>
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
              <div className={styles.voiceProfileBox}>
                <div className={styles.voiceProfileHeader}>
                  <div>
                    <strong>내 해설 문체</strong>
                    <p>직접 쓴 해설만 문체로 배우고, 출판 자료는 개념 참고에만 사용합니다.</p>
                  </div>
                  {selectedVoiceProfileId && (
                    <Badge tone="teal" size="sm">
                      v{voiceProfiles.find((profile) => profile.id === selectedVoiceProfileId)?.version || 1}
                    </Badge>
                  )}
                </div>
                <div className={styles.voiceProfileControls}>
                  <Field label="사용할 문체 프로필">
                    <select
                      value={selectedVoiceProfileId}
                      onChange={(event) => setSelectedVoiceProfileId(event.target.value)}
                    >
                      <option value="">기본 해설 문체</option>
                      {voiceProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name} · 문체 {profile.style_sample_count} · 참고 {profile.reference_sample_count}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="새 프로필 이름">
                    <input
                      value={voiceProfileName}
                      onChange={(event) => setVoiceProfileName(event.target.value)}
                      placeholder="예: 중2 과학 내 해설"
                    />
                  </Field>
                  <Button
                    type="button"
                    intent="secondary"
                    size="sm"
                    loading={voiceProfileCreating}
                    onClick={handleCreateVoiceProfile}
                  >
                    프로필 만들기
                  </Button>
                </div>
                {selectedVoiceProfileId && (
                  <div className={styles.voiceSampleEditor}>
                    <Field label="샘플 종류">
                      <select
                        value={voiceSampleScope}
                        onChange={(event) => setVoiceSampleScope(event.target.value as typeof voiceSampleScope)}
                      >
                        <option value="style">내가 직접 쓴 해설 · 문체 학습</option>
                        <option value="content_reference">교재·출판 자료 · 내용 참고만</option>
                      </select>
                    </Field>
                    <Field
                      label={voiceSampleScope === "style" ? "내가 직접 쓴 해설" : "내용 참고 문제"}
                      wide
                    >
                      <textarea
                        value={voiceSampleText}
                        onChange={(event) => setVoiceSampleText(event.target.value)}
                        rows={3}
                        placeholder={
                          voiceSampleScope === "style"
                            ? "평소 선생님이 직접 작성한 해설을 붙여넣으세요."
                            : "교재 내용은 문체를 따라 하지 않고 개념·풀이 구조 참고에만 씁니다."
                        }
                      />
                    </Field>
                    <label className={styles.voiceRightsCheck}>
                      <input
                        type="checkbox"
                        checked={voiceSampleRightsConfirmed}
                        onChange={(event) => setVoiceSampleRightsConfirmed(event.target.checked)}
                      />
                      <span>
                        {voiceSampleScope === "style"
                          ? "내가 직접 작성한 해설이며 문체 학습에 사용할 수 있습니다."
                          : "문제 제작의 내용 참고에 사용할 권리가 있습니다."}
                      </span>
                    </label>
                    <Button
                      type="button"
                      intent="secondary"
                      size="sm"
                      loading={voiceSampleSaving}
                      disabled={!voiceSampleText.trim() || !voiceSampleRightsConfirmed}
                      onClick={handleAddVoiceSample}
                    >
                      {voiceSampleScope === "style" ? "문체 샘플 추가" : "내용 참고 추가"}
                    </Button>
                  </div>
                )}
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

          <section className={styles.panel} aria-labelledby="document-style-title">
            <div className={styles.panelHeader}>
              <div>
                <h3 id="document-style-title">4. 내 문서 스타일</h3>
                <p>제목·본문 글꼴과 간격을 한 번 저장하면 다음 교재와 문제지에도 그대로 씁니다.</p>
              </div>
              <Button
                type="button"
                intent="secondary"
                size="sm"
                loading={styleSaving}
                disabled={styleLoading}
                onClick={handleSaveDocumentStyle}
              >
                내 기본값 저장
              </Button>
            </div>
            <div className={styles.formGrid}>
              <Field label="제목 글꼴">
                <select
                  value={documentStyle.title_font}
                  disabled={styleLoading}
                  onChange={(event) => patchDocumentStyle({ title_font: event.target.value })}
                >
                  <optgroup label="한글 기본 글꼴">
                    {fontCatalog.built_in_fonts.map((font) => (
                      <option key={font.key} value={`builtin:${font.key}`}>{font.label}</option>
                    ))}
                  </optgroup>
                  {fontCatalog.custom_fonts.length > 0 && (
                    <optgroup label="내가 올린 글꼴">
                      {fontCatalog.custom_fonts.map((font) => (
                        <option key={font.id} value={`asset:${font.id}`}>{font.display_name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </Field>
              <Field label="본문 글꼴">
                <select
                  value={documentStyle.body_font}
                  disabled={styleLoading}
                  onChange={(event) => patchDocumentStyle({ body_font: event.target.value })}
                >
                  <optgroup label="한글 기본 글꼴">
                    {fontCatalog.built_in_fonts.map((font) => (
                      <option key={font.key} value={`builtin:${font.key}`}>{font.label}</option>
                    ))}
                  </optgroup>
                  {fontCatalog.custom_fonts.length > 0 && (
                    <optgroup label="내가 올린 글꼴">
                      {fontCatalog.custom_fonts.map((font) => (
                        <option key={font.id} value={`asset:${font.id}`}>{font.display_name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </Field>
              <Field label="제목 크기(pt)">
                <input
                  type="number"
                  min={14}
                  max={32}
                  step={0.5}
                  value={documentStyle.title_size_pt}
                  onChange={(event) => patchDocumentStyle({ title_size_pt: Number(event.target.value) || 20 })}
                />
              </Field>
              <Field label="본문 크기(pt)">
                <input
                  type="number"
                  min={8}
                  max={18}
                  step={0.5}
                  value={documentStyle.body_size_pt}
                  onChange={(event) => patchDocumentStyle({ body_size_pt: Number(event.target.value) || 10.5 })}
                />
              </Field>
              <Field label="줄 간격(%)">
                <input
                  type="number"
                  min={120}
                  max={220}
                  step={5}
                  value={documentStyle.line_spacing_percent}
                  onChange={(event) => patchDocumentStyle({ line_spacing_percent: Number(event.target.value) || 155 })}
                />
              </Field>
              <Field label="자평(%)">
                <input
                  type="number"
                  min={50}
                  max={200}
                  step={1}
                  value={documentStyle.body_width_ratio_percent}
                  disabled={documentStyle.match_source_style}
                  onChange={(event) => patchDocumentStyle({
                    body_width_ratio_percent: Number(event.target.value) || 100,
                  })}
                />
              </Field>
              <Field label="자간(%)">
                <input
                  type="number"
                  min={-50}
                  max={50}
                  step={1}
                  value={documentStyle.body_letter_spacing_percent}
                  disabled={documentStyle.match_source_style}
                  onChange={(event) => patchDocumentStyle({
                    body_letter_spacing_percent: Number(event.target.value),
                  })}
                />
              </Field>
              <Field label="문항 간격(pt)">
                <input
                  type="number"
                  min={0}
                  max={24}
                  step={1}
                  value={documentStyle.question_spacing_pt}
                  onChange={(event) => patchDocumentStyle({ question_spacing_pt: Number(event.target.value) || 0 })}
                />
              </Field>
              <Field label="원본 서식 자동 맞춤" wide>
                <label className={styles.fontRightsCheck}>
                  <input
                    type="checkbox"
                    checked={documentStyle.match_source_style}
                    onChange={(event) => patchDocumentStyle({
                      match_source_style: event.target.checked,
                    })}
                  />
                  <span>HWPX 원본의 본문 글꼴·크기·자평·자간·줄간격·여백·2단을 자동 적용</span>
                </label>
              </Field>
              <Field label="페이지·단 규격">
                <select
                  value={pageLayout.mode}
                  onChange={(event) => patchPageLayout({
                    mode: event.target.value as ProblemStudioPageLayout["mode"],
                  })}
                >
                  <option value="source">원본 크기·단 자동 감지</option>
                  <option value="korean_two_column">A4 한국식 2단·중앙선</option>
                  <option value="single_column">원본 크기·1단</option>
                </select>
              </Field>
              <Field label="왼쪽 여백(mm)">
                <input
                  type="number"
                  min={6}
                  max={35}
                  step={0.5}
                  value={pageLayout.margin_left_mm}
                  onChange={(event) => patchPageLayout({ margin_left_mm: Number(event.target.value) || 12 })}
                />
              </Field>
              <Field label="오른쪽 여백(mm)">
                <input
                  type="number"
                  min={6}
                  max={35}
                  step={0.5}
                  value={pageLayout.margin_right_mm}
                  onChange={(event) => patchPageLayout({ margin_right_mm: Number(event.target.value) || 12 })}
                />
              </Field>
              <Field label="위·아래 여백(mm)">
                <input
                  type="number"
                  min={6}
                  max={35}
                  step={0.5}
                  value={pageLayout.margin_top_mm}
                  onChange={(event) => {
                    const value = Number(event.target.value) || 12;
                    patchPageLayout({ margin_top_mm: value, margin_bottom_mm: value });
                  }}
                />
              </Field>
              <Field label="좌우 단 사이(mm)">
                <input
                  type="number"
                  min={3}
                  max={20}
                  step={0.5}
                  value={pageLayout.column_gap_mm}
                  disabled={pageLayout.mode === "single_column"}
                  onChange={(event) => patchPageLayout({ column_gap_mm: Number(event.target.value) || 8 })}
                />
              </Field>
              <Field label="2단 중앙선">
                <label className={styles.fontRightsCheck}>
                  <input
                    type="checkbox"
                    checked={pageLayout.center_line}
                    disabled={pageLayout.mode === "single_column"}
                    onChange={(event) => patchPageLayout({ center_line: event.target.checked })}
                  />
                  <span>한국식 문제지 중앙 구분선 표시</span>
                </label>
              </Field>
              <Field label="중앙선 모양">
                <select
                  value={pageLayout.center_line_style}
                  disabled={pageLayout.mode === "single_column" || !pageLayout.center_line}
                  onChange={(event) => patchPageLayout({
                    center_line_style: event.target.value as ProblemStudioPageLayout["center_line_style"],
                  })}
                >
                  <option value="DASH">점선</option>
                  <option value="SOLID">실선</option>
                  <option value="DOT">촘촘한 점선</option>
                </select>
              </Field>
            </div>
            <div className={styles.typographySample}>
              <strong>산화·환원 단원 확인</strong>
              <span>H₂O와 SO₄²⁻의 관계를 설명하시오. 첨자는 HWPX에서 편집 가능한 한글 수식으로 생성됩니다.</span>
              <small>HWPX는 원본 페이지 크기와 1·2단 구성을 감지하고, 지정한 좌우 여백·단 간격·중앙선을 적용합니다.</small>
            </div>
            <div className={styles.fontUploadBox}>
              <div>
                <strong>내가 가진 글꼴 올리기</strong>
                <p>TTF/OTF만 지원합니다. 파일은 내 계정 전용이며 HWPX에 포함하지 않고, 한글에서 열 때 내 PC에 설치 여부를 묻습니다.</p>
              </div>
              <div className={styles.fontUploadControls}>
                <Field label="사용 권한 근거">
                  <select
                    value={fontLicenseBasis}
                    onChange={(event) => setFontLicenseBasis(event.target.value as typeof fontLicenseBasis)}
                  >
                    <option value="academy">학원 보유</option>
                    <option value="purchased">직접 구매</option>
                    <option value="free">무료 배포</option>
                    <option value="other">기타</option>
                  </select>
                </Field>
                <label className={styles.fontRightsCheck}>
                  <input
                    type="checkbox"
                    checked={fontRightsConfirmed}
                    onChange={(event) => setFontRightsConfirmed(event.target.checked)}
                  />
                  <span>문서 생성과 내 PC 설치에 사용할 권리가 있습니다.</span>
                </label>
                <input
                  ref={fontInputRef}
                  className={styles.hiddenInput}
                  type="file"
                  accept=".ttf,.otf,font/ttf,font/otf"
                  onChange={handleFontUpload}
                />
                <Button
                  type="button"
                  intent="secondary"
                  size="sm"
                  loading={fontUploading}
                  disabled={!fontRightsConfirmed}
                  leftIcon={<Upload size={ICON_FOR_BUTTON.sm} />}
                  onClick={() => fontInputRef.current?.click()}
                >
                  TTF/OTF 선택
                </Button>
              </div>
              {fontCatalog.custom_fonts.length > 0 && (
                <div className={styles.customFontList}>
                  {fontCatalog.custom_fonts.map((font) => (
                    <div key={font.id}>
                      <span>
                        <strong>{font.display_name}</strong>
                        <small>{font.family_name} · {font.supports_hangul ? "한글 지원" : "한글 글리프 제한"} · {formatFileSize(font.size_bytes)}</small>
                      </span>
                      <button
                        type="button"
                        aria-label={`${font.display_name} 삭제`}
                        onClick={() => handleDeleteFont(font.id)}
                      >
                        <Trash2 size={ICON.sm} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <details className={styles.optionalPanel} open={generationDetails.length > 0 ? true : undefined}>
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
                      {generationQuestionIndexById[question.id] !== undefined
                        && generationDetails[generationQuestionIndexById[question.id]]
                        && generationJobId
                        && generationVoiceProfileId && (
                        <div
                          className={styles.generationReviewCard}
                          data-risk={
                            generationDetails[generationQuestionIndexById[question.id]]
                              .quality_checks?.verbatim_similarity_risk
                              ? "true"
                              : "false"
                          }
                        >
                          <div>
                            <strong>
                              AI 검수 정보 · 신뢰도 {
                                generationDetails[generationQuestionIndexById[question.id]].confidence === "high"
                                  ? "높음"
                                  : generationDetails[generationQuestionIndexById[question.id]].confidence === "medium"
                                    ? "보통"
                                    : "낮음"
                              }
                            </strong>
                            <span>
                              근거 문항 {
                                generationDetails[generationQuestionIndexById[question.id]].source_evidence?.length
                                  ? generationDetails[generationQuestionIndexById[question.id]].source_evidence?.join(", ")
                                  : "확인 필요"
                              }
                              {generationDetails[generationQuestionIndexById[question.id]].answer_check
                                ? ` · 정답 재확인: ${generationDetails[generationQuestionIndexById[question.id]].answer_check}`
                                : " · 정답 근거 확인 필요"}
                            </span>
                            {generationDetails[generationQuestionIndexById[question.id]]
                              .quality_checks?.verbatim_similarity_risk && (
                              <em>원문과 표현이 유사할 수 있어 문장을 다시 써 주세요.</em>
                            )}
                          </div>
                          <Button
                            type="button"
                            intent="secondary"
                            size="sm"
                            loading={reviewingQuestionIndex === generationQuestionIndexById[question.id]}
                            disabled={reviewedQuestionIndexes.has(generationQuestionIndexById[question.id])}
                            leftIcon={<FileCheck2 size={ICON_FOR_BUTTON.sm} />}
                            onClick={() => handleApproveGeneratedQuestion(
                              question,
                              generationQuestionIndexById[question.id],
                            )}
                          >
                            {reviewedQuestionIndexes.has(generationQuestionIndexById[question.id])
                              ? "승인·학습 완료"
                              : "검수 승인 후 문체 학습"}
                          </Button>
                        </div>
                      )}
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
                <h3 id="output-title">3. 결과 만들기</h3>
                <p>정답·해설 PDF를 먼저 검수하고, 필요한 경우 편집용 HWPX를 만듭니다.</p>
              </div>
            </div>
            <div
              className={styles.explanationRunCard}
              data-state={explanationRun?.status?.toLowerCase() || "empty"}
              aria-live="polite"
            >
              <div className={styles.explanationRunHeading}>
                <div>
                  <Badge tone="warning" size="sm">Beta</Badge>
                  <strong>정답·해설 PDF</strong>
                </div>
                {explanationProgress && <b>{explanationProgress.percent}%</b>}
              </div>
              <p>{explanationStatusText}</p>
              {explanationProgress && (
                <progress
                  className={styles.explanationProgress}
                  aria-label={explanationProgress.step_name_display}
                  max={100}
                  value={explanationProgress.percent}
                />
              )}
              {explanationProgress && explanationProgress.total_questions > 0 && (
                <div className={styles.explanationCounts}>
                  <span>해설 {explanationProgress.completed_questions}/{explanationProgress.total_questions}</span>
                  <span>독립 검산 {explanationProgress.verified_questions}</span>
                  <span data-attention={explanationProgress.review_required_questions > 0 ? "true" : "false"}>
                    검수 표시 {explanationProgress.review_required_questions}
                  </span>
                </div>
              )}
              <div className={styles.explanationActions}>
                <Button
                  type="button"
                  intent="primary"
                  size="md"
                  loading={explanationRunning}
                  disabled={
                    explanationRunning
                    || sourceFileBlobs.length !== 1
                    || !sourceFileBlobs[0]
                    || !isPdfFile(sourceFileBlobs[0])
                    || !externalAiConfirmed
                    || betaAccess?.can_start === false
                  }
                  leftIcon={<Sparkles size={ICON_FOR_BUTTON.md} />}
                  onClick={handleExplanationRun}
                >
                  {betaAccess?.can_start === false
                    ? "Beta 무료 체험 소진"
                    : "정답·해설 PDF 만들기"}
                </Button>
                {explanationRun?.can_resume && (
                  <Button
                    type="button"
                    intent="secondary"
                    size="md"
                    loading={explanationRunning}
                    onClick={handleExplanationResume}
                  >
                    중단 지점에서 다시 시작
                  </Button>
                )}
                {explanationRun?.status === "DONE" && explanationRun.result && (
                  <Button
                    type="button"
                    intent="secondary"
                    size="md"
                    leftIcon={<Download size={ICON_FOR_BUTTON.md} />}
                    onClick={handleExplanationDownload}
                  >
                    정답·해설 PDF 내려받기
                  </Button>
                )}
              </div>
              <small>화면을 닫아도 작업은 계속됩니다. 다시 열면 마지막 배치부터 상태를 확인합니다.</small>
            </div>
            <div className={styles.reviewBundle}>
              <FileCheck2 size={ICON.sm} />
              <span>
                {transferResult
                  ? `편집본 준비 완료 · 전사 ${transferResult.ai_transcribed_units || 0}쪽 · 원본 보존 ${transferResult.reconstruction_quality?.source_page_preserved_count || 0}쪽`
                  : "편집 문제지 HWPX · 원본충실 레이아웃 대조본"}
              </span>
            </div>
            <div className={styles.outputButtons}>
              <Button
                type="button"
                intent="primary"
                size="md"
                loading={transferring}
                disabled={
                  sourceFileBlobs.length === 0
                  || !externalAiConfirmed
                }
                leftIcon={<Sparkles size={ICON_FOR_BUTTON.md} />}
                onClick={handleTransferOriginal}
              >
                편집용 문제지 HWPX 만들기
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
                    편집용 HWPX ZIP 내려받기
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
