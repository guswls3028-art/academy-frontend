// PATH: src/app_admin/domains/tools/problem-studio/pages/ProblemStudioPage.tsx
// 문제 제작 스튜디오 — 업로드 기반 문제&정답지 생성 요구 정리 + 검수용 산출물 출력.

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpenCheck,
  ClipboardCheck,
  Copy,
  Download,
  Eye,
  FileCheck2,
  FileInput,
  FileSearch,
  FileText,
  Layers3,
  LibraryBig,
  ListChecks,
  Microscope,
  PenLine,
  Plus,
  Printer,
  RotateCcw,
  Route,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Badge, Button, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  buildWorksheetPreviewHtml,
  downloadWorksheetPdf,
  openWorksheetPrintWindow,
  type WorksheetAttachment,
  type WorksheetDraft,
  type WorksheetPdfKind,
  type WorksheetQuestion,
} from "../utils/worksheetPdf";
import {
  downloadHangulDraft,
  type HangulSourceFile,
} from "../utils/worksheetDocument";
import {
  generateProblemStudioDraft,
  type ProblemStudioGeneratedQuestion,
} from "../api/problemStudio.api";
import styles from "./ProblemStudioPage.module.css";

type StudioMode = "scan" | "rewrite" | "bank" | "research";
type WorkstreamTone = "primary" | "teal" | "warning" | "complement";
type PhaseTone = "primary" | "success" | "warning" | "info";

type StudioModeItem = {
  key: StudioMode;
  title: string;
  short: string;
  status: string;
  icon: typeof FileText;
  tone: WorkstreamTone;
  promise: string;
  output: string[];
  guardrails: string[];
};

type PhaseItem = {
  title: string;
  goal: string;
  verify: string;
  tone: PhaseTone;
};

type BacklogItem = {
  title: string;
  detail: string;
  dependency: string;
};

type GenerationVariant = "copy" | "same-type" | "trap" | "concept";

type GenerationVariantItem = {
  key: GenerationVariant;
  title: string;
  detail: string;
  badge: string;
};

type SourceFileEntry = HangulSourceFile & {
  id: string;
  extractedChars?: number;
  warning?: string | null;
};

type PdfViewport = { width: number; height: number };
type PdfPageProxy = {
  getViewport: (params: { scale: number }) => PdfViewport;
  render: (params: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
  }) => { promise: Promise<void> };
};
type PdfDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  destroy?: () => Promise<void> | void;
};
type PdfJsLib = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (params: { data: Uint8Array }) => { promise: Promise<PdfDocumentProxy> };
};

const DRAFT_KEY = "problem-studio:worksheet-draft:v1";
const SOURCE_KEY = "problem-studio:source-files:v1";
const MAX_PDF_PAGES = 24;
const SOURCE_ACCEPT = ".pdf,.hwp,.hwpx,.doc,.docx,.png,.jpg,.jpeg,.webp";
const DEFAULT_PROMPT = "문제 내용을 입력하거나, 스캔/PDF 파일을 올려 문항 이미지를 추가하세요.";
const DEFAULT_CHOICES = "① 보기 1\n② 보기 2\n③ 보기 3\n④ 보기 4\n⑤ 보기 5";
const DEFAULT_ANSWER = "①";
const DEFAULT_EXPLANATION = "해설을 입력하면 해설지 PDF에만 표시됩니다.";

const GENERATION_VARIANTS: GenerationVariantItem[] = [
  {
    key: "copy",
    title: "원본 이관/정리",
    detail: "애매하면 원본을 먼저 한글 파일로 옮기고, 답과 해설은 미주 검수 영역에 둡니다.",
    badge: "현재 단위",
  },
  {
    key: "same-type",
    title: "유사 유형",
    detail: "같은 개념과 풀이 구조를 유지한 후보를 여러 개 만들고 선생님이 선택합니다.",
    badge: "선택형",
  },
  {
    key: "trap",
    title: "함정/오답 유도",
    detail: "아미노산 20종 같은 혼동 지점을 짚어 오답 이유를 짧게 설명합니다.",
    badge: "해설 강화",
  },
  {
    key: "concept",
    title: "교과 개념형",
    detail: "교과서 개념 정의와 풀이 원리를 기준으로 짧고 자세한 해설을 만듭니다.",
    badge: "기본 해설",
  },
];

