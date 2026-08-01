import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Badge, ICON } from "@/shared/ui/ds";
import { cx } from "@/shared/utils/cx";
import { BackButton } from "@teacher/shared/ui/Card";
import {
  AlertCircle,
  Camera,
  CheckCircle,
  ImagePlus,
  Info,
  Shield,
} from "@teacher/shared/ui/Icons";
import {
  createProblemSolverJob,
  fetchProblemSolverJob,
  type ProblemSolverResult,
  type ProblemSolverStatus,
} from "../api/problemSolver.api";
import styles from "./ProblemSolverPage.module.css";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const POLL_INTERVAL_MS = 1_400;
const POLL_RETRY_INTERVAL_MS = 4_000;
const TERMINAL_STATUSES = new Set<ProblemSolverStatus>([
  "DONE",
  "FAILED",
  "REJECTED_BAD_INPUT",
  "FALLBACK_TO_GPU",
  "REVIEW_REQUIRED",
]);

const CONFIDENCE_LABELS: Record<ProblemSolverResult["confidence"], string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

function errorMessage(error: unknown): string {
  if (
    typeof error === "object"
    && error !== null
    && "response" in error
  ) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    if (response?.data?.detail) return response.data.detail;
  }
  return "풀이 작업을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export default function ProblemSolverPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [subject, setSubject] = useState("");
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [jobId, setJobId] = useState("");
  const [jobStatus, setJobStatus] = useState<ProblemSolverStatus | null>(null);
  const [result, setResult] = useState<ProblemSolverResult | null>(null);
  const [error, setError] = useState("");

  const isWorking = submitting || (
    jobStatus !== null && !TERMINAL_STATUSES.has(jobStatus)
  );

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  useEffect(() => {
    if (!jobId || !jobStatus || TERMINAL_STATUSES.has(jobStatus)) return;
    let cancelled = false;
    let timerId: number | undefined;

    const poll = async () => {
      try {
        const job = await fetchProblemSolverJob(jobId);
        if (cancelled) return;
        setJobStatus(job.status);
        if (job.status === "DONE" && job.result) {
          setResult(job.result);
          setError("");
          return;
        }
        if (TERMINAL_STATUSES.has(job.status)) {
          setError(job.error || "풀이 초안을 만들지 못했습니다. 다시 시도해 주세요.");
          return;
        }
        timerId = window.setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (cancelled) return;
        setError("결과 확인 연결이 불안정합니다. 기존 작업을 자동으로 다시 확인합니다.");
        timerId = window.setTimeout(poll, POLL_RETRY_INTERVAL_MS);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, [jobId, jobStatus]);

  const selectImage = (file: File | null) => {
    setError("");
    setResult(null);
    setJobId("");
    setJobStatus(null);
    if (!file) {
      setImageFile(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setImageFile(null);
      setError("JPG, PNG, WEBP 사진만 올릴 수 있습니다.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageFile(null);
      setError("사진은 12MB 이하로 올려 주세요.");
      return;
    }
    setImageFile(file);
  };

  const startJob = async () => {
    if (!imageFile || !privacyConfirmed || isWorking) return;
    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("subject", subject);
      formData.append("privacy_confirmed", "true");
      const job = await createProblemSolverJob(formData);
      setJobId(job.job_id);
      setJobStatus(job.status);
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setImageFile(null);
    setSubject("");
    setPrivacyConfirmed(false);
    setJobId("");
    setJobStatus(null);
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <BackButton onClick={() => navigate("/workspace/mobile/tools")} />
        <div className={styles.headerCopy}>
          <div className={styles.titleRow}>
            <h1>AI 풀이·해설</h1>
            <Badge tone="warning" size="xs">Beta</Badge>
          </div>
          <p>문제 사진 한 장을 강사 검수용 풀이 초안으로 바꿉니다.</p>
        </div>
      </header>

      <div className={styles.betaNotice}>
        <Info size={ICON.sm} aria-hidden="true" />
        <p>
          <strong>Beta 기능입니다.</strong>
          {" "}AI가 만든 정답과 해설은 수업에 사용하기 전에 반드시 직접 확인해 주세요.
        </p>
      </div>

      {!result ? (
        <div className={styles.workspace}>
          <section className={styles.uploadCard}>
            <div className={styles.sectionHeading}>
              <span>1</span>
              <div>
                <h2>문제 사진</h2>
                <p>한 번에 한 문제만, 글자가 선명하게 보이도록 올려 주세요.</p>
              </div>
            </div>

            <label className={cx(styles.dropzone, previewUrl && styles.dropzoneWithPreview)}>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(event) => selectImage(event.target.files?.[0] ?? null)}
                disabled={isWorking}
              />
              {previewUrl ? (
                <>
                  <img src={previewUrl} alt="선택한 문제 사진 미리보기" />
                  {!isWorking && (
                    <span className={styles.changeImage}>
                      <ImagePlus size={ICON.xs} aria-hidden="true" />
                      사진 바꾸기
                    </span>
                  )}
                </>
              ) : (
                <div className={styles.uploadPrompt}>
                  <div className={styles.cameraIcon}>
                    <Camera size={ICON.lg} aria-hidden="true" />
                  </div>
                  <strong>촬영하거나 사진 선택</strong>
                  <span>JPG · PNG · WEBP, 최대 12MB</span>
                </div>
              )}
            </label>
          </section>

          <section className={styles.setupCard}>
            <div className={styles.sectionHeading}>
              <span>2</span>
              <div>
                <h2>풀이 설정</h2>
                <p>과목을 고르면 용어와 설명 맥락을 맞추는 데 도움이 됩니다.</p>
              </div>
            </div>

            <label className={styles.field}>
              <span>과목 <small>선택</small></span>
              <select
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                disabled={isWorking}
              >
                <option value="">과목 선택 안 함</option>
                <option value="수학">수학</option>
                <option value="과학">과학</option>
                <option value="국어">국어</option>
                <option value="영어">영어</option>
                <option value="사회">사회</option>
                <option value="기타">기타</option>
              </select>
            </label>

            <label className={styles.privacyCheck}>
              <input
                type="checkbox"
                checked={privacyConfirmed}
                onChange={(event) => setPrivacyConfirmed(event.target.checked)}
                disabled={isWorking}
              />
              <span>
                학생 이름·연락처 등 개인정보가 없는 사진임을 확인합니다.
                사진은 외부 AI로 일시 처리되며 작업 종료 후 삭제됩니다.
              </span>
            </label>

            <button
              type="button"
              className={styles.submitButton}
              onClick={startJob}
              disabled={!imageFile || !privacyConfirmed || isWorking}
            >
              {isWorking ? "풀이 초안 만드는 중…" : "풀이·해설 초안 만들기"}
            </button>
          </section>
        </div>
      ) : (
        <section className={styles.resultCard}>
          <div className={styles.resultHeader}>
            <div>
              <div className={styles.resultBadges}>
                <Badge tone="warning" size="xs">Beta</Badge>
                <Badge tone="info" size="xs">강사 검수 필요</Badge>
              </div>
              <h2>풀이·해설 초안</h2>
              <p>AI 결과를 원문 문제와 대조한 뒤 사용해 주세요.</p>
            </div>
            <CheckCircle size={ICON.lg} aria-hidden="true" />
          </div>

          <div className={styles.resultSection}>
            <div className={styles.resultLabel}>
              <span>정답 초안</span>
              <small>확신도 {CONFIDENCE_LABELS[result.confidence]}</small>
            </div>
            <div className={styles.answer}>{result.answer || "검수 필요"}</div>
          </div>

          <div className={styles.resultSection}>
            <h3>단계별 해설</h3>
            <p className={styles.resultText}>{result.explanation}</p>
          </div>

          {result.answer_check && (
            <div className={styles.checkSection}>
              <Shield size={ICON.sm} aria-hidden="true" />
              <div>
                <strong>정답 확인 근거</strong>
                <p>{result.answer_check}</p>
              </div>
            </div>
          )}

          <button type="button" className={styles.resetButton} onClick={reset}>
            새 문제 풀기
          </button>
        </section>
      )}

      {isWorking && (
        <div className={styles.progressCard} role="status" aria-live="polite">
          <div className={styles.spinner} aria-hidden="true" />
          <div>
            <strong>문제를 읽고 풀이 초안을 만들고 있습니다.</strong>
            <span>페이지를 벗어나지 않으면 완료되는 즉시 결과를 보여 드립니다.</span>
          </div>
        </div>
      )}

      {error && (
        <div className={styles.errorCard} role="alert">
          <AlertCircle size={ICON.sm} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
