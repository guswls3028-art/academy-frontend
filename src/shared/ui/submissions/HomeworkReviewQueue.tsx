import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { assessmentQueryKeys } from "@/shared/api/queryKeys/assessments";
import { fetchHomeworkReviewQueue, type HomeworkReviewItem } from "@/shared/api/contracts/homeworkReviewQueue";
import { Badge, Button, EmptyState } from "@/shared/ui/ds";
import { fetchHomeworkSubmissions, type HomeworkSubmissionRow } from "@/shared/api/contracts/staffHomeworkSubmissions";
import type { HomeworkSubmissionMediaFile } from "@/shared/api/contracts/staffHomeworkFiles";
import { useConfirm } from "@/shared/ui/confirm";
import { readAuthTokenEnvelopeSafely } from "@/shared/auth/tokenSession";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { extractApiError } from "@/shared/utils/extractApiError";
import HomeworkMediaPreviewModal from "@/shared/ui/media/HomeworkMediaPreviewModal";
import HomeworkFileGallery from "./HomeworkFileGallery";
import { batchSession, canSelect, saveHomeworkBatch } from "./saveHomeworkBatch";
import { refreshHomeworkBatch } from "./refreshHomeworkDecisions";
import styles from "./HomeworkReviewQueue.module.css";

function reviewPath(mobile: boolean, row: HomeworkReviewItem, page: number) {
  const path = mobile
    ? `/workspace/mobile/homeworks/${row.homework_id}?from=pending`
    : `/workspace/results/submissions?homework=${row.homework_id}&homeworkList=pending`;
  return `${path}&reviewEnrollment=${row.enrollment_id}&queuePage=${page}`;
}

function queueQuery(page: number) {
  return {
    queryKey: assessmentQueryKeys.homeworkReviewPage(page),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchHomeworkReviewQueue(page, signal),
    refetchInterval: 30_000, retry: false,
  };
}

function useQueue() {
  const [params, setParams] = useSearchParams();
  const parsed = Number(params.get("queuePage"));
  const page = Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 1_000_000 ? parsed : 1;
  const query = useQuery(queueQuery(page));
  const setPage = (value: number) => setParams(previous => {
    const next = new URLSearchParams(previous);
    next.set("queuePage", String(value));
    return next;
  });
  return { query, setPage };
}

export function NextHomeworkReview({ mobile, homeworkId, enrollmentId }: {
  mobile: boolean; homeworkId: number; enrollmentId: number;
}) {
  const { query } = useQueue();
  const data = query.data;
  const index = data?.results.findIndex(row => row.homework_id === homeworkId && row.enrollment_id === enrollmentId) ?? -1;
  const following = data?.results[index + 1];
  const nextPage = data && !following && data.pages > 1 ? data.page % data.pages + 1 : null;
  const adjacent = useQuery({ ...queueQuery(nextPage ?? 1), enabled: nextPage !== null });
  if (query.isError) return <Button intent="ghost" onClick={() => void query.refetch()}>다음 제출 다시 찾기</Button>;
  if (nextPage !== null && adjacent.isError) return <Button intent="ghost" onClick={() => void adjacent.refetch()}>다음 제출 다시 찾기</Button>;
  if (!data || (nextPage !== null && !adjacent.data)) return null;
  const next = following ?? (nextPage !== null
    ? adjacent.data?.results.find(row => row.homework_id !== homeworkId || row.enrollment_id !== enrollmentId)
    : index > 0 ? data.results[0] : undefined);
  if (next) return <Link className={styles.action} replace to={reviewPath(mobile, next, nextPage !== null ? adjacent.data!.page : data.page)}>다음 대기 제출 · {next.student_name}</Link>;
  const list = mobile ? "/workspace/mobile/submissions" : "/workspace/results/submissions";
  return <Link className={styles.action} to={`${list}?homework=pending`}>확인 대기 목록 보기</Link>;
}

const submittedDate = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
});

const rowKey = (row: HomeworkReviewItem) => `${row.homework_id}-${row.enrollment_id}`;
const rowVersion = (row: HomeworkReviewItem) => `${row.submitted_at}/${row.file_count}`;
type Selection = {
  homeworkId: number; item: HomeworkReviewItem; row: HomeworkSubmissionRow & { media_set_fingerprint: string };
};
type SelectionRequest = { key: string; item: HomeworkReviewItem };

function detailQuery(item: HomeworkReviewItem) {
  return {
    queryKey: assessmentQueryKeys.homeworkReviewDetail(item.homework_id, item.enrollment_id),
    queryFn: async () => {
      const [row] = await fetchHomeworkSubmissions(item.homework_id, item.enrollment_id);
      if (!row || row.enrollment_id !== item.enrollment_id) throw new Error("이 제출이 변경되었습니다. 목록을 새로고침해 주세요.");
      return row;
    },
    retry: false,
  };
}