const REQUIREMENT_FACTS = [
  "소스: EBS 교재, 사설 참고서, PDF/HWP/HWPX가 주력이고 스캔본은 보조입니다.",
  "산출물: 문제와 정답/해설을 한글 문서로 만들고, 정답/해설은 문항 미주 형태로 둡니다.",
  "양식 기준: 매치업 기존 양식을 우선 활용하고, 기준 샘플 파일을 추가 업로드할 수 있어야 합니다.",
  "생성 기준: 지금 단위는 원본을 한글 파일로 먼저 옮기는 것이고, 변주는 선생님이 직접 고릅니다.",
  "해설 기준: 교과서 개념 중심, 짧지만 충분히 자세하게, 오답 유도 포인트는 이유까지 표시합니다.",
];

const STUDIO_MODES: StudioModeItem[] = [
  {
    key: "scan",
    title: "스캔 정리 PDF",
    short: "자료형",
    status: "바로 착수",
    icon: FileText,
    tone: "primary",
    promise: "PDF/HWP/HWPX 교재 자료를 문항 단위로 읽고 학원 양식의 한글 검수 문서로 정리한다.",
    output: ["PDF/HWP/HWPX 소스 등록", "문항 번호와 보기 구조 정렬", "학원 양식 헤더/반명 반영", "정답·해설 미주형 배치"],
    guardrails: ["폰 촬영본은 후순위", "수식/표/그림은 선생님 확인 후 확정", "한컴에서 열리는 산출물 검증"],
  },
  {
    key: "rewrite",
    title: "유사 유형 후보",
    short: "선택형",
    status: "검수 필수",
    icon: PenLine,
    tone: "teal",
    promise: "같은 유형 후보를 여러 개 만들되, 최종 변주와 채택은 선생님이 직접 고른다.",
    output: ["유사 후보 3~5개", "객관식/주관식 후보", "함정/오답 포인트 표시", "채택/버림 검수 상태"],
    guardrails: ["현재 기본은 단순 복사/정리", "후보는 승인 전 배포 불가", "정답 검산 실패 시 출력 차단"],
  },
  {
    key: "bank",
    title: "문제은행 기반 생성",
    short: "MVP 3",
    status: "자산화",
    icon: LibraryBig,
    tone: "warning",
    promise: "기존 매치업/문제은행 자산에서 유사 문제를 찾고 조합해 학습지를 만든다.",
    output: ["단원/개념/난이도 태그 기반 추천", "학생 오답 유형별 유사 문제 묶음", "시험지 자동 편성", "유사 문제 그룹 관리"],
    guardrails: ["테넌트별 문제 자산 격리", "출처와 사용 권한 기록", "중복 문항 자동 제외"],
  },
  {
    key: "research",
    title: "리서치 기반 제작",
    short: "MVP 4",
    status: "후순위",
    icon: Microscope,
    tone: "complement",
    promise: "교육과정, 학교 범위, 선생님 지시를 바탕으로 신규 문제 세트를 구성한다.",
    output: ["학교별 시험 범위 기반 구성", "개념 설명 자료와 문제 동시 생성", "킬러/서술형 보강 세트", "출제 의도 요약"],
    guardrails: ["근거 자료와 생성 로그 보존", "정답 검산과 해설 일치 검사", "외부 자료 인용 범위 제한"],
  },
];

const PHASES: PhaseItem[] = [
  { title: "1차: 한글 초안", goal: "PDF/HWP/HWPX 소스 등록 후 문제와 미주형 정답/해설 문서 출력", verify: "한글에서 열리는 검수 문서가 생성되고 미주 섹션이 문항 번호와 맞는다.", tone: "primary" },
  { title: "2차: 매치업 연결", goal: "기존 매치업 문항 분리와 유사문제 추천 결과를 소스로 재사용", verify: "업로드 문서의 문항 후보와 매치업 양식 기준이 생성 요청에 들어간다.", tone: "success" },
  { title: "3차: 생성 워커", goal: "원본 문제를 정리하고 정답/짧은 교과 개념 해설을 자동 생성", verify: "정답 검산과 해설 길이 제한, 오답 유도 설명 규칙을 통과한다.", tone: "warning" },
  { title: "4차: HWPX 정식 출력", goal: "서버에서 HWPX/HWP 네이티브 미주 객체로 내보내기", verify: "한컴에서 미주 객체로 열리고 선생님이 바로 수정할 수 있다.", tone: "info" },
];

