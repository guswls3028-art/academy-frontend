import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  Download,
  Eye,
  FileText,
  Globe2,
  Layers3,
  ListChecks,
  Plus,
  Presentation,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Badge, Button, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { downloadPresignedUrl } from "@/shared/utils/safeDownload";
import {
  createProblemReviewExport,
  createProblemReviewReport,
  getProblemReviewExport,
  getProblemReviewReport,
  finalizeProblemReviewReport,
  listProblemReviewReports,
  publishProblemReviewReport,
  saveProblemReviewReport,
  type ProblemReviewDifficulty,
  type ProblemReviewDraft,
  type ProblemReviewMetadata,
  type ProblemReviewArtifact,
  type ProblemReviewReport,
  type ProblemReviewThinkingAction,
} from "../api/problemReview.api";
import { ProblemReviewPreview } from "./ProblemReviewPreview";
import {
  ProblemReviewStartView,
  ProblemReviewStatusBadge,
} from "./ProblemReviewStartView";
import { problemReviewFileSize, problemReviewReportLabel } from "./problemReviewFormatters";
import styles from "./ProblemReviewPage.module.css";

const MAX_SOURCE_FILES = 6;
const MAX_SOURCE_FILE_BYTES = 120 * 1024 * 1024;
const MAX_SOURCE_TOTAL_BYTES = 512 * 1024 * 1024;
const SUPPORTED_SOURCE_EXTENSIONS = new Set(["pdf", "hwp", "hwpx", "doc", "docx", "zip", "png", "jpg", "jpeg", "webp", "bmp"]);
const ANALYSIS_TIMEOUT_MS = 15 * 60 * 1000;
const EXPORT_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 1600;
const DIFFICULTIES: ProblemReviewDifficulty[] = ["검수 필요", "하", "중", "중상", "상", "최상"];
const THINKING_ACTIONS: ProblemReviewThinkingAction[] = ["검수 필요", "확인", "해석", "계산", "서술", "복합"];

const EMPTY_METADATA: Partial<ProblemReviewMetadata> = {
  title: "",
  school: "",
  subject: "",
  grade: "",
  exam_name: "",
  exam_date: "",
  report_purpose: "teacher_review",
};

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    if (response?.data?.detail) return response.data.detail;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

function questionIssues(question: ProblemReviewDraft["questions"][number], includeConfirmation = true): string[] {
  const missing = [
    ["단원", question.unit],
    ["정답·정답 예시", question.answer],
    ["핵심 포인트", question.key_point],
    ["오답 함정", question.trap],
    ["타당성 메모", question.validity],
  ].filter(([, value]) => !value || ["검수 필요", "확인 필요", "미확인", "-"].includes(String(value).trim())).map(([label]) => label);
  if (question.difficulty === "검수 필요") missing.push("난이도");
  if (question.thinking_action === "검수 필요") missing.push("사고행동");
  if (includeConfirmation && question.review_status !== "verified") missing.push("원문·정답 대조");
  return missing;
}

type ExportProgress = {
  status: "idle" | "pending" | "ready" | "failed";
  label: string;
  percent?: number;
  artifact?: ProblemReviewArtifact;
};

const EMPTY_EXPORT_PROGRESS: Record<"pdf" | "pptx", ExportProgress> = {
  pdf: { status: "idle", label: "A4 세로 편집물" },
  pptx: { status: "idle", label: "발표·촬영용 슬라이드" },
};

