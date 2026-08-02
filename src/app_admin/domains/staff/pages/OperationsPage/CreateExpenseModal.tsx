// PATH: src/app_admin/domains/staff/pages/OperationsPage/CreateExpenseModal.tsx
import { useEffect, useState } from "react";
import { useWorkMonth } from "../../operations/context/workMonthHooks";
import { useExpenses } from "../../hooks/useExpenses";
import type { ExpenseRecord } from "../../api/expenses.api";

import {
  AdminModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/shared/ui/modal";
import { ActionButton } from "@/shared/ui/ds";
import { DatePicker } from "@/shared/ui/date";
import { feedback } from "@/shared/ui/feedback/feedback";

export default function CreateExpenseModal({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: ExpenseRecord | null;
}) {
  const { staffId, range, writeBlocked } = useWorkMonth();

  const { createM, patchM } = useExpenses({
    staff: staffId,
    date_from: range.from,
    date_to: range.to,
  });

  const [form, setForm] = useState({
    date: range.from,
    title: "",
    amount: "",
    memo: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        date: initial?.date ?? range.from,
        title: initial?.title ?? "",
        amount: initial ? String(initial.amount) : "",
        memo: initial?.memo ?? "",
      });
    }
  }, [initial, open, range.from]);

  if (writeBlocked) return null;

  const parsedAmount = Number(form.amount);
  const canSubmit = Boolean(form.title.trim()) && Number.isFinite(parsedAmount) && parsedAmount > 0;

  const handleSubmit = () => {
    if (!canSubmit) {
      feedback.warning("항목과 금액을 입력하세요.");
      return;
    }
    if (form.date < range.from || form.date > range.to) {
      feedback.warning("현재 선택한 월 안의 날짜를 선택해 주세요.");
      return;
    }
    const payload = {
      date: form.date,
      title: form.title.trim(),
      amount: parsedAmount,
      memo: form.memo.trim(),
    };
    if (initial) {
      if (patchM.isPending) return;
      patchM.mutate(
        { id: initial.id, payload },
        { onSuccess: onClose },
      );
    } else if (!createM.isPending) {
      createM.mutate(
        {
          staff: staffId,
          ...payload,
        },
        { onSuccess: onClose }
      );
    }
  };

  const isPending = createM.isPending || patchM.isPending;
  const isEdit = Boolean(initial);

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      type="action"
      closeDisabled={isPending}
      onEnterConfirm={!isPending && canSubmit ? handleSubmit : undefined}
    >
      <ModalHeader
        title={isEdit ? "선결제 환급 수정" : "선결제 환급 추가"}
        description={
          isEdit
            ? "승인 전 환급의 날짜·항목·금액·메모를 정정합니다."
            : "직원이 개인 비용으로 먼저 결제한 환급 항목을 추가합니다."
        }
        type="action"
      />

      <ModalBody>
        <div className="grid gap-3">
          <Field id="staff-expense-date" label="날짜">
            <DatePicker
              id="staff-expense-date"
              value={form.date}
              onChange={(v) =>
                setForm((p) => ({ ...p, date: v }))
              }
            />
          </Field>

          <Field id="staff-expense-title" label="항목 *">
            <input
              id="staff-expense-title"
              className="ds-input"
              value={form.title}
              onChange={(e) =>
                setForm((p) => ({ ...p, title: e.target.value }))
              }
            />
          </Field>

          <Field id="staff-expense-amount" label="금액(원) *">
            <input
              id="staff-expense-amount"
              type="number"
              className="ds-input"
              value={form.amount}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  amount: e.target.value,
                }))
              }
            />
          </Field>

          <Field id="staff-expense-memo" label="메모">
            <textarea
              id="staff-expense-memo"
              className="ds-input"
              rows={3}
              value={form.memo}
              onChange={(e) =>
                setForm((p) => ({ ...p, memo: e.target.value }))
              }
            />
          </Field>
        </div>
      </ModalBody>

      <ModalFooter
        right={
          <>
            <ActionButton action="close" onClick={onClose} disabled={isPending} />
            <ActionButton
              action={isEdit ? "save" : "create"}
              loading={isPending}
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {isEdit ? "저장" : "추가"}
            </ActionButton>
          </>
        }
      />
    </AdminModal>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-[var(--text-muted)]">
        {label}
      </label>
      {children}
    </div>
  );
}
