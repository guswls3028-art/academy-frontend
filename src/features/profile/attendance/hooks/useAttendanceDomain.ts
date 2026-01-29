// PATH: src/features/profile/attendance/hooks/useAttendanceDomain.ts
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Attendance,
  createAttendance,
  deleteAttendance,
  fetchAttendanceSummary,
  fetchMyAttendance,
  updateAttendance,
  AttendanceSummary,
} from "../../api/profile.api";

/** 백엔드가 배열 or {results: []} 형태로 와도 방어 */
function normalizeRows(data: unknown): Attendance[] {
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

export function useAttendanceDomain(month: string, range: { from: string; to: string }) {
  const qc = useQueryClient();

  const listQ = useQuery({
    queryKey: ["my-attendance", month],
    queryFn: () => fetchMyAttendance(month),
  });

  const summaryQ = useQuery({
    queryKey: ["my-attendance-summary", month],
    queryFn: () => fetchAttendanceSummary(month),
  });

  const createMut = useMutation({
    mutationFn: createAttendance,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-attendance", month] });
      await qc.invalidateQueries({ queryKey: ["my-attendance-summary", month] });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateAttendance(id, data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-attendance", month] });
      await qc.invalidateQueries({ queryKey: ["my-attendance-summary", month] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteAttendance(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-attendance", month] });
      await qc.invalidateQueries({ queryKey: ["my-attendance-summary", month] });
    },
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Attendance | null>(null);

  const allRows = useMemo(() => normalizeRows(listQ.data), [listQ.data]);

  /** ✅ 기간 필터 적용된 rows */
  const rows = useMemo(() => {
    const from = range?.from || "";
    const to = range?.to || "";
    return allRows.filter((r) => inRange(r.date, from, to));
  }, [allRows, range?.from, range?.to]);

  /** ✅ “기간 요약”은 프론트에서 계산 */
  const rangeSummary = useMemo<AttendanceSummary | null>(() => {
    if (!rows.length) return { total_hours: 0, total_amount: 0, total_after_tax: 0 };

    const total_hours = rows.reduce((s, r) => s + (Number(r.duration_hours) || 0), 0);
    const total_amount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

    // ✅ 세후는 서버(month summary)의 비율을 적용해서 추정 (원본 API 손상 없음)
    const monthSum = summaryQ.data;
    let total_after_tax = 0;
    if (monthSum && monthSum.total_amount > 0) {
      const ratio = monthSum.total_after_tax / monthSum.total_amount;
      total_after_tax = Math.round(total_amount * ratio);
    } else {
      total_after_tax = total_amount;
    }

    return { total_hours, total_amount, total_after_tax };
  }, [rows, summaryQ.data]);

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (row: Attendance) => {
    setEditing(row);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setEditing(null);
  };

  const submit = async (form: any) => {
    if (editing) {
      await updateMut.mutateAsync({ id: editing.id, data: form });
    } else {
      await createMut.mutateAsync(form);
    }
    close();
  };

  const remove = async (row: Attendance) => {
    if (!confirm("해당 근태 기록을 삭제하시겠습니까?")) return;
    await deleteMut.mutateAsync(row.id);
  };

  return {
    // ✅ 기존 유지 + 확장
    rows,                 // 기간 필터 적용
    allRows,              // 월 전체(엑셀/참고용)
    summary: summaryQ.data,     // 월 요약(서버)
    rangeSummary,               // 기간 요약(프론트)
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
