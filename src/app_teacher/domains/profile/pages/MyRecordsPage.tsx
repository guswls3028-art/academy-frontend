/* eslint-disable no-restricted-syntax */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState, ICON } from "@/shared/ui/ds";
import { ChevronLeft, Pencil, Plus, Trash2 } from "@teacher/shared/ui/Icons";
import { Card, TabBar } from "@teacher/shared/ui/Card";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import api from "@/shared/api/axios";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";
import { useConfirm } from "@/shared/ui/confirm";
import { todayLocalISO } from "@/shared/utils/localDate";
import {
  fetchMyWorkRecords,
  fetchMyWorkSummary,
  fetchStaffMe,
  type WorkRecord,
} from "@/features/staff-clock/api";
import { staffClockQueryKeys } from "@/features/staff-clock/queryKeys";
import { teacherProfileQueryKeys } from "../queryKeys";

type Tab = "attendance" | "expense";
type Expense = {
  id: number;
  date: string;
  title: string;
  amount: number;
  memo?: string | null;
};

const now = new Date();
const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

function monthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

async function fetchExpenses(month: string): Promise<Expense[]> {
  const { data } = await api.get("/core/profile/expenses/", { params: { month } });
  return Array.isArray(data) ? data as Expense[] : [];
}

async function createExpense(payload: Omit<Expense, "id">) {
  return (await api.post("/core/profile/expenses/", payload)).data as Expense;
}

async function updateExpense(id: number, payload: Omit<Expense, "id">) {
  return (await api.patch(`/core/profile/expenses/${id}/`, payload)).data as Expense;
}

async function deleteExpense(id: number) {
  await api.delete(`/core/profile/expenses/${id}/`);
}

