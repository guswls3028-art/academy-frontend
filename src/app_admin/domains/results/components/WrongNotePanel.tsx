import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import { extractApiError } from "@/shared/utils/extractApiError";
import {
  getSessionItem,
  removeSessionItem,
  setSessionItem,
} from "@/shared/utils/safeSessionStorage";
import {
  createWrongNotePDF,
  fetchWrongNotePDFStatus,
  fetchWrongNotes,
  MAX_WRONG_NOTE_PDF_ITEMS,
  type WrongNoteItem,
  type WrongNotePDFCreateResponse,
} from "../api/wrongNotes";
import { adminResultsQueryKeys } from "../queryKeys";

type Props = {
  enrollmentId: number;
  examId?: number;
};

type Scope = "exam" | "lecture";

type WrongNoteGroup = {
  key: string;
  sessionLabel: string;
  examTitle: string;
  items: WrongNoteItem[];
};

type PersistedPdfJob = {
  job: WrongNotePDFCreateResponse;
  fingerprint: string;
};

const PDF_POLL_LIMIT = 200;
const PDF_URL_REFRESH_MS = 50 * 60 * 1000;

function pdfJobStorageKey(context: string): string {
  const tenant = getSessionItem("tenantCode") || "current";
  return `hakwonplus:wrong-note-pdf:v1:${tenant}:${context}`;
}

function readPersistedPdfJob(key: string): PersistedPdfJob | null {
  const raw = getSessionItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedPdfJob>;
    if (
      !parsed.job ||
      !Number.isFinite(parsed.job.job_id) ||
      typeof parsed.fingerprint !== "string"
    ) {
      return null;
    }
    return parsed as PersistedPdfJob;
  } catch {
    return null;
  }
}

function sessionLabel(item: WrongNoteItem): string {
  if (item.session_order != null && item.session_title) {
    return `${item.session_order}주차 · ${item.session_title}`;
  }
  if (item.session_order != null) return `${item.session_order}주차`;
  return item.session_title || "주차 미지정";
}

