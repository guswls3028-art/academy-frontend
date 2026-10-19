import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { assessmentCommentQueryKeys, fetchAdminParentComments, saveParentComment, type AdminParentComment, type AssessmentKind } from "@/shared/api/assessmentComments";
import { AdminModal, ModalHeader, ModalBody, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import "./ParentAssessmentCommentsPanel.css";

export type ParentAssessmentCommentsPanelProps = { sessionId: number; assessmentKind: AssessmentKind; assessmentId: number; title: string; onClose: () => void };
export default function ParentAssessmentCommentsPanel(props: ParentAssessmentCommentsPanelProps) {
  const { sessionId, assessmentKind, assessmentId, title, onClose } = props;
  const key = assessmentCommentQueryKeys.admin(sessionId, assessmentKind, assessmentId);
  const query = useQuery({ queryKey: key, queryFn: () => fetchAdminParentComments(sessionId, assessmentKind, assessmentId) });
  const client = useQueryClient();
  const dirty = useRef(new Set<number>());
  const [busyIds, setBusyIds] = useState(new Set<number>());
  const confirm = useConfirm();
  const close = async () => {
    if (busyIds.size) return;
    if (dirty.current.size && !await confirm({ title: "작성 중인 코멘트", message: "공개하지 않은 입력 내용이 있습니다. 저장하지 않고 닫을까요?", confirmText: "저장하지 않고 닫기" })) return;
    onClose();
  };
  return <AdminModal open width={MODAL_WIDTH.wide} closeDisabled={busyIds.size > 0} onClose={() => void close()}>
    <ModalHeader title="학부모 코멘트" subtitle={title} />
    <ModalBody>
    <p className="parent-comment-help">이 시험·과제에 대한 관찰과 가정에서 도울 내용을 적어 주세요. ‘학부모에게 공개’를 누르면 해당 학생의 학부모만 성적표에서 확인합니다.</p>
    {query.isPending && <p role="status">불러오는 중…</p>}
    {query.isError && <div role="alert">코멘트를 불러오지 못했습니다. <button onClick={() => void query.refetch()}>다시 시도</button></div>}
    {query.data?.length === 0 && <p>이 평가에 배정된 학생이 없습니다.</p>}
    {query.data?.map(row => <CommentEditor key={row.enrollment_id} row={row} {...props} onDirty={(value) => { if (value) dirty.current.add(row.enrollment_id); else dirty.current.delete(row.enrollment_id); }} onBusy={(value) => setBusyIds((current) => { const next = new Set(current); if (value) next.add(row.enrollment_id); else next.delete(row.enrollment_id); return next; })} onSaved={() => void client.invalidateQueries({ queryKey: key })} />)}
    </ModalBody>
  </AdminModal>;
}
function CommentEditor({ row, sessionId, assessmentKind, assessmentId, onSaved, onDirty, onBusy }: ParentAssessmentCommentsPanelProps & { row: AdminParentComment; onSaved: () => void; onDirty: (dirty: boolean) => void; onBusy: (busy: boolean) => void }) {
  const [text, setText] = useState(row.text);
  const [savedText, setSavedText] = useState(row.text);
  const [version, setVersion] = useState(row.version);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const [history, setHistory] = useState(row.history);
  async function save() {
    setBusy(true); onBusy(true); setMessage("");
    try {
      const saved = await saveParentComment(sessionId, assessmentKind, assessmentId, row.enrollment_id, text, version);
      setVersion(saved.version); setHistory(saved.history); setText(saved.text); setSavedText(saved.text); onDirty(false); setMessage(saved.text.trim() ? "학부모에게 공개했습니다." : "학부모 코멘트를 비웠습니다."); setConflict(false); onSaved();
    } catch (error) {
      const e = error as { response?: { status?: number } };
      setConflict(e.response?.status === 409);
      setMessage(e.response?.status === 409 ? "다른 선생님이 수정했습니다. 입력한 내용은 유지됩니다. 최신 내용을 확인한 후 다시 저장해 주세요." : "저장하지 못했습니다. 입력 내용은 유지됩니다. 다시 시도해 주세요.");
    } finally { setBusy(false); onBusy(false); }
  }
  async function reload() {
    try {
      const current = (await fetchAdminParentComments(sessionId, assessmentKind, assessmentId)).find(r => r.enrollment_id === row.enrollment_id);
      if (current) { setVersion(current.version); setHistory(current.history); setSavedText(current.text); onDirty(text !== current.text); setMessage(`최신 코멘트: ${current.text || "(비어 있음)"} · 현재 입력 내용을 저장하면 최신 코멘트를 변경합니다.`); setConflict(false); }
      else { setMessage("이 평가의 배정이 변경되었습니다. 작성 내용을 복사한 뒤 창을 닫고 배정을 확인해 주세요."); }
    } catch { setMessage("최신 내용을 불러오지 못했습니다. 다시 시도해 주세요."); }
  }
  return <div className="parent-comment-row">
    <label className="block font-medium" htmlFor={`parent-comment-${row.enrollment_id}`}>{row.student_name}</label>
    <div className="parent-comment-editor">
    <textarea id={`parent-comment-${row.enrollment_id}`} value={text} maxLength={2000} disabled={busy} onChange={e => { setText(e.target.value); onDirty(e.target.value !== savedText); }} rows={3} placeholder="관찰한 사실과 가정에서 도울 행동을 적어 주세요." />
    <div className="parent-comment-actions"><span>{text.length}/2000</span><Button size="sm" intent="primary" disabled={busy || conflict || text === savedText} onClick={() => void save()}>{busy ? "공개 중…" : text.trim() ? "학부모에게 공개" : "코멘트 비우기"}</Button>{conflict && <Button size="sm" onClick={() => void reload()}>최신 내용 확인</Button>}</div>
    {message && <p role="status" className="text-sm whitespace-pre-wrap">{message}</p>}
    {history.length > 0 && <details><summary>수정 이력 ({history.length})</summary>{history.map(h => <div key={h.version} className="text-sm border-t py-2"><span>{h.author_name} · </span><time>{new Date(h.created_at).toLocaleString("ko-KR")}</time><p className="whitespace-pre-wrap break-words">{h.text || "코멘트 비움"}</p></div>)}</details>}
    </div>
  </div>;
}