export default function MyRecordsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("attendance");
  const [month, setMonth] = useState(thisMonth);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const range = useMemo(() => monthBounds(month), [month]);
  const staffMeQ = useQuery({
    queryKey: staffClockQueryKeys.me,
    queryFn: fetchStaffMe,
    staleTime: 30_000,
  });
  const staffId = staffMeQ.data?.staff_id;
  const recordsQ = useQuery({
    queryKey: staffId != null
      ? staffClockQueryKeys.personalRecords(staffId, range.from, range.to)
      : ["my-work-records", "unavailable", range.from, range.to],
    queryFn: () => fetchMyWorkRecords(staffId!, range.from, range.to),
    enabled: tab === "attendance" && staffId != null,
  });
  const summaryQ = useQuery({
    queryKey: staffId != null
      ? staffClockQueryKeys.personalSummary(staffId, range.from, range.to)
      : ["my-work-summary", "unavailable", range.from, range.to],
    queryFn: () => fetchMyWorkSummary(staffId!, range.from, range.to),
    enabled: tab === "attendance" && staffId != null,
  });
  const expensesQ = useQuery({
    queryKey: teacherProfileQueryKeys.expenses(month),
    queryFn: () => fetchExpenses(month),
    enabled: tab === "expense",
  });
  const deleteExpenseMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teacherProfileQueryKeys.expenses(month) });
      teacherToast.info("지출 기록이 삭제되었습니다.");
    },
    onError: (error) => teacherToast.error(extractApiError(error, "지출 기록을 삭제하지 못했습니다.")),
  });

  const openExpenseForm = (expense?: Expense) => {
    setEditTarget(expense ?? null);
    setFormOpen(true);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex p-1 cursor-pointer"
          style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}
          aria-label="뒤로"
        >
          <ChevronLeft size={ICON.lg} />
        </button>
        <h1 className="text-[17px] font-bold flex-1" style={{ color: "var(--tc-text)" }}>
          근무 기록 / 지출
        </h1>
        {tab === "expense" && (
          <button
            type="button"
            onClick={() => openExpenseForm()}
            className="flex items-center gap-1 text-xs font-bold cursor-pointer"
            style={{ padding: "6px 12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}
          >
            <Plus size={ICON.xs} /> 등록
          </button>
        )}
      </div>

      <input
        type="month"
        value={month}
        onChange={(event) => setMonth(event.target.value)}
        className="text-sm self-center"
        style={{ padding: "6px 12px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border)", background: "var(--tc-surface)", color: "var(--tc-text)" }}
        aria-label="조회 월"
      />

      <TabBar
        tabs={[
          { key: "attendance" as Tab, label: "근무 기록" },
          { key: "expense" as Tab, label: "지출" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "attendance" ? (
        <AttendanceContent
          records={recordsQ.data ?? []}
          loading={staffMeQ.isLoading || recordsQ.isLoading || summaryQ.isLoading}
          error={staffMeQ.isError || recordsQ.isError || summaryQ.isError}
          hasStaffProfile={staffId != null}
          totalHours={Number(summaryQ.data?.work_hours ?? 0)}
          totalAmount={Number(summaryQ.data?.work_amount ?? 0)}
          onRetry={() => {
            void staffMeQ.refetch();
            void recordsQ.refetch();
            void summaryQ.refetch();
          }}
        />
      ) : expensesQ.isLoading ? (
        <EmptyState scope="panel" tone="loading" title="지출 기록을 불러오는 중" />
      ) : expensesQ.isError ? (
        <EmptyState
          scope="panel"
          tone="error"
          title="지출 기록을 불러오지 못했습니다"
          actions={<button type="button" onClick={() => void expensesQ.refetch()}>다시 시도</button>}
        />
      ) : expensesQ.data?.length ? (
        <div className="flex flex-col gap-1.5">
          {expensesQ.data.map((expense) => (
            <Card key={expense.id} style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium" style={{ color: "var(--tc-text)" }}>
                    {expense.date} · {expense.title}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                    {expense.amount.toLocaleString()}원 {expense.memo ? `· ${expense.memo}` : ""}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => openExpenseForm(expense)}
                    className="flex p-1 cursor-pointer"
                    style={{ background: "none", border: "none", color: "var(--tc-text-muted)" }}
                    aria-label={`${expense.title} 지출 수정`}
                  >
                    <Pencil size={ICON.md} />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const confirmed = await confirm({
                        title: "지출 삭제",
                        message: "이 지출 기록을 삭제하시겠습니까?",
                        confirmText: "삭제",
                        danger: true,
                      });
                      if (confirmed) deleteExpenseMutation.mutate(expense.id);
                    }}
                    className="flex p-1 cursor-pointer"
                    style={{ background: "none", border: "none", color: "var(--tc-danger)" }}
                    aria-label={`${expense.title} 지출 삭제`}
                  >
                    <Trash2 size={ICON.md} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          scope="panel"
          tone="empty"
          title="지출 기록이 없습니다"
          description="업무 지출을 등록하면 월별 비용 확인에 반영됩니다."
          actions={<button type="button" onClick={() => openExpenseForm()}>지출 등록</button>}
        />
      )}

      <ExpenseFormSheet
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        month={month}
        editData={editTarget}
      />
    </div>
  );
}

function AttendanceContent({
  records,
  loading,
  error,
  hasStaffProfile,
  totalHours,
  totalAmount,
  onRetry,
}: {
  records: WorkRecord[];
  loading: boolean;
  error: boolean;
  hasStaffProfile: boolean;
  totalHours: number;
  totalAmount: number;
  onRetry: () => void;
}) {
  if (loading) return <EmptyState scope="panel" tone="loading" title="근무 기록을 불러오는 중" />;
  if (error) {
    return (
      <EmptyState
        scope="panel"
        tone="error"
        title="근무 기록을 불러오지 못했습니다"
        actions={<button type="button" onClick={onRetry}>다시 시도</button>}
      />
    );
  }
  if (!hasStaffProfile) {
    return (
      <EmptyState
        scope="panel"
        tone="empty"
        title="연결된 직원 정보가 없습니다"
        description="관리자에게 직원 계정 연결을 요청해 주세요."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Card style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>총 근무시간</div>
            <div className="text-lg font-bold tabular-nums" style={{ color: "var(--tc-text)" }}>{totalHours}시간</div>
          </div>
          <div>
            <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>총 근무액 (공제 전)</div>
            <div className="text-lg font-bold tabular-nums" style={{ color: "var(--tc-primary)" }}>{totalAmount.toLocaleString()}원</div>
          </div>
        </div>
      </Card>
      {records.length === 0 ? (
        <EmptyState
          scope="panel"
          tone="empty"
          title="근무 기록이 없습니다"
          description="로그인 후 근무 유형을 선택해 출근하면 자동으로 기록됩니다."
        />
      ) : (
        records.map((record) => (
          <Card key={record.id} style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>
                  {record.date} · {record.work_type_name}
                </div>
                <div className="mt-0.5 text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                  {record.start_time.slice(0, 5)} ~ {record.end_time?.slice(0, 5) ?? "근무 중"}
                  {record.end_time ? ` · ${record.work_hours ?? 0}시간` : " · 진행 중"}
                  {(record.break_minutes ?? 0) > 0 ? ` · 휴게 ${record.break_minutes}분` : ""}
                </div>
                <div className="mt-1 text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                  적용 시급 {record.resolved_hourly_wage?.toLocaleString() ?? "-"}원
                </div>
              </div>
              <div className="shrink-0 text-right text-sm font-bold tabular-nums" style={{ color: "var(--tc-text)" }}>
                {record.end_time ? `${(record.amount ?? 0).toLocaleString()}원` : "계산 전"}
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

function ExpenseFormSheet({
  open,
  onClose,
  month,
  editData,
}: {
  open: boolean;
  onClose: () => void;
  month: string;
  editData: Expense | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = editData != null;
  const [date, setDate] = useState(editData?.date || todayLocalISO());
  const [title, setTitle] = useState(editData?.title || "");
  const [amount, setAmount] = useState(editData?.amount ? String(editData.amount) : "");
  const [memo, setMemo] = useState(editData?.memo || "");

  useEffect(() => {
    if (!open) return;
    setDate(editData?.date || todayLocalISO());
    setTitle(editData?.title || "");
    setAmount(editData?.amount ? String(editData.amount) : "");
    setMemo(editData?.memo || "");
  }, [editData, open]);

  const parsedAmount = Number(amount);
  const canSubmit = Boolean(date && title.trim() && Number.isFinite(parsedAmount) && parsedAmount > 0);
  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        date,
        title: title.trim(),
        amount: parsedAmount,
        memo: memo.trim() || null,
      };
      return isEdit ? updateExpense(editData.id, payload) : createExpense(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teacherProfileQueryKeys.expenses(month) });
      teacherToast.success(`지출 기록이 ${isEdit ? "수정" : "등록"}되었습니다.`);
      onClose();
    },
    onError: (error) => teacherToast.error(extractApiError(error, `지출 ${isEdit ? "수정" : "등록"}에 실패했습니다.`)),
  });

  return (
    <BottomSheet open={open} onClose={onClose} title={`지출 ${isEdit ? "편집" : "등록"}`}>
      <div className="flex flex-col gap-2.5" style={{ padding: "var(--tc-space-3) 0" }}>
        <Field label="날짜" value={date} onChange={setDate} type="date" />
        <Field label="항목" value={title} onChange={setTitle} placeholder="지출 항목" />
        <Field label="금액 (원)" value={amount} onChange={setAmount} type="number" placeholder="0" />
        <Field label="메모" value={memo} onChange={setMemo} placeholder="메모 (선택)" />
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !canSubmit}
          className="w-full text-sm font-bold cursor-pointer mt-1"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}
        >
          {mutation.isPending ? "저장 중..." : isEdit ? "수정" : "등록"}
        </button>
      </div>
    </BottomSheet>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex-1">
      <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>
        {label}
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full text-sm mt-1"
          style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }}
        />
      </label>
    </div>
  );
}