export default function WrongNotePanel({ enrollmentId, examId }: Props) {
  const [scope, setScope] = useState<Scope>("exam");
  const [pdfJob, setPdfJob] = useState<WrongNotePDFCreateResponse | null>(null);
  const [pdfFileUrl, setPdfFileUrl] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [pdfUrlFetchedAt, setPdfUrlFetchedAt] = useState(0);
  const [pollRevision, setPollRevision] = useState(0);
  const [pdfAnnouncement, setPdfAnnouncement] = useState("");
  const panelRef = useRef<HTMLElement | null>(null);
  const shouldFocusDownloadRef = useRef(false);

  const queryExamId = scope === "exam" ? examId : undefined;
  const requestContext = `${enrollmentId}:${queryExamId ?? "lecture"}:${scope}`;
  const storageKey = pdfJobStorageKey(requestContext);
  const requestContextRef = useRef(requestContext);
  const mutationContextRef = useRef("");
  const mutationFingerprintRef = useRef("");
  requestContextRef.current = requestContext;
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: adminResultsQueryKeys.wrongNotes(enrollmentId, scope, queryExamId),
    queryFn: () =>
      fetchWrongNotes({
        enrollment_id: enrollmentId,
        exam_id: queryExamId,
        from_session_order: scope === "lecture" ? 1 : undefined,
        limit: 200,
      }),
    enabled: Number.isFinite(enrollmentId),
  });

  const wrongList = useMemo(() => data?.results ?? [], [data]);
  const totalWrongCount = data?.count ?? wrongList.length;
  const wrongListFingerprint = useMemo(
    () =>
      JSON.stringify([
        totalWrongCount,
        ...wrongList.map((item) => [
          item.exam_id,
          item.exam_title,
          item.question_id,
          item.question_number,
          item.session_order,
          item.session_title,
          item.student_answer,
          item.correct_answer,
          item.score,
          item.is_correct,
          item.has_question_image,
          item.question_image_url,
        ]),
      ]),
    [totalWrongCount, wrongList],
  );
  const isPreviewLimited = totalWrongCount > wrongList.length;
  const exceedsPdfLimit = totalWrongCount > MAX_WRONG_NOTE_PDF_ITEMS;
  const groups = useMemo<WrongNoteGroup[]>(() => {
    const grouped = new Map<string, WrongNoteGroup>();
    for (const item of wrongList) {
      const key = `${item.session_order ?? "none"}-${item.exam_id}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.items.push(item);
        continue;
      }
      grouped.set(key, {
        key,
        sessionLabel: sessionLabel(item),
        examTitle: item.exam_title || "시험",
        items: [item],
      });
    }
    return [...grouped.values()].sort((a, b) => {
      const aItem = a.items[0];
      const bItem = b.items[0];
      return (
        (aItem.session_order ?? Number.MAX_SAFE_INTEGER) -
          (bItem.session_order ?? Number.MAX_SAFE_INTEGER) ||
        a.examTitle.localeCompare(b.examTitle, "ko")
      );
    });
  }, [wrongList]);

  const readyImageCount = wrongList.filter((item) => item.has_question_image).length;
  const missingImageCount = wrongList.length - readyImageCount;

  const pdfMutation = useMutation({
    mutationFn: () => {
      shouldFocusDownloadRef.current = true;
      mutationContextRef.current = requestContext;
      mutationFingerprintRef.current = wrongListFingerprint;
      return createWrongNotePDF({
        enrollment_id: enrollmentId,
        exam_id: queryExamId,
        from_session_order: scope === "lecture" ? 1 : undefined,
      });
    },
    onSuccess: (response) => {
      const completedContext = mutationContextRef.current;
      setSessionItem(
        pdfJobStorageKey(completedContext),
        JSON.stringify({
          job: response,
          fingerprint: mutationFingerprintRef.current,
        } satisfies PersistedPdfJob),
      );
      if (requestContextRef.current !== completedContext) return;
      setPdfJob(response);
      setPdfFileUrl("");
      setPdfError("");
      setPdfAnnouncement("PDF 생성 요청이 접수되었습니다.");
    },
    onError: (mutationError: unknown) => {
      if (requestContextRef.current !== mutationContextRef.current) return;
      setPdfError(extractApiError(mutationError, "오답노트 PDF를 만들지 못했습니다."));
    },
  });

  useEffect(() => {
    setPdfJob(null);
    setPdfFileUrl("");
    setPdfError("");
    setPdfUrlFetchedAt(0);
    setPdfAnnouncement("");
  }, [requestContext]);

  useEffect(() => {
    if (error) {
      setPdfJob(null);
      setPdfFileUrl("");
      setPdfUrlFetchedAt(0);
      return;
    }
    if (isFetching || !data) return;
    const persisted = readPersistedPdfJob(storageKey);
    if (!persisted) return;
    if (persisted.fingerprint !== wrongListFingerprint) {
      removeSessionItem(storageKey);
      setPdfJob(null);
      setPdfFileUrl("");
      setPdfError("");
      setPdfUrlFetchedAt(0);
      setPdfAnnouncement("");
      return;
    }
    setPdfJob(persisted.job);
  }, [data, error, isFetching, storageKey, wrongListFingerprint]);

  useEffect(() => {
    if (!pdfJob?.job_id) return;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const jobId = pdfJob.job_id;
    const pollContext = requestContext;

    const tick = async () => {
      try {
        const status = await fetchWrongNotePDFStatus(jobId);
        if (stopped || requestContextRef.current !== pollContext) return;

        if (status.status === "DONE") {
          if (status.file_url) {
            setPdfFileUrl(status.file_url);
            setPdfUrlFetchedAt(Date.now());
            setPdfError("");
            setPdfAnnouncement("오답노트 PDF 다운로드가 준비되었습니다.");
          } else {
            setPdfError("PDF는 만들어졌지만 다운로드 주소를 확인하지 못했습니다.");
          }
          return;
        }

        if (status.status === "FAILED") {
          removeSessionItem(storageKey);
          setPdfJob(null);
          setPdfError(status.error_message || "오답노트 PDF를 만들지 못했습니다.");
          return;
        }

        attempts += 1;
        if (attempts >= PDF_POLL_LIMIT) {
          setPdfError("PDF 생성이 오래 걸리고 있습니다. 잠시 후 상태를 다시 확인해 주세요.");
          return;
        }
        timer = setTimeout(tick, 1500);
      } catch (statusError: unknown) {
        if (stopped || requestContextRef.current !== pollContext) return;
        attempts += 1;
        if (attempts >= 3) {
          setPdfError(extractApiError(statusError, "PDF 상태를 확인하지 못했습니다."));
          return;
        }
        timer = setTimeout(tick, 2000);
      }
    };

    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [pdfJob, pollRevision, requestContext, storageKey]);

  useEffect(() => {
    if (!pdfFileUrl || !pdfUrlFetchedAt) return;
    const remaining = PDF_URL_REFRESH_MS - (Date.now() - pdfUrlFetchedAt);
    const timer = setTimeout(() => {
      shouldFocusDownloadRef.current = false;
      setPdfFileUrl("");
      setPdfUrlFetchedAt(0);
      setPollRevision((revision) => revision + 1);
    }, Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [pdfFileUrl, pdfUrlFetchedAt]);

  useEffect(() => {
    if (!pdfFileUrl || !shouldFocusDownloadRef.current) return;
    shouldFocusDownloadRef.current = false;
    panelRef.current
      ?.querySelector<HTMLButtonElement>('[data-testid="wrong-note-download"]')
      ?.focus();
  }, [pdfFileUrl]);

  const isCreating = pdfMutation.isPending || Boolean(pdfJob && !pdfFileUrl && !pdfError);
  const retryPdf = () => {
    setPdfError("");
    setPdfAnnouncement("");
    if (pdfJob) {
      shouldFocusDownloadRef.current = true;
      setPollRevision((revision) => revision + 1);
      return;
    }
    pdfMutation.mutate();
  };
  const downloadPdf = () => {
    if (Date.now() - pdfUrlFetchedAt >= PDF_URL_REFRESH_MS) {
      setPdfFileUrl("");
      setPdfUrlFetchedAt(0);
      setPollRevision((revision) => revision + 1);
      return;
    }
    window.open(pdfFileUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <section ref={panelRef} className="wrong-note" data-testid="wrong-note-builder">
      <span className="ds-sr-only" role="status" aria-live="polite">
        {pdfAnnouncement}
      </span>
      <div className="wrong-note__hero">
        <div className="wrong-note__paper-stack" aria-hidden>
          <span />
          <span />
          <strong>Q</strong>
        </div>
        <div className="wrong-note__hero-copy">
          <span className="wrong-note__eyebrow">자동 문항 선별</span>
          <h2>틀린 문제만 모아, 다시 풀 수 있게</h2>
          <p>최신 채점 결과에서 오답만 골라 주차 순서대로 PDF 한 권에 묶습니다.</p>
        </div>
        <div className="wrong-note__summary" aria-label="오답노트 준비 상태">
          <strong>{totalWrongCount}</strong>
          <span>수록 문항</span>
          <i aria-hidden />
          <strong>{readyImageCount}</strong>
          <span>{isPreviewLimited ? "미리보기 이미지" : "이미지 준비"}</span>
        </div>
      </div>

      <div className="wrong-note__scope" role="group" aria-label="오답노트 범위">
        <button
          type="button"
          className={scope === "exam" ? "is-active" : ""}
          aria-pressed={scope === "exam"}
          disabled={isCreating}
          onClick={() => setScope("exam")}
        >
          이번 시험
          <span>현재 시험의 오답</span>
        </button>
        <button
          type="button"
          className={scope === "lecture" ? "is-active" : ""}
          aria-pressed={scope === "lecture"}
          disabled={isCreating}
          onClick={() => setScope("lecture")}
        >
          강의 누적
          <span>1주차부터 주차별 오답</span>
        </button>
      </div>

      {isLoading && <div className="wrong-note__state">오답을 모으고 있습니다…</div>}
      {error && (
        <div className="wrong-note__state wrong-note__state--error" role="alert">
          <span>{extractApiError(error, "오답을 불러오지 못했습니다.")}</span>
          <Button intent="ghost" size="sm" onClick={() => void refetch()}>
            다시 불러오기
          </Button>
        </div>
      )}

      {!isLoading && !error && wrongList.length === 0 && (
        <div className="wrong-note__empty">
          <strong>{scope === "exam" ? "이번 시험은 틀린 문항이 없습니다." : "누적된 오답이 없습니다."}</strong>
          <span>채점이 끝나고 오답이 생기면 이곳에서 바로 PDF로 만들 수 있습니다.</span>
        </div>
      )}

      {!isLoading && !error && groups.length > 0 && (
        <div className="wrong-note__groups">
          {groups.map((group) => (
            <section className="wrong-note__group" key={group.key}>
              <header>
                <div>
                  <span>{group.sessionLabel}</span>
                  <strong>{group.examTitle}</strong>
                </div>
                <em>{group.items.length}문항</em>
              </header>
              <div className="wrong-note__question-grid">
                {group.items.map((item) => (
                  <article
                    className="wrong-note__question"
                    key={`${item.exam_id}-${item.question_id}`}
                  >
                    <div className="wrong-note__thumb">
                      {item.question_image_url ? (
                        <img
                          src={item.question_image_url}
                          alt={`${item.question_number ?? item.question_id}번 문제`}
                          loading="lazy"
                        />
                      ) : (
                        <span>이미지<br />미등록</span>
                      )}
                    </div>
                    <div className="wrong-note__question-copy">
                      <strong>{item.question_number ?? item.question_id}번</strong>
                      <dl>
                        <div>
                          <dt>학생 답</dt>
                          <dd className="is-wrong">{item.student_answer || "미입력"}</dd>
                        </div>
                        <div>
                          <dt>정답</dt>
                          <dd className="is-correct">{item.correct_answer || "미등록"}</dd>
                        </div>
                      </dl>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {missingImageCount > 0 && wrongList.length > 0 && (
        <div className="wrong-note__image-hint">
          <strong>
            {isPreviewLimited ? "미리보기 문항 중 " : ""}문제 이미지 {missingImageCount}개가 비어
            있습니다.
          </strong>
          <span>해당 시험의 시험 설정 → 답안 등록 → 이미지 등록에서 문항 사진을 붙이면 PDF에 자동 반영됩니다.</span>
        </div>
      )}

      <div className="wrong-note__action-bar">
        <div>
          <strong>{scope === "exam" ? "이번 시험 오답노트" : "강의 누적 오답노트"}</strong>
          {exceedsPdfLimit ? (
            <span
              className="wrong-note__limit-guidance"
              id="wrong-note-limit-guidance"
              data-testid="wrong-note-limit-guidance"
            >
              한 번에 최대 {MAX_WRONG_NOTE_PDF_ITEMS}문항까지 만들 수 있습니다.{" "}
              {scope === "lecture"
                ? "‘이번 시험’으로 범위를 좁혀 주세요."
                : `오답이 ${MAX_WRONG_NOTE_PDF_ITEMS}문항을 넘는 단일 시험은 PDF 생성을 지원하지 않습니다.`}
            </span>
          ) : (
            <span>
              {totalWrongCount}문항 전체를 수록합니다. 문제 이미지가 없는 문항도 답안 정보와 함께
              들어갑니다.
            </span>
          )}
        </div>
        {pdfFileUrl ? (
          <Button
            intent="primary"
            onClick={downloadPdf}
            data-testid="wrong-note-download"
          >
            PDF 다운로드
          </Button>
        ) : (
          <Button
            intent="primary"
            onClick={() => pdfMutation.mutate()}
            disabled={wrongList.length === 0 || exceedsPdfLimit || isCreating}
            loading={isCreating}
            aria-describedby={exceedsPdfLimit ? "wrong-note-limit-guidance" : undefined}
            data-testid="wrong-note-create"
          >
            {isCreating ? "PDF 만드는 중" : "오답노트 PDF 만들기"}
          </Button>
        )}
      </div>

      {pdfError && (
        <div className="wrong-note__pdf-error" role="alert">
          <span>{pdfError}</span>
          <button type="button" onClick={retryPdf}>
            {pdfJob ? "상태 다시 확인" : "다시 시도"}
          </button>
        </div>
      )}
    </section>
  );
}
