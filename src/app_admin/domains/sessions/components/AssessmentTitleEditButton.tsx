import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { fetchAdminExam, updateAdminExam } from "@admin/domains/exams/api/adminExam";
import { fetchAdminHomework, updateAdminHomework } from "@admin/domains/homework/api/adminHomework";
import { isStaleResourceConflict } from "@/shared/api/optimisticConcurrency";
import { Button, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";

type Props = { kind: "exam" | "homework"; id: number; title: string; disabled?: boolean; compact?: boolean };

/** A title-only edit must never submit grading defaults or regrade existing work. */
export default function AssessmentTitleEditButton({ kind, id, title, disabled, compact }: Props) {
  const qc = useQueryClient();
  const label = kind === "exam" ? "시험" : "과제";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(title);
  const [version, setVersion] = useState("");
  const [currentTitle, setCurrentTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const saveInFlight = useRef(false);

  async function loadLatest(resetDraft: boolean) {
    const request = ++requestId.current;
    setLoading(true);
    setVersion("");
    setError("");
    try {
      const latest = kind === "exam" ? await fetchAdminExam(id) : await fetchAdminHomework(id);
      if (request !== requestId.current) return;
      if (!latest.updated_at) throw new Error("최신 수정 시각을 확인하지 못했습니다. 다시 시도해 주세요.");
      setVersion(latest.updated_at);
      setCurrentTitle(latest.title);
      if (resetDraft) setDraft(latest.title);
    } catch (e) {
      if (request === requestId.current) setError(extractApiError(e, "현재 제목을 불러오지 못했습니다."));
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }

  function close() {
    if (saveInFlight.current) return;
    requestId.current += 1;
    setOpen(false);
  }

  async function save() {
    if (saveInFlight.current || loading || !version || !draft.trim() || draft.trim() === currentTitle) return;
    saveInFlight.current = true;
    setSaving(true);
    setError("");
    try {
      const updated = kind === "exam"
        ? await updateAdminExam(id, { title: draft.trim() }, version)
        : await updateAdminHomework(id, { title: draft.trim() }, version);
      qc.setQueryData([kind === "exam" ? "admin-exam" : "admin-homework", id], updated);
      // An assessment can be shown in several cached sessions and result views.
      const roots = kind === "exam"
        ? ["admin-exam", "exam-detail", "admin-exams", "admin-session-exams", "admin-exam-detail", "admin-exam-results", "session-scores", "templates-with-usage"]
        : ["admin-homework", "session-homeworks", "homeworks", "session-scores"];
      await qc.invalidateQueries({ predicate: (query) => roots.includes(String(query.queryKey[0])) });
      feedback.success(`${label} 제목을 수정했습니다.`);
      setOpen(false);
    } catch (e) {
      if (isStaleResourceConflict(e)) {
        setVersion("");
        setError("다른 화면에서 변경되었습니다. 입력한 제목은 유지됩니다. 최신 제목을 확인한 뒤 다시 저장해 주세요.");
      } else {
        setError(extractApiError(e, "제목을 저장하지 못했습니다. 입력을 확인하고 다시 시도해 주세요."));
      }
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  return <>
    <Button type="button" intent="secondary" size="sm" className="shrink-0 max-w-full"
      style={{ minHeight: 44, paddingInline: compact ? 6 : 12, whiteSpace: compact ? "normal" : "nowrap" }}
      disabled={disabled} aria-label={`${title} 제목 수정`}
      leftIcon={compact ? undefined : <Pencil size={ICON_FOR_BUTTON.sm} aria-hidden />}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => { event.stopPropagation(); setDraft(title); setCurrentTitle(""); setOpen(true); void loadLatest(true); }}>
      제목 수정
    </Button>
    <AdminModal open={open} onClose={close} closeDisabled={saving} type="action" width={MODAL_WIDTH.sm}>
      <ModalHeader type="action" title={`${label} 제목 수정`} />
      <ModalBody>
        <form id={`assessment-title-${kind}-${id}`} onSubmit={(event) => { event.preventDefault(); void save(); }} className="space-y-3">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">{label} 제목</span>
            <input className="ds-input w-full" value={draft} maxLength={255} disabled={loading || saving}
              onChange={(event) => setDraft(event.target.value)} autoFocus />
          </label>
          {loading && <p role="status" className="text-sm">최신 제목을 확인하는 중…</p>}
          {currentTitle && <p className="break-words text-sm text-[var(--color-text-muted)]">현재 제목: {currentTitle}</p>}
          {error && <div role="alert" className="space-y-2 text-sm text-[var(--color-error)]">
            <p>{error}</p>
            {!version && <Button type="button" intent="secondary" size="md" disabled={loading} onClick={() => void loadLatest(false)}>최신 제목 확인</Button>}
          </div>}
        </form>
      </ModalBody>
      <ModalFooter right={<>
        <Button intent="secondary" size="lg" onClick={close} disabled={saving}>취소</Button>
        <Button type="submit" form={`assessment-title-${kind}-${id}`} intent="primary" size="lg"
          disabled={loading || saving || !version || !draft.trim() || draft.trim() === currentTitle}
          loading={saving}>저장</Button>
      </>} />
    </AdminModal>
  </>;
}
