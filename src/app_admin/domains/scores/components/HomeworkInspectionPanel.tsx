import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useAuth from "@/auth/hooks/useAuth";
import api from "@/shared/api/axios";
import { getTenantUserLocalKey } from "@/shared/utils/safeLocalStorage";
import { extractApiError } from "@/shared/utils/extractApiError";
import { useConfirm } from "@/shared/ui/confirm";
import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalHeader, ModalBody, MODAL_WIDTH } from "@/shared/ui/modal";
import HomeworkInspectionWorkbook from "./HomeworkInspectionWorkbook";
import styles from "./HomeworkInspectionPanel.module.css";

type Row = { enrollment_id: number; student_name: string; solved: number | null; total: number | null; feedback: string; version: number };
type Draft = { id: number; solved: string; total: string; feedback: string; version: number };
type Props = { sessionId: number; homeworkId: number; title: string; onClose: () => void };

function edit(row: Row): Draft {
  return { id: row.enrollment_id, solved: String(row.solved ?? ""), total: String(row.total ?? ""), feedback: row.feedback, version: row.version };
}

export default function HomeworkInspectionPanel(props: Props) {
  const { user } = useAuth();
  const scope = getTenantUserLocalKey(`homework-inspection:${props.sessionId}:${props.homeworkId}`, user?.id);
  return <InspectionEditor key={scope} {...props} scope={scope} />;
}