function QueueFiles({ item, onClose }: { item: HomeworkReviewItem; onClose: () => void }) {
  const { data, isError, refetch } = useQuery(detailQuery(item));
  const [file, setFile] = useState<HomeworkSubmissionMediaFile | null>(null);
  const context = [item.student_name, item.lecture_title, item.session_title, item.homework_title].join(" · ");
  const files = data?.files.filter(f => !f.removed_at && f.status !== "removed") ?? [];
  return <div className={styles.files} aria-label={context}>
    <div className={styles.fileHeading}><strong>{item.student_name} 제출 파일</strong>
      <Button size="sm" intent="ghost" onClick={onClose}>파일 접기</Button></div>
    {isError ? <EmptyState scope="panel" tone="error" title="제출 파일을 불러오지 못했습니다" actions={<Button onClick={() => void refetch()}>다시 시도</Button>} />
      : !data ? <p role="status">파일 불러오는 중…</p>
      : !files.length ? <p role="status">현재 확인할 제출 파일이 없습니다.</p>
      : <HomeworkFileGallery homeworkId={item.homework_id} files={files}
          fingerprint={data.media_set_fingerprint} onOpen={setFile} />}
    {file && <HomeworkMediaPreviewModal open file={file} homeworkId={item.homework_id} context={context}
      mediaSetFingerprint={data?.media_set_fingerprint ?? null} onClose={() => setFile(null)} />}
  </div>;
}

export default function HomeworkReviewQueue({ mobile }: { mobile: boolean }) {
  const { query, setPage } = useQueue();
  if (query.isError) return <EmptyState scope="panel" tone="error" title="확인 대기 제출물을 불러오지 못했습니다"
    actions={<Button onClick={() => void query.refetch()}>다시 시도</Button>} />;
  if (!query.data) return <EmptyState scope="panel" tone="loading" title="제출물 불러오는 중…" />;
  const scope = `${getTenantCodeForApiRequest()}:${readAuthTokenEnvelopeSafely()?.generation}:${query.data.page}`;
  return <QueuePage key={scope} mobile={mobile} data={query.data} setPage={setPage} />;
}

