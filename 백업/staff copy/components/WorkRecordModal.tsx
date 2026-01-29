// PATH: src/features/staff/components/WorkRecordModal.tsx
import { useEffect, useMemo, useState } from "react";
import { WorkType } from "../api/staffWorkType.api";
import { WorkRecord } from "../api/staffWorkRecord.api";

export default function WorkRecordModal({
  open,
  title,
  workTypes,
  staffId,
  initialValue,
  onClose,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  title: string;
  workTypes: WorkType[];
  staffId: number;
  initialValue?: WorkRecord;
  onClose: () => void;
  onSubmit: (payload: {
    staff: number;
    work_type: number;
    date: string;
    start_time: string;
    end_time: string;
    break_minutes: number;
    memo: string;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const isEdit = !!initialValue;

  const defaultWorkType = useMemo(() => {
    if (initialValue?.work_type) return initialValue.work_type;
    return workTypes[0]?.id ?? 0;
  }, [initialValue?.work_type, workTypes]);

  const [form, setForm] = useState({
    date: "",
    work_type: 0,
    start_time: "09:00",
    end_time: "18:00",
    break_minutes: 0,
    memo: "",
  });

  useEffect(() => {
    if (!open) return;
    if (initialValue) {
      setForm({
        date: initialValue.date,
        work_type: initialValue.work_type,
        start_time: (initialValue.start_time || "09:00").slice(0, 5),
        end_time: (initialValue.end_time || "18:00").slice(0, 5),
        break_minutes: Number(initialValue.break_minutes || 0),
        memo: initialValue.memo || "",
      });
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setForm({
        date: today,
        work_type: defaultWorkType,
        start_time: "09:00",
        end_time: "18:00",
        break_minutes: 0,
        memo: "",
      });
    }
  }, [open, initialValue, defaultWorkType]);

  if (!open) return null;

  const submit = async () => {
    if (!form.date) return alert("날짜는 필수입니다.");
    if (!form.work_type) return alert("근무유형을 선택하세요.");
    if (!form.start_time || !form.end_time) return alert("시간은 필수입니다.");

    await onSubmit({
      staff: staffId,
      work_type: Number(form.work_type),
      date: form.date,
      start_time: form.start_time,
      end_time: form.end_time,
      break_minutes: Number(form.break_minutes || 0),
      memo: form.memo || "",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[520px] rounded-2xl bg-[var(--bg-surface)] shadow-2xl overflow-hidden">
        <div className="border-b border-[var(--border-divider)] px-5 py-3">
          <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-medium text-[var(--text-muted)] mb-1">날짜</div>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className="h-[38px] w-full rounded-lg border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 text-sm outline-none"
              />
            </div>

            <div>
              <div className="text-xs font-medium text-[var(--text-muted)] mb-1">근무유형</div>
              <select
                value={form.work_type}
                onChange={(e) => setForm((p) => ({ ...p, work_type: Number(e.target.value) }))}
                className="h-[38px] w-full rounded-lg border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 text-sm outline-none"
              >
                <option value={0}>선택</option>
                {workTypes.map((wt) => (
                  <option key={wt.id} value={wt.id}>
                    {wt.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs font-medium text-[var(--text-muted)] mb-1">시작</div>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
                className="h-[38px] w-full rounded-lg border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 text-sm outline-none"
              />
            </div>

            <div>
              <div className="text-xs font-medium text-[var(--text-muted)] mb-1">종료</div>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
                className="h-[38px] w-full rounded-lg border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 text-sm outline-none"
              />
            </div>

            <div>
              <div className="text-xs font-medium text-[var(--text-muted)] mb-1">휴게(분)</div>
              <input
                type="number"
                min={0}
                value={form.break_minutes}
                onChange={(e) => setForm((p) => ({ ...p, break_minutes: Number(e.target.value) }))}
                className="h-[38px] w-full rounded-lg border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-[var(--text-muted)] mb-1">메모</div>
            <textarea
              rows={3}
              value={form.memo}
              onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 py-2 text-sm outline-none resize-none"
              placeholder="옵션"
            />
          </div>

          {isEdit && (
            <div className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3">
              <div className="text-xs text-[var(--text-muted)] mb-1">계산값 (readonly)</div>
              <div className="text-sm text-[var(--text-primary)]">
                근무시간: <b>{String(initialValue?.work_hours ?? "-")}</b> h{" "}
                <span className="mx-2 text-[var(--text-muted)]">|</span>
                금액: <b>{Number(initialValue?.amount ?? 0).toLocaleString()}</b> 원
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center gap-2 px-5 py-3 border-t border-[var(--border-divider)]">
          <div>
            {isEdit && onDelete && (
              <button
                onClick={async () => {
                  if (!confirm("삭제할까요?")) return;
                  await onDelete();
                  onClose();
                }}
                className="px-3 py-1.5 text-sm rounded-md border border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
              >
                삭제
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-md border border-[var(--border-divider)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)]"
            >
              취소
            </button>

            <button
              onClick={submit}
              className="px-3 py-1.5 text-sm rounded-md bg-[var(--color-primary)] text-white hover:opacity-90"
            >
              {isEdit ? "저장" : "등록"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
