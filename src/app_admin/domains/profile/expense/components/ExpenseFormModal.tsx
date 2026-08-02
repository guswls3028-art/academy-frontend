// PATH: src/app_admin/domains/profile/expense/components/ExpenseFormModal.tsx
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/shared/ui/ds";
import { DatePicker } from "@/shared/ui/date";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { extractApiError } from "@/shared/utils/extractApiError";
import { type Expense } from "../../api/profile.api";

type Form = {
  date: string;
  title: string;
  amount: string;
  memo: string;
};

type ExpenseFormPayload = Omit<Form, "amount"> & {
  amount: number;
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
  onSubmit: (data: ExpenseFormPayload) => Promise<void> | void;
}) {
  const isEdit = !!initial;

  const [form, setForm] = useState<Form>({
    date: "",
    title: "",
    amount: "",
    memo: "",
  });

  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;

    if (initial) {
      setForm({
        date: initial.date,
        title: initial.title,
        amount: Number(initial.amount) > 0 ? String(initial.amount) : "",
        memo: initial.memo ?? "",
      });
    } else {
      const _d = new Date();
      setForm({
        date: `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, "0")}-${String(_d.getDate()).padStart(2, "0")}`,
        title: "",
        amount: "",
        memo: "",
      });
    }
    setErr("");
  }, [open, initial]);

  const canSubmit = useMemo(() => {
    const amount = Number(form.amount);
    return !!form.date && !!form.title.trim() && Number.isFinite(amount) && amount > 0;
  }, [form]);

  const submit = async () => {
    setErr("");

    if (!form.date) return setErr("날짜를 선택하세요.");
    if (!form.title.trim()) return setErr("항목을 입력하세요.");
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return setErr("금액은 1원 이상 입력하세요.");
    }

    try {
      await onSubmit({
        ...form,
        title: form.title.trim(),
        amount,
      });
    } catch (e: unknown) {
      setErr(extractApiError(e, "저장 실패"));
    }
  };

  if (!open) return null;

  return (
    <AdminModal
      open
      onClose={onClose}
      type="action"
      closeDisabled={submitting}
      onEnterConfirm={!submitting && canSubmit ? submit : undefined}
    >
      <ModalHeader
        title={isEdit ? "지출 수정" : "지출 등록"}
        description={isEdit ? "지출 내역을 수정합니다." : "새 지출 내역을 등록합니다."}
        type="action"
      />
      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact">
          <div className="modal-form-group">
            <Row id="profile-expense-date" label="날짜">
              <DatePicker
                id="profile-expense-date"
                value={form.date}
                onChange={(v) => setForm((p) => ({ ...p, date: v }))}
              />
            </Row>

            <Row id="profile-expense-title" label="항목">
              <input
                id="profile-expense-title"
                className={inputCls}
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="예: 식비, 교통비, 교재비"
                autoFocus
              />
            </Row>

            <Row id="profile-expense-amount" label="금액">
              <input
                id="profile-expense-amount"
                type="number"
                className={inputCls}
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="0"
                min={1}
              />
            </Row>

            <Row id="profile-expense-memo" label="메모 (선택)">
              <textarea
                id="profile-expense-memo"
                rows={3}
                className={inputCls}
                value={form.memo}
                onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
                placeholder="예: 카드결제 / 영수증 있음"
              />
            </Row>
          </div>

          {err && (
            <div
              role="alert"
              className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]"
            >
              {err}
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <>
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
              {submitting ? "저장 중…" : isEdit ? "수정 저장" : "저장"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}

/* ---------- UI Helpers ---------- */

const inputCls =
  "w-full rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] \
   px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]";

function Row({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-[var(--text-muted)]">
        {label}
      </label>
      {children}
    </div>
  );
}
