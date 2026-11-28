import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRegularOrder } from "@/shared/product/sessions/sessionOrdering";
import { Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { extractApiError } from "@/shared/utils/extractApiError";
import { getSessionItem, setSessionItem } from "@/shared/utils/safeSessionStorage";
import { fetchSessions } from "../../api/sessions";
import { adminLectureQueryKeys } from "../../queryKeys";
import { createBatch, fieldKey, loadRange, prepareSelection, sourceKey, type Range, type Selection } from "./rangeWrongNotes";
import WrongNoteBatchResult from "./WrongNoteBatchResult";
import styles from "./RangeWrongNoteModal.module.css";

type Draft = { range: Range | null; values: Record<string, string>; batchId: number | null };
const empty: Draft = { range: null, values: {}, batchId: null };
const positive = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n > 0;

function restore(scope: string): Draft {
  try {
    const data = JSON.parse(getSessionItem(scope) ?? "null");
    if (!positive(data?.range?.from_session_order) || !positive(data.range.to_session_order)
      || data.range.from_session_order > data.range.to_session_order
      || !data.values || typeof data.values !== "object" || Array.isArray(data.values)
      || !Object.entries(data.values).every(([k, v]) => /^\d+:(exam|homework):\d+$/.test(k) && typeof v === "string")) return empty;
    return { range: data.range, values: data.values, batchId: positive(data.batchId) ? data.batchId : null };
  } catch { return empty; }
}

export default function RangeWrongNoteModal({ lectureId, sessionId, scope, onClose }: {
  lectureId: number; sessionId: number; scope: string; onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => restore(scope));
  const [storageFailed, setStorageFailed] = useState(false);
  const [activeKey, setActiveKey] = useState("");
  const roster = useRef<HTMLDivElement>(null);
  const confirm = useConfirm();
  const client = useQueryClient();
  useEffect(() => {
    if (!draft.range) return;
    const content = JSON.stringify(draft);
    setSessionItem(scope, content);
    setStorageFailed(getSessionItem(scope) !== content);
  }, [scope, draft]);
  const sessionList = useQuery({
    queryKey: adminLectureQueryKeys.lectureSessionsForLecture(lectureId),
    queryFn: () => fetchSessions(lectureId),
    enabled: !draft.batchId,
  });
  const orders = [...new Set((sessionList.data ?? []).map(getRegularOrder).filter(positive))].sort((a, b) => a - b);
  const current = getRegularOrder(sessionList.data?.find(s => s.id === sessionId)) ?? orders[0];
  const range = draft.range ?? { from_session_order: current, to_session_order: current };
  const { from_session_order: from, to_session_order: to } = range;
  const valid = orders.includes(from) && orders.includes(to);
  const catalog = useQuery({
    queryKey: adminLectureQueryKeys.wrongNoteRange(scope, from, to),
    queryFn: () => loadRange(lectureId, range),
    enabled: !draft.batchId && valid,
    retry: false,
  });
  const selection = useMemo(() => catalog.data ? prepareSelection(catalog.data, draft.values) : null, [catalog.data, draft.values]);
  const selectedStudents = useMemo(() => new Map(selection?.students.map(s => [s.enrollment_id, s])), [selection]);
  const studentsWithErrors = useMemo(() => new Set(
    selection && [...selection.errors.keys(), ...selection.stale].map(key => Number(key.split(":", 1)[0]))
  ), [selection]);
  const source = catalog.data?.sources.find(s => sourceKey(s) === activeKey) ?? catalog.data?.sources[0];
  const create = useMutation({
    mutationFn: (students: Selection[]) => createBatch(lectureId, range, students),
    onSuccess: batch => {
      client.setQueryData(adminLectureQueryKeys.wrongNoteBatch(scope, batch.id), batch);
      setDraft(prev => ({ ...prev, range, batchId: batch.id }));
    },
    onError: () => { void catalog.refetch(); },
  });
  const changeRange = async (next: Range) => {
    if (Object.values(draft.values).some(v => v.trim()) && !await confirm({
      title: "차시 범위를 바꿀까요?",
      message: "현재 입력한 오답 번호를 지우고 새 범위의 자료를 불러옵니다.",
      confirmText: "범위 변경",
    })) return;
    setDraft({ ...empty, range: next });
    setActiveKey("");
    create.reset();
  };
  const total = selection?.students.length ?? 0;
  const invalid = Boolean(selection?.errors.size || selection?.stale.length);
  const totalStudents = catalog.data?.students.length ?? 0;
  const showCreateAction = !draft.batchId && sessionList.isSuccess && valid && catalog.isSuccess && source && totalStudents > 0;

  function moveBetweenStudents(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    event.preventDefault();
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.currentTarget.getAttribute("aria-invalid") === "true") return;
    const inputs = Array.from(roster.current?.querySelectorAll<HTMLInputElement>("input:enabled") ?? []);
    const current = inputs.indexOf(event.currentTarget);
    inputs[current + (event.shiftKey ? -1 : 1)]?.focus();
  }

  return (
    <AdminModal open size={draft.batchId ? "wide" : "full"} onClose={onClose} closeDisabled={create.isPending} noMinimize trapFocus>
      <ModalHeader title="차시별 오답노트" description="시험·과제에서 틀린 번호를 입력하면 학생마다 문제와 정답을 한 PDF로 묶습니다." noIcon />
      <ModalBody>
        <div className={styles.workspace}>
          {storageFailed && <p role="alert" className={styles.error}>이 탭에 입력을 보관하지 못했습니다. 문서를 받을 때까지 창을 열어 두세요.</p>}
          {draft.batchId ? <WrongNoteBatchResult id={draft.batchId} scope={scope} onEdit={() => setDraft(prev => ({ ...prev, batchId: null }))} />
            : sessionList.isError ? <div role="alert">{extractApiError(sessionList.error, "차시 목록을 가져오지 못했습니다.")} <Button onClick={() => void sessionList.refetch()}>차시 다시 불러오기</Button></div>
            : sessionList.isPending ? <p role="status">차시를 불러오는 중…</p>
            : !orders.length ? <p>이 강의에 정규 차시가 없습니다.</p>
            : <div className={styles.editor}>
              <div className={styles.setup}>
                <fieldset className={styles.range} disabled={create.isPending}>
                  <legend>정규 차시 범위</legend>
                  <label>시작 차시<select value={from} onChange={e => {
                    const start = Number(e.target.value);
                    void changeRange({ from_session_order: start, to_session_order: !orders.includes(to) || to < start ? start : to });
                  }}>
                    {!orders.includes(from) && <option value={from}>삭제된 차시</option>}
                    {orders.map(n => <option key={n} value={n}>{n}차시</option>)}
                  </select></label>
                  <label>끝 차시<select value={to} onChange={e => {
                    const end = Number(e.target.value);
                    void changeRange({ from_session_order: !orders.includes(from) || from > end ? end : from, to_session_order: end });
                  }}>
                    {!orders.includes(to) && <option value={to}>삭제된 차시</option>}
                    {orders.map(n => <option key={n} value={n}>{n}차시</option>)}
                  </select></label>
                </fieldset>
                {showCreateAction && catalog.data && <>
                    <label className={styles.material}>오답을 입력할 자료
                      <select value={sourceKey(source)} disabled={create.isPending} onChange={e => setActiveKey(e.target.value)}>
                        {catalog.data.sources.map(s => <option key={sourceKey(s)} value={sourceKey(s)}>
                          {s.session_order}차시 · {s.type === "exam" ? "시험" : "과제"} · {s.title}
                        </option>)}
                      </select>
                    </label>
                    <div className={styles.hint}>
                      {source.ready ? (
                        <details><summary>입력 가능한 문항 번호</summary><p>{source.question_numbers.filter(n => !source.unavailable_numbers.includes(n)).join(", ") || "없음"}</p></details>
                      ) : <p>이 자료의 문제와 정답을 준비한 뒤 다시 불러오세요.</p>}
                      {source.unavailable_numbers.length > 0 && <p>문제·정답 확인 필요 · {source.unavailable_numbers.join(", ")}번</p>}
                    </div>
                </>}
              </div>
              <div className={styles.roster}>
                {!valid ? <p role="alert">선택한 차시가 변경되었습니다. 범위를 다시 골라 주세요.</p>
                  : catalog.isError ? <div role="alert">{extractApiError(catalog.error, "자료를 불러오지 못했습니다.")} <Button onClick={() => void catalog.refetch()}>자료 다시 불러오기</Button></div>
                  : !catalog.data || !selection ? <p role="status">자료와 학생을 불러오는 중…</p>
                  : !catalog.data.sources.length ? <p>이 범위에 시험·과제가 없습니다. 다른 차시를 선택해 주세요.</p>
                  : !totalStudents ? <p>이 강의에 등록된 수강생이 없습니다.</p>
                  : source && <>
                    <div className={styles.rosterHeading}>
                      <h3>{source.title} · 학생별 오답 번호</h3>
                      <p>번호는 쉼표나 공백으로 구분하세요. <span className={styles.keys}><kbd>Enter</kbd> 다음 학생 · <kbd>Shift + Enter</kbd> 이전 학생</span></p>
                    </div>
                    <div className={styles.rows} ref={roster}>
                      {catalog.data.students.map(student => {
                        const id = student.enrollment_id;
                        const key = fieldKey(id, source);
                        const assigned = source.enrollment_ids.includes(id);
                        const individual = selectedStudents.get(id);
                        const error = selection.errors.get(key);
                        const hasError = studentsWithErrors.has(id);
                        const count = individual?.sources.reduce((sum, s) => sum + s.numbers.length, 0) ?? 0;
                        return <div className={styles.row} key={id} role="group" aria-label={student.name}>
                          <div className={styles.student}><strong>{student.name}</strong>
                            {hasError ? <span className={styles.error}>입력 확인 필요</span>
                              : count > 0 ? <span className={styles.included}>전체 {count}문항</span>
                                : <span className={styles.muted}>출력 제외</span>}
                          </div>
                          <div>{assigned ? <>
                            <input aria-label={`${student.name} 오답 번호`} aria-invalid={!!error} aria-describedby={error ? `wrong-note-${id}` : undefined}
                              data-modal-local-enter="" aria-keyshortcuts="Enter Shift+Enter" onKeyDown={moveBetweenStudents}
                              placeholder="예: 2, 7, 13" autoComplete="off" disabled={create.isPending || (!source.ready && !draft.values[key])}
                              value={draft.values[key] ?? ""} onChange={e => {
                                setDraft({ ...draft, range, values: { ...draft.values, [key]: e.target.value } });
                                create.reset();
                              }} />
                            {error && <p id={`wrong-note-${id}`} className={styles.error}>{error}</p>}
                          </> : <span className={styles.muted}>이 자료 미배정</span>}</div>
                          <Button size="sm" disabled={!individual || hasError || create.isPending} aria-label={`${student.name} 개인 PDF 만들기`}
                            onClick={() => individual && create.mutate([individual])}>개인 PDF</Button>
                        </div>;
                      })}
                    </div>
                    {selection.stale.length > 0 && <div role="alert">배정 또는 자료가 바뀐 입력 {selection.stale.length}건이 있습니다. <Button disabled={create.isPending} onClick={() => {
                      const values = { ...draft.values };
                      selection.stale.forEach(k => delete values[k]);
                      setDraft({ ...draft, range, values });
                    }}>해당 입력 지우기</Button></div>}
                    {selection.errors.size > 0 && <div role="alert" className={styles.error}>확인이 필요한 입력 {selection.errors.size}건이 있습니다. <Button size="sm" onClick={() => {
                      const key = [...selection.errors.keys()][0];
                      setActiveKey(key.slice(key.indexOf(":") + 1));
                    }}>해당 자료 보기</Button></div>}
                    {create.error && <p role="alert" className={styles.error}>{extractApiError(create.error, "오답노트를 요청하지 못했습니다. 입력을 확인하고 다시 시도해 주세요.")}</p>}
                  </>}
              </div>
            </div>}
        </div>
      </ModalBody>
      {showCreateAction && selection && (
        <ModalFooter
          left={<span className={styles.muted}>{total}명 출력 대상 · {totalStudents - total}명 제외</span>}
          right={
            <Button intent="primary" loading={create.isPending} disabled={!total || invalid} onClick={() => create.mutate(selection.students)}>
              {total > 1 ? `${total}명 오답노트 묶음 만들기` : "오답노트 만들기"}
            </Button>
          }
        />
      )}
    </AdminModal>
  );
}
