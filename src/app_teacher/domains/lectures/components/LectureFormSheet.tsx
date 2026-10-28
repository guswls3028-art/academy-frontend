import { useState, useEffect, useId, useRef, type InputHTMLAttributes } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createLecture, updateLecture, type TeacherLecture } from "../api";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";
import { useConfirmBeforeClose } from "@/shared/ui/overlays/useConfirmBeforeClose";
import { Button } from "@/shared/ui/ds";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { normalizeLectureChipText } from "@/shared/ui/chips/lectureChipText";
import { teacherLectureQueryKeys } from "../queryKeys";
import styles from "./LectureFormSheet.module.css";

const COLORS = [
  ["#3b82f6", "파랑"], ["#ef4444", "빨강"], ["#22c55e", "초록"], ["#f59e0b", "노랑"],
  ["#8b5cf6", "보라"], ["#ec4899", "분홍"], ["#06b6d4", "하늘"], ["#f97316", "주황"],
] as const;
type EditableLecture = TeacherLecture & { instructor?: string };
function formFrom(lecture?: EditableLecture | null) {
  return {
    title: lecture?.title ?? "", name: lecture?.name ?? lecture?.instructor ?? "",
    subject: lecture?.subject ?? "", color: lecture?.color || COLORS[0][0],
    chipLabel: lecture?.chip_label ?? lecture?.chipLabel ?? "",
    startDate: lecture?.start_date ?? "", endDate: lecture?.end_date ?? "",
    lectureTime: lecture?.lecture_time ?? lecture?.lectureTime ?? "",
  };
}
type Props = { open: boolean; onClose: () => void; onCreated?: () => void; editData?: EditableLecture | null };

export default function LectureFormSheet({ open, onClose, onCreated, editData }: Props) {
  const qc = useQueryClient();
  const formId = useId();
  const [form, setForm] = useState(() => formFrom(editData));
  const initial = useRef(form);
  const openedRecord = useRef<number | "create" | null>(null);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const isEdit = Boolean(editData);
  useEffect(() => {
    if (!open) { openedRecord.current = null; return; }
    const record = editData?.id ?? "create";
    if (openedRecord.current === record) return;
    openedRecord.current = record;
    initial.current = formFrom(editData);
    setForm(initial.current);
    setError("");
  }, [editData, open]);
  const update = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const chipLabel = normalizeLectureChipText(form.chipLabel) || normalizeLectureChipText(form.title);
  const invalidDates = Boolean(form.startDate && form.endDate && form.endDate < form.startDate);
  const ready = [form.title, form.name, form.subject, form.lectureTime].every(value => value.trim()) && !invalidDates;
  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title.trim(), name: form.name.trim(), subject: form.subject.trim(), color: form.color,
        chip_label: chipLabel || null, start_date: form.startDate || null, end_date: form.endDate || null,
        lecture_time: form.lectureTime.trim() || null, is_active: editData?.is_active ?? editData?.isActive ?? true,
      };
      return editData ? updateLecture(editData.id, payload) : createLecture(payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: teacherLectureQueryKeys.lectures });
      teacherToast.success(isEdit ? `${form.title} 강의가 수정되었습니다.` : `${form.title} 강의가 생성되었습니다.`);
      onClose();
      if (!isEdit) onCreated?.();
    },
    onError: cause => setError(extractApiError(cause, isEdit ? "강의를 수정하지 못했습니다." : "강의를 생성하지 못했습니다.")),
    onSettled: () => { submitting.current = false; },
  });
  const dirty = (Object.keys(form) as Array<keyof typeof form>).some(key => form[key] !== initial.current[key]);
  const requestClose = useConfirmBeforeClose(dirty, mutation.isPending, onClose);

  return (
    <BottomSheet open={open} onClose={() => void requestClose()} closeDisabled={mutation.isPending}
      title={isEdit ? "강의 편집" : "강의 생성"}
      footer={<div className={styles.actions}>
        <Button onClick={() => void requestClose()} disabled={mutation.isPending}>취소</Button>
        <Button type="submit" form={formId} intent="primary" loading={mutation.isPending} disabled={!ready}>
          {mutation.isPending ? "저장 중..." : isEdit ? "수정" : "생성"}
        </Button>
      </div>}>
      <form id={formId} onSubmit={event => {
        event.preventDefault();
        if (!ready || submitting.current) return;
        submitting.current = true; setError(""); mutation.mutate();
      }}>
        <fieldset className={styles.fields} disabled={mutation.isPending}>
          <p className={styles.help}>강의명, 강사, 과목, 수업 시간은 필수입니다.</p>
          <Field label="강의명 *" required value={form.title} onChange={value => update("title", value)} placeholder="예: 수학 심화반" />
          <div className={styles.row}>
            <Field label="강사 *" required value={form.name} onChange={value => update("name", value)} placeholder="담당 강사명" />
            <Field label="과목 *" required value={form.subject} onChange={value => update("subject", value)} placeholder="예: 수학, 영어" />
          </div>
          <Field label="수업 시간 *" required value={form.lectureTime} onChange={value => update("lectureTime", value)} placeholder="예: 월수금 18:00~20:00" />
          <div className={styles.row}>
            <Field label="시작일" type="date" value={form.startDate} onChange={value => update("startDate", value)} />
            <Field label="종료일" type="date" min={form.startDate || undefined} value={form.endDate} onChange={value => update("endDate", value)} />
          </div>
          {invalidDates && <p className={styles.error} role="alert">종료일은 시작일과 같거나 이후여야 합니다.</p>}
          <div className={styles.identity}>
            <LectureChip lectureName={form.title} color={form.color} chipLabel={chipLabel || "강의"} size={40} />
            <Field label="강의 딱지 2글자" value={form.chipLabel} maxLength={2}
              placeholder={normalizeLectureChipText(form.title) || "딱지"}
              onChange={value => update("chipLabel", normalizeLectureChipText(value))} />
          </div>
          <fieldset className={styles.palette}>
            <legend>색상</legend>
            <div className={styles.colors}>
              {COLORS.map(([color, label]) => <button key={color} type="button" aria-label={label} aria-pressed={form.color === color}
                className={styles.color} onClick={() => update("color", color)}>
                {/* Palette values are the persisted lecture colors. */}
                {/* eslint-disable-next-line no-restricted-syntax -- Persisted lecture colors determine each swatch. */}
                <span style={{ backgroundColor: color }} aria-hidden="true">{form.color === color ? "✓" : ""}</span>
              </button>)}
            </div>
          </fieldset>
        </fieldset>
        {error && <p role="alert" className={styles.error}><span>{error}</span><br />입력한 내용은 유지됩니다. 확인 후 다시 저장해 주세요.</p>}
      </form>
    </BottomSheet>
  );
}

function Field({ label, onChange, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  label: string; onChange: (value: string) => void;
}) {
  const id = useId();
  return <div className={styles.field}><label htmlFor={id}>{label}</label>
    <input {...props} id={id} onChange={event => onChange(event.target.value)} /></div>;
}
