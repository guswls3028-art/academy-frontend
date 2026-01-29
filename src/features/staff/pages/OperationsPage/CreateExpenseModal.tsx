// PATH: src/features/staff/pages/OperationsPage/CreateExpenseModal.tsx
import { Modal } from "antd";
import { useEffect, useState } from "react";
import { useWorkMonth } from "../../operations/context/WorkMonthContext";
import { useExpenses } from "../../hooks/useExpenses";

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
    if (!open) return;
    setForm((p) => ({ ...p, date: range.from }));
  }, [open, range.from]);

  // 🔒 마감 월이면 모달 자체를 안 띄움 (UX: “추가 버튼 비활성 + 사유”로 이미 안내됨)
  if (locked) return null;

  return (
    <Modal
      title="비용 추가"
      open={open}
      onCancel={onClose}
      onOk={() => {
        if (!form.title.trim() || !form.amount || form.amount <= 0) {
          alert("항목과 금액(0보다 큼)을 입력하세요.");
          return;
        }

        createM.mutate(
          {
            staff: staffId,
            date: form.date,
            title: form.title.trim(),
            amount: Number(form.amount),
            memo: form.memo ?? "",
          },
          {
            onSuccess: () => {
              onClose();
              setForm({
                date: range.from,
                title: "",
                amount: 0,
                memo: "",
              });
            },
            onError: (e: any) => {
              const msg =
                e?.response?.data?.detail ||
                e?.response?.data?.message ||
                "비용 추가에 실패했습니다.";
              alert(msg);
            },
          }
        );
      }}
      okText="추가"
      cancelText="취소"
      confirmLoading={createM.isPending}
    >
      <div className="space-y-3">
        <Field label="날짜">
          <input
            type="date"
            className="input"
            value={form.date}
            onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
          />
        </Field>

        <Field label="항목 *">
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="예: 교재비, 교통비"
          />
        </Field>

        <Field label="금액(원) *">
          <input
            type="number"
            className="input"
            value={form.amount}
            onChange={(e) =>
              setForm((p) => ({ ...p, amount: Number(e.target.value) }))
            }
            min={0}
          />
        </Field>

        <Field label="메모">
          <textarea
            className="input"
            value={form.memo}
            onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
            placeholder="선택"
            rows={3}
          />
        </Field>

        <div className="text-xs text-[var(--text-muted)]">
          * 금액/상태/승인은 서버 기준입니다.
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-[var(--text-muted)]">{label}</div>
      {children}
    </div>
  );
}