export default function ProblemReviewPage() {
  const [metadata, setMetadata] = useState<Partial<ProblemReviewMetadata>>(EMPTY_METADATA);
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [aiConfirmed, setAiConfirmed] = useState(false);
  const [recentReports, setRecentReports] = useState<ProblemReviewReport[]>([]);
  const [current, setCurrent] = useState<ProblemReviewReport | null>(null);
  const [draft, setDraft] = useState<ProblemReviewDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "pptx" | null>(null);
  const [exportProgress, setExportProgress] = useState(EMPTY_EXPORT_PROGRESS);
  const [publishing, setPublishing] = useState(false);
  const [publicationUrl, setPublicationUrl] = useState<string | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState("시험지에서 문항과 출제 구조를 읽고 있습니다.");
  const [pageError, setPageError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [questionFilter, setQuestionFilter] = useState<"unresolved" | "all">("unresolved");
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const pollToken = useRef(0);
  const readiness = current?.review_readiness ?? null;
  const isReportFinalized = Boolean(!dirty && readiness?.is_finalized);
  const unresolvedQuestionIndexes = draft
    ? draft.questions.map((question, index) => questionIssues(question).length ? index : -1).filter((index) => index >= 0)
    : [];
  const visibleQuestionIndexes = draft
    ? (questionFilter === "unresolved" ? unresolvedQuestionIndexes : draft.questions.map((_, index) => index))
    : [];
  const selectedQuestionIndex = visibleQuestionIndexes.includes(activeQuestionIndex)
    ? activeQuestionIndex
    : (visibleQuestionIndexes[0] ?? 0);

  useEffect(() => {
    let active = true;
    listProblemReviewReports()
      .then((reports) => {
        if (active) setRecentReports(reports);
      })
      .catch(() => {
        if (active) setPageError("최근 리포트를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoadingRecent(false);
      });
    return () => {
      active = false;
      pollToken.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!previewOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const mobilePreview = window.matchMedia("(max-width: 1180px)").matches;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewOpen(false);
    };
    if (mobilePreview) document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [previewOpen]);

  function markDraft(next: ProblemReviewDraft) {
    setDraft(next);
    setDirty(true);
  }

  function selectFiles(files: File[]) {
    const unsupported = files.filter((file) => !SUPPORTED_SOURCE_EXTENSIONS.has(file.name.split(".").pop()?.toLowerCase() ?? ""));
    if (unsupported.length) {
      feedback.warning(`지원하지 않는 파일입니다: ${unsupported.slice(0, 3).map((file) => file.name).join(", ")}`);
      return;
    }
    const oversized = files.filter((file) => file.size > MAX_SOURCE_FILE_BYTES);
    if (oversized.length) {
      feedback.warning(`파일 하나는 120MB까지 올릴 수 있습니다: ${oversized[0].name}`);
      return;
    }
    if (files.reduce((sum, file) => sum + file.size, 0) > MAX_SOURCE_TOTAL_BYTES) {
      feedback.warning("전체 파일 용량은 512MB까지 올릴 수 있습니다.");
      return;
    }
    const accepted = files.slice(0, MAX_SOURCE_FILES);
    if (files.length > MAX_SOURCE_FILES) {
      feedback.warning(`한 번에 파일은 ${MAX_SOURCE_FILES}개까지 등록할 수 있습니다.`);
    }
    setSourceFiles(accepted);
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    selectFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    selectFiles(Array.from(event.dataTransfer.files));
  }

  async function waitForAnalysis(reportId: string, token: number) {
    const startedAt = Date.now();
    let messageIndex = 0;
    const messages = [
      "시험지에서 문항과 출제 구조를 읽고 있습니다.",
      "문항별 난이도와 학생이 흔들릴 지점을 정리하고 있습니다.",
      "선생님이 바로 고칠 수 있는 리포트 초안을 구성하고 있습니다.",
    ];
    while (Date.now() - startedAt < ANALYSIS_TIMEOUT_MS && pollToken.current === token) {
      const report = await getProblemReviewReport(reportId);
      setCurrent(report);
      setRecentReports((items) => [report, ...items.filter((item) => item.id !== report.id)].slice(0, 20));
      if (report.status === "draft" && report.draft) {
        setDraft(report.draft);
        setDirty(false);
        setPageError("");
        feedback.success("검수 가능한 문제 리뷰 초안이 준비됐습니다.");
        return;
      }
      if (report.status === "failed") {
        throw new Error(report.last_error || "문제 리뷰 분석에 실패했습니다.");
      }
      messageIndex = (messageIndex + 1) % messages.length;
      setAnalysisMessage(messages[messageIndex]);
      await sleep(POLL_INTERVAL_MS);
    }
    if (pollToken.current === token) throw new Error("분석이 예상보다 오래 걸립니다. 최근 리포트에서 다시 열어 주세요.");
  }

  async function handleStart() {
    if (!sourceFiles.length) {
      feedback.warning("리뷰할 시험지나 문제지 파일을 등록해 주세요.");
      return;
    }
    if (!aiConfirmed) {
      feedback.warning("외부 AI 처리 안내를 확인해 주세요.");
      return;
    }
    setStarting(true);
    setPageError("");
    const token = pollToken.current + 1;
    pollToken.current = token;
    try {
      const report = await createProblemReviewReport(metadata, sourceFiles);
      setCurrent(report);
      setDraft(null);
      setRecentReports((items) => [report, ...items.filter((item) => item.id !== report.id)].slice(0, 20));
      await waitForAnalysis(report.id, token);
    } catch (error) {
      const message = errorMessage(error, "문제 리뷰를 시작하지 못했습니다.");
      setPageError(message);
      feedback.error(message);
    } finally {
      setStarting(false);
    }
  }

  async function openReport(report: ProblemReviewReport) {
    if (dirty && !window.confirm("저장하지 않은 수정 내용이 있습니다. 다른 리포트를 열까요?")) return;
    const token = pollToken.current + 1;
    pollToken.current = token;
    setPageError("");
    try {
      const detail = await getProblemReviewReport(report.id);
      setCurrent(detail);
      setDraft(detail.draft ?? null);
      setDirty(false);
      if (detail.status === "analyzing") {
        setStarting(true);
        await waitForAnalysis(detail.id, token);
      }
    } catch (error) {
      const message = errorMessage(error, "리포트를 열지 못했습니다.");
      setPageError(message);
      feedback.error(message);
    } finally {
      setStarting(false);
    }
  }

  function resetWorkspace() {
    if (dirty && !window.confirm("저장하지 않은 수정 내용이 있습니다. 새 리포트를 만들까요?")) return;
    pollToken.current += 1;
    setCurrent(null);
    setDraft(null);
    setDirty(false);
    setSourceFiles([]);
    setMetadata(EMPTY_METADATA);
    setAiConfirmed(false);
    setExportProgress(EMPTY_EXPORT_PROGRESS);
    setPageError("");
  }

  async function persistDraft(): Promise<ProblemReviewReport | null> {
    if (!current || !draft) return null;
    if (!dirty) return current;
    setSaving(true);
    try {
      const saved = await saveProblemReviewReport(current.id, {
        version: current.version,
        title: draft.metadata.title || current.title,
        draft,
      });
      setCurrent(saved);
      setDraft(saved.draft ?? draft);
      setDirty(false);
      setRecentReports((items) => [saved, ...items.filter((item) => item.id !== saved.id)].slice(0, 20));
      feedback.success("선생님 검수 내용을 저장했습니다.");
      return saved;
    } catch (error) {
      const message = errorMessage(error, "리포트를 저장하지 못했습니다.");
      feedback.error(message);
      setPageError(message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalize() {
    if (!current || !draft) return;
    setFinalizing(true);
    setPageError("");
    try {
      const saved = await persistDraft();
      if (!saved) return;
      if (!saved.review_readiness?.ready_for_finalize) {
        const remaining = saved.review_readiness?.unresolved_questions ?? unresolvedQuestionIndexes.length;
        throw new Error(remaining > 0
          ? `원문·정답 대조가 남은 문항 ${remaining}개를 먼저 확인해 주세요.`
          : "검수 현황의 남은 필수 항목을 확인해 주세요.");
      }
      const finalized = await finalizeProblemReviewReport(saved.id, saved.version);
      setCurrent(finalized);
      setDraft(finalized.draft ?? draft);
      setDirty(false);
      setRecentReports((items) => [finalized, ...items.filter((item) => item.id !== finalized.id)].slice(0, 20));
      feedback.success("현재 버전의 최종 검수를 확정했습니다. 다운로드와 공개가 열렸습니다.");
    } catch (error) {
      const message = errorMessage(error, "최종 검수를 확정하지 못했습니다.");
      setPageError(message);
      feedback.error(message);
    } finally {
      setFinalizing(false);
    }
  }

  async function handleExport(outputFormat: "pdf" | "pptx") {
    if (!current || !draft) return;
    if (!isReportFinalized) {
      feedback.warning("전 문항 대조와 최종 검수 확정 뒤 파일을 만들 수 있습니다.");
      return;
    }
    setExporting(outputFormat);
    setExportProgress((value) => ({
      ...value,
      [outputFormat]: { status: "pending", label: "저장된 검수본을 고밀도 리포트로 조판하고 있습니다.", percent: 0 },
    }));
    setPageError("");
    try {
      const saved = await persistDraft();
      if (!saved) {
        setExportProgress((value) => ({ ...value, [outputFormat]: { status: "failed", label: "검수본 저장 뒤 다시 시도해 주세요." } }));
        return;
      }
      const exportArtifact = await createProblemReviewExport(saved.id, outputFormat);
      if (exportArtifact.status === "ready" && exportArtifact.download_url) {
        downloadPresignedUrl(exportArtifact.download_url, exportArtifact.filename);
        setExportProgress((value) => ({ ...value, [outputFormat]: { status: "ready", label: exportArtifact.filename, artifact: exportArtifact } }));
        setCurrent((value) => value ? { ...value, artifacts: [exportArtifact, ...(value.artifacts ?? []).filter((item) => item.id !== exportArtifact.id)] } : value);
        feedback.success(`${outputFormat.toUpperCase()} 파일을 준비했습니다.`);
        return;
      }
      const startedAt = Date.now();
      while (Date.now() - startedAt < EXPORT_TIMEOUT_MS) {
        const status = await getProblemReviewExport(saved.id, exportArtifact.id || exportArtifact.job_id);
        setExportProgress((value) => ({
          ...value,
          [outputFormat]: {
            status: "pending",
            label: status.progress?.step_name_display || "파일을 생성하고 있습니다.",
            percent: status.progress?.percent,
          },
        }));
        if (["ready", "DONE"].includes(status.status) && status.result?.download_url) {
          downloadPresignedUrl(status.result.download_url, status.result.filename);
          setExportProgress((value) => ({ ...value, [outputFormat]: { status: "ready", label: status.result!.filename, artifact: status.result! } }));
          setCurrent((value) => value ? { ...value, artifacts: [status.result!, ...(value.artifacts ?? []).filter((item) => item.id !== status.result!.id)] } : value);
          feedback.success(`${outputFormat.toUpperCase()} 파일을 준비했습니다.`);
          return;
        }
        if (["failed", "FAILED", "DEAD", "CANCELLED"].includes(status.status)) {
          throw new Error(status.error_message || "다운로드 파일 생성에 실패했습니다.");
        }
        await sleep(POLL_INTERVAL_MS);
      }
      throw new Error("파일 생성이 예상보다 오래 걸립니다. 잠시 뒤 다시 시도해 주세요.");
    } catch (error) {
      const message = errorMessage(error, "다운로드 파일을 만들지 못했습니다.");
      setExportProgress((value) => ({ ...value, [outputFormat]: { status: "failed", label: message } }));
      setPageError(message);
      feedback.error(message);
    } finally {
      setExporting(null);
    }
  }

  async function downloadArtifact(artifact: ProblemReviewArtifact) {
    if (!current) return;
    try {
      const status = await getProblemReviewExport(current.id, artifact.id);
      if (!status.result?.download_url) throw new Error(status.error_message || "이전 산출물의 다운로드 주소를 만들지 못했습니다.");
      downloadPresignedUrl(status.result.download_url, status.result.filename);
    } catch (error) {
      const message = errorMessage(error, "이전 산출물을 내려받지 못했습니다.");
      setPageError(message);
      feedback.error(message);
    }
  }

  async function handlePublish() {
    if (!current || !draft) return;
    if (!isReportFinalized) {
      feedback.warning("전 문항 대조와 최종 검수 확정 뒤 홈페이지에 공개할 수 있습니다.");
      return;
    }
    const confirmed = window.confirm(
      "현재 선생님 검수본을 홈페이지에 공개할까요? 기존 공개본이 있으면 이 내용으로 갱신됩니다.",
    );
    if (!confirmed) return;
    setPublishing(true);
    setPageError("");
    try {
      const saved = await persistDraft();
      if (!saved) return;
      const publication = await publishProblemReviewReport(saved.id, saved.version);
      setPublicationUrl(publication.public_url);
      feedback.success("홈페이지에 시험 분석 공개본을 게시했습니다.");
    } catch (error) {
      const message = errorMessage(error, "홈페이지 공개본을 게시하지 못했습니다.");
      setPageError(message);
      feedback.error(message);
    } finally {
      setPublishing(false);
    }
  }

  function updateMetadata<K extends keyof ProblemReviewMetadata>(key: K, value: ProblemReviewMetadata[K]) {
    if (!draft) return;
    markDraft({ ...draft, metadata: { ...draft.metadata, [key]: value } });
  }

  function updateQuestion(index: number, key: keyof ProblemReviewDraft["questions"][number], value: string | number) {
    if (!draft) return;
    const questions = draft.questions.map((question, questionIndex) => (
      questionIndex === index
        ? { ...question, [key]: value, ...(key === "review_status" ? {} : { review_status: "unverified" as const }) }
        : question
    ));
    markDraft({ ...draft, questions, summary: { ...draft.summary, total_questions: questions.length } });
  }

  function confirmQuestion(index: number) {
    if (!draft) return;
    const question = draft.questions[index];
    const missing = questionIssues(question, false);
    if (missing.length) {
      feedback.warning(`확인 전 입력해 주세요: ${missing.join(", ")}`);
      return;
    }
    updateQuestion(index, "review_status", "verified");
    const nextIndex = draft.questions.findIndex((item, itemIndex) => itemIndex > index && questionIssues(item).length > 0);
    if (nextIndex >= 0) setActiveQuestionIndex(nextIndex);
  }

  function addQuestion() {
    if (!draft || draft.questions.length >= 80) return;
    const number = Math.max(0, ...draft.questions.map((item) => item.number)) + 1;
    markDraft({
      ...draft,
      questions: [...draft.questions, {
        number,
        source_number: 0,
        unit: "",
        answer: "",
        points: "",
        difficulty: "검수 필요",
        thinking_action: "검수 필요",
        key_point: "",
        trap: "",
        validity: "",
        review_note: "",
        source_excerpt: "",
        confidence: "low",
        review_status: "unverified",
      }],
      summary: { ...draft.summary, total_questions: draft.questions.length + 1 },
    });
  }

  function removeQuestion(index: number) {
    if (!draft) return;
    const questions = draft.questions.filter((_, questionIndex) => questionIndex !== index);
    markDraft({ ...draft, questions, summary: { ...draft.summary, total_questions: questions.length } });
  }

  if (current) {
    return (
      <section className={styles.page} aria-label="문제 리뷰 리포트 편집기">
        <div className={styles.workspaceBar}>
          <div className={styles.workspaceIdentity}>
            <button type="button" className={styles.backButton} onClick={resetWorkspace} aria-label="리포트 목록으로 돌아가기">
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className={styles.eyebrow}>PROBLEM REVIEW WORKSPACE</div>
              <h1>{problemReviewReportLabel(current)}</h1>
            </div>
          </div>
          <div className={styles.workspaceActions}>
            <ProblemReviewStatusBadge report={current} />
            {draft && (
              <>
                <Button intent="secondary" size="sm" loading={saving} leftIcon={<Save size={ICON_FOR_BUTTON.sm} />} onClick={() => void persistDraft()}>
                  {dirty ? "변경 저장" : "저장됨"}
                </Button>
                <Button intent={isReportFinalized ? "secondary" : "primary"} size="sm" loading={finalizing} leftIcon={<CircleCheckBig size={ICON_FOR_BUTTON.sm} />} onClick={() => void handleFinalize()} disabled={isReportFinalized}>
                  {isReportFinalized ? "확정됨" : "최종 검수 확정"}
                </Button>
                <Button intent="secondary" size="sm" loading={publishing} leftIcon={<Globe2 size={ICON_FOR_BUTTON.sm} />} onClick={() => void handlePublish()} disabled={!isReportFinalized}>
                  홈페이지 공개
                </Button>
                <Button intent="ghost" size="sm" leftIcon={<Eye size={ICON_FOR_BUTTON.sm} />} onClick={() => setPreviewOpen(true)} className={styles.previewToggle}>
                  미리보기
                </Button>
                {publicationUrl ? (
                  <Button intent="ghost" size="sm" onClick={() => window.open(publicationUrl, "_blank", "noopener,noreferrer")}>
                    공개본 보기
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </div>

        {pageError && <div className={styles.errorBanner} role="alert"><AlertTriangle size={18} />{pageError}</div>}

        {current.status === "analyzing" || starting ? (
          <div className={styles.analysisState}>
            <div className={styles.analysisOrb}><Sparkles size={30} /></div>
            <div className={styles.analysisKicker}>리포트 초안 구성 중</div>
            <h2>{analysisMessage}</h2>
            <p>원문을 바꾸지 않고 문항별 근거를 정리합니다. 결과는 선생님 검수 전 초안으로만 저장됩니다.</p>
            <div className={styles.progressTrack}><span /></div>
          </div>
        ) : current.status === "failed" ? (
          <div className={styles.analysisState}>
            <AlertTriangle size={34} />
            <h2>분석을 마치지 못했습니다.</h2>
            <p>{current.last_error || "원본 파일을 확인한 뒤 새 리포트로 다시 시도해 주세요."}</p>
            <Button intent="primary" leftIcon={<RefreshCw size={ICON_FOR_BUTTON.md} />} onClick={resetWorkspace}>새 리포트 만들기</Button>
          </div>
        ) : draft ? (
          <div className={styles.editorShell}>
            <div className={styles.editorPane}>
              <div className={styles.reviewNotice}>
                <ShieldCheck size={20} />
                <div><strong>AI가 만든 검수 초안입니다.</strong><span>정답·배점·난이도와 표현을 선생님이 확인한 뒤 내려받아 주세요.</span></div>
              </div>

              {readiness ? (
                <div className={styles.readinessPanel} data-finalized={isReportFinalized}>
                  {/* eslint-disable-next-line no-restricted-syntax -- 서버 검수 진행률은 리포트마다 달라 동적 원형 게이지로 표시한다. */}
                  <div className={styles.readinessScore} style={{ background: `conic-gradient(#d91e3f ${readiness.progress_percent}%, #e9edf3 0)` }}><strong>{readiness.progress_percent}</strong><span>%</span></div>
                  <div className={styles.readinessCopy}>
                    <strong>{isReportFinalized ? "현재 버전은 최종 검수 완료" : "선생님 최종 검수 현황"}</strong>
                    <p>{isReportFinalized
                      ? `${readiness.finalized_at ? new Date(readiness.finalized_at).toLocaleString("ko-KR") : ""} 확정 · 수정하면 자동으로 다시 잠깁니다.`
                      : `원문과 정답을 대조한 문항 ${readiness.verified_questions}/${readiness.total_questions} · 미검수 ${readiness.unresolved_questions}문항`}</p>
                    <div>{readiness.sections.map((item) => <span data-ready={item.ready} key={item.key}>{item.ready ? "✓" : "·"} {item.label}</span>)}</div>
                  </div>
                </div>
              ) : null}
              <section className={styles.exportStudio} aria-label="PDF와 PPTX 내보내기">
                <div className={styles.exportHeading}>
                  <div>
                    <span>EXAM SPECTRUM EXPORT</span>
                    <h2>{isReportFinalized ? "확정된 검수본을 내려받으세요" : "최종 검수 확정 뒤 다운로드가 열립니다"}</h2>
                    <p>{isReportFinalized
                      ? "PDF와 PPTX는 같은 검수 버전과 fingerprint를 사용합니다."
                      : "미검수 상태의 내용은 파일이나 홈페이지에 나가지 않습니다."}</p>
                  </div>
                  <Badge tone="neutral">현재 v{current.version}</Badge>
                </div>
                <div className={styles.exportActions}>
                  {(["pdf", "pptx"] as const).map((format) => {
                    const progress = exportProgress[format];
                    const isPdf = format === "pdf";
                    return (
                      <div className={styles.exportAction} key={format} data-status={progress.status}>
                        <div className={styles.exportIcon}>{isPdf ? <FileText size={22} /> : <Presentation size={22} />}</div>
                        <div className={styles.exportCopy}>
                          <strong>{isPdf ? "PDF 다운로드" : "PPTX 다운로드"}</strong>
                          <span>{progress.label}</span>
                          {progress.status === "pending" && <progress className={styles.exportProgress} value={Math.max(8, progress.percent ?? 18)} max={100} aria-label={`${format.toUpperCase()} 생성 진행률`} />}
                        </div>
                        <Button
                          intent={isPdf ? "secondary" : "primary"}
                          size="sm"
                          loading={exporting === format}
                          disabled={!isReportFinalized}
                          leftIcon={progress.status === "failed" ? <RotateCcw size={ICON_FOR_BUTTON.sm} /> : <Download size={ICON_FOR_BUTTON.sm} />}
                          onClick={() => void handleExport(format)}
                        >
                          {progress.status === "failed" ? "다시 생성" : "생성·받기"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
                {(current.artifacts ?? []).length > 0 && (
                  <div className={styles.artifactHistory}>
                    <div className={styles.artifactTitle}><strong>이전 산출물</strong><span>파일명·검수 버전·snapshot을 확인하고 다시 받을 수 있습니다.</span></div>
                    {(current.artifacts ?? []).slice(0, 8).map((artifact) => (
                      <div className={styles.artifactRow} key={artifact.id}>
                        <Badge tone={artifact.status === "ready" ? "success" : artifact.status === "failed" ? "danger" : "info"}>{artifact.output_format.toUpperCase()}</Badge>
                        <span className={styles.artifactInfo}>
                          <strong>{artifact.filename || `${artifact.output_format.toUpperCase()} 생성 중`}</strong>
                          <small>v{artifact.report_version} · {artifact.source_fingerprint.slice(0, 8)} · {artifact.size_bytes ? problemReviewFileSize(artifact.size_bytes) : new Date(artifact.created_at).toLocaleString("ko-KR")}</small>
                        </span>
                        {artifact.status === "ready" && artifact.verified ? <Button intent="ghost" size="sm" onClick={() => void downloadArtifact(artifact)}>다시 받기</Button> : <span className={styles.artifactState}>{artifact.status === "ready" ? "검수 증표 없음" : artifact.status === "failed" ? "실패" : "생성 중"}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <details className={styles.editorSection} open>
                <summary><span><FileText size={18} />기본 정보와 총평</span><ChevronRight size={17} /></summary>
                <div className={styles.sectionBody}>
                  <div className={styles.fieldGrid}>
                    <label className={styles.wideField}>리포트 목적<select value={draft.metadata.report_purpose} onChange={(event) => updateMetadata("report_purpose", event.target.value as ProblemReviewMetadata["report_purpose"])}><option value="teacher_review">내 문제 검수</option><option value="exam_analysis">학교 시험 분석·홍보</option></select></label>
                    <label className={styles.wideField}>리포트 제목<input value={draft.metadata.title} onChange={(event) => updateMetadata("title", event.target.value)} /></label>
                    <label>학교<input value={draft.metadata.school} onChange={(event) => updateMetadata("school", event.target.value)} /></label>
                    <label>과목<input value={draft.metadata.subject} onChange={(event) => updateMetadata("subject", event.target.value)} /></label>
                    <label>학년<input value={draft.metadata.grade} onChange={(event) => updateMetadata("grade", event.target.value)} /></label>
                    <label>시험명<input value={draft.metadata.exam_name} onChange={(event) => updateMetadata("exam_name", event.target.value)} /></label>
                    <label>시험일<input type="date" value={draft.metadata.exam_date} onChange={(event) => updateMetadata("exam_date", event.target.value)} /></label>
                    <label>총점<input value={draft.summary.total_points} onChange={(event) => markDraft({ ...draft, summary: { ...draft.summary, total_points: event.target.value } })} /></label>
                  </div>
                  <label>시험 한 줄 평<input value={draft.summary.one_line} onChange={(event) => markDraft({ ...draft, summary: { ...draft.summary, one_line: event.target.value } })} /></label>
                  <label>시험 성격<textarea rows={4} value={draft.summary.character} onChange={(event) => markDraft({ ...draft, summary: { ...draft.summary, character: event.target.value } })} /></label>
                  <label>학생 체감 부담<textarea rows={3} value={draft.summary.student_burden} onChange={(event) => markDraft({ ...draft, summary: { ...draft.summary, student_burden: event.target.value } })} /></label>
                </div>
              </details>

              <details className={styles.editorSection} open>
                <summary><span><Layers3 size={18} />출제 기조</span><ChevronRight size={17} /></summary>
                <div className={styles.sectionBody}>
                  {draft.assessment_axes.map((axis, index) => (
                    <div className={styles.inlineCard} key={`axis-${index}`}>
                      <div className={styles.indexBadge}>{String(index + 1).padStart(2, "0")}</div>
                      <div className={styles.inlineFields}>
                        <input aria-label={`출제 기조 ${index + 1} 제목`} value={axis.title} onChange={(event) => {
                          const assessmentAxes = draft.assessment_axes.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item);
                          markDraft({ ...draft, assessment_axes: assessmentAxes });
                        }} />
                        <textarea aria-label={`출제 기조 ${index + 1} 설명`} rows={2} value={axis.description} onChange={(event) => {
                          const assessmentAxes = draft.assessment_axes.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item);
                          markDraft({ ...draft, assessment_axes: assessmentAxes });
                        }} />
                      </div>
                    </div>
                  ))}
                  <Button intent="ghost" size="sm" leftIcon={<Plus size={ICON_FOR_BUTTON.sm} />} onClick={() => markDraft({ ...draft, assessment_axes: [...draft.assessment_axes, { title: "", description: "" }].slice(0, 6) })}>기조 추가</Button>
                </div>
              </details>

              <details className={styles.editorSection}>
                <summary><span><BarChart3 size={18} />영역·난이도와 설명 문구</span><ChevronRight size={17} /></summary>
                <div className={styles.sectionBody}>
                  {draft.domains.map((domain, index) => (
                    <div className={styles.keyItemEditor} key={`domain-${index}`}>
                      <div className={styles.keyRank}>DOMAIN {String(index + 1).padStart(2, "0")}</div>
                      <div className={styles.twoFields}>
                        <label>영역명<input value={domain.name} onChange={(event) => {
                          const domains = draft.domains.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item);
                          markDraft({ ...draft, domains });
                        }} /></label>
                        <label>문항 번호 <span className={styles.labelHint}>쉼표로 구분</span><input value={domain.question_numbers.join(", ")} onChange={(event) => {
                          const questionNumbers = event.target.value.split(",").map((value) => value.trim()).filter(Boolean);
                          const domains = draft.domains.map((item, itemIndex) => itemIndex === index ? { ...item, question_numbers: questionNumbers } : item);
                          markDraft({ ...draft, domains });
                        }} /></label>
                        <label>배점<input value={domain.points} onChange={(event) => {
                          const domains = draft.domains.map((item, itemIndex) => itemIndex === index ? { ...item, points: event.target.value } : item);
                          markDraft({ ...draft, domains });
                        }} /></label>
                        <label>비중<input value={domain.ratio} onChange={(event) => {
                          const domains = draft.domains.map((item, itemIndex) => itemIndex === index ? { ...item, ratio: event.target.value } : item);
                          markDraft({ ...draft, domains });
                        }} /></label>
                      </div>
                      <label>영역 해석<textarea rows={2} value={domain.insight} onChange={(event) => {
                        const domains = draft.domains.map((item, itemIndex) => itemIndex === index ? { ...item, insight: event.target.value } : item);
                        markDraft({ ...draft, domains });
                      }} /></label>
                    </div>
                  ))}
                  <Button intent="ghost" size="sm" leftIcon={<Plus size={ICON_FOR_BUTTON.sm} />} onClick={() => markDraft({ ...draft, domains: [...draft.domains, { name: "", question_numbers: [], points: "", ratio: "", insight: "" }].slice(0, 12) })}>영역 추가</Button>
                  <label>난이도·등급 해석 주의<textarea rows={3} value={draft.difficulty.grade_estimate_note} onChange={(event) => markDraft({ ...draft, difficulty: { ...draft.difficulty, grade_estimate_note: event.target.value } })} /></label>
                  <div className={styles.twoFields}>
                    <label>학부모에게 피할 표현 <span className={styles.labelHint}>줄바꿈으로 구분</span><textarea rows={4} value={draft.parent_guidance.avoid.join("\n")} onChange={(event) => markDraft({ ...draft, parent_guidance: { ...draft.parent_guidance, avoid: event.target.value.split("\n") } })} /></label>
                    <label>권장 설명 문구 <span className={styles.labelHint}>줄바꿈으로 구분</span><textarea rows={4} value={draft.parent_guidance.recommended.join("\n")} onChange={(event) => markDraft({ ...draft, parent_guidance: { ...draft.parent_guidance, recommended: event.target.value.split("\n") } })} /></label>
                  </div>
                  {draft.failure_patterns.map((pattern, index) => (
                    <div className={styles.patternEditor} key={`failure-${index}`}>
                      <div className={styles.indexBadge}>{String(index + 1).padStart(2, "0")}</div>
                      <div className={styles.inlineFields}>
                        <label>패턴 제목<input aria-label={`실패 패턴 ${index + 1} 제목`} value={pattern.title} onChange={(event) => {
                          const failurePatterns = draft.failure_patterns.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item);
                          markDraft({ ...draft, failure_patterns: failurePatterns });
                        }} /></label>
                        <div className={styles.twoFields}>
                          <label>보이는 증상<textarea aria-label={`실패 패턴 ${index + 1} 증상`} rows={2} value={pattern.symptom} onChange={(event) => {
                            const failurePatterns = draft.failure_patterns.map((item, itemIndex) => itemIndex === index ? { ...item, symptom: event.target.value } : item);
                            markDraft({ ...draft, failure_patterns: failurePatterns });
                          }} /></label>
                          <label>학습 원인<textarea aria-label={`실패 패턴 ${index + 1} 원인`} rows={2} value={pattern.cause} onChange={(event) => {
                            const failurePatterns = draft.failure_patterns.map((item, itemIndex) => itemIndex === index ? { ...item, cause: event.target.value } : item);
                            markDraft({ ...draft, failure_patterns: failurePatterns });
                          }} /></label>
                        </div>
                        <label>수업 처방<textarea aria-label={`실패 패턴 ${index + 1} 처방`} rows={2} value={pattern.prescription} onChange={(event) => {
                          const failurePatterns = draft.failure_patterns.map((item, itemIndex) => itemIndex === index ? { ...item, prescription: event.target.value } : item);
                          markDraft({ ...draft, failure_patterns: failurePatterns });
                        }} /></label>
                      </div>
                      <button type="button" onClick={() => markDraft({ ...draft, failure_patterns: draft.failure_patterns.filter((_, itemIndex) => itemIndex !== index) })} aria-label={`실패 패턴 ${index + 1} 삭제`}><Trash2 size={15} /></button>
                    </div>
                  ))}
                  <Button
                    intent="ghost"
                    size="sm"
                    leftIcon={<Plus size={ICON_FOR_BUTTON.sm} />}
                    disabled={draft.failure_patterns.length >= 4}
                    onClick={() => markDraft({
                      ...draft,
                      failure_patterns: [
                        ...draft.failure_patterns,
                        { title: "", symptom: "", cause: "", prescription: "" },
                      ].slice(0, 4),
                    })}
                  >오류 패턴 추가</Button>
                </div>
              </details>

              <details className={styles.editorSection} open>
                <summary><span><ListChecks size={18} />문항별 원문·정답 대조 <em>{draft.questions.length}</em></span><ChevronRight size={17} /></summary>
                <div className={styles.sectionBody}>
                  <div className={styles.questionReviewToolbar}>
                    <div className={styles.questionFilter} role="group" aria-label="문항 검수 필터">
                      <button type="button" data-active={questionFilter === "unresolved"} onClick={() => setQuestionFilter("unresolved")}>미검수 {unresolvedQuestionIndexes.length}</button>
                      <button type="button" data-active={questionFilter === "all"} onClick={() => setQuestionFilter("all")}>전체 {draft.questions.length}</button>
                    </div>
                    <p>한 문항씩 원문, 정답, 분석 내용을 확인하세요. 확정 뒤 내용을 고치면 해당 문항은 자동으로 미검수로 돌아갑니다.</p>
                  </div>
                  {visibleQuestionIndexes.length > 0 ? (
                    <>
                      <nav className={styles.questionRail} aria-label="검수할 문항 선택">
                        {visibleQuestionIndexes.map((index) => {
                          const question = draft.questions[index];
                          return (
                            <button
                              type="button"
                              key={`${question.source_number}-${index}`}
                              data-active={index === selectedQuestionIndex}
                              data-ready={questionIssues(question).length === 0}
                              onClick={() => setActiveQuestionIndex(index)}
                              aria-label={`${question.number}번 ${question.review_status === "verified" ? "검수 완료" : "미검수"}`}
                            >{question.number}</button>
                          );
                        })}
                      </nav>
                      {(() => {
                        const question = draft.questions[selectedQuestionIndex];
                        const missing = questionIssues(question, false);
                        const position = visibleQuestionIndexes.indexOf(selectedQuestionIndex);
                        return (
                      <article className={styles.questionCard} key={`${question.number}-${selectedQuestionIndex}`} data-verified={question.review_status === "verified"}>
                        <div className={styles.questionStatusLine}>
                          <span>{question.review_status === "verified" ? <CircleCheckBig size={17} /> : <AlertTriangle size={17} />}{question.review_status === "verified" ? "원문·정답 대조 완료" : "선생님 확인 필요"}</span>
                          <small>{position + 1}/{visibleQuestionIndexes.length}</small>
                        </div>
                        <header>
                          <label>문항<input type="number" min={1} max={999} value={question.number} onChange={(event) => updateQuestion(selectedQuestionIndex, "number", Number(event.target.value))} /></label>
                          <label>단원<input value={question.unit} onChange={(event) => updateQuestion(selectedQuestionIndex, "unit", event.target.value)} /></label>
                          <label>배점<input value={question.points} onChange={(event) => updateQuestion(selectedQuestionIndex, "points", event.target.value)} /></label>
                          <label>사고행동<select value={question.thinking_action} onChange={(event) => updateQuestion(selectedQuestionIndex, "thinking_action", event.target.value as ProblemReviewThinkingAction)}>{THINKING_ACTIONS.map((action) => <option key={action}>{action}</option>)}</select></label>
                          <label>난이도<select value={question.difficulty} onChange={(event) => updateQuestion(selectedQuestionIndex, "difficulty", event.target.value as ProblemReviewDifficulty)}>{DIFFICULTIES.map((difficulty) => <option key={difficulty}>{difficulty}</option>)}</select></label>
                          <button type="button" onClick={() => removeQuestion(selectedQuestionIndex)} aria-label={`${question.number}번 문항 삭제`}><Trash2 size={16} /></button>
                        </header>
                        {question.source_excerpt && <details className={styles.sourceExcerpt}><summary>OCR 원문 발췌 펼치기</summary><p>{question.source_excerpt}</p><small>OCR은 틀릴 수 있습니다. 업로드한 원본 시험지와 직접 대조해 주세요.</small></details>}
                        <label>핵심 포인트<textarea rows={2} value={question.key_point} onChange={(event) => updateQuestion(selectedQuestionIndex, "key_point", event.target.value)} /></label>
                        <div className={styles.twoFields}>
                          <label>학생이 빠질 함정<textarea rows={2} value={question.trap} onChange={(event) => updateQuestion(selectedQuestionIndex, "trap", event.target.value)} /></label>
                          <label>출제 검토 메모 <span className={styles.labelHint}>선택</span><textarea rows={2} value={question.review_note} onChange={(event) => updateQuestion(selectedQuestionIndex, "review_note", event.target.value)} /></label>
                        </div>
                        <div className={styles.twoFields}>
                          <label>정답·정답 예시<input value={question.answer} onChange={(event) => updateQuestion(selectedQuestionIndex, "answer", event.target.value)} /></label>
                          <label>문항 타당성·모호성 메모<input value={question.validity} onChange={(event) => updateQuestion(selectedQuestionIndex, "validity", event.target.value)} /></label>
                        </div>
                        <div className={styles.questionApproval}>
                          <div>{missing.length ? <><strong>확인 전 남은 입력</strong><span>{missing.join(" · ")}</span></> : <><strong>원문과 정답을 직접 대조했나요?</strong><span>이 확인은 AI가 대신 처리하지 않습니다.</span></>}</div>
                          <Button intent={question.review_status === "verified" ? "secondary" : "primary"} size="sm" leftIcon={question.review_status === "verified" ? <CircleCheckBig size={ICON_FOR_BUTTON.sm} /> : <ShieldCheck size={ICON_FOR_BUTTON.sm} />} disabled={missing.length > 0 || question.review_status === "verified"} onClick={() => confirmQuestion(selectedQuestionIndex)}>{question.review_status === "verified" ? "대조 완료" : "대조 완료로 표시"}</Button>
                        </div>
                        <div className={styles.questionPager}>
                          <Button intent="ghost" size="sm" leftIcon={<ChevronLeft size={ICON_FOR_BUTTON.sm} />} disabled={position <= 0} onClick={() => setActiveQuestionIndex(visibleQuestionIndexes[position - 1])}>이전</Button>
                          <Button intent="ghost" size="sm" disabled={position >= visibleQuestionIndexes.length - 1} onClick={() => setActiveQuestionIndex(visibleQuestionIndexes[position + 1])}>다음</Button>
                        </div>
                      </article>
                        );
                      })()}
                    </>
                  ) : (
                    <div className={styles.questionComplete}><CircleCheckBig size={28} /><strong>모든 문항 대조를 마쳤습니다.</strong><span>검수 현황의 나머지 항목을 확인한 뒤 최종 검수를 확정하세요.</span></div>
                  )}
                  <Button intent="secondary" size="sm" leftIcon={<Plus size={ICON_FOR_BUTTON.sm} />} onClick={addQuestion}>문항 추가</Button>
                </div>
              </details>

              <details className={styles.editorSection} open>
                <summary><span><Sparkles size={18} />핵심 변별과 결론</span><ChevronRight size={17} /></summary>
                <div className={styles.sectionBody}>
                  {draft.key_items.map((item, index) => (
                    <div className={styles.keyItemEditor} key={`key-${index}`}>
                      <div className={styles.keyEditorHeader}><div className={styles.keyRank}>#{item.rank || index + 1}</div><button type="button" onClick={() => markDraft({ ...draft, key_items: draft.key_items.filter((_, itemIndex) => itemIndex !== index) })} aria-label={`핵심 변별 ${index + 1} 삭제`}><Trash2 size={15} /></button></div>
                      <label>제목<input value={item.title} onChange={(event) => {
                        const keyItems = draft.key_items.map((entry, entryIndex) => entryIndex === index ? { ...entry, title: event.target.value } : entry);
                        markDraft({ ...draft, key_items: keyItems });
                      }} /></label>
                      <label>문항 번호 <span className={styles.labelHint}>쉼표로 구분</span><input value={item.question_numbers.join(", ")} onChange={(event) => {
                        const questionNumbers = event.target.value.split(",").map((value) => value.trim()).filter(Boolean);
                        const keyItems = draft.key_items.map((entry, entryIndex) => entryIndex === index ? { ...entry, question_numbers: questionNumbers } : entry);
                        markDraft({ ...draft, key_items: keyItems });
                      }} /></label>
                      <label>왜 어려운가<textarea rows={2} value={item.reason} onChange={(event) => {
                        const keyItems = draft.key_items.map((entry, entryIndex) => entryIndex === index ? { ...entry, reason: event.target.value } : entry);
                        markDraft({ ...draft, key_items: keyItems });
                      }} /></label>
                      <label>막히는 지점<textarea rows={2} value={item.collapse_point} onChange={(event) => {
                        const keyItems = draft.key_items.map((entry, entryIndex) => entryIndex === index ? { ...entry, collapse_point: event.target.value } : entry);
                        markDraft({ ...draft, key_items: keyItems });
                      }} /></label>
                      <label>다음 시험 처방<textarea rows={2} value={item.prescription} onChange={(event) => {
                        const keyItems = draft.key_items.map((entry, entryIndex) => entryIndex === index ? { ...entry, prescription: event.target.value } : entry);
                        markDraft({ ...draft, key_items: keyItems });
                      }} /></label>
                      <label>X-ray 근거<textarea rows={3} value={item.evidence} onChange={(event) => {
                        const keyItems = draft.key_items.map((entry, entryIndex) => entryIndex === index ? { ...entry, evidence: event.target.value } : entry);
                        markDraft({ ...draft, key_items: keyItems });
                      }} /></label>
                      <label>무너지는 분기 3개 <span className={styles.labelHint}>줄바꿈으로 구분</span><textarea rows={4} value={item.collapse_branches.join("\n")} onChange={(event) => {
                        const keyItems = draft.key_items.map((entry, entryIndex) => entryIndex === index ? { ...entry, collapse_branches: event.target.value.split("\n").filter(Boolean).slice(0, 3) } : entry);
                        markDraft({ ...draft, key_items: keyItems });
                      }} /></label>
                      <label>복구 4단계 <span className={styles.labelHint}>줄바꿈으로 구분</span><textarea rows={5} value={item.recovery_steps.join("\n")} onChange={(event) => {
                        const keyItems = draft.key_items.map((entry, entryIndex) => entryIndex === index ? { ...entry, recovery_steps: event.target.value.split("\n").filter(Boolean).slice(0, 4) } : entry);
                        markDraft({ ...draft, key_items: keyItems });
                      }} /></label>
                      <label>학습 신호<textarea rows={2} value={item.learning_point} onChange={(event) => {
                        const keyItems = draft.key_items.map((entry, entryIndex) => entryIndex === index ? { ...entry, learning_point: event.target.value } : entry);
                        markDraft({ ...draft, key_items: keyItems });
                      }} /></label>
                    </div>
                  ))}
                  <Button
                    intent="ghost"
                    size="sm"
                    leftIcon={<Plus size={ICON_FOR_BUTTON.sm} />}
                    disabled={draft.key_items.length >= 8}
                    onClick={() => markDraft({
                      ...draft,
                      key_items: [
                        ...draft.key_items,
                        {
                          rank: draft.key_items.length + 1,
                          title: "",
                          question_numbers: [],
                          reason: "",
                          collapse_point: "",
                          prescription: "",
                          evidence: "",
                          collapse_branches: [],
                          recovery_steps: [],
                          learning_point: "",
                        },
                      ].slice(0, 8),
                    })}
                  >핵심 변별 / X-ray 추가</Button>
                  <div className={styles.protocolEditor}>
                    <div className={styles.keyRank}>RECOVERY PROTOCOL</div>
                    <div className={styles.threeFields}>
                      <label>72시간 안 <span className={styles.labelHint}>줄바꿈으로 구분</span><textarea rows={5} value={draft.recovery_protocol.within_72_hours.join("\n")} onChange={(event) => markDraft({ ...draft, recovery_protocol: { ...draft.recovery_protocol, within_72_hours: event.target.value.split("\n").filter(Boolean) } })} /></label>
                      <label>2주 안 <span className={styles.labelHint}>줄바꿈으로 구분</span><textarea rows={5} value={draft.recovery_protocol.within_two_weeks.join("\n")} onChange={(event) => markDraft({ ...draft, recovery_protocol: { ...draft.recovery_protocol, within_two_weeks: event.target.value.split("\n").filter(Boolean) } })} /></label>
                      <label>다음 시험 <span className={styles.labelHint}>줄바꿈으로 구분</span><textarea rows={5} value={draft.recovery_protocol.next_exam.join("\n")} onChange={(event) => markDraft({ ...draft, recovery_protocol: { ...draft.recovery_protocol, next_exam: event.target.value.split("\n").filter(Boolean) } })} /></label>
                    </div>
                    <div className={styles.keyRank}>ACHIEVEMENT SIGNALS</div>
                    {draft.achievement_bands.map((band, index) => (
                      <div className={styles.inlineCard} key={`achievement-${index}`}>
                        <div className={styles.indexBadge}>{String(index + 1).padStart(2, "0")}</div>
                        <div className={styles.inlineFields}>
                          <input aria-label={`성취 구간 ${index + 1} 이름`} value={band.label} onChange={(event) => {
                            const achievementBands = draft.achievement_bands.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item);
                            markDraft({ ...draft, achievement_bands: achievementBands });
                          }} />
                          <textarea aria-label={`성취 구간 ${index + 1} 확인 신호`} rows={2} value={band.signal} onChange={(event) => {
                            const achievementBands = draft.achievement_bands.map((item, itemIndex) => itemIndex === index ? { ...item, signal: event.target.value } : item);
                            markDraft({ ...draft, achievement_bands: achievementBands });
                          }} />
                          <textarea aria-label={`성취 구간 ${index + 1} 처방`} rows={2} value={band.prescription} onChange={(event) => {
                            const achievementBands = draft.achievement_bands.map((item, itemIndex) => itemIndex === index ? { ...item, prescription: event.target.value } : item);
                            markDraft({ ...draft, achievement_bands: achievementBands });
                          }} />
                        </div>
                      </div>
                    ))}
                    <Button
                      intent="ghost"
                      size="sm"
                      leftIcon={<Plus size={ICON_FOR_BUTTON.sm} />}
                      disabled={draft.achievement_bands.length >= 3}
                      onClick={() => markDraft({
                        ...draft,
                        achievement_bands: [
                          ...draft.achievement_bands,
                          { label: "", signal: "", prescription: "" },
                        ].slice(0, 3),
                      })}
                    >성취 구간 추가</Button>
                  </div>
                  <label>최종 결론<input value={draft.conclusion.headline} onChange={(event) => markDraft({ ...draft, conclusion: { ...draft.conclusion, headline: event.target.value } })} /></label>
                  <label>다음 시험까지 할 일 <span className={styles.labelHint}>줄바꿈으로 구분</span><textarea rows={4} value={draft.conclusion.actions.join("\n")} onChange={(event) => markDraft({ ...draft, conclusion: { ...draft.conclusion, actions: event.target.value.split("\n") } })} /></label>
                </div>
              </details>
            </div>

            <ProblemReviewPreview draft={draft} version={current.version} dirty={dirty} open={previewOpen} onClose={() => setPreviewOpen(false)} />
          </div>
        ) : null}
      </section>
    );
  }

  return <ProblemReviewStartView
    pageError={pageError}
    sourceFiles={sourceFiles}
    onRemoveSourceFile={(index) => setSourceFiles((items) => items.filter((_, itemIndex) => itemIndex !== index))}
    onDrop={handleDrop}
    onFileInput={handleFileInput}
    metadata={metadata}
    setMetadata={setMetadata}
    aiConfirmed={aiConfirmed}
    setAiConfirmed={setAiConfirmed}
    starting={starting}
    onStart={() => void handleStart()}
    loadingRecent={loadingRecent}
    recentReports={recentReports}
    onOpenReport={(report) => void openReport(report)}
  />;
}
