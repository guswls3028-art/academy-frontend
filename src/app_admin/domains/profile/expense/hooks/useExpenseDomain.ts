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

  const listQ = useQuery({
    queryKey: ["my-expenses", month],
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

  const createMut = useMutation({
    mutationFn: createExpense,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-expenses", month] });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ExpenseMutationPayload> }) =>
      updateExpense(id, payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-expenses", month] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteExpense(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-expenses", month] });
    },
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (row: Expense) => {
    setEditing(row);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setEditing(null);
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
    if (!confirm("해당 지출을 삭제하시겠습니까?")) return;
    await deleteMut.mutateAsync(row.id);
  };

  return {
    rows,
    allRows,
    total,
    isLoading: listQ.isLoading,

    open,
    editing,
    submitting: createMut.isPending || updateMut.isPending,

    openCreate,
    openEdit,
    close,
    submit,
    remove,
  };
}
