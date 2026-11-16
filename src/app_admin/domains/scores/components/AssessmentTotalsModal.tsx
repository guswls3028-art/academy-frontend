import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { extractApiError } from "@/shared/utils/extractApiError";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import useAuth from "@/auth/hooks/useAuth";
import { getTenantUserLocalKey } from "@/shared/utils/safeLocalStorage";
import { readActiveAuthGenerationSafely } from "@/shared/auth/tokenSession";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { fetchSessionScores, saveScoreTotalConfig, type SessionScoreMeta, type ScoreTotalColumnKind } from "../api/sessionScores";
import { scoresQueryKeys } from "../api/queryKeys";
import "./AssessmentTotalsModal.css";

type Props = { sessionId: number; meta: SessionScoreMeta; onClose: () => void };
type TotalSettings = {
  order: Record<ScoreTotalColumnKind, readonly number[]>;
  selected: Record<ScoreTotalColumnKind, ReadonlySet<number>>;
};
type TotalDraft = { meta: SessionScoreMeta; baseline: TotalSettings; settings: TotalSettings };
type TotalItem = { id: number; title: string; max: number | null; completion?: boolean };
const TOTAL_GROUPS = ["exam", "homework"] as const;
const TOTAL_DRAFTS = ["assessment-total-drafts"] as const;

function initialDraft(meta: SessionScoreMeta): TotalDraft {
  // The score endpoint returns complete, session-local ordered metadata.
  const order = {
    exam: meta.exams.map((item) => item.exam_id),
    homework: meta.homeworks.map((item) => item.homework_id),
  };
  const selected = {
    exam: new Set(meta.total_config?.exam_ids ?? order.exam),
    homework: new Set(meta.total_config?.homework_ids ?? meta.homeworks
      .filter((item) => item.grading_mode !== "COMPLETION").map((item) => item.homework_id)),
  };
  const settings = { order, selected };
  return { meta, baseline: settings, settings };
}