const BACKLOG_NOW: BacklogItem[] = [
  { title: "생성 요청 화면", detail: "소스 파일, 양식 샘플, 생성 방식, 해설 기준을 한 화면에서 고정", dependency: "현재 구현 중" },
  { title: "한글 호환 초안", detail: "문제 본문과 정답/해설 미주 섹션을 포함한 검수 문서 다운로드", dependency: "브라우저 .doc 우선, HWPX는 서버 필요" },
  { title: "매치업 진입 연결", detail: "기존 매치업 자산/양식 확인 동선을 문제 생성기에서 바로 제공", dependency: "기존 /admin/storage/matchup 재사용" },
];

const BACKLOG_NEXT: BacklogItem[] = [
  { title: "HWP/HWPX 본문 추출", detail: "한글 파일에서 문항 텍스트와 표/수식/이미지를 추출", dependency: "서버 파서 또는 변환 워커" },
  { title: "정답/해설 생성", detail: "교과서 개념 중심, 짧은 해설, 오답 유도 포인트 설명 규칙 적용", dependency: "AI 워커와 검산 게이트" },
  { title: "후보 선택", detail: "유사 유형 여러 후보를 생성하고 선생님이 채택/버림 선택", dependency: "생성 결과 스키마 고정" },
];

const BACKLOG_LATER: BacklogItem[] = [
  { title: "정식 HWPX 미주", detail: "한컴 네이티브 미주 객체로 정답/해설 삽입", dependency: "HWPX 패키지 생성기 검증" },
  { title: "양식 학습", detail: "업로드된 샘플 한글/PDF에서 헤더, 문항 간격, 정답 표기 규칙 추출", dependency: "템플릿 분석 스키마" },
  { title: "교재 출처/권한 로그", detail: "EBS/사설 참고서 출처와 생성 이력을 남겨 운영 리스크 관리", dependency: "콘텐츠 정책 확정" },
];

const PIPELINE_STEPS = [
  { label: "소스", detail: "PDF/HWP/HWPX/스캔 접수" },
  { label: "분리", detail: "문항·보기·답지 영역 추출" },
  { label: "생성", detail: "문제 정리와 해설 생성" },
  { label: "선택", detail: "유사 후보 채택/버림" },
  { label: "검수", detail: "정답·해설·오답 유도 확인" },
  { label: "한글", detail: "미주형 HWP/HWPX 출력" },
];

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

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

