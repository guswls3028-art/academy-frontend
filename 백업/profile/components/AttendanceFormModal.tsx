// PATH: src/features/profile/components/AttendanceFormModal.tsx
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/shared/ui/card";
import { Attendance } from "../api/profile";

type Form = {
  date: string;
  start_time: string;
  end_time: string;
  work_type: string;
  memo: string;
};

export default function AttendanceFormModal({
  open,
  onClose,
  initial,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Attendance | null;
  onSubmit: (data: Form) => Promise<void>;
  submitting?: boolean;
}) {
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

  if (!open) return null;

  const submit = async () => {
    setErr("");
    if (!form.date || !form.start_time || !form.end_time) {
      setErr("필수 항목을 입력하세요.");
      return;
    }
    try {
      await onSubmit(form);
      onClose();
    } catch {
      setErr("저장 실패");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-[560px]">
        <Card className="flex max-h-[90vh] flex-col overflow-hidden">
          <CardHeader title={initial ? "근태 수정" : "근태 등록"} />

          <CardBody className="flex-1 overflow-y-auto space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <input type="date" className="form-input" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <input className="form-input" value={form.work_type}
                onChange={(e) => setForm({ ...form, work_type: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input type="time" className="form-input" value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              <input type="time" className="form-input" value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </div>

            <textarea className="form-input" rows={4} value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })} />

            {err && <div className="text-sm text-red-400">{err}</div>}
          </CardBody>

          <div className="border-t px-4 py-3 flex justify-end gap-2">
            <button className="btn-secondary" onClick={onClose}>취소</button>
            <button className="btn-primary" onClick={submit} disabled={submitting}>
              {submitting ? "저장중..." : "저장"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
