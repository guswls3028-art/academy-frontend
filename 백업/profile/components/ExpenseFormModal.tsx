// PATH: src/features/profile/components/ExpenseFormModal.tsx
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/shared/ui/card";
import { Expense } from "../api/profile";

type Form = {
  date: string;
  title: string;
  amount: number;
  memo: string;
};

export default function ExpenseFormModal({
  open,
  onClose,
  initial,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Expense | null;
  onSubmit: (data: Form) => Promise<void>;
  submitting?: boolean;
}) {
  const [form, setForm] = useState<Form>({
    date: "",
    title: "",
    amount: 0,
    memo: "",
  });
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(
      initial
        ? { ...initial, amount: Number(initial.amount), memo: initial.memo ?? "" }
        : { date: new Date().toISOString().slice(0, 10), title: "", amount: 0, memo: "" }
    );
    setErr("");
  }, [open, initial]);

  if (!open) return null;

  const submit = async () => {
    if (!form.date || !form.title) return setErr("필수 항목 누락");
    await onSubmit(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-[560px]">
        <Card className="flex max-h-[90vh] flex-col overflow-hidden">
          <CardHeader title={initial ? "지출 수정" : "지출 등록"} />

          <CardBody className="flex-1 overflow-y-auto space-y-4">
            <input type="date" className="form-input" value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <input className="form-input" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input type="number" className="form-input" value={form.amount}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
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
