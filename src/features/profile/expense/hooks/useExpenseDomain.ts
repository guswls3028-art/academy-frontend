// PATH: src/features/profile/expense/hooks/useExpenseDomain.ts
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Expense,
  createExpense,
  deleteExpense,
  fetchMyExpenses,
  updateExpense,
} from "../../api/profile.api";

function normalizeRows(data: unknown): Expense[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "results" in data) {
    const r = (data as any).results;
    return Array.isArray(r) ? r : [];
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
    mutationFn: ({ id, payload }: { id: number; payload: any }) => updateExpense(id, payload),
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

  const submit = async (form: { date: string; title: string; amount: number; memo: string }) => {
    const payload = {
      date: form.date,
      title: form.title.trim(),
      amount: Number(form.amount) || 0,
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
