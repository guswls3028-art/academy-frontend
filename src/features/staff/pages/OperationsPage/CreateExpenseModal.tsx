// PATH: src/features/staff/pages/OperationsPage/CreateExpenseModal.tsx
import { useEffect, useState } from "react";
import { useWorkMonth } from "../../operations/context/WorkMonthContext";
import { useExpenses } from "../../hooks/useExpenses";

import {
  AdminModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/shared/ui/modal";
import { ActionButton } from "@/shared/ui/ds";
import { DatePicker } from "@/shared/ui/date";

export default function CreateExpenseModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { staffId, range, locked } = useWorkMonth();

  const { createM } = useExpenses({
    staff: staffId,
    date_from: range.from,
    date_to: range.to,
  });

  const [form, setForm] = useState({
    date: range.from,
    title: "",
    amount: 0,
    memo: "",
  });

  useEffect(() => {
    if (open) {
      setForm((p) => ({ ...p, date: range.from }));
    }
  }, [open, range.from]);

  if (locked) return null;

  return (
    <AdminModal open={open} onClose={onClose} type="action">
      <ModalHeader
        title="비용 추가"
        description="직원의 비용 항목을 추가합니다."
        type="action"
      />

      <ModalBody>
        <div className="grid gap-3">
          <Field label="날짜">
            <input
              type="date"
              className="ds-input"
              value={form.date}
              onChange={(e) =>
                setForm((p) => ({ ...p, date: e.target.value }))
              }
            />
          </Field>

          <Field label="항목 *">
            <input
              className="ds-input"
              value={form.title}
              onChange={(e) =>
                setForm((p) => ({ ...p, title: e.target.value }))
              }
            />
          </Field>

          <Field label="금액(원) *">
            <input
              type="number"
              className="ds-input"
              value={form.amount}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  amount: Number(e.target.value),
                }))
              }
            />
          </Field>

          <Field label="메모">
            <textarea
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
            <ActionButton action="close" onClick={onClose} />
            <ActionButton
              action="create"
              loading={createM.isPending}
              onClick={() => {
                if (!form.title.trim() || form.amount <= 0) {
                  alert("항목과 금액을 입력하세요.");
                  return;
                }

                createM.mutate(
                  {
                    staff: staffId,
                    date: form.date,
                    title: form.title,
                    amount: form.amount,
                    memo: form.memo,
                  },
                  { onSuccess: onClose }
                );
              }}
            >
              추가
            </ActionButton>
          </>
        }
      />
    </AdminModal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <div className="text-xs font-semibold text-[var(--text-muted)]">
        {label}
      </div>
      {children}
    </div>
  );
}
