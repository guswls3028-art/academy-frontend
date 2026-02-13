// PATH: src/features/profile/expense/components/ExpenseFormModal.tsx
import { useEffect, useMemo, useState } from "react";
import { Button, Panel } from "@/shared/ui/ds";
import { DatePicker } from "@/shared/ui/date";
import { Expense } from "../../api/profile.api";

type Form = {
  date: string;
  title: string;
  amount: number;
  memo: string;
};

export default function ExpenseFormModal({
  open,
  initial,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial?: Expense | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (data: Form) => Promise<void> | void;
}) {
  const isEdit = !!initial;

  const [form, setForm] = useState<Form>({
    date: "",
    title: "",
    amount: 0,
    memo: "",
  });

  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;

    if (initial) {
      setForm({
        date: initial.date,
        title: initial.title,
        amount: Number(initial.amount) || 0,
        memo: initial.memo ?? "",
      });
    } else {
      setForm({
        date: new Date().toISOString().slice(0, 10),
        title: "",
        amount: 0,
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

  const canSubmit = useMemo(() => {
    return !!form.date && !!form.title.trim();
  }, [form]);

  if (!open) return null;

  const submit = async () => {
    setErr("");

    if (!form.date) return setErr("날짜를 선택하세요.");
    if (!form.title.trim()) return setErr("항목을 입력하세요.");

    try {
      await onSubmit({
        ...form,
        title: form.title.trim(),
        amount: Number(form.amount) || 0,
      });
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "저장 실패");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-[560px]">
        <Panel>
          <div className="panel-header">
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              {isEdit ? "지출 수정" : "지출 등록"}
            </div>
          </div>

          <div className="panel-body space-y-4 text-sm">
            {/* 안내 */}
            <div className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3">
              <div className="text-xs text-[var(--text-muted)]">
                {isEdit
                  ? "지출 내역을 수정합니다."
                  : "새 지출 내역을 등록합니다."}
              </div>
            </div>

            {/* 입력 영역 */}
            <div className="space-y-4 rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] p-4">
              <Row label="날짜">
                <DatePicker
                  value={form.date}
                  onChange={(v) =>
                    setForm((p) => ({ ...p, date: v }))
                  }
                />
              </Row>

              <Row label="항목">
                <input
                  className={inputCls}
                  value={form.title}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="예: 식비, 교통비, 교재비"
                  autoFocus
                />
              </Row>

              <Row label="금액">
                <input
                  type="number"
                  className={inputCls}
                  value={form.amount}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      amount: Number(e.target.value),
                    }))
                  }
                  placeholder="0"
                />
              </Row>

              <Row label="메모 (선택)">
                <textarea
                  rows={3}
                  className={inputCls}
                  value={form.memo}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, memo: e.target.value }))
                  }
                  placeholder="예: 카드결제 / 영수증 있음"
                />
              </Row>
            </div>

            {/* 에러 */}
            {err && (
              <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
                {err}
              </div>
            )}

            {/* 버튼 */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button type="button" intent="secondary" size="md" onClick={onClose} disabled={submitting}>
                취소
              </Button>

              <Button
                type="button"
                intent="primary"
                size="md"
                onClick={submit}
                disabled={submitting || !canSubmit}
              >
                {submitting
                  ? "저장중..."
                  : isEdit
                  ? "수정 저장"
                  : "저장"}
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ---------- UI Helpers ---------- */

const inputCls =
  "w-full rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] \
   px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]";

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
