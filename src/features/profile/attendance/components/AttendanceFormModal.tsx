// PATH: src/features/profile/attendance/components/AttendanceFormModal.tsx
import { useEffect, useMemo, useState } from "react";
import { Button, Panel } from "@/shared/ui/ds";
import { DatePicker } from "@/shared/ui/date";
import { TimeRangeInput } from "@/shared/ui/time";
import { Attendance } from "../../api/profile.api";

type Form = {
  date: string;
  start_time: string;
  end_time: string;
  work_type: string;
  memo: string;
};

export default function AttendanceFormModal({
  open,
  initial,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial?: Attendance | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (data: Form) => Promise<void> | void;
}) {
  const isEdit = !!initial;

  const [form, setForm] = useState<Form>({
    date: "",
    start_time: "09:00",
    end_time: "18:00",
    work_type: "근무",
    memo: "",
  });

  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;

    if (initial) {
      setForm({
        date: initial.date,
        start_time: initial.start_time.slice(0, 5),
        end_time: initial.end_time.slice(0, 5),
        work_type: initial.work_type,
        memo: initial.memo ?? "",
      });
    } else {
      setForm({
        date: new Date().toISOString().slice(0, 10),
        start_time: "09:00",
        end_time: "18:00",
        work_type: "근무",
        memo: "",
      });
    }
    setErr("");
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const canSubmit = useMemo(
    () => !!form.date && !!form.start_time && !!form.end_time,
    [form]
  );

  if (!open) return null;

  const submit = async () => {
    setErr("");
    try {
      await onSubmit(form);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "저장 실패");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-[640px]">
        <Panel>
          <div className="panel-header">
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              {isEdit ? "근태 수정" : "근태 등록"}
            </div>
          </div>

          <div className="panel-body space-y-4 text-sm">
            {/* 안내 */}
            <div className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3">
              <div className="text-xs text-[var(--text-muted)]">
                {isEdit
                  ? "기존 근태 기록을 수정합니다."
                  : "새 근태 기록을 등록합니다."}
              </div>
            </div>

            {/* 입력 */}
            <div className="space-y-4 rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] p-4">
              <Row label="날짜">
                <DatePicker
                  value={form.date}
                  onChange={(v) =>
                    setForm((p) => ({ ...p, date: v }))
                  }
                />
              </Row>

              <Row label="근무유형">
                <input
                  className={inputCls}
                  value={form.work_type}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, work_type: e.target.value }))
                  }
                />
              </Row>

              <div className="grid grid-cols-2 gap-3">
                <Row label="시작 시간">
                  <input
                    type="time"
                    className={inputCls}
                    value={form.start_time}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, start_time: e.target.value }))
                    }
                  />
                </Row>

                <Row label="종료 시간">
                  <input
                    type="time"
                    className={inputCls}
                    value={form.end_time}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, end_time: e.target.value }))
                    }
                  />
                </Row>
              </div>

              <Row label="메모 (선택)">
                <textarea
                  rows={3}
                  className={inputCls}
                  value={form.memo}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, memo: e.target.value }))
                  }
                />
              </Row>
            </div>

            {err && (
              <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
                {err}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button type="button" intent="secondary" size="md" onClick={onClose}>
                취소
              </Button>
              <Button
                type="button"
                intent="primary"
                size="md"
                onClick={submit}
                disabled={!canSubmit || submitting}
              >
                {submitting ? "저장중..." : isEdit ? "수정 저장" : "저장"}
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]";

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-[var(--text-muted)]">
        {label}
      </div>
      {children}
    </div>
  );
}
