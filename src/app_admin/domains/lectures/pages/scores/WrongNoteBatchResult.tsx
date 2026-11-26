import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import { extractApiError } from "@/shared/utils/extractApiError";
import { adminLectureQueryKeys } from "../../queryKeys";
import { downloadBatch, loadBatch, retryBatch, type Batch } from "./rangeWrongNotes";
import styles from "./RangeWrongNoteModal.module.css";

const labels = { PENDING: "대기 중", RUNNING: "만드는 중", DONE: "완료", FAILED: "실패" };

export default function WrongNoteBatchResult({ id, scope, onEdit }: {
  id: number; scope: string; onEdit: () => void;
}) {
  const client = useQueryClient();
  const key = adminLectureQueryKeys.wrongNoteBatch(scope, id);
  const status = useQuery({
    queryKey: key,
    queryFn: () => loadBatch(id),
    retry: false,
    refetchInterval: q => {
      if (q.state.error) return false;
      const state = q.state.data?.status;
      return state === "PENDING" || state === "RUNNING" ? 1600 : false;
    },
  });
  const retry = useMutation({
    mutationFn: () => retryBatch(id),
    onSuccess: result => { client.setQueryData(key, result); void status.refetch(); },
  });
  const download = useMutation({ mutationFn: (batch: Batch) => downloadBatch(batch) });
  const batch = status.data;
  if (status.isError) return (
    <div className={styles.section}>
      <p role="alert">{extractApiError(status.error, "문서 상태를 불러오지 못했습니다.")}</p>
      <div className={styles.actions}>
        <Button onClick={() => void status.refetch()}>상태 다시 확인</Button>
        <Button intent="ghost" onClick={onEdit}>입력으로 돌아가기</Button>
      </div>
    </div>
  );
  if (!batch) return <p role="status">문서 상태를 확인하고 있습니다…</p>;
  const done = batch.status === "DONE";
  const failed = batch.status === "FAILED";
  const single = batch.students.length === 1;
  return (
    <section className={styles.section} aria-label="문서 생성 결과">
      <h3 role="status">{done ? "오답노트가 준비됐습니다" : failed ? "완료하지 못한 문서가 있습니다" : "학생별 오답노트를 만들고 있습니다…"}</h3>
      <ul className={styles.results}>
        {batch.students.map(student => <li key={student.enrollment_id}>
          <strong>{student.name}</strong>
          <span>{labels[student.status]}{student.error_message && ` · ${student.error_message}`}</span>
        </li>)}
      </ul>
      {(retry.error || download.error) && <p className={styles.error} role="alert">
        {extractApiError(retry.error || download.error, "요청을 완료하지 못했습니다. 다시 시도해 주세요.")}
      </p>}
      <div className={styles.actions}>
        {done && <Button intent="primary" loading={download.isPending} onClick={() => download.mutate(batch)}>
          {single ? "개인 PDF 다운로드" : "학생별 PDF 묶음 다운로드"}
        </Button>}
        {failed && <Button intent="primary" loading={retry.isPending} onClick={() => retry.mutate()}>실패한 문서 다시 만들기</Button>}
        {(done || failed) && <Button disabled={retry.isPending} onClick={onEdit}>입력으로 돌아가기</Button>}
      </div>
    </section>
  );
}
