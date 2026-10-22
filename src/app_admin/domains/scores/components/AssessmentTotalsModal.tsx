import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { extractApiError } from "@/shared/utils/extractApiError";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import useAuth from "@/auth/hooks/useAuth";
import { getTenantUserLocalKey } from "@/shared/utils/safeLocalStorage";
import { readActiveAuthGenerationSafely } from "@/shared/auth/tokenSession";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { fetchSessionScores, saveScoreTotalConfig, type SessionScoreMeta } from "../api/sessionScores";
import { scoresQueryKeys } from "../api/queryKeys";
import "./AssessmentTotalsModal.css";

type Props = { sessionId: number; meta: SessionScoreMeta; onClose: () => void };
type TotalOrder = { exam_ids: number[]; homework_ids: number[] };
type TotalDraft = { meta: SessionScoreMeta; version: number; order: TotalOrder };
const TOTAL_DRAFTS = ["assessment-total-drafts"] as const;

function initialDraft(meta: SessionScoreMeta): TotalDraft {
  const initial = meta.total_config ?? { version: 0, exam_ids: meta.exams.map((x) => x.exam_id), homework_ids: meta.homeworks.filter((x) => x.grading_mode !== "COMPLETION").map((x) => x.homework_id) };
  return { meta, version: initial.version, order: {
    exam_ids: [...meta.exams.filter((x) => initial.exam_ids.includes(x.exam_id)).map((x) => x.exam_id), 0, ...meta.exams.filter((x) => !initial.exam_ids.includes(x.exam_id)).map((x) => x.exam_id)],
    homework_ids: [...meta.homeworks.filter((x) => initial.homework_ids.includes(x.homework_id)).map((x) => x.homework_id), 0, ...meta.homeworks.filter((x) => x.grading_mode !== "COMPLETION" && !initial.homework_ids.includes(x.homework_id)).map((x) => x.homework_id)],
  } };
}
function isDirty(draft: TotalDraft) {
  return JSON.stringify(draft.order) !== JSON.stringify(initialDraft(draft.meta).order);
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
  const { meta, order } = draft;
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
  const move = (key: "exam_ids" | "homework_ids", from: number, to: number) => {
    if (busy.current) return;
    const current = draftRef.current;
    const next = [...current.order[key]];
    if (from < 0 || to < 0 || from >= next.length || to >= next.length) return;
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    updateDraft({ ...current, order: { ...current.order, [key]: next } });
  };
  const close = async () => {
    if (busy.current || closing.current) return;
    closing.current = true;
    try {
      if (isDirty(draftRef.current) && !await confirm({
        title: "저장하지 않은 합산 설정", message: "변경한 합산 선택을 저장하지 않고 닫을까요?",
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
    const { meta, version, order } = submitted;
    setSaving(true);
    setError("");
    try {
      const scoredHomeworkOrder = order.homework_ids.filter(Boolean);
      let scoredHomeworkIndex = 0;
      await saveScoreTotalConfig(sessionId, {
        version,
        exam_ids: order.exam_ids.slice(0, order.exam_ids.indexOf(0)),
        homework_ids: order.homework_ids.slice(0, order.homework_ids.indexOf(0)),
        exam_order: order.exam_ids.filter(Boolean),
        // Completion items are edited in the table, so retain their positions here.
        homework_order: meta.homeworks.map((item) => item.grading_mode === "COMPLETION"
          ? item.homework_id : scoredHomeworkOrder[scoredHomeworkIndex++]),
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
      setError(extractApiError(cause, "합산 설정을 저장하지 못했습니다. 선택은 유지됩니다. 다시 시도해 주세요."));
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
  return <AdminModal open closeDisabled={saving} onClose={() => void close()}>
    <ModalHeader title="합산 설정" subtitle={meta.session_title} />
    <ModalBody>
      <p className="assessment-totals-help">항목이나 ‘총점’을 끌어 순서를 바꾸세요. 총점 앞의 항목만 합산합니다. 화살표 버튼으로도 이동할 수 있습니다.</p>
      {([
        { key: "exam_ids" as const, title: "시험 총점", items: meta.exams.map((x) => ({ id: x.exam_id, title: x.title, max: x.max_score })) },
        { key: "homework_ids" as const, title: "과제 총점", items: meta.homeworks.filter((x) => x.grading_mode !== "COMPLETION").map((x) => ({ id: x.homework_id, title: x.title, max: x.max_score })) },
      ]).map(({ key, title, items }) => <fieldset key={key} className="assessment-totals-group" disabled={saving}>
        <legend>{title} · {order[key].indexOf(0)}개 합산</legend>
        {items.length ? order[key].map((id, index) => {
          const item = items.find((entry) => entry.id === id);
          const label = id === 0 ? title : item?.title ?? "";
          return <div key={id} className={`assessment-totals-option ${id === 0 ? "assessment-totals-divider" : ""}`} draggable={!saving} onDragStart={(event) => event.dataTransfer.setData("text/plain", `${key}:${index}`)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
            event.preventDefault();
            const [source, from] = event.dataTransfer.getData("text/plain").split(":");
            if (source === key && /^\d+$/.test(from)) move(key, Number(from), index);
          }}>
            <GripVertical size={ICON_FOR_BUTTON.sm} aria-hidden />
            <span>{id === 0 ? `Σ ${title}` : label}<small className="block">{id === 0 ? "위 항목만 합산" : index < order[key].indexOf(0) ? `${item?.max}점 만점 · 합산` : "합산 제외"}</small></span>
            <Button size="lg" className="h-11 shrink-0" intent="ghost" iconOnly leftIcon={<ChevronUp size={ICON_FOR_BUTTON.md} />} aria-label={`${label} 위로 이동`} disabled={index === 0} onClick={() => move(key, index, index - 1)} />
            <Button size="lg" className="h-11 shrink-0" intent="ghost" iconOnly leftIcon={<ChevronDown size={ICON_FOR_BUTTON.md} />} aria-label={`${label} 아래로 이동`} disabled={index === order[key].length - 1} onClick={() => move(key, index, index + 1)} />
          </div>;
        }) : <p className="assessment-totals-help">합산할 점수형 항목이 없습니다.</p>}
      </fieldset>)}
      <p className="assessment-totals-help">통과형 과제는 점수 합계에 포함하지 않습니다. 미입력·미채점 점수는 ‘집계 중’으로 표시합니다.</p>
      {error && <p role="alert" className="assessment-totals-error">{error}</p>}
      {conflict && <Button disabled={saving} onClick={() => void reload()}>최신 설정으로 다시 시작</Button>}
    </ModalBody>
    <ModalFooter right={<><Button intent="secondary" onClick={() => void close()} disabled={saving}>취소</Button><Button intent="primary" onClick={() => void save()} disabled={saving || conflict}>{saving ? "저장 중…" : "합산 설정 저장"}</Button></>} />
  </AdminModal>;
}