function QueuePage({ mobile, data, setPage }: { mobile: boolean; data: Awaited<ReturnType<typeof fetchHomeworkReviewQueue>>; setPage: (n: number) => void }) {
  const { results, count, page, pages } = data;
  const client = useQueryClient();
  const confirm = useConfirm();
  const [preview, setPreview] = useState("");
  const [selection, setSelection] = useState(() => new Map<string, Selection>());
  const [checking, setChecking] = useState(() => new Set<string>());
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const locked = useRef(false);
  const pending = useRef(new Map<string, SelectionRequest>());
  const waiting = useRef<SelectionRequest[]>([]);
  const activeReads = useRef(0);
  useEffect(() => {
    const jobs = pending.current;
    const queue = waiting.current;
    return () => { jobs.clear(); queue.length = 0; };
  }, []);
  const selected = results.flatMap(item => {
    const match = selection.get(rowKey(item));
    return match && rowVersion(item) === rowVersion(match.item) ? [match] : [];
  });
  const selectedKeys = new Set(selected.map(s => rowKey(s.item)));
  const checked = new Set([...selectedKeys, ...checking]);
  const all = results.length > 0 && results.every(item => checked.has(rowKey(item)));

  async function loadSelection(request: SelectionRequest) {
    const { key, item } = request;
    try {
      const row = await client.fetchQuery({ ...detailQuery(item), staleTime: 0 });
      if (pending.current.get(key) !== request) return;
      if (!canSelect(row) || row.teacher_reviewed || row.files.filter(f => !f.removed_at && f.status === "uploaded").length !== item.file_count) {
        throw new Error("제출 상태가 바뀌었습니다. 파일을 다시 확인해 주세요.");
      }
      setSelection(previous => new Map(previous).set(key, { homeworkId: item.homework_id, item, row }));
    } catch (error) {
      if (pending.current.get(key) !== request) return;
      const reason = extractApiError(error, "최신 제출을 확인할 수 없습니다.");
      setProblems(previous => [...previous, `${item.student_name} · ${item.lecture_title} · ${item.homework_title} · ${reason}`]);
      void client.invalidateQueries({ queryKey: assessmentQueryKeys.homeworkReviewQueue });
    } finally {
      if (pending.current.get(key) === request) {
        pending.current.delete(key);
        setChecking(new Set(pending.current.keys()));
      }
    }
  }

  function loadWaiting() {
    while (activeReads.current < 3 && waiting.current.length) {
      const request = waiting.current.shift()!;
      if (pending.current.get(request.key) !== request) continue;
      activeReads.current++;
      void loadSelection(request).finally(() => {
        activeReads.current--;
        loadWaiting();
      });
    }
  }

  function choose(items: HomeworkReviewItem[], checked: boolean) {
    if (locked.current) return;
    setSummary("");
    setProblems([]);
    if (!checked) {
      items.forEach(item => pending.current.delete(rowKey(item)));
      setChecking(new Set(pending.current.keys()));
      setSelection(previous => {
        const next = new Map(previous);
        items.forEach(item => next.delete(rowKey(item)));
        return next;
      });
      return;
    }
    for (const item of items) {
      const key = rowKey(item);
      if (selectedKeys.has(key) || pending.current.has(key)) continue;
      const request = { key, item };
      pending.current.set(key, request);
      waiting.current.push(request);
    }
    setChecking(new Set(pending.current.keys()));
    loadWaiting();
  }

  async function accept() {
    if (locked.current || pending.current.size || !selected.length) return;
    locked.current = true;
    setBusy(true);
    try {
      const config = batchSession();
      if (!await confirm({ title: `선택한 제출 ${selected.length}건 통과`,
        message: `과제 ${new Set(selected.map(s => s.homeworkId)).size}개의 선택한 제출물을 통과로 인정합니다. 기존 점수는 유지됩니다.`,
        confirmText: `${selected.length}건 통과 처리` })) return;
      const { completed, failed } = await saveHomeworkBatch(selected, config);
      setSelection(new Map());
      setSummary(`통과 ${completed.length}건` + (failed.length ? ` · 저장 실패 ${failed.length}건` : ""));
      setProblems(failed.map(({ item, reason }) => `${item.item.student_name} · ${item.item.lecture_title} · ${item.item.homework_title} · ${reason}`));
      await refreshHomeworkBatch(client, selected.map(s => s.homeworkId),
        selected.flatMap(s => s.row.session_id ? [s.row.session_id] : []), selected.flatMap(s => s.row.student_id ? [s.row.student_id] : []));
    } catch (error) {
      setProblems([extractApiError(error, "최신 제출 상태를 확인해 주세요.")]);
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }
  return <section className={styles.queue}>
    <div className={styles.tools}>
      <header className={styles.heading}>
        <strong>학생별 제출물</strong><Badge tone="warning">확인 대기 {count}건</Badge>
        {count > 0 && <div className={styles.selection}>
          <label>
            <input type="checkbox" checked={all} disabled={busy}
              ref={el => { if (el) el.indeterminate = checked.size > 0 && !all; }}
              onChange={e => void choose(results, e.currentTarget.checked)} />
            이 페이지 전체 선택
          </label>
          <Button intent="primary" size="sm" disabled={busy || checking.size > 0 || !selected.length} onClick={() => void accept()}>
            {checking.size ? "파일 확인 중…" : busy ? "처리 중…" : `선택 ${selected.length}건 통과`}
          </Button>
        </div>}
      </header>
      {count > 0 && <div className={styles.columns} aria-hidden="true">
        <span/><div className={styles.fields}>
          <span>학생</span><span>강의</span><span>차시</span><span>과제</span><span>제출 시각</span>
        </div><span>제출 파일</span>
      </div>}
    </div>
    {summary && <p role="status">{summary}</p>}
    {!!problems.length && <ul role="alert">{problems.map((problem, index) => <li key={index}>{problem}</li>)}</ul>}
    {!count ? <EmptyState scope="panel" tone="empty" title="확인 대기 과제가 없습니다" /> : <>
      <ul aria-label="확인 대기 학생 제출물" className={styles.list}>
        {results.map(row => {
          const key = rowKey(row);
          const context = [row.student_name, row.lecture_title, row.session_title, row.homework_title].join(" · ");
          return <li key={key}>
            <div className={styles.line} data-selected={checked.has(key) || undefined}>
              <label className={styles.checkbox}><input type="checkbox" aria-label={`${context} 선택`} aria-describedby={`submitted-${key}`}
                checked={checked.has(key)} disabled={busy} onChange={e => void choose([row], e.currentTarget.checked)} /></label>
              <Link className={styles.row} to={reviewPath(mobile, row, page)} state={{ fromHomeworkInbox: true }}
                aria-label={`${context} 제출물 열기`} aria-describedby={`submitted-${key}`}>
                <strong className={styles.name}>{row.student_name}</strong><span className={styles.lecture}>{row.lecture_title}</span>
                <span className={styles.session}>{row.session_title}</span><strong className={styles.homework}>{row.homework_title}</strong>
                <time id={`submitted-${key}`} className={styles.time} dateTime={row.submitted_at}>{submittedDate.format(new Date(row.submitted_at))}</time>
              </Link>
              <button type="button" className={styles.open} aria-label={`${row.student_name} 제출 파일 ${row.file_count}개 미리보기`}
                aria-expanded={preview === key} onClick={() => setPreview(preview === key ? "" : key)}>파일 {row.file_count}개</button>
            </div>
            {preview === key && <QueueFiles key={key} item={row} onClose={() => setPreview("")} />}
          </li>;
        })}
      </ul></>}
    {pages > 1 && <nav aria-label="제출 목록 페이지" className={styles.pager}>
      <Button intent="secondary" disabled={busy || page <= 1} onClick={() => setPage(page - 1)}>이전</Button>
      <span>{page} / {pages}</span>
      <Button intent="secondary" disabled={busy || page >= pages} onClick={() => setPage(page + 1)}>다음</Button>
    </nav>}
  </section>;
}
