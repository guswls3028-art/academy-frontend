import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { assessmentQueryKeys } from "@/shared/api/queryKeys/assessments";
import { fetchHomeworkReviewQueue, type HomeworkReviewItem } from "@/shared/api/contracts/homeworkReviewQueue";
import { Badge, Button, EmptyState } from "@/shared/ui/ds";
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

export default function HomeworkReviewQueue({ mobile }: { mobile: boolean }) {
  const { query, setPage } = useQueue();
  if (query.isError) return <EmptyState scope="panel" tone="error" title="확인 대기 제출물을 불러오지 못했습니다"
    actions={<Button onClick={() => void query.refetch()}>다시 시도</Button>} />;
  if (!query.data) return <EmptyState scope="panel" tone="loading" title="제출물 불러오는 중…" />;
  const { results, count, page, pages } = query.data;
  if (!count) return <EmptyState scope="panel" tone="empty" title="확인 대기 과제가 없습니다" />;
  return <section className={styles.queue}>
    <header className={styles.heading}><strong>학생별 제출물</strong><Badge tone="warning">확인 대기 {count}건</Badge></header>
    <ul aria-label="확인 대기 학생 제출물" className={styles.list}>
      {results.map(row => <li key={`${row.homework_id}-${row.enrollment_id}`}>
        <Link className={styles.row} to={reviewPath(mobile, row, page)} state={{ fromHomeworkInbox: true }}>
          <strong className={styles.name}>{row.student_name}</strong>
          <span className={styles.target}><strong>{row.homework_title}</strong>
            <span>{row.lecture_title} · {row.session_title}</span></span>
          <span className={styles.time}><time dateTime={row.submitted_at}>{submittedDate.format(new Date(row.submitted_at))}</time> · 파일 {row.file_count}개</span>
          <span className={styles.open}>제출물 열기</span>
        </Link>
      </li>)}
    </ul>
    {pages > 1 && <nav aria-label="제출 목록 페이지" className={styles.pager}>
      <Button intent="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>이전</Button>
      <span>{page} / {pages}</span>
      <Button intent="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>다음</Button>
    </nav>}
  </section>;
}