function isSourceFileEntry(value: unknown): value is SourceFileEntry {
  if (value == null || typeof value !== "object") return false;
  const file = value as Partial<SourceFileEntry>;
  return typeof file.id === "string"
    && typeof file.name === "string"
    && typeof file.kind === "string"
    && typeof file.sizeLabel === "string";
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

function loadSourceFiles(): SourceFileEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SOURCE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isSourceFileEntry) : [];
  } catch {
    return [];
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`${file.name} 파일을 읽을 수 없습니다.`));
    reader.readAsDataURL(file);
  });
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file.name);
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function isHangulOrWordFile(file: File): boolean {
  return /\.(hwp|hwpx|doc|docx)$/i.test(file.name);
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

async function pdfFileToImageQuestions(file: File): Promise<WorksheetQuestion[]> {
  const pdfjsLib = (await import("pdfjs-dist")) as unknown as PdfJsLib;
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const questions: WorksheetQuestion[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(2, 1250 / Math.max(baseViewport.width, 1));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("PDF 페이지를 이미지로 변환할 수 없습니다.");
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const attachment: WorksheetAttachment = {
        id: makeId("att"),
        name: file.name,
        pageLabel: `${file.name} · ${pageNumber}쪽`,
        dataUrl: canvas.toDataURL("image/jpeg", 0.92),
      };
      questions.push(createQuestion({
        prompt: "",
        attachments: [attachment],
      }));
    }
  } finally {
    await pdf.destroy?.();
  }

  if (pdf.numPages > MAX_PDF_PAGES) {
    feedback.warning(`PDF는 앞 ${MAX_PDF_PAGES}쪽까지만 가져왔습니다.`);
  }
  return questions;
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

export default function ProblemStudioPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const templateInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedMode, setSelectedMode] = useState<StudioMode>("scan");
  const [variantMode, setVariantMode] = useState<GenerationVariant>("copy");
  const [variantCount, setVariantCount] = useState(3);
  const [sourceFiles, setSourceFiles] = useState<SourceFileEntry[]>(() => loadSourceFiles());
  const [sourceFileBlobs, setSourceFileBlobs] = useState<File[]>([]);
  const [templateName, setTemplateName] = useState("매치업 기존 양식");
  const [notePolicy, setNotePolicy] = useState("교과서 개념 중심으로 짧게 설명하고, 함정/오답 유도 문항은 왜 헷갈리는지 한 문장으로 덧붙입니다.");
  const [draft, setDraft] = useState<WorksheetDraft>(() => loadDraft());
  const [pasteText, setPasteText] = useState("");
  const [importing, setImporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [generationNote, setGenerationNote] = useState("아직 생성 전입니다.");
  const [generationWarnings, setGenerationWarnings] = useState<string[]>([]);
  const [pdfLoading, setPdfLoading] = useState<WorksheetPdfKind | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // 이미지가 많은 초안은 localStorage 한도를 넘을 수 있다. 저장 실패는 출력 기능을 막지 않는다.
    }
  }, [draft]);

  useEffect(() => {
    try {
      localStorage.setItem(SOURCE_KEY, JSON.stringify(sourceFiles));
    } catch {
      // 파일 본문은 저장하지 않고, 화면/문서에 필요한 소스 메타만 보존한다.
    }
  }, [sourceFiles]);

  const selected = useMemo(
    () => STUDIO_MODES.find((item) => item.key === selectedMode) ?? STUDIO_MODES[0],
    [selectedMode],
  );
  const selectedVariant = useMemo(
    () => GENERATION_VARIANTS.find((item) => item.key === variantMode) ?? GENERATION_VARIANTS[0],
    [variantMode],
  );
  const SelectedIcon = selected.icon;
  const questionCount = draft.questions.length;
  const answeredCount = draft.questions.filter((q) => q.answer.trim()).length;
  const previewHtml = useMemo(() => buildWorksheetPreviewHtml(draft, "questions"), [draft]);
  const sourceSummary = sourceFiles.length > 0 ? `${sourceFiles.length}개` : "대기";

  const patchDraft = (patch: Partial<WorksheetDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

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

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setImporting(true);
    try {
      setSourceFiles((prev) => [...prev, ...files.map(toSourceFileEntry)]);
      setSourceFileBlobs((prev) => [...prev, ...files]);
      const imported: WorksheetQuestion[] = [];
      let registeredOnly = 0;
      for (const file of files) {
        if (isImageFile(file)) {
          const attachment: WorksheetAttachment = {
            id: makeId("att"),
            name: file.name,
            dataUrl: await fileToDataUrl(file),
          };
          imported.push(createQuestion({ attachments: [attachment] }));
          continue;
        }
        if (isPdfFile(file)) {
          imported.push(...await pdfFileToImageQuestions(file));
          continue;
        }
        if (isHangulOrWordFile(file)) {
          registeredOnly += 1;
          continue;
        }
        feedback.warning(`지원하지 않는 파일입니다: ${file.name}`);
      }
      if (imported.length > 0) {
        setDraft((prev) => ({ ...prev, questions: mergeImportedQuestions(prev.questions, imported) }));
        feedback.success(`${imported.length}개 문항 이미지를 가져왔습니다.`);
      } else if (registeredOnly > 0) {
        feedback.success(`${registeredOnly}개 한글/문서 소스를 등록했습니다.`);
      }
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : "파일을 가져오지 못했습니다.");
    } finally {
      setImporting(false);
    }
  };

  const handleTemplateFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setTemplateName(file.name);
    feedback.success("기준 양식 샘플을 연결했습니다.");
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

  const handleGenerateDraft = async () => {
    const hasText = draft.questions.some(hasRealQuestion) || pasteText.trim();
    if (sourceFileBlobs.length === 0 && !hasText) {
      feedback.warning("소스 파일을 올리거나 문제 텍스트를 먼저 넣어 주세요.");
      return;
    }
    setGenerating(true);
    setGenerationWarnings([]);
    try {
      const response = await generateProblemStudioDraft(
        {
          title: draft.title,
          class_name: draft.className,
          subject: draft.subject,
          template_name: templateName,
          variant_mode: variantMode,
          variant_count: variantMode === "copy" ? 1 : variantCount,
          note_policy: notePolicy,
          use_ai: true,
          questions: [
            ...draft.questions.map((q) => ({
              prompt: q.prompt,
              choices: q.choices,
              answer: q.answer,
              explanation: q.explanation,
            })),
            ...(pasteText.trim() ? [{ prompt: pasteText, choices: "", answer: "", explanation: "" }] : []),
          ],
        },
        sourceFileBlobs,
      );
      const generated = response.questions.map(generatedToQuestion);
      if (generated.length > 0) {
        setDraft((prev) => ({ ...prev, questions: generated }));
        setPasteText("");
      }
      if (response.source_files.length > 0) {
        setSourceFiles(response.source_files.map((file) => ({
          id: makeId("src"),
          name: file.name,
          kind: file.kind,
          sizeLabel: file.sizeLabel,
          extractedChars: file.extractedChars,
          warning: file.warning,
        })));
      }
      setGenerationWarnings(response.warnings);
      setGenerationNote(
        response.generation_engine === "ai"
          ? `${response.mode_label} · AI 초안 ${response.questions.length}문항`
          : `${response.mode_label} · 규칙 기반 초안 ${response.questions.length}문항`,
      );
      feedback.success(`${response.questions.length}개 문항 초안을 만들었습니다.`);
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : "문항 초안을 만들 수 없습니다.");
    } finally {
      setGenerating(false);
    }
  };

  const handleTransferOriginal = async () => {
    const hasDraftContent = draft.questions.some(hasRealQuestion) || pasteText.trim();
    if (sourceFileBlobs.length === 0 && !hasDraftContent) {
      feedback.warning("원본으로 옮길 소스 파일을 먼저 올려 주세요.");
      return;
    }
    setTransferring(true);
    setGenerationWarnings([]);
    try {
      const response = await generateProblemStudioDraft(
        {
          title: draft.title,
          class_name: draft.className,
          subject: draft.subject,
          template_name: templateName,
          variant_mode: "copy",
          variant_count: 1,
          note_policy: "원본을 한글 검수 파일로 먼저 옮기고, 선생님이 파일에서 직접 수정합니다.",
          use_ai: false,
          transfer_only: true,
          questions: [
            ...draft.questions.filter(hasRealQuestion).map((q) => ({
              prompt: q.prompt,
              choices: q.choices,
              answer: q.answer,
              explanation: q.explanation,
            })),
            ...(pasteText.trim() ? [{ prompt: pasteText, choices: "", answer: "", explanation: "" }] : []),
          ],
        },
        sourceFileBlobs,
      );
      const nextSourceFiles = response.source_files.length > 0
        ? response.source_files.map((file) => ({
          id: makeId("src"),
          name: file.name,
          kind: file.kind,
          sizeLabel: file.sizeLabel,
          extractedChars: file.extractedChars,
          warning: file.warning,
        }))
        : sourceFiles;
      const generated = response.questions.map(generatedToQuestion);
      const localVisualQuestions = draft.questions.filter((q) => hasRealQuestion(q) && q.attachments.length > 0);
      const shouldKeepLocalVisuals = response.source_text_chars === 0 && localVisualQuestions.length > 0;
      const nextDraft = {
        ...draft,
        questions: shouldKeepLocalVisuals ? localVisualQuestions : generated,
      };

      setDraft(nextDraft);
      setSourceFiles(nextSourceFiles);
      setPasteText("");
      setGenerationWarnings(response.warnings);
      setGenerationNote(`원본 이관 · 한글 초안 ${nextDraft.questions.length}문항`);
      downloadHangulDraft(nextDraft, {
        sourceFiles: nextSourceFiles,
        templateName,
        variantLabel: "원본 이관 · 후보 1개",
        notePolicy: "원본을 한글 검수 파일로 먼저 옮긴 초안입니다. 선생님이 파일에서 직접 정리합니다.",
      });
      feedback.success("원본 이관 한글 파일을 저장했습니다.");
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : "원본을 한글 파일로 옮길 수 없습니다.");
    } finally {
      setTransferring(false);
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
        variantLabel: `${selectedVariant.title} · 후보 ${variantMode === "copy" ? 1 : variantCount}개`,
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
    setGenerationNote("아직 생성 전입니다.");
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      localStorage.removeItem(SOURCE_KEY);
    } catch {
      // ignore
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.builderHero} aria-labelledby="worksheet-builder-title">
        <div className={styles.builderHeroText}>
          <Badge tone="primary" size="md">요구 재정의</Badge>
          <h2 id="worksheet-builder-title" className={styles.title}>문제&정답지 생성기</h2>
          <p className={styles.lead}>
            EBS·사설 참고서 PDF/HWP/HWPX를 소스로 올리고, 매치업 양식 또는 업로드 샘플 기준으로 문제와 정답·해설을 한글 검수 문서로 만듭니다.
          </p>
        </div>
        <div className={styles.heroStats}>
          <Stat label="소스" value={sourceSummary} />
          <Stat label="문항" value={`${questionCount}`} />
          <Stat label="미주" value={`${answeredCount}/${questionCount}`} />
        </div>
      </section>

      <section className={styles.builderShell}>
        <div className={styles.editorColumn}>
          <section className={styles.panel} aria-labelledby="source-title">
            <div className={styles.panelHeader}>
              <div>
                <h3 id="source-title">1. 소스와 양식</h3>
                <p>PDF/HWP/HWPX는 생성 소스로 등록하고, PDF·스캔 이미지는 즉시 검수 초안에 붙입니다.</p>
              </div>
              <Button
                type="button"
                intent="primary"
                size="sm"
                loading={importing}
                leftIcon={<Upload size={ICON_FOR_BUTTON.sm} />}
                onClick={() => fileInputRef.current?.click()}
              >
                소스 업로드
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
            <input
              ref={templateInputRef}
              type="file"
              accept={SOURCE_ACCEPT}
              className={styles.hiddenInput}
              onChange={handleTemplateFile}
            />

            <div className={styles.sourceGrid}>
              <div className={styles.sourceDrop}>
                <FileCheck2 size={ICON.lg} />
                <strong>기준 양식</strong>
                <span>{templateName}</span>
                <Button
                  type="button"
                  intent="secondary"
                  size="sm"
                  onClick={() => templateInputRef.current?.click()}
                >
                  양식 샘플 연결
                </Button>
              </div>
              <div className={styles.sourceList}>
                <strong>등록된 소스</strong>
                {sourceFiles.length === 0 ? (
                  <p>아직 등록된 소스가 없습니다. EBS/참고서 PDF, HWP, HWPX를 올리면 여기에 쌓입니다.</p>
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
                <h3 id="generation-title">2. 생성 방식</h3>
                <p>지금 단위는 단순 복사/정리이고, 유사 유형은 후보를 골라 쓰는 옵션으로 둡니다.</p>
              </div>
              <Button
                type="button"
                intent="primary"
                size="sm"
                loading={generating}
                leftIcon={<Sparkles size={ICON_FOR_BUTTON.sm} />}
                onClick={handleGenerateDraft}
              >
                자동 초안 생성
              </Button>
            </div>
            <div className={styles.variantGrid}>
              {GENERATION_VARIANTS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={cx(styles.variantCard, item.key === variantMode && styles.variantCardActive)}
                  aria-pressed={item.key === variantMode}
                  onClick={() => setVariantMode(item.key)}
                >
                  <span>{item.badge}</span>
                  <strong>{item.title}</strong>
                  <em>{item.detail}</em>
                </button>
              ))}
            </div>
            <div className={styles.generationControls}>
              <Field label="유사 유형 후보 수">
                <select
                  value={variantCount}
                  onChange={(e) => setVariantCount(Number(e.target.value))}
                  disabled={variantMode === "copy"}
                >
                  <option value={1}>1개</option>
                  <option value={3}>3개</option>
                  <option value={5}>5개</option>
                  <option value={10}>10개</option>
                </select>
              </Field>
              <Field label="해설 기준" wide>
                <textarea value={notePolicy} onChange={(e) => setNotePolicy(e.target.value)} rows={2} />
              </Field>
            </div>
            <div className={styles.generationStatus} data-warning={generationWarnings.length > 0 ? "true" : "false"}>
              <FileCheck2 size={ICON.sm} />
              <div>
                <strong>{generationNote}</strong>
                {generationWarnings.length > 0 ? (
                  <span>{generationWarnings.slice(0, 2).join(" · ")}</span>
                ) : (
                  <span>소스 업로드 후 자동 초안을 만들면 문항 편집기에 바로 반영됩니다.</span>
                )}
              </div>
            </div>
          </section>

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
          </section>

          <section className={styles.panel} aria-labelledby="import-title">
            <div className={styles.panelHeader}>
              <div>
                <h3 id="import-title">4. 검수용 텍스트 보정</h3>
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

        <aside className={styles.outputColumn}>
          <section className={styles.panel} aria-labelledby="output-title">
            <div className={styles.panelHeader}>
              <div>
                <h3 id="output-title">한글 출력</h3>
                <p>애매하면 원본만 먼저 한글 파일로 옮깁니다. 정답과 해설은 문항 번호 미주 형태로 묶습니다.</p>
              </div>
            </div>
            <div className={styles.outputButtons}>
              <Button
                type="button"
                intent="primary"
                size="md"
                loading={transferring}
                leftIcon={<FileInput size={ICON_FOR_BUTTON.md} />}
                onClick={handleTransferOriginal}
              >
                원본만 한글로 저장
              </Button>
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

          <section className={styles.previewPanel} aria-labelledby="preview-title">
            <div className={styles.previewHeader}>
              <div>
                <h3 id="preview-title">학생용 미리보기</h3>
                <p>실제 PDF와 같은 HTML로 렌더링합니다.</p>
              </div>
              <Eye size={ICON.md} />
            </div>
            <iframe className={styles.previewFrame} srcDoc={previewHtml} title="문제지 미리보기" sandbox="allow-same-origin" />
          </section>
        </aside>
      </section>

      <section className={styles.summaryPanel} aria-labelledby="problem-studio-title">
        <div className={styles.summaryMain}>
          <Badge tone="primary" size="md">기획 보드</Badge>
          <h2 id="problem-studio-title" className={styles.title}>문제&정답지 생성 요구사항</h2>
          <p className={styles.lead}>
            선생님 인터뷰 기준으로 제품 문장을 다시 잡았습니다. 핵심은 소스 업로드, 학원 양식, 한글 파일, 미주형 정답/해설입니다.
          </p>
        </div>
        <div className={styles.summaryActions}>
          <Button intent="secondary" size="sm" leftIcon={<FileSearch size={ICON_FOR_BUTTON.sm} />} onClick={() => navigate("/admin/storage/matchup")}>
            매치업 자산 보기
          </Button>
          <Button intent="secondary" size="sm" leftIcon={<FileText size={ICON_FOR_BUTTON.sm} />} onClick={() => navigate("/admin/tools/omr")}>
            OMR 도구 보기
          </Button>
        </div>
      </section>

      <section className={styles.pipeline} aria-label="문제 제작 흐름">
        {PIPELINE_STEPS.map((step, index) => (
          <div key={step.label} className={styles.pipelineStep}>
            <span className={styles.pipelineNumber}>{index + 1}</span>
            <div>
              <strong>{step.label}</strong>
              <span>{step.detail}</span>
            </div>
          </div>
        ))}
      </section>

      <section className={styles.requirementPanel} aria-labelledby="requirement-title">
        <div className={styles.sectionHeader}>
          <div>
            <h3 id="requirement-title">선생님에게서 확정된 요구</h3>
            <p>추상 요청을 실제 구현 단위로 바꾼 기준입니다.</p>
          </div>
          <Badge tone="info" size="md">실측 기준</Badge>
        </div>
        <ul className={styles.requirementList}>
          {REQUIREMENT_FACTS.map((item) => (
            <li key={item}><ClipboardCheck size={ICON.sm} /><span>{item}</span></li>
          ))}
        </ul>
      </section>

      <div className={styles.grid}>
        <section className={styles.modePanel} aria-labelledby="mode-title">
          <div className={styles.sectionHeader}>
            <div>
              <h3 id="mode-title">제작 방식</h3>
              <p>요청을 네 갈래로 나누고, 각 갈래의 산출물과 안전장치를 고정합니다.</p>
            </div>
            <Badge tone="teal" size="md">4개 축</Badge>
          </div>

          <div className={styles.modeList}>
            {STUDIO_MODES.map((item) => {
              const Icon = item.icon;
              const active = item.key === selectedMode;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={cx(styles.modeCard, active && styles.modeCardActive)}
                  data-tone={item.tone}
                  aria-pressed={active}
                  onClick={() => setSelectedMode(item.key)}
                >
                  <span className={styles.modeIcon} aria-hidden><Icon size={ICON.md} /></span>
                  <span className={styles.modeText}>
                    <span className={styles.modeTopline}>
                      <strong>{item.title}</strong>
                      <Badge tone={active ? "primary" : "neutral"} size="sm">{item.short}</Badge>
                    </span>
                    <span>{item.promise}</span>
                  </span>
                  <span className={styles.modeStatus}>{item.status}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.detailPanel} aria-labelledby="selected-mode-title">
          <div className={styles.detailHero} data-tone={selected.tone}>
            <div className={styles.detailIcon} aria-hidden><SelectedIcon size={ICON.xl} /></div>
            <div>
              <Badge tone="primary" size="sm">{selected.status}</Badge>
              <h3 id="selected-mode-title">{selected.title}</h3>
              <p>{selected.promise}</p>
            </div>
          </div>

          <div className={styles.detailColumns}>
            <div>
              <div className={styles.miniHeader}><Sparkles size={ICON.sm} /><span>산출물</span></div>
              <ul className={styles.checkList}>
                {selected.output.map((item) => (
                  <li key={item}><ClipboardCheck size={ICON.sm} /><span>{item}</span></li>
                ))}
              </ul>
            </div>
            <div>
              <div className={styles.miniHeader}><ShieldCheck size={ICON.sm} /><span>검수 기준</span></div>
              <ul className={styles.checkList}>
                {selected.guardrails.map((item) => (
                  <li key={item}><ShieldCheck size={ICON.sm} /><span>{item}</span></li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>

      <section className={styles.phasePanel} aria-labelledby="phase-title">
        <div className={styles.sectionHeader}>
          <div>
            <h3 id="phase-title">제품 단계</h3>
            <p>기획은 넓게 두되 구현은 정리 PDF부터 쌓는 순서가 안전합니다.</p>
          </div>
          <Badge tone="warning" size="md">MVP 우선순위</Badge>
        </div>
        <div className={styles.phaseGrid}>
          {PHASES.map((phase, index) => (
            <article key={phase.title} className={styles.phaseCard} data-tone={phase.tone}>
              <div className={styles.phaseNumber}>{String(index + 1).padStart(2, "0")}</div>
              <h4>{phase.title}</h4>
              <p>{phase.goal}</p>
              <div className={styles.verifyLine}><ListChecks size={ICON.sm} /><span>{phase.verify}</span></div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.executionPanel} aria-labelledby="execution-title">
        <div className={styles.sectionHeader}>
          <div>
            <h3 id="execution-title">실행 단위</h3>
            <p>각 항목은 독립 작업 단위로 끊을 수 있는 크기입니다.</p>
          </div>
          <Badge tone="info" size="md">구현 순서</Badge>
        </div>

        <div className={styles.backlogGrid}>
          <BacklogColumn title="지금" icon={<Route size={ICON.md} />} items={BACKLOG_NOW} tone="primary" />
          <BacklogColumn title="다음" icon={<Layers3 size={ICON.md} />} items={BACKLOG_NEXT} tone="teal" />
          <BacklogColumn title="나중" icon={<BookOpenCheck size={ICON.md} />} items={BACKLOG_LATER} tone="warning" />
        </div>
      </section>

      <section className={styles.riskPanel} aria-labelledby="risk-title">
        <div className={styles.riskIcon} aria-hidden><ShieldCheck size={ICON.lg} /></div>
        <div>
          <h3 id="risk-title">제품 문구 기준</h3>
          <p>
            "타교재를 리라이트"가 아니라 "자료에서 개념과 출제 의도를 추출해 학원 고유 문항을 제작"으로 잡아야 합니다.
            이 차이가 저작권, 검수, 품질 설계의 기준선입니다.
          </p>
        </div>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function BacklogColumn({
  title,
  icon,
  items,
  tone,
}: {
  title: string;
  icon: ReactNode;
  items: BacklogItem[];
  tone: "primary" | "teal" | "warning";
}) {
  return (
    <div className={styles.backlogColumn} data-tone={tone}>
      <div className={styles.backlogHeader}>
        <span aria-hidden>{icon}</span>
        <strong>{title}</strong>
      </div>
      <div className={styles.backlogItems}>
        {items.map((item) => (
          <article key={item.title} className={styles.backlogItem}>
            <h4>{item.title}</h4>
            <p>{item.detail}</p>
            <span>{item.dependency}</span>
          </article>
        ))}
      </div>
    </div>
  );
}
