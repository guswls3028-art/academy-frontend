import { useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { batchSession, canSelect, saveHomeworkBatch, type ReviewRow } from "./saveHomeworkBatch";
import { useConfirm } from "@/shared/ui/confirm";
import { Button } from "@/shared/ui/ds";
import { extractApiError } from "@/shared/utils/extractApiError";
import styles from "./HomeworkBulkAcceptance.module.css";
import { refreshHomeworkDecisions } from "./refreshHomeworkDecisions";

function version(row: ReviewRow) {
  return `${row.media_set_fingerprint}/${row.teacher_accepted_updated_at ?? ""}`;
}

export default function HomeworkBulkAcceptance<Row extends ReviewRow>({ homeworkId, sessionId, rows, children, individual }: {
  homeworkId: number;
  sessionId: number;
  individual?: boolean;
  rows: Row[];
  children: (visibleRows: Row[], checkbox: (row: ReviewRow) => ReactNode) => ReactNode;
}) {
  const client = useQueryClient();
  const confirm = useConfirm();
  const lock = useRef(false);
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState(() => new Map<number, string>());
  const [summary, setSummary] = useState("");
  const [failures, setFailures] = useState<string[]>([]);
  const eligible = rows.filter((row): row is Row & { media_set_fingerprint: string } => canSelect(row));
  const selected = eligible.filter(row => selection.get(row.enrollment_id) === version(row));
  const allSelected = eligible.length > 0 && selected.length === eligible.length;

  async function acceptSelected() {
    if (lock.current || !selected.length) return;
    lock.current = true;
    setBusy(true);
    try {
      const config = batchSession();
      if (!await confirm({
        title: `선택한 ${selected.length}명 과제 통과`,
        message: "선택한 학생의 제출물을 통과로 인정합니다. 기존 점수와 미채점 상태는 유지됩니다.",
        confirmText: `${selected.length}명 통과 처리`,
      })) return;

      setSummary("통과 처리를 저장하는 중…");
      setFailures([]);
      const { completed, failed } = await saveHomeworkBatch(selected.map(row => ({ row, homeworkId })), config);
      const problems = failed.map(({ item, reason }) => `${item.row.student_name} · ${reason}`);
      setSelection(previous => {
        const next = new Map(previous);
        completed.forEach(({ row }) => next.delete(row.enrollment_id));
        return next;
      });
      setSummary(`통과 ${completed.length}명${problems.length ? ` · 저장 실패 ${problems.length}명` : ""}`);
      setFailures(problems);
      await refreshHomeworkDecisions(client, homeworkId, sessionId, selected.flatMap(row => row.student_id ? [row.student_id] : []));
    } catch (error) {
      setFailures([extractApiError(error, "최신 제출 상태를 확인해 주세요.")]);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (individual) return <>{children(rows, () => null)}</>;

  return <>
    {(eligible.length > 0 || eligibleOnly) && <div className={styles.toolbar} role="group" aria-label="과제 일괄 통과">
      <label className={styles.control}>
        <input type="checkbox" checked={eligibleOnly} onChange={event => setEligibleOnly(event.currentTarget.checked)} />
        통과 대상만 보기
      </label>
      <label className={styles.control}>
        <input type="checkbox" checked={allSelected} disabled={busy}
          ref={el => { if (el) el.indeterminate = selected.length > 0 && !allSelected; }}
          onChange={() => setSelection(allSelected ? new Map() : new Map(eligible.map(row => [row.enrollment_id, version(row)])))} />
        통과 대상 전체 선택 ({eligible.length}명)
      </label>
      <Button type="button" intent="primary" size="sm" disabled={busy || !selected.length} onClick={() => void acceptSelected()}>
        {busy ? "처리 중…" : `선택 ${selected.length}명 통과`}
      </Button>
    </div>}
    {summary && <p role="status">{summary}</p>}
    {failures.length > 0 && <ul role="alert" className="text-sm">{failures.map((reason, index) => <li key={index}>{reason}</li>)}</ul>}
    {eligibleOnly && !eligible.length && <p>통과 처리할 제출물이 없습니다.</p>}
    {children(eligibleOnly ? eligible : rows, row => canSelect(row) && <label className="inline-flex min-h-10 items-center gap-2 text-sm">
      <input type="checkbox" disabled={busy} checked={selection.get(row.enrollment_id) === version(row)}
        aria-label={`${row.student_name} 통과 대상 선택`}
        onChange={event => {
          const checked = event.currentTarget.checked;
          setSelection(previous => {
            const next = new Map(previous);
            if (checked) next.set(row.enrollment_id, version(row));
            else next.delete(row.enrollment_id);
            return next;
          });
        }} />
      선택
    </label>)}
  </>;
}
