// PATH: src/app_admin/domains/profile/expense/hooks/useExpenseDomain.ts
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type Expense,
  type ExpenseMutationPayload,
  createExpense,
  deleteExpense,
  fetchMyExpenses,
  updateExpense,
} from "../../api/profile.api";
import { adminProfileQueryKeys } from "../../queryKeys";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function normalizeRows(data: unknown): Expense[] {
  if (Array.isArray(data)) return data as Expense[];
  if (isRecord(data)) {
    const rows = data.results;
    return Array.isArray(rows) ? rows as Expense[] : [];
  }
  return [];
}

function inRange(date: string, from: string, to: string) {
  if (!from || !to) return true;
  return date >= from && date <= to;
}

export function useExpenseDomain(month: string, range: { from: string; to: string }) {
  const qc = useQueryClient();
  const confirm = useConfirm();

  const listQ = useQuery({
    queryKey: adminProfileQueryKeys.myExpenses(month),
    queryFn: () => fetchMyExpenses(month),
  });

  const allRows = useMemo(() => normalizeRows(listQ.data), [listQ.data]);

  const rows = useMemo(
    () => allRows.filter((r) => inRange(r.date, range.from, range.to)),
    [allRows, range.from, range.to]
  );

  const total = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [rows]
  );

  const invalidateExpenses = () =>
    qc.invalidateQueries({ queryKey: adminProfileQueryKeys.myExpenses(month) });

  const createMut = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      invalidateExpenses();
      feedback.success("지출을 등록했습니다.");
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ExpenseMutationPayload> }) =>
      updateExpense(id, payload),
    onSuccess: () => {
      invalidateExpenses();
      feedback.success("지출을 수정했습니다.");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteExpense(id),
    onSuccess: () => {
      invalidateExpenses();
      feedback.success("지출을 삭제했습니다.");
    },
    onError: (error: unknown) => {
      feedback.error(extractApiError(error, "지출 삭제에 실패했습니다."));
    },
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [createDefaultDate, setCreateDefaultDate] = useState<string | null>(null);

  const openCreate = (selectedMonth?: string) => {
    setEditing(null);
    setCreateDefaultDate(selectedMonth ? `${selectedMonth}-01` : range.from);
    setOpen(true);
  };

  const openEdit = (row: Expense) => {
    setEditing(row);
    setCreateDefaultDate(null);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setEditing(null);
    setCreateDefaultDate(null);
  };

  const submit = async (form: ExpenseMutationPayload) => {
    const payload: ExpenseMutationPayload = {
      date: form.date,
      title: form.title.trim(),
      amount: form.amount,
      memo: form.memo?.trim() || undefined,
    };

    if (editing) {
      await updateMut.mutateAsync({ id: editing.id, payload });
    } else {
      await createMut.mutateAsync(payload);
    }
    close();
  };

  const remove = async (row: Expense) => {
    const ok = await confirm({
      title: "지출 삭제",
      message: `${row.date} · ${row.title} 지출을 삭제하시겠습니까?`,
      confirmText: "삭제",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(row.id);
    } catch {
      // mutation onError가 사용자 피드백을 담당한다.
    }
  };

  return {
    rows,
    allRows,
    total,
    isLoading: listQ.isLoading,
    isError: listQ.isError,
    refetch: listQ.refetch,

    open,
    editing,
    createDefaultDate,
    submitting: createMut.isPending || updateMut.isPending,
    deletingId: deleteMut.isPending ? deleteMut.variables : null,

    openCreate,
    openEdit,
    close,
    submit,
    remove,
  };
}
