// PATH: src/features/profile/attendance/hooks/useAttendanceDomain.ts
import { useState } from "react";
import {
  Attendance,
} from "@/features/profile/api/profile";
import {
  useMyAttendance,
  useAttendanceSummary,
  useCreateAttendance,
  useUpdateAttendance,
  useDeleteAttendance,
} from "@/features/profile/hooks/useProfile";

export function useAttendanceDomain(month: string) {
  const listQ = useMyAttendance(month);
  const summaryQ = useAttendanceSummary(month);

  const createMut = useCreateAttendance(month);
  const updateMut = useUpdateAttendance(month);
  const deleteMut = useDeleteAttendance(month);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Attendance | null>(null);

  const submit = async (form: any) => {
    if (editing) {
      await updateMut.mutateAsync({ id: editing.id, data: form });
    } else {
      await createMut.mutateAsync(form);
    }
    setOpen(false);
    setEditing(null);
  };

  const remove = async (row: Attendance) => {
    if (!confirm("해당 근태 기록을 삭제하시겠습니까?")) return;
    await deleteMut.mutateAsync(row.id);
  };

  return {
    // data
    rows: listQ.data ?? [],
    summary: summaryQ.data,
    isLoading: listQ.isLoading,

    // modal state
    open,
    editing,

    // actions
    openCreate: () => {
      setEditing(null);
      setOpen(true);
    },
    openEdit: (r: Attendance) => {
      setEditing(r);
      setOpen(true);
    },
    closeModal: () => {
      setOpen(false);
