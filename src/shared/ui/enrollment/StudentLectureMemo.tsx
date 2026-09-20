import { useEffect, useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchLectureMemo, saveLectureMemo, type LectureMemo } from "@/shared/api/contracts/lectureMemo";
import { isStaleResourceConflict } from "@/shared/api/optimisticConcurrency";
import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import useAuth from "@/auth/hooks/useAuth";
import { getTenantUserLocalKey } from "@/shared/utils/safeLocalStorage";
import styles from "./StudentLectureMemo.module.css";

type Props = {
  enrollmentId: number;
  studentName: string;
  lectureTitle?: string | null;
  lectureMemo?: string | null;
  studentMemo?: string | null;
};

export default function StudentLectureMemo(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.root} data-student-memos={props.enrollmentId}>
      <button
        type="button"
        className={styles.preview}
        aria-label={`${props.studentName} 강의 메모 ${props.lectureMemo ? "보기 및 수정" : "추가"}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span className={styles.scope}>강의 메모</span>
        <span className={styles.previewText} data-empty={!props.lectureMemo}>
          {props.lectureMemo || "메모 추가"}
        </span>
        <span className={styles.editHint}>{props.lectureMemo ? "수정" : "+"}</span>
      </button>
      {props.studentMemo && (
        <button type="button" className={`${styles.preview} ${styles.common}`}
          aria-label={`${props.studentName} 학생 공통 메모 보기`} onClick={() => setOpen(true)}>
          <span className={styles.scope}>학생 공통</span>
          <span className={styles.previewText}>{props.studentMemo}</span>
        </button>
      )}
      {open && <LectureMemoEditor {...props} onClose={() => setOpen(false)} />}
    </div>
  );
}

function LectureMemoEditor({ enrollmentId, studentName, lectureTitle, studentMemo, onClose }: Props & { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const draftScope = getTenantUserLocalKey(`lecture-memo:${enrollmentId}`, user?.id);
  const confirm = useConfirm();
  const inputId = useId();
  const [baseline, setBaseline] = useState<LectureMemo | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [latest, setLatest] = useState<LectureMemo | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!baseline || draft === baseline.lecture_memo) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [baseline, draft]);

  useEffect(() => {
    let active = true;
    queryClient.setQueryDefaults(["lecture-memo-draft"], { gcTime: Infinity });
    setLoading(true);
    setError("");
    void fetchLectureMemo(enrollmentId).then((value) => {
      if (!active) return;
      const recovery = draftScope ? queryClient.getQueryData<{ draft: string; baseline: LectureMemo }>(["lecture-memo-draft", draftScope]) : null;
      setBaseline(recovery?.baseline ?? value);
      setDraft(recovery?.draft ?? value.lecture_memo);
      setRestored(Boolean(recovery));
    }).catch((cause: unknown) => {
      if (active) setError(extractApiError(cause, "메모를 불러오지 못했습니다."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [enrollmentId, attempt, draftScope, queryClient]);

  const close = async () => {
    if (saving) return;
    if (baseline && draft !== baseline.lecture_memo && !await confirm({
      title: "메모 편집 닫기",
      message: "아직 저장하지 않은 내용이 있습니다. 편집을 닫으시겠습니까?",
      confirmText: "저장하지 않고 닫기",
      cancelText: "계속 편집",
    })) return;
    if (baseline && draftScope) queryClient.removeQueries({ queryKey: ["lecture-memo-draft", draftScope], exact: true });
    onClose();
  };

  const loadConflict = async () => {
    setLoading(true);
    try {
      setLatest(await fetchLectureMemo(enrollmentId));
      setError("");
    } catch (cause) {
      setError(extractApiError(cause, "최신 메모를 불러오지 못했습니다. 작성 내용은 유지됩니다."));
    } finally { setLoading(false); }
  };

  const save = async () => {
    if (!baseline || saving || conflict) return;
    setSaving(true);
    setError("");
    try {
      const saved = await saveLectureMemo(enrollmentId, draft, baseline.lecture_memo_updated_at);
      // Every session consumes the enrollment memo, including inactive cached rosters.
      const roots = ["attendance", "session-attendance", "session-enrollments", "lecture-enrollments"];
      for (const key of roots) {
        queryClient.setQueriesData({ queryKey: [key] }, (previous: unknown) => {
          const updateRows = (rows: unknown[]) => rows.map((row) => {
            if (!row || typeof row !== "object") return row;
            const item = row as Record<string, unknown>;
            const id = key === "lecture-enrollments" ? item.id : item.enrollment_id ?? item.enrollment;
            return id === saved.id ? { ...item, lecture_memo: saved.lecture_memo, lecture_memo_updated_at: saved.lecture_memo_updated_at } : item;
          });
          if (Array.isArray(previous)) return updateRows(previous);
          if (!previous || typeof previous !== "object") return previous;
          const record = previous as Record<string, unknown>;
          if (Array.isArray(record.data)) return { ...record, data: updateRows(record.data) };
          if (Array.isArray(record.results)) return { ...record, results: updateRows(record.results) };
          return previous;
        });
      }
      if (draftScope) queryClient.removeQueries({ queryKey: ["lecture-memo-draft", draftScope], exact: true });
      void Promise.all(roots
        .map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      feedback.success("강의 메모를 저장했습니다.");
      onClose();
    } catch (cause) {
      if (isStaleResourceConflict(cause)) {
        setConflict(true);
        await loadConflict();
      } else {
        setError(extractApiError(cause, "저장하지 못했습니다. 작성 내용을 확인하고 다시 시도해 주세요."));
      }
    } finally { setSaving(false); }
  };

  return (
    <AdminModal open onClose={() => void close()} width={560} noMinimize closeDisabled={saving}>
      <ModalHeader noIcon title={`${studentName} 강의 메모`}
        description={`${lectureTitle || "이 강의"}의 모든 차시에서 직원이 함께 보는 메모입니다. 다른 강의에는 표시되지 않습니다.`} />
      <ModalBody>
        <div className={styles.editor}>
          {studentMemo && <section className={styles.commonDetail} aria-label="학생 공통 메모">
            <strong>학생 공통 메모</strong>
            <p>{studentMemo}</p>
            <span className={styles.help}>학생 공통 메모는 학생 정보에서 수정합니다.</span>
          </section>}
          {loading && <p role="status">{conflict ? "최신 메모를 불러오는 중…" : "메모를 불러오는 중…"}</p>}
          {restored && <p role="status" className={styles.help}>저장하지 않은 메모를 복원했습니다. 내용을 확인하고 저장해 주세요.</p>}
          {baseline && <>
            <label className={styles.label} htmlFor={inputId}>강의 메모</label>
            <textarea id={inputId} className={`ds-textarea ${styles.textarea}`} rows={6}
              value={draft} onChange={(event) => {
                const text = event.target.value;
                setDraft(text);
                if (draftScope) {
                  const key = ["lecture-memo-draft", draftScope];
                  if (text === baseline.lecture_memo) queryClient.removeQueries({ queryKey: key, exact: true });
                  else queryClient.setQueryData(key, { draft: text, baseline });
                }
              }} maxLength={2000}
              disabled={saving} aria-describedby={`${inputId}-help`}
              placeholder="예: 이 강의는 영상 수강 · 수업 전 자료 전달" />
            <p id={`${inputId}-help`} className={styles.help}>조교에게 전달할 수업별 특이사항을 적어 주세요. {draft.length}/2,000</p>
          </>}
          {conflict && <section className={styles.conflict} role="alert">
            <strong>다른 직원이 먼저 수정했습니다.</strong>
            <p>작성 중인 내용은 유지했습니다. 최신 메모를 확인한 뒤 필요한 내용을 합쳐 저장해 주세요.</p>
            {latest && <>
              <p className={styles.latest}>{latest.lecture_memo || "(메모 없음)"}</p>
              <Button type="button" size="sm" onClick={() => {
                setBaseline(latest); setConflict(false); setLatest(null);
                if (draftScope) queryClient.setQueryData(["lecture-memo-draft", draftScope], { draft, baseline: latest });
              }}>최신 메모 확인 · 계속 편집</Button>
            </>}
            {!latest && !loading && <Button type="button" size="sm" onClick={() => void loadConflict()}>최신 메모 다시 불러오기</Button>}
          </section>}
          {error && <p role="alert" className={styles.error}>{error}</p>}
          {!baseline && !loading && <Button type="button" onClick={() => setAttempt((value) => value + 1)}>다시 불러오기</Button>}
        </div>
      </ModalBody>
      <ModalFooter right={<>
        <Button type="button" onClick={() => void close()} disabled={saving}>닫기</Button>
        <Button type="button" intent="primary" onClick={() => void save()}
          disabled={!baseline || loading || saving || conflict || draft === baseline.lecture_memo}>
          {saving ? "저장 중…" : "저장"}
        </Button>
      </>} />
    </AdminModal>
  );
}
