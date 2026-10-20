import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { assessmentCommentQueryKeys, fetchAdminParentComments, saveParentComment, type AdminParentComment, type AssessmentKind } from "@/shared/api/assessmentComments";
import { AdminModal, ModalHeader, ModalBody, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { readActiveAuthGenerationSafely } from "@/shared/auth/tokenSession";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import useAuth from "@/auth/hooks/useAuth";
import { getTenantUserLocalKey } from "@/shared/utils/safeLocalStorage";
import "./ParentAssessmentCommentsPanel.css";

const COMMENT_DRAFTS = ["parent-assessment-comment-drafts"] as const;

type CommentDraft = { row: AdminParentComment; text: string; savedText: string; version: number; history: AdminParentComment["history"] };

export type ParentAssessmentCommentsPanelProps = { sessionId: number; assessmentKind: AssessmentKind; assessmentId: number; title: string; onClose: () => void };
export default function ParentAssessmentCommentsPanel(props: ParentAssessmentCommentsPanelProps) {
  const { user } = useAuth();
  const draftScope = getTenantUserLocalKey(`assessment-comments:${props.sessionId}:${props.assessmentKind}:${props.assessmentId}`, user?.id);
  return <ScopedCommentsPanel key={`${draftScope}:${props.sessionId}:${props.assessmentKind}:${props.assessmentId}`} {...props} draftScope={draftScope} />;
}
function ScopedCommentsPanel(props: ParentAssessmentCommentsPanelProps & { draftScope: string | null }) {
  const { sessionId, assessmentKind, assessmentId, title, onClose } = props;
  const key = assessmentCommentQueryKeys.admin(sessionId, assessmentKind, assessmentId);
  const query = useQuery({ queryKey: key, queryFn: () => fetchAdminParentComments(sessionId, assessmentKind, assessmentId) });
  const client = useQueryClient();
  const { draftScope } = props;
  const draftKey = [...COMMENT_DRAFTS, draftScope] as const;
  useEffect(() => { client.setQueryDefaults(COMMENT_DRAFTS, { gcTime: Infinity }); }, [client]);
  const [drafts, setDrafts] = useState<Map<number, CommentDraft>>(() =>
    new Map(draftScope ? client.getQueryData<Map<number, CommentDraft>>(draftKey) : undefined));
  const draftsRef = useRef(drafts);
  const active = useRef(true);
  const [generation] = useState(readActiveAuthGenerationSafely);
  const [tenantCode] = useState(getTenantCodeForApiRequest);
  const isActiveScope = () => active.current
    && generation === readActiveAuthGenerationSafely()
    && tenantCode === getTenantCodeForApiRequest();
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const busyRows = useRef(new Map<number, AdminParentComment>());
  const [busyIds, setBusyIds] = useState(new Set<number>());
  const updateDraft = (id: number, draft: CommentDraft | null) => {
    if (!isActiveScope()) return;
    const next = new Map(draftsRef.current);
    if (draft) next.set(id, draft); else next.delete(id);
    draftsRef.current = next; setDrafts(next);
    if (draftScope) {
      if (next.size) {
        client.setQueryData(draftKey, next);
      } else client.removeQueries({ queryKey: draftKey, exact: true });
    }
  };
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!draftsRef.current.size) return;
      event.preventDefault(); event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const assignedIds = new Set(query.data?.map(row => row.enrollment_id));
  const rows = new Map(query.data?.map(row => [row.enrollment_id, row]));
  for (const [id, draft] of drafts) if (!rows.has(id)) rows.set(id, draft.row);
  for (const [id, row] of busyRows.current) if (!rows.has(id)) rows.set(id, row);
  const confirm = useConfirm();
  const close = async () => {
    if (busyIds.size) return;
    if (draftsRef.current.size && !await confirm({ title: "작성 중인 코멘트", message: "공개하지 않은 입력 내용이 있습니다. 저장하지 않고 닫을까요?", confirmText: "저장하지 않고 닫기" })) return;
    if (!isActiveScope()) return;
    if (draftScope) client.removeQueries({ queryKey: draftKey, exact: true });
    onClose();
  };
  return <AdminModal open width={MODAL_WIDTH.wide} closeDisabled={busyIds.size > 0} onClose={() => void close()}>
    <ModalHeader title="학부모 코멘트" subtitle={title} />
    <ModalBody>
    <p className="parent-comment-help">이 시험·과제에 대한 관찰과 가정에서 도울 내용을 적어 주세요. ‘학부모에게 공개’를 누르면 해당 학생의 학부모만 성적표에서 확인합니다.</p>
    {query.isPending && <p role="status">불러오는 중…</p>}
    {query.isError && <div role="alert">코멘트를 불러오지 못했습니다. <button onClick={() => void query.refetch()}>다시 시도</button></div>}
    {!query.isFetching && !query.isError && query.data?.length === 0 && <p>이 평가에 배정된 학생이 없습니다.</p>}
    {[...rows.values()].map(row => <CommentEditor key={row.enrollment_id} row={row} {...props}
      assignmentState={query.isError ? "error" : query.isPending || query.isFetching ? "checking" : assignedIds.has(row.enrollment_id) ? "assigned" : "unassigned"}
      onRecheck={() => { void query.refetch(); }} recovery={drafts.get(row.enrollment_id)}
      onDraft={(draft) => updateDraft(row.enrollment_id, draft)}
      onBusy={(value) => {
        if (!isActiveScope()) return;
        if (value) busyRows.current.set(row.enrollment_id, row); else busyRows.current.delete(row.enrollment_id);
        setBusyIds(new Set(busyRows.current.keys()));
      }} onSaved={() => { if (isActiveScope()) void client.invalidateQueries({ queryKey: key }); }} />)}
    </ModalBody>
  </AdminModal>;
}
function CommentEditor({ row, sessionId, assessmentKind, assessmentId, onSaved, onDraft, onBusy, assignmentState, onRecheck, recovery }: ParentAssessmentCommentsPanelProps & { row: AdminParentComment; assignmentState: "assigned" | "unassigned" | "checking" | "error"; onRecheck: () => void; recovery?: CommentDraft; onSaved: () => void; onDraft: (draft: CommentDraft | null) => void; onBusy: (busy: boolean) => void }) {
  const assigned = assignmentState === "assigned";
  const [text, setText] = useState(recovery?.text ?? row.text);
  const [savedText, setSavedText] = useState(recovery?.savedText ?? row.text);
  const [version, setVersion] = useState(recovery?.version ?? row.version);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const pending = useRef(false);
  const latestText = useRef(text);
  latestText.current = text;
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const [history, setHistory] = useState(recovery?.history ?? row.history);
  useEffect(() => {
    // Keep unpublished drafts on their original baseline. Once clean again,
    // consume a newer server revision; never undo a completed save with stale props.
    if (busy || text !== savedText || row.version <= version) return;
    setText(row.text); setSavedText(row.text); setVersion(row.version);
    setHistory(row.history); setConflict(false); setMessage("");
  }, [row, busy, text, savedText, version]);
  async function save() {
    if (!assigned || pending.current) return;
    pending.current = true;
    setBusy(true); onBusy(true); setMessage("");
    try {
      const saved = await saveParentComment(sessionId, assessmentKind, assessmentId, row.enrollment_id, text, version);
      setVersion(saved.version); setHistory(saved.history); setText(saved.text); setSavedText(saved.text); onDraft(null); setMessage(saved.text.trim() ? "학부모에게 공개했습니다." : "학부모 코멘트를 비웠습니다."); setConflict(false); onSaved();
    } catch (error) {
      const e = error as { response?: { status?: number } };
      setConflict(e.response?.status === 409);
      setMessage(e.response?.status === 409 ? "다른 선생님이 수정했습니다. 입력한 내용은 유지됩니다. 최신 내용을 확인한 후 다시 저장해 주세요." : "저장하지 못했습니다. 입력 내용은 유지됩니다. 다시 시도해 주세요.");
    } finally { pending.current = false; setBusy(false); onBusy(false); }
  }
  async function reload() {
    if (pending.current) return;
    pending.current = true;
    setRefreshing(true); onBusy(true);
    try {
      const current = (await fetchAdminParentComments(sessionId, assessmentKind, assessmentId)).find(r => r.enrollment_id === row.enrollment_id);
      if (current) {
        const currentDraft = latestText.current;
        setVersion(current.version); setHistory(current.history); setSavedText(current.text);
        onDraft(currentDraft !== current.text ? { row, text: currentDraft, savedText: current.text, version: current.version, history: current.history } : null);
        setMessage(`최신 코멘트: ${current.text || "(비어 있음)"} · 현재 입력 내용을 저장하면 최신 코멘트를 변경합니다.`); setConflict(false);
      }
      else { setMessage("이 평가의 배정이 변경되었습니다. 작성 내용을 복사한 뒤 창을 닫고 배정을 확인해 주세요."); }
    } catch { setMessage("최신 내용을 불러오지 못했습니다. 다시 시도해 주세요."); }
    finally { pending.current = false; setRefreshing(false); onBusy(false); }
  }
  return <div className="parent-comment-row">
    <label className="block font-medium" htmlFor={`parent-comment-${row.enrollment_id}`}>{row.student_name}</label>
    <div className="parent-comment-editor">
    <textarea id={`parent-comment-${row.enrollment_id}`} value={text} maxLength={2000} disabled={busy} onChange={e => { setText(e.target.value); onDraft(e.target.value !== savedText ? { row, text: e.target.value, savedText, version, history } : null); }} rows={3} placeholder="관찰한 사실과 가정에서 도울 행동을 적어 주세요." />
    <div className="parent-comment-actions"><span>{text.length}/2000</span><Button size="sm" intent="primary" disabled={busy || refreshing || !assigned || conflict || text === savedText} onClick={() => void save()}>{busy ? "공개 중…" : text.trim() ? "학부모에게 공개" : "코멘트 비우기"}</Button>{conflict && <Button size="sm" disabled={refreshing} onClick={() => void reload()}>{refreshing ? "최신 내용 확인 중…" : "최신 내용 확인"}</Button>}</div>
    {!assigned && <div role="status" className="text-sm">
      {assignmentState === "checking" ? "현재 배정을 확인하고 있습니다. 입력은 유지됩니다." : assignmentState === "error" ? "현재 배정을 확인하지 못했습니다. 입력은 유지되며 확인 후 공개할 수 있습니다." : "이 평가의 배정이 해제되어 공개할 수 없습니다. 입력은 유지됩니다. 내용을 편집·복사하거나 배정을 복구한 후 공개할 수 있습니다."}
      <Button size="sm" disabled={busy || refreshing || assignmentState === "checking"} onClick={onRecheck}>{assignmentState === "checking" ? "배정 확인 중…" : "배정 다시 확인"}</Button>
      <Button size="sm" disabled={busy || refreshing} onClick={() => { setText(savedText); setConflict(false); setMessage(""); onDraft(null); }}>초안 버리기</Button>
    </div>}
    {message && <p role="status" className="text-sm whitespace-pre-wrap">{message}</p>}
    {history.length > 0 && <details><summary>수정 이력 ({history.length})</summary>{history.map(h => <div key={h.version} className="text-sm border-t py-2"><span>{h.author_name} · </span><time>{new Date(h.created_at).toLocaleString("ko-KR")}</time><p className="whitespace-pre-wrap break-words">{h.text || "코멘트 비움"}</p></div>)}</details>}
    </div>
  </div>;
}
