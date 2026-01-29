// PATH: src/features/staff/components/ExpenseEditModal.tsx
import { useEffect, useMemo, useState } from "react";
import { ExpenseRecord, ExpenseStatus } from "../api/staffExpense.api";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_LABEL: Record<ExpenseStatus, string> = {
  PENDING: "대기",
  APPROVED: "승인",
  REJECTED: "반려",
};

export default function ExpenseEditModal({
  open,
  title,
  staffId,
  initialValue,
  isManager,
  onClose,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  title: string;
  staffId: number;
  initialValue?: ExpenseRecord;
  isManager: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    staff: number;
    date: string;
    title: string;
    amount: number;
    memo: string;
    status: ExpenseStatus;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const isEdit = !!initialValue;
  const locked =
    initialValue?.status === "APPROVED" || initialValue?.status === "REJECTED";

  const [form, setForm] = useState({
    date: "",
    title: "",
    amount: 0,
    memo: "",
    status: "PENDING" as ExpenseStatus,
  });

  const computedTitle = useMemo(() => {
    if (locked) return "처리 완료된 비용";
    return isEdit ? title : title || "비용 등록";
  }, [locked, isEdit, title]);

  useEffect(() => {
    if (!open) return;

    if (initialValue) {
      setForm({
        date: initialValue.date,
        title: initialValue.title ?? "",
        amount: Number(initialValue.amount ?? 0),
        memo: initialValue.memo ?? "",
        status: initialValue.status ?? "PENDING",
      });
    } else {
      setForm({
        date: todayISO(),
        title: "",
        amount: 0,
        memo: "",
        status: "PENDING",
      });
    }
  }, [open, initialValue]);

  if (!open) return null;

  const statusDisabledReason = locked
    ? "승인/반려된 비용은 상태 변경이 불가능합니다."
    : !isManager
    ? "승인/반려는 관리자만 가능합니다."
    : "";

  const submit = async () => {
    if (locked) {
      alert("승인 또는 반려된 비용은 수정할 수 없습니다.");
      return;
    }

    if (!form.date) return alert("날짜는 필수입니다.");
    if (!form.title.trim()) return alert("항목명은 필수입니다.");
    const amt = Number(form.amount);
    if (Number.isNaN(amt) || amt < 0)
      return alert("금액은 0 이상 숫자여야 합니다.");

    await onSubmit({
      staff: staffId,
      date: form.date,
      title: form.title.trim(),
      amount: amt,
      memo: form.memo ?? "",
      status: isManager ? form.status : "PENDING",
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[560px] rounded-2xl bg-[var(--bg-surface)] shadow-2xl overflow-hidden">
        <div className="border-b border-[var(--border-divider)] px-5 py-3">
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            {computedTitle}
          </div>
          {initialValue?.approved_at && (
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              승인자: <b>{initialValue.approved_by_name || "-"}</b> · 승인시각:{" "}
              <b>{new Date(initialValue.approved_at).toLocaleString()}</b>
            </div>
          )}
        </div>

        <div className="px-5 py-4 space-y-3">
          {locked && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 font-semibold">
              승인 또는 반려된 비용은 수정·삭제가 불가능합니다.
            </div>
          )}

          {!isManager && !locked && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 font-semibold">
              * 일반 사용자는 비용을 등록할 수 있지만, 승인/반려는 관리자만 가능합니다.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              disabled={locked}
              value={form.date}
              onChange={(e) =>
                setForm((p) => ({ ...p, date: e.target.value }))
              }
              className="input"
            />

            <select
              disabled={!!statusDisabledReason}
              title={statusDisabledReason}
              value={form.status}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  status: e.target.value as ExpenseStatus,
                }))
              }
              className="input"
            >
              <option value="PENDING">{STATUS_LABEL.PENDING}</option>
              <option value="APPROVED">{STATUS_LABEL.APPROVED}</option>
              <option value="REJECTED">{STATUS_LABEL.REJECTED}</option>
            </select>
          </div>

          <input
            disabled={locked}
            value={form.title}
            onChange={(e) =>
              setForm((p) => ({ ...p, title: e.target.value }))
            }
            className="input"
            placeholder="항목명"
          />

          <input
            type="number"
            min={0}
            disabled={locked}
            value={form.amount}
            onChange={(e) =>
              setForm((p) => ({ ...p, amount: Number(e.target.value) }))
            }
            className="input"
            placeholder="금액"
          />

          <textarea
            disabled={locked}
            rows={3}
            value={form.memo}
            onChange={(e) =>
              setForm((p) => ({ ...p, memo: e.target.value }))
            }
            className="input resize-none"
            placeholder="메모 (옵션)"
          />
        </div>

        <div className="flex justify-between items-center gap-2 px-5 py-3 border-t border-[var(--border-divider)]">
          <div>
            {isEdit && onDelete && !locked && (
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
            <button onClick={onClose} className="btn-secondary">
              닫기
            </button>

            {!locked && (
              <button onClick={submit} className="btn-primary">
                {isEdit ? "저장" : "등록"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
