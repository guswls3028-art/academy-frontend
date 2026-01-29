// src/features/profile/hooks/useProfile.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Attendance,
  AttendanceSummary,
  Expense,
  Me,
  changePassword,
  createAttendance,
  createExpense,
  deleteAttendance,
  deleteExpense,
  fetchAttendanceSummary,
  fetchMe,
  fetchMyAttendance,
  fetchMyExpenses,
  updateAttendance,
  updateProfile,
} from "../api/profile";

export function useMe() {
  return useQuery<Me>({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 30_000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: changePassword,
  });
}

/* Attendance */
export function useMyAttendance(month?: string) {
  return useQuery<Attendance[]>({
    queryKey: ["my-attendance", month],
    queryFn: () => fetchMyAttendance(month),
  });
}

export function useAttendanceSummary(month?: string) {
  return useQuery<AttendanceSummary>({
    queryKey: ["my-attendance-summary", month],
    queryFn: () => fetchAttendanceSummary(month),
  });
}

export function useCreateAttendance(month?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAttendance,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-attendance", month] });
      await qc.invalidateQueries({ queryKey: ["my-attendance-summary", month] });
    },
  });
}

export function useUpdateAttendance(month?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<any> }) =>
      updateAttendance(id, data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-attendance", month] });
      await qc.invalidateQueries({ queryKey: ["my-attendance-summary", month] });
    },
  });
}

export function useDeleteAttendance(month?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteAttendance(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-attendance", month] });
      await qc.invalidateQueries({ queryKey: ["my-attendance-summary", month] });
    },
  });
}

/* Expense */
export function useMyExpenses(month?: string) {
  return useQuery<Expense[]>({
    queryKey: ["my-expenses", month],
    queryFn: () => fetchMyExpenses(month),
  });
}

export function useCreateExpense(month?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createExpense,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-expenses", month] });
    },
  });
}

export function useDeleteExpense(month?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteExpense(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-expenses", month] });
    },
  });
}
