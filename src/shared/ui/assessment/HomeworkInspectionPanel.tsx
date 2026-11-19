import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useAuth from "@/auth/hooks/useAuth";
import api from "@/shared/api/axios";
import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";
import { readActiveAuthGenerationSafely } from "@/shared/auth/tokenSession";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
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
  const [boundScope] = useState(scope);
  const [generation] = useState(readActiveAuthGenerationSafely);
  const [tenant] = useState(getTenantCodeForApiRequest);
  const scopeMatches = () => Boolean(scope && boundScope === scope
    && generation === readActiveAuthGenerationSafely() && tenant === getTenantCodeForApiRequest());
  const [expired, setExpired] = useState(false);
  if (expired || !scopeMatches()) {
    return <AdminModal open type="action" width={MODAL_WIDTH.wide} onClose={props.onClose}>
      <ModalHeader type="action" title="과제 검사" noIcon />
      <ModalBody><p role="alert">계정이나 학원 정보를 다시 확인해야 합니다. 창을 닫고 과제를 다시 열어 주세요.</p></ModalBody>
    </AdminModal>;
  }
  return <InspectionEditor key={scope} {...props} scope={scope} scopeMatches={scopeMatches}
    onExpired={() => setExpired(true)} />;
}

function InspectionEditor({ sessionId, homeworkId, scope, title, onClose, scopeMatches, onExpired }: Props & {
  scope: string | null; scopeMatches: () => boolean; onExpired: () => void;
}) {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  function active() {
    if (!mounted.current) return false;
    if (scopeMatches()) return true;
    onExpired();
    return false;
  }
  const base = `/results/admin/sessions/${sessionId}/homework/${homeworkId}/inspection/`;
  const query = useQuery({
    queryKey: scoresQueryKeys.homeworkInspection(scope, sessionId, homeworkId),
    queryFn: async ({ signal }) => {
      if (!scopeMatches()) throw new Error("계정 또는 학원이 변경되었습니다.");
      const { data } = await api.get<{ items: Row[] }>(base, { signal });
      if (!scopeMatches()) throw new Error("계정 또는 학원이 변경되었습니다.");
      return data.items;
    },
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [mode, setMode] = useState<"manual" | "excel">("manual");
  const [busy, setBusy] = useState(false);
  const [fileDirty, setFileDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [needsReadback, setNeedsReadback] = useState(false);
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
    if (mode === next || !await allowLeave() || !active()) return;
    setDraft(null); setFileDirty(false); setError(""); setMessage(""); setConflict(false); setMode(next);
  }
  async function selectStudent(id: number) {
    if (!await allowLeave() || !active()) return;
    setSelectedId(id); setDraft(null); setConflict(false); setError(""); setMessage("");
  }
  function update(field: "solved" | "total" | "feedback", value: string) {
    if (!active() || !values || needsReadback || query.isError) return;
    setDraft({ ...values, [field]: value });
    setMessage("");
  }
  async function reviewLatest() {
    if (!draft || saving.current || !active()) return;
    saving.current = true; setBusy(true);
    try {
      const result = await query.refetch({ throwOnError: true });
      if (!active()) return;
      const latest = result.data?.find(row => row.enrollment_id === draft.id);
      if (!latest) {
        setError("이 학생의 과제 배정이 변경되었습니다. 작성한 내용은 유지됩니다.");
        return;
      }
      const count = latest.solved == null ? "풀이 기록 없음" : `${latest.solved}/${latest.total}문제`;
      if (!await confirm({ title: "최신 검사 결과 확인", message: `현재 공개 내용: ${count} · ${latest.feedback || "코멘트 없음"}
작성 중인 내용으로 계속할까요?`, confirmText: "내 입력으로 계속" }) || !active()) return;
      setDraft({ ...draft, version: latest.version }); setError(""); setConflict(false);
    } catch {
      if (active()) setError("최신 배정 명단을 확인하지 못했습니다. 입력은 유지됩니다.");
    } finally { saving.current = false; if (mounted.current) setBusy(false); }
  }
  async function reloadRows() {
    if (!active()) return;
    try {
      await query.refetch({ throwOnError: true });
      if (active()) setNeedsReadback(false);
    } catch {
      // The query error and saved-readback state keep the retry action visible.
    }
  }
  async function save() {
    if (!values || !selected || saving.current || conflict || needsReadback || query.isError || !active()) return;
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
      if (!active()) return;
      setNeedsReadback(true);
      const next = rows[rows.findIndex(row => row.enrollment_id === values.id) + 1];
      setDraft(null); setSelectedId(next?.enrollment_id ?? values.id);
      setMessage(`${selected.student_name} 학생의 검사 결과를 저장했습니다.`);
      await reloadRows();
      requestAnimationFrame(() => { if (active()) solvedRef.current?.focus(); });
    } catch (reason) {
      if (!active()) return;
      setError(extractApiError(reason, "저장하지 못했습니다. 입력을 확인한 뒤 다시 시도해 주세요."));
      setConflict((reason as { response?: { status?: number } }).response?.status === 409);
    } finally { saving.current = false; if (mounted.current) setBusy(false); }
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
            {(query.isError || needsReadback) && !busy && <div role="alert">
              {needsReadback ? "저장은 완료되었습니다. 다음 입력을 위해 최신 명단을 불러와 주세요." : "배정 명단을 불러오지 못했습니다."}
              <button type="button" disabled={query.isFetching} onClick={() => void reloadRows()}>최신 명단 다시 불러오기</button>
            </div>}
            {query.isSuccess && !rows.length && <p>이 과제에 배정된 학생이 없습니다. 과제 대상자를 먼저 지정해 주세요.</p>}
            {!needsReadback && rows.length > 0 && <label className={styles.field}>학생 선택
              <select value={values?.id ?? ""} disabled={busy || query.isError} onChange={event => void selectStudent(Number(event.target.value))}>
                {!selected && <option value={values?.id ?? ""}>배정 명단을 확인해 주세요</option>}
                {rows.map(row => <option key={row.enrollment_id} value={row.enrollment_id}>{row.student_name} · 수강번호 {row.enrollment_id}{row.feedback || row.solved !== null ? " · 검사 기록 있음" : ""}</option>)}
              </select>
            </label>}
            {!needsReadback && values && <form className={styles.form} onSubmit={event => { event.preventDefault(); void save(); }}>
              <div className={styles.numbers}>
                <label className={styles.field}>풀어 온 문제 수<input ref={solvedRef} type="number" min="0" max="100000" step="1" value={values.solved} disabled={busy || query.isError} onChange={event => update("solved", event.target.value)} /></label>
                <label className={styles.field}>총 문제 수<input type="number" min="1" max="100000" step="1" value={values.total} disabled={busy || query.isError} onChange={event => update("total", event.target.value)} /></label>
              </div>
              <label className={styles.field}>학생·학부모용 코멘트<textarea rows={3} maxLength={2000} value={values.feedback} disabled={busy || query.isError} onChange={event => update("feedback", event.target.value)} /></label>
              <Button type="submit" intent="primary" disabled={!dirty || busy || conflict || !selected || query.isError} loading={busy}>
                {selected?.enrollment_id === rows[rows.length - 1]?.enrollment_id ? "저장" : "저장하고 다음 학생"}
              </Button>
            </form>}
            {error && <p role="alert">{error} {conflict && <button type="button" disabled={busy} onClick={() => void reviewLatest()}>최신 값 확인</button>}</p>}
            {message && <p role="status">{message}</p>}
          </>}
      </div>
    </ModalBody>
  </AdminModal>;
}