function InspectionEditor({ sessionId, homeworkId, scope, title, onClose }: Props & { scope: string | null }) {
  const base = `/results/admin/sessions/${sessionId}/homework/${homeworkId}/inspection/`;
  const query = useQuery({
    queryKey: ["homework-inspection", scope, sessionId, homeworkId],
    queryFn: async () => (await api.get<{ items: Row[] }>(base)).data.items,
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [mode, setMode] = useState<"manual" | "excel">("manual");
  const [busy, setBusy] = useState(false);
  const [fileDirty, setFileDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const saving = useRef(false);
  const solvedRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();
  const rows = query.data ?? [];
  const selected = rows.find(row => row.enrollment_id === (draft?.id ?? selectedId)) ?? (!draft && !selectedId ? rows[0] : undefined);
  const values = draft ?? (selected ? edit(selected) : null);
  const dirty = fileDirty || (draft !== null && (!selected || draft.solved !== String(selected.solved ?? "") || draft.total !== String(selected.total ?? "") || draft.feedback !== selected.feedback));

  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);

  async function allowLeave() {
    return !busy && (!dirty || await confirm({ title: "작성 중인 검사 결과", message: "아직 반영하지 않은 내용이 있습니다. 작성 내용을 닫을까요?", confirmText: "닫기", danger: true }));
  }
  async function changeMode(next: "manual" | "excel") {
    if (mode === next || !await allowLeave()) return;
    setDraft(null); setFileDirty(false); setError(""); setMessage(""); setConflict(false); setMode(next);
  }
  async function selectStudent(id: number) {
    if (!await allowLeave()) return;
    setSelectedId(id); setDraft(null); setConflict(false); setError(""); setMessage("");
  }
  function update(field: "solved" | "total" | "feedback", value: string) {
    if (values) setDraft({ ...values, [field]: value });
    setMessage("");
  }
  async function reviewLatest() {
    const result = await query.refetch();
    const latest = result.data?.find(row => row.enrollment_id === draft?.id);
    if (result.isError || !latest || !draft) {
      setError("최신 배정 명단을 확인하지 못했습니다. 입력은 유지됩니다.");
      return;
    }
    const count = latest.solved == null ? "풀이 기록 없음" : `${latest.solved}/${latest.total}문제`;
    if (!await confirm({ title: "최신 검사 결과 확인", message: `현재 공개 내용: ${count} · ${latest.feedback || "코멘트 없음"}\n작성 중인 내용으로 계속할까요?`, confirmText: "내 입력으로 계속" })) return;
    setDraft({ ...draft, version: latest.version }); setError(""); setConflict(false);
  }
  async function save() {
    if (!values || !selected || saving.current || conflict) return;
    const solved = values.solved === "" ? null : Number(values.solved);
    const total = values.total === "" ? null : Number(values.total);
    if ((solved === null) !== (total === null) || (solved !== null && total !== null &&
      (!Number.isInteger(solved) || !Number.isInteger(total) || solved < 0 || total < 1 || total > 100000 || solved > total))) {
      setError("풀이 수와 총 문제 수를 함께 입력해 주세요. 풀이 수는 0부터 총 문제 수까지입니다.");
      return;
    }
    saving.current = true; setBusy(true); setError(""); setMessage("");
    try {
      await api.post(base, { rows: [{ enrollment_id: values.id, version: values.version, solved, total, feedback: values.feedback }] });
      const next = rows[rows.findIndex(row => row.enrollment_id === values.id) + 1];
      setDraft(null); setSelectedId(next?.enrollment_id ?? values.id);
      setMessage(`${selected.student_name} 학생의 검사 결과를 저장했습니다.`);
      await query.refetch();
      requestAnimationFrame(() => solvedRef.current?.focus());
    } catch (reason) {
      setError(extractApiError(reason, "저장하지 못했습니다. 입력을 확인한 뒤 다시 시도해 주세요."));
      setConflict((reason as { response?: { status?: number } }).response?.status === 409);
    } finally { saving.current = false; setBusy(false); }
  }

  return <AdminModal open type="action" width={MODAL_WIDTH.wide} closeDisabled={busy} onClose={() => { void allowLeave().then(ok => { if (ok) onClose(); }); }}>
    <ModalHeader type="action" title="과제 검사" subtitle={title} noIcon />
    <ModalBody>
      <div className={styles.panel}>
        <div className={styles.modes} role="group" aria-label="검사 입력 방식">
          <button type="button" aria-pressed={mode === "manual"} disabled={busy} onClick={() => void changeMode("manual")}>직접 입력</button>
          <button type="button" aria-pressed={mode === "excel"} disabled={busy} onClick={() => void changeMode("excel")}>엑셀 일괄 입력</button>
        </div>
        <p className={styles.audience}>검사 결과는 학생 본인과 학부모에게 공개됩니다. 풀이 수는 과제 점수와 별도로 기록합니다.</p>
        {mode === "excel" ? <HomeworkInspectionWorkbook base={base} title={title} onApplied={() => query.refetch({ throwOnError: true })} onBusy={setBusy} onDirty={setFileDirty} /> :
          <>
            {query.isPending && <p role="status">배정 명단을 불러오는 중입니다.</p>}
            {query.isError && <div role="alert">배정 명단을 불러오지 못했습니다. <button type="button" onClick={() => void query.refetch()}>다시 시도</button></div>}
            {query.isSuccess && !rows.length && <p>이 과제에 배정된 학생이 없습니다. 과제 대상자를 먼저 지정해 주세요.</p>}
            {rows.length > 0 && <label className={styles.field}>학생 선택
              <select value={values?.id ?? ""} disabled={busy} onChange={event => void selectStudent(Number(event.target.value))}>
                {!selected && <option value={values?.id ?? ""}>배정 명단을 확인해 주세요</option>}
                {rows.map(row => <option key={row.enrollment_id} value={row.enrollment_id}>{row.student_name} · 수강번호 {row.enrollment_id}{row.feedback || row.solved !== null ? " · 검사 기록 있음" : ""}</option>)}
              </select>
            </label>}
            {values && <form className={styles.form} onSubmit={event => { event.preventDefault(); void save(); }}>
              <div className={styles.numbers}>
                <label className={styles.field}>풀어 온 문제 수<input ref={solvedRef} type="number" min="0" max="100000" step="1" value={values.solved} disabled={busy} onChange={event => update("solved", event.target.value)} /></label>
                <label className={styles.field}>총 문제 수<input type="number" min="1" max="100000" step="1" value={values.total} disabled={busy} onChange={event => update("total", event.target.value)} /></label>
              </div>
              <label className={styles.field}>학생·학부모용 코멘트<textarea rows={3} maxLength={2000} value={values.feedback} disabled={busy} onChange={event => update("feedback", event.target.value)} /></label>
              <Button type="submit" intent="primary" disabled={!dirty || busy || conflict || !selected || query.isError} loading={busy}>
                {selected?.enrollment_id === rows[rows.length - 1]?.enrollment_id ? "저장" : "저장하고 다음 학생"}
              </Button>
            </form>}
            {error && <p role="alert">{error} {conflict && <button type="button" onClick={() => void reviewLatest()}>최신 값 확인</button>}</p>}
            {message && <p role="status">{message}</p>}
          </>}
      </div>
    </ModalBody>
  </AdminModal>;
}