function isDirty({ settings, baseline }: TotalDraft) {
  return TOTAL_GROUPS.some((kind) => settings.order[kind].some((id, index) =>
    id !== baseline.order[kind][index] || settings.selected[kind].has(id) !== baseline.selected[kind].has(id),
  ));
}
export default function AssessmentTotalsModal(props: Props) {
  const { user } = useAuth();
  const draftScope = getTenantUserLocalKey(`assessment-totals:${props.sessionId}`, user?.id);
  return <ScopedTotalsModal key={`${draftScope}:${props.sessionId}`} {...props} draftScope={draftScope} />;
}
function ScopedTotalsModal({ sessionId, meta: serverMeta, onClose, draftScope }: Props & { draftScope: string | null }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const draftKey = [...TOTAL_DRAFTS, draftScope] as const;
  const [draft, setDraft] = useState<TotalDraft>(() =>
    (draftScope ? qc.getQueryData<TotalDraft>(draftKey) : undefined) ?? initialDraft(serverMeta));
  const draftRef = useRef(draft);
  const { meta, settings: { order, selected } } = draft;
  const itemsByKind = useMemo(() => ({
    exam: new Map<number, TotalItem>(meta.exams.map((item) => [item.exam_id, {
      id: item.exam_id, title: item.title, max: item.max_score,
    }])),
    homework: new Map<number, TotalItem>(meta.homeworks.map((item) => [item.homework_id, {
      id: item.homework_id, title: item.title, max: item.max_score, completion: item.grading_mode === "COMPLETION",
    }])),
  }), [meta.exams, meta.homeworks]);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const closing = useRef(false);
  const active = useRef(true);
  const [generation] = useState(readActiveAuthGenerationSafely);
  const [tenantCode] = useState(getTenantCodeForApiRequest);
  const sameAuth = () => generation === readActiveAuthGenerationSafely() && tenantCode === getTenantCodeForApiRequest();
  const isActiveScope = () => active.current && sameAuth();
  useEffect(() => {
    qc.setQueryDefaults(TOTAL_DRAFTS, { gcTime: Infinity, structuralSharing: false });
    active.current = true;
    const warn = (event: BeforeUnloadEvent) => {
      if (!isDirty(draftRef.current)) return;
      event.preventDefault(); event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => { active.current = false; window.removeEventListener("beforeunload", warn); };
  }, [qc]);
  const clearDraft = (saved: TotalDraft) => {
    // A late response may finish after another editor has recovered and changed this draft.
    if (draftScope && sameAuth() && qc.getQueryData(draftKey) === saved) {
      qc.removeQueries({ queryKey: draftKey, exact: true });
    }
  };
  const updateDraft = (next: TotalDraft) => {
    if (!isActiveScope()) return;
    draftRef.current = next; setDraft(next);
    if (draftScope) {
      if (isDirty(next)) qc.setQueryData(draftKey, next);
      else qc.removeQueries({ queryKey: draftKey, exact: true });
    }
  };
  const select = (kind: ScoreTotalColumnKind, ids: ReadonlySet<number>) => {
    if (busy.current) return;
    const current = draftRef.current;
    const { settings } = current;
    updateDraft({ ...current, settings: { ...settings, selected: { ...settings.selected, [kind]: ids } } });
  };
  const toggle = (kind: ScoreTotalColumnKind, id: number, checked: boolean) => {
    const ids = new Set(draftRef.current.settings.selected[kind]);
    if (checked) ids.add(id);
    else ids.delete(id);
    select(kind, ids);
  };
  const move = (kind: ScoreTotalColumnKind, fromId: number, toId: number) => {
    if (busy.current || fromId === toId) return;
    const current = draftRef.current;
    const { settings } = current;
    const ids = settings.order[kind];
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, fromId);
    updateDraft({ ...current, settings: { ...settings, order: { ...settings.order, [kind]: next } } });
  };
  const close = async () => {
    if (busy.current || closing.current) return;
    closing.current = true;
    try {
      if (isDirty(draftRef.current) && !await confirm({
        title: "저장하지 않은 합산 설정", message: "변경한 합산 설정을 저장하지 않고 닫을까요?",
        confirmText: "저장하지 않고 닫기", cancelText: "계속 편집",
      })) return;
      if (!isActiveScope()) return;
      clearDraft(draftRef.current);
      onClose();
    } finally { closing.current = false; }
  };
  const save = async () => {
    if (busy.current || !isActiveScope()) return;
    busy.current = true;
    const submitted = draftRef.current;
    const { meta, settings: { order, selected } } = submitted;
    setSaving(true);
    setError("");
    try {
      await saveScoreTotalConfig(sessionId, {
        version: meta.total_config?.version ?? 0,
        exam_ids: order.exam.filter((id) => selected.exam.has(id)),
        homework_ids: order.homework.filter((id) => selected.homework.has(id)),
        exam_order: [...order.exam],
        homework_order: [...order.homework],
      });
      if (!sameAuth()) return;
      clearDraft(submitted);
      await qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(sessionId) });
      if (!isActiveScope()) return;
      feedback.success("시험·과제 합산 설정을 저장했습니다.");
      onClose();
    } catch (cause) {
      if (!isActiveScope()) return;
      setConflict([400, 409].includes((cause as { response?: { status?: number } }).response?.status ?? 0));
      setError(extractApiError(cause, "합산 설정을 저장하지 못했습니다. 편집 내용은 유지됩니다. 다시 시도해 주세요."));
    } finally { busy.current = false; if (isActiveScope()) setSaving(false); }
  };
  const reload = async () => {
    if (busy.current || !isActiveScope()) return;
    busy.current = true;
    setSaving(true);
    try {
      const fresh = await fetchSessionScores(sessionId);
      if (!isActiveScope()) return;
      const config = fresh.meta.total_config;
      if (!config) throw new Error("합산 설정이 없습니다.");
      qc.setQueryData(scoresQueryKeys.sessionScores(sessionId), fresh);
      updateDraft(initialDraft(fresh.meta));
      setConflict(false); setError("");
    } catch { if (isActiveScope()) setError("최신 설정을 불러오지 못했습니다. 다시 시도해 주세요."); }
    finally { busy.current = false; if (isActiveScope()) setSaving(false); }
  };
  return <AdminModal open width={760} closeDisabled={saving} onClose={() => void close()}>
    <ModalHeader title="합산 설정" subtitle={meta.session_title} />
    <ModalBody>
      <p className="assessment-totals-help">총점에 포함할 항목을 체크하세요. 손잡이를 끌거나 화살표를 눌러 성적표와 알림톡의 항목 순서를 바꿀 수 있습니다.</p>
      <div className="assessment-totals-groups">{TOTAL_GROUPS.map((kind) => {
        const title = kind === "exam" ? "시험 총점" : "과제 총점";
        const ids = order[kind];
        const items = ids.map((id) => itemsByKind[kind].get(id)!);
        const eligible = items.filter((item) => !item.completion);
        const selectedItems = eligible.filter((item) => selected[kind].has(item.id));
        const maximum = selectedItems.reduce((sum, item) => sum + (item.max ?? 0), 0);
        const dragType = `text/x-academy-total-${kind}`;
        return <fieldset key={kind} className="assessment-totals-group" disabled={saving}>
          <legend>{title} · {selectedItems.length}개 합산</legend>
          {items.length ? <>
            {eligible.length > 0 && <div className="assessment-totals-group-summary">
              <span role="status">{selectedItems.length ? selectedItems.some(item => item.max == null) ? "만점 미설정 항목 포함" : `합산 만점 ${maximum.toLocaleString()}점` : "합산할 항목을 선택하지 않았습니다"}</span>
              <div className="assessment-totals-selection-actions">
                <Button size="sm" intent="ghost" disabled={selectedItems.length === eligible.length} onClick={() => select(kind, new Set(eligible.map((item) => item.id)))}>전체 선택</Button>
                <Button size="sm" intent="ghost" disabled={!selectedItems.length} onClick={() => select(kind, new Set())}>선택 해제</Button>
              </div>
            </div>}
            <div className="assessment-totals-options">
              {items.map((item, index) => {
                const checked = selected[kind].has(item.id);
                const previous = ids[index - 1];
                const next = ids[index + 1];
                return <div key={item.id} className="assessment-totals-option" data-selected={checked}
                  onDragOver={(event) => {
                    if (saving || !event.dataTransfer.types.includes(dragType)) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    event.currentTarget.classList.add("assessment-totals-option--drop");
                  }}
                  onDragLeave={(event) => {
                    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
                    event.currentTarget.classList.remove("assessment-totals-option--drop");
                  }}
                  onDrop={(event) => {
                    event.currentTarget.classList.remove("assessment-totals-option--drop");
                    const id = event.dataTransfer.getData(dragType);
                    if (!id) return;
                    event.preventDefault();
                    move(kind, Number(id), item.id);
                  }}
                >
                  {items.length > 1 && <span
                    className="assessment-totals-drag-handle"
                    draggable={!saving}
                    title={`${item.title} 순서 끌어서 변경`}
                    aria-hidden="true"
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData(dragType, String(item.id));
                    }}
                  ><GripVertical size={ICON.sm} /></span>}
                  {item.completion ? (
                    <span className="assessment-totals-option-copy assessment-totals-option-completion">
                      <strong>{item.title}</strong><small>통과형 · 순서만 설정</small>
                    </span>
                  ) : (
                    <label className="assessment-totals-option-label">
                      <input type="checkbox" checked={checked} aria-label={`${item.title} 합산에 포함`} onChange={(event) => toggle(kind, item.id, event.target.checked)} />
                      <span className="assessment-totals-option-copy">
                        <strong>{item.title}</strong>
                        <small>{item.max == null ? "만점 미설정" : `${item.max.toLocaleString()}점 만점`}</small>
                      </span>
                    </label>
                  )}
                  {items.length > 1 && <div className="assessment-totals-move-actions">
                    <Button type="button" size="sm" intent="ghost" iconOnly leftIcon={<ChevronUp size={ICON_FOR_BUTTON.sm} />}
                      disabled={previous == null} aria-label={`${item.title} 위로 이동`}
                      onClick={() => move(kind, item.id, previous)} />
                    <Button type="button" size="sm" intent="ghost" iconOnly leftIcon={<ChevronDown size={ICON_FOR_BUTTON.sm} />}
                      disabled={next == null} aria-label={`${item.title} 아래로 이동`}
                      onClick={() => move(kind, item.id, next)} />
                  </div>}
                </div>;
              })}
            </div>
          </> : <p className="assessment-totals-empty">합산할 점수형 항목이 없습니다.</p>}
        </fieldset>;
      })}</div>
      <p className="assessment-totals-help">합산 선택과 표시 순서는 별개입니다. 항목을 이동해도 합산 여부는 바뀌지 않으며, 제외한 항목도 성적표와 알림톡 결과에서 사용할 수 있습니다.</p>
      <p className="assessment-totals-help">통과형 과제는 점수 합계에 포함하지 않습니다. 미입력·미채점 점수는 ‘집계 중’으로 표시합니다.</p>
      {error && <p role="alert" className="assessment-totals-error">{error}</p>}
      {conflict && <Button disabled={saving} onClick={() => void reload()}>최신 설정으로 다시 시작</Button>}
    </ModalBody>
    <ModalFooter right={<><Button intent="secondary" onClick={() => void close()} disabled={saving}>취소</Button><Button intent="primary" onClick={() => void save()} disabled={saving || conflict}>{saving ? "저장 중…" : "합산 설정 저장"}</Button></>} />
  </AdminModal>;
}
