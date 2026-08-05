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
  Check,
  ChevronRight,
  FileArchive,
  FileText,
  Globe2,
  Layers3,
  Plus,
  Presentation,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Badge, Button, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { downloadPresignedUrl } from "@/shared/utils/safeDownload";
import {
  createProblemReviewExport,
  createProblemReviewReport,
  getProblemReviewExport,
  getProblemReviewReport,
  listProblemReviewReports,
  publishProblemReviewReport,
  saveProblemReviewReport,
  type ProblemReviewDifficulty,
  type ProblemReviewDraft,
  type ProblemReviewMetadata,
  type ProblemReviewReport,
} from "../api/problemReview.api";
import styles from "./ProblemReviewPage.module.css";

const SOURCE_ACCEPT = ".pdf,.hwp,.hwpx,.doc,.docx,.zip,.png,.jpg,.jpeg,.webp,.bmp";
const MAX_SOURCE_FILES = 6;
const ANALYSIS_TIMEOUT_MS = 15 * 60 * 1000;
const EXPORT_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 1600;
const DIFFICULTIES: ProblemReviewDifficulty[] = ["검수 필요", "하", "중", "중상", "상", "최상"];

const EMPTY_METADATA: Partial<ProblemReviewMetadata> = {
  title: "",
  school: "",
  subject: "",
  grade: "",
  exam_name: "",
  exam_date: "",
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

function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function reportLabel(report: ProblemReviewReport): string {
  return report.title || report.source_name || "제목 없는 문제 리뷰";
}

function statusBadge(report: ProblemReviewReport) {
  if (report.status === "draft") return <Badge tone="success">검수 초안</Badge>;
  if (report.status === "failed") return <Badge tone="danger">분석 실패</Badge>;
  return <Badge tone="info">분석 중</Badge>;
}

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
  const [exporting, setExporting] = useState<"pdf" | "pptx" | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publicationUrl, setPublicationUrl] = useState<string | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState("시험지에서 문항과 출제 구조를 읽고 있습니다.");
  const [pageError, setPageError] = useState("");
  const pollToken = useRef(0);

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

  function markDraft(next: ProblemReviewDraft) {
    setDraft(next);
    setDirty(true);
  }

  function selectFiles(files: File[]) {
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

  async function handleExport(outputFormat: "pdf" | "pptx") {
    if (!current || !draft) return;
    setExporting(outputFormat);
    setPageError("");
    try {
      const saved = await persistDraft();
      if (!saved) return;
      const exportJob = await createProblemReviewExport(saved.id, outputFormat);
      const startedAt = Date.now();
      while (Date.now() - startedAt < EXPORT_TIMEOUT_MS) {
        const status = await getProblemReviewExport(saved.id, exportJob.job_id);
        if (status.status === "DONE" && status.result?.download_url) {
          downloadPresignedUrl(status.result.download_url, status.result.filename);
          feedback.success(`${outputFormat.toUpperCase()} 파일을 준비했습니다.`);
          return;
        }
        if (["FAILED", "DEAD", "CANCELLED"].includes(status.status)) {
          throw new Error(status.error_message || "다운로드 파일 생성에 실패했습니다.");
        }
        await sleep(POLL_INTERVAL_MS);
      }
      throw new Error("파일 생성이 예상보다 오래 걸립니다. 잠시 뒤 다시 시도해 주세요.");
    } catch (error) {
      const message = errorMessage(error, "다운로드 파일을 만들지 못했습니다.");
      setPageError(message);
      feedback.error(message);
    } finally {
      setExporting(null);
    }
  }

  async function handlePublish() {
    if (!current || !draft) return;
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

  function updateMetadata(key: keyof ProblemReviewMetadata, value: string) {
    if (!draft) return;
    markDraft({ ...draft, metadata: { ...draft.metadata, [key]: value } });
  }

  function updateQuestion(index: number, key: keyof ProblemReviewDraft["questions"][number], value: string | number) {
    if (!draft) return;
    const questions = draft.questions.map((question, questionIndex) => (
      questionIndex === index ? { ...question, [key]: value } : question
    ));
    markDraft({ ...draft, questions, summary: { ...draft.summary, total_questions: questions.length } });
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
        key_point: "",
        trap: "",
        validity: "",
        review_note: "",
        source_excerpt: "",
        confidence: "low",
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
              <h1>{reportLabel(current)}</h1>
            </div>
          </div>
          <div className={styles.workspaceActions}>
            {statusBadge(current)}
            {draft && (
              <>
                <Button intent="secondary" size="sm" loading={saving} leftIcon={<Save size={ICON_FOR_BUTTON.sm} />} onClick={() => void persistDraft()}>
                  {dirty ? "변경 저장" : "저장됨"}
                </Button>
                <Button intent="secondary" size="sm" loading={publishing} leftIcon={<Globe2 size={ICON_FOR_BUTTON.sm} />} onClick={() => void handlePublish()}>
                  홈페이지 공개
                </Button>
                {publicationUrl ? (
                  <Button intent="ghost" size="sm" onClick={() => window.open(publicationUrl, "_blank", "noopener,noreferrer")}>
                    공개본 보기
                  </Button>
                ) : null}
                <Button intent="secondary" size="sm" loading={exporting === "pdf"} leftIcon={<FileText size={ICON_FOR_BUTTON.sm} />} onClick={() => void handleExport("pdf")}>
                  PDF
                </Button>
                <Button intent="primary" size="sm" loading={exporting === "pptx"} leftIcon={<Presentation size={ICON_FOR_BUTTON.sm} />} onClick={() => void handleExport("pptx")}>
                  PPTX
                </Button>
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

              <details className={styles.editorSection} open>
                <summary><span><FileText size={18} />기본 정보와 총평</span><ChevronRight size={17} /></summary>
                <div className={styles.sectionBody}>
                  <div className={styles.fieldGrid}>
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
                    <div className={styles.inlineCard} key={`failure-${index}`}>
                      <div className={styles.indexBadge}>{String(index + 1).padStart(2, "0")}</div>
                      <div className={styles.inlineFields}>
                        <input aria-label={`실패 패턴 ${index + 1} 제목`} value={pattern.title} onChange={(event) => {
                          const failurePatterns = draft.failure_patterns.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item);
                          markDraft({ ...draft, failure_patterns: failurePatterns });
                        }} />
                        <textarea aria-label={`실패 패턴 ${index + 1} 처방`} rows={2} value={pattern.prescription} onChange={(event) => {
                          const failurePatterns = draft.failure_patterns.map((item, itemIndex) => itemIndex === index ? { ...item, prescription: event.target.value } : item);
                          markDraft({ ...draft, failure_patterns: failurePatterns });
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </details>

              <details className={styles.editorSection} open>
                <summary><span><BarChart3 size={18} />전 문항 리뷰 <em>{draft.questions.length}</em></span><ChevronRight size={17} /></summary>
                <div className={styles.sectionBody}>
                  <div className={styles.questionList}>
                    {draft.questions.map((question, index) => (
                      <article className={styles.questionCard} key={`${question.number}-${index}`}>
                        <header>
                          <label>문항<input type="number" min={1} max={999} value={question.number} onChange={(event) => updateQuestion(index, "number", Number(event.target.value))} /></label>
                          <label>단원<input value={question.unit} onChange={(event) => updateQuestion(index, "unit", event.target.value)} /></label>
                          <label>배점<input value={question.points} onChange={(event) => updateQuestion(index, "points", event.target.value)} /></label>
                          <label>난이도<select value={question.difficulty} onChange={(event) => updateQuestion(index, "difficulty", event.target.value as ProblemReviewDifficulty)}>{DIFFICULTIES.map((difficulty) => <option key={difficulty}>{difficulty}</option>)}</select></label>
                          <button type="button" onClick={() => removeQuestion(index)} aria-label={`${question.number}번 문항 삭제`}><Trash2 size={16} /></button>
                        </header>
                        {question.source_excerpt && <div className={styles.sourceExcerpt}><span>원문 근거</span>{question.source_excerpt}</div>}
                        <label>핵심 포인트<textarea rows={2} value={question.key_point} onChange={(event) => updateQuestion(index, "key_point", event.target.value)} /></label>
                        <div className={styles.twoFields}>
                          <label>학생이 빠질 함정<textarea rows={2} value={question.trap} onChange={(event) => updateQuestion(index, "trap", event.target.value)} /></label>
                          <label>출제 검토 메모<textarea rows={2} value={question.review_note} onChange={(event) => updateQuestion(index, "review_note", event.target.value)} /></label>
                        </div>
                      </article>
                    ))}
                  </div>
                  <Button intent="secondary" size="sm" leftIcon={<Plus size={ICON_FOR_BUTTON.sm} />} onClick={addQuestion}>문항 추가</Button>
                </div>
              </details>

              <details className={styles.editorSection} open>
                <summary><span><Sparkles size={18} />핵심 변별과 결론</span><ChevronRight size={17} /></summary>
                <div className={styles.sectionBody}>
                  {draft.key_items.map((item, index) => (
                    <div className={styles.keyItemEditor} key={`key-${index}`}>
                      <div className={styles.keyRank}>#{item.rank || index + 1}</div>
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
                    </div>
                  ))}
                  <label>최종 결론<input value={draft.conclusion.headline} onChange={(event) => markDraft({ ...draft, conclusion: { ...draft.conclusion, headline: event.target.value } })} /></label>
                  <label>다음 시험까지 할 일 <span className={styles.labelHint}>줄바꿈으로 구분</span><textarea rows={4} value={draft.conclusion.actions.join("\n")} onChange={(event) => markDraft({ ...draft, conclusion: { ...draft.conclusion, actions: event.target.value.split("\n") } })} /></label>
                </div>
              </details>
            </div>

            <aside className={styles.previewPane} aria-label="리포트 미리보기">
              <div className={styles.previewSticky}>
                <div className={styles.previewLabel}><span>LIVE PREVIEW</span><span>{dirty ? "저장 전 변경 있음" : `v${current.version}`}</span></div>
                <div className={styles.reportPage}>
                  <div className={styles.reportRail} />
                  <div className={styles.reportEyebrow}>PROBLEM REVIEW REPORT</div>
                  <h2>{draft.metadata.title || `${draft.metadata.school} ${draft.metadata.exam_name}` || "문제 리뷰 리포트"}</h2>
                  <p className={styles.reportMeta}>{[draft.metadata.school, draft.metadata.grade, draft.metadata.subject, draft.metadata.exam_date].filter(Boolean).join(" · ") || "시험 정보를 입력해 주세요."}</p>
                  <div className={styles.reportMetrics}>
                    <div><span>문항</span><strong>{draft.questions.length}</strong></div>
                    <div><span>총점</span><strong>{draft.summary.total_points || "-"}</strong></div>
                    <div><span>변별 문항</span><strong>{draft.key_items.length}</strong></div>
                  </div>
                  <section className={styles.reportLead}>
                    <span>시험 한 줄 평</span>
                    <h3>{draft.summary.one_line || "시험의 핵심 특징을 한 문장으로 정리해 주세요."}</h3>
                    <p>{draft.summary.character || "시험 성격에 대한 설명이 이곳에 표시됩니다."}</p>
                  </section>
                  <section className={styles.reportSection}>
                    <div className={styles.reportSectionTitle}><span>01</span><h3>출제 기조</h3></div>
                    <div className={styles.axisPreview}>
                      {draft.assessment_axes.slice(0, 3).map((axis, index) => <div key={`preview-axis-${index}`}><strong>{axis.title || `기조 ${index + 1}`}</strong><p>{axis.description}</p></div>)}
                    </div>
                  </section>
                  <section className={styles.reportSection}>
                    <div className={styles.reportSectionTitle}><span>02</span><h3>문항 리뷰</h3></div>
                    <div className={styles.questionPreview}>
                      {draft.questions.slice(0, 5).map((question) => <div key={`preview-q-${question.number}`}><b>{question.number}</b><span>{question.unit || "단원 미입력"}</span><em data-level={question.difficulty}>{question.difficulty}</em><p>{question.key_point || "핵심 포인트를 입력해 주세요."}</p></div>)}
                    </div>
                  </section>
                  {draft.key_items[0] && <section className={styles.killerPreview}><span>KILLER REVIEW #1</span><h3>{draft.key_items[0].title}</h3><p>{draft.key_items[0].reason}</p></section>}
                  <section className={styles.reportConclusion}><Check size={18} /><div><span>FINAL TAKEAWAY</span><strong>{draft.conclusion.headline || draft.summary.one_line}</strong></div></section>
                  <footer>선생님 검수본 · PDF / PPTX 다운로드 지원</footer>
                </div>
              </div>
            </aside>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className={styles.page} aria-label="문제 리뷰 리포트 만들기">
      <div className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>TEACHER REVIEW WORKSPACE</div>
          <h1>시험지를 올리면,<br /><span>리뷰가 바로 수업 자료가 됩니다.</span></h1>
          <p>직접 만든 문제의 출제 의도와 문항별 포인트를 검토하고, 학부모 설명용 리포트까지 한 화면에서 다듬으세요.</p>
          <div className={styles.heroProof}>
            <span><ShieldCheck size={17} />선생님별 비공개</span>
            <span><FileText size={17} />PDF</span>
            <span><Presentation size={17} />PPTX</span>
          </div>
        </div>
        <div className={styles.heroSteps}>
          {["시험지 등록", "AI 검수 초안", "수정 후 다운로드"].map((label, index) => (
            <div key={label}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong>{index < 2 && <ChevronRight size={17} />}</div>
          ))}
        </div>
      </div>

      {pageError && <div className={styles.errorBanner} role="alert"><AlertTriangle size={18} />{pageError}</div>}

      <div className={styles.startGrid}>
        <div className={styles.uploadPanel}>
          <div className={styles.panelHeading}>
            <div><span>01 · SOURCE</span><h2>리뷰할 시험지를 등록하세요</h2></div>
            <Badge tone="neutral">최대 6개</Badge>
          </div>
          <label className={styles.dropZone} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
            <input type="file" accept={SOURCE_ACCEPT} multiple onChange={handleFileInput} />
            <div className={styles.uploadIcon}><UploadCloud size={28} /></div>
            <strong>파일을 놓거나 눌러서 선택</strong>
            <span>PDF · HWP/HWPX · DOCX · 이미지 · ZIP</span>
          </label>
          {sourceFiles.length > 0 && (
            <div className={styles.fileList}>
              {sourceFiles.map((file, index) => (
                <div key={`${file.name}-${file.lastModified}`}>
                  <FileArchive size={17} /><span><strong>{file.name}</strong><small>{fileSize(file.size)}</small></span>
                  <button type="button" onClick={() => setSourceFiles((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label={`${file.name} 제거`}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.metadataFields}>
            <label className={styles.fullField}>리포트 제목<input placeholder="예: 1학기 중간고사 통합과학 문제 리뷰" value={metadata.title ?? ""} onChange={(event) => setMetadata((value) => ({ ...value, title: event.target.value }))} /></label>
            <label>학교<input placeholder="학교명" value={metadata.school ?? ""} onChange={(event) => setMetadata((value) => ({ ...value, school: event.target.value }))} /></label>
            <label>과목<input placeholder="통합과학" value={metadata.subject ?? ""} onChange={(event) => setMetadata((value) => ({ ...value, subject: event.target.value }))} /></label>
            <label>학년<input placeholder="1학년" value={metadata.grade ?? ""} onChange={(event) => setMetadata((value) => ({ ...value, grade: event.target.value }))} /></label>
            <label>시험명<input placeholder="1학기 중간고사" value={metadata.exam_name ?? ""} onChange={(event) => setMetadata((value) => ({ ...value, exam_name: event.target.value }))} /></label>
          </div>

          <label className={styles.aiConsent}>
            <input type="checkbox" checked={aiConfirmed} onChange={(event) => setAiConfirmed(event.target.checked)} />
            <span><strong>외부 AI 처리 안내를 확인했습니다.</strong><small>시험지 판독과 분석을 위해 설정된 AI 제공자로 자료가 전송됩니다. 개인정보는 올리기 전에 가려 주세요.</small></span>
          </label>
          <Button className={styles.startButton} intent="primary" size="lg" loading={starting} rightIcon={<Sparkles size={ICON_FOR_BUTTON.lg} />} onClick={() => void handleStart()}>
            문제 리뷰 초안 만들기
          </Button>
        </div>

        <aside className={styles.recentPanel}>
          <div className={styles.panelHeading}>
            <div><span>RECENT</span><h2>최근 리포트</h2></div>
            <Layers3 size={20} />
          </div>
          {loadingRecent ? (
            <div className={styles.recentEmpty}><RefreshCw className={styles.spin} size={22} />불러오는 중</div>
          ) : recentReports.length ? (
            <div className={styles.recentList}>
              {recentReports.map((report) => (
                <button type="button" key={report.id} onClick={() => void openReport(report)}>
                  <span className={styles.reportIcon}><FileText size={18} /></span>
                  <span className={styles.reportInfo}><strong>{reportLabel(report)}</strong><small>{report.source_name || new Date(report.updated_at).toLocaleDateString("ko-KR")}</small></span>
                  {statusBadge(report)}
                  <ChevronRight size={17} />
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.recentEmpty}><FileText size={24} /><strong>아직 만든 리포트가 없습니다.</strong><span>첫 시험지를 등록하면 이곳에서 이어서 편집할 수 있습니다.</span></div>
          )}
          <div className={styles.reportPromise}>
            <span><ShieldCheck size={18} /></span>
            <div><strong>원문은 근거로만 보존합니다.</strong><p>AI 분석은 정답이나 배점을 임의로 확정하지 않으며, 선생님이 저장한 검수본만 다운로드에 사용됩니다.</p></div>
          </div>
        </aside>
      </div>
    </section>
  );
}
