/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any */
// PATH: src/app_teacher/domains/staff/pages/StaffDetailPage.tsx
// 직원 상세 — 근태/비용/급여 월별 조회 + 관리 (원장/조교 관리자용)
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { ChevronLeft, Plus, Pencil, Trash2, Check, X, Lock } from "@teacher/shared/ui/Icons";
import { Card, TabBar } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";
import { useConfirm } from "@/shared/ui/confirm";
import {
  fetchStaffOne,
  fetchWorkRecords, createWorkRecord, updateWorkRecord, deleteWorkRecord,
  fetchExpenseRecords, updateExpenseStatus, deleteExpenseRecord,
  fetchPayrollSnapshots,
  fetchWorkMonthLocks, createWorkMonthLock, deleteWorkMonthLock,
  fetchWorkTypes,
  type WorkRecord,
} from "../api";

type Tab = "work" | "expense" | "payroll";

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function StaffDetailPage() {
  const { staffId } = useParams<{ staffId: string }>();
  const navigate = useNavigate();
  const sid = Number(staffId);

  const [tab, setTab] = useState<Tab>("work");
  const [month, setMonth] = useState(thisMonth());
  const [workFormOpen, setWorkFormOpen] = useState(false);
  const [editWork, setEditWork] = useState<WorkRecord | null>(null);

  const { data: staff, isLoading: staffLoading } = useQuery({
    queryKey: ["teacher-staff-one", sid],
    queryFn: () => fetchStaffOne(sid),
    enabled: Number.isFinite(sid),
  });

  const { data: locks } = useQuery({
    queryKey: ["teacher-staff-locks", sid, month],
    queryFn: () => fetchWorkMonthLocks({ staff: sid, month }),
    enabled: Number.isFinite(sid),
  });
  const isLocked = (locks ?? []).length > 0;
  const lockId = locks?.[0]?.id;

  if (staffLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!staff) return <EmptyState scope="panel" tone="error" title="직원 정보를 찾을 수 없습니다" />;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <button onClick={() => navigate(-1)} className="flex p-1 cursor-pointer"
          style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[17px] font-bold flex-1 truncate" style={{ color: "var(--tc-text)" }}>{staff.name}</h1>
        <Badge tone="neutral" size="xs">{staff.role === "TEACHER" ? "강사" : staff.role === "owner" ? "원장" : "조교"}</Badge>
      </div>

      {/* Month selector + lock status */}
      <div className="flex items-center gap-2">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="text-sm flex-1"
          style={{ padding: "8px 12px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border)", background: "var(--tc-surface)", color: "var(--tc-text)" }} />
        <LockButton staffId={sid} month={month} isLocked={isLocked} lockId={lockId} />
      </div>

      {/* Tabs */}
      <TabBar
        tabs={[
          { key: "work" as Tab, label: "근태" },
          { key: "expense" as Tab, label: "비용" },
          { key: "payroll" as Tab, label: "급여" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "work" && (
        <WorkTab staffId={sid} month={month} isLocked={isLocked}
          onAdd={() => { setEditWork(null); setWorkFormOpen(true); }}
          onEdit={(r) => { setEditWork(r); setWorkFormOpen(true); }} />
      )}
      {tab === "expense" && <ExpenseTab staffId={sid} month={month} />}
      {tab === "payroll" && <PayrollTab staffId={sid} month={month} isLocked={isLocked} />}

      <WorkFormSheet open={workFormOpen} onClose={() => { setWorkFormOpen(false); setEditWork(null); }}
        staffId={sid} month={month} editData={editWork} />
    </div>
  );
}

/* ─── Lock Button ─── */
function LockButton({ staffId, month, isLocked, lockId }: { staffId: number; month: string; isLocked: boolean; lockId?: number }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const lockMut = useMutation({
    mutationFn: () => createWorkMonthLock({ staff: staffId, month }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-staff-locks", staffId, month] });
      teacherToast.success("월이 마감되었습니다.");
    },
    onError: () => teacherToast.error("마감에 실패했습니다."),
  });
  const unlockMut = useMutation({
    mutationFn: () => lockId ? deleteWorkMonthLock(lockId) : Promise.reject(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-staff-locks", staffId, month] });
      teacherToast.success("월 마감이 해제되었습니다.");
    },
    onError: () => teacherToast.error("해제에 실패했습니다."),
  });

  if (isLocked) {
    return (
      <button onClick={async () => {
          const ok = await confirm({ title: "월 마감 해제", message: "월 마감을 해제하시겠습니까? 해제하면 내역을 다시 수정할 수 있습니다.", confirmText: "해제" });
          if (ok) unlockMut.mutate();
        }}
        className="flex items-center gap-1 text-xs font-semibold cursor-pointer"
        style={{ padding: "7px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-warn)", background: "var(--tc-warn-bg)", color: "var(--tc-warn)" }}>
        <Lock size={12} /> 마감됨
      </button>
    );
  }
  return (
    <button onClick={async () => {
        const ok = await confirm({ title: "월 마감", message: `${month} 월을 마감하시겠습니까? 마감 후에는 내역을 수정할 수 없습니다.`, confirmText: "마감" });
        if (ok) lockMut.mutate();
      }}
      className="flex items-center gap-1 text-xs font-semibold cursor-pointer"
      style={{ padding: "7px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface)", color: "var(--tc-text-secondary)" }}>
      월 마감
    </button>
  );
}

/* ─── Work Tab ─── */
function WorkTab({ staffId, month, isLocked, onAdd, onEdit }: {
  staffId: number; month: string; isLocked: boolean;
  onAdd: () => void; onEdit: (r: WorkRecord) => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: records, isLoading } = useQuery({
    queryKey: ["teacher-staff-work", staffId, month],
    queryFn: () => fetchWorkRecords({ staff: staffId, month }),
  });

  const deleteMut = useMutation({
    mutationFn: deleteWorkRecord,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-staff-work", staffId, month] });
      teacherToast.success("근태 기록이 삭제되었습니다.");
    },
    onError: (e) => teacherToast.error(extractApiError(e, "삭제에 실패했습니다.")),
  });

  const totalHours = (records ?? []).reduce((s, r) => s + Number(r.work_hours ?? 0), 0);
  const totalAmount = (records ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;

  return (
    <div className="flex flex-col gap-2">
      {/* Summary */}
      <Card style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>이번 달 총합</span>
            <span className="text-sm font-bold" style={{ color: "var(--tc-text)" }}>{totalHours.toFixed(1)}시간</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>예상 금액</span>
            <span className="text-sm font-bold" style={{ color: "var(--tc-text)" }}>{totalAmount.toLocaleString()}원</span>
          </div>
          {!isLocked && (
            <button onClick={onAdd}
              className="flex items-center gap-1 text-xs font-bold cursor-pointer shrink-0 ml-3"
              style={{ padding: "6px 10px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
              <Plus size={13} /> 추가
            </button>
          )}
        </div>
      </Card>

      {/* Records */}
      {records && records.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {records.map((r) => (
            <Card key={r.id} style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>
                    {r.date}{r.work_type_name ? ` · ${r.work_type_name}` : ""}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                    {r.start_time?.slice(0, 5) ?? "--"} ~ {r.end_time?.slice(0, 5) ?? "--"}
                    {r.work_hours != null ? ` · ${Number(r.work_hours).toFixed(1)}h` : ""}
                    {r.amount != null ? ` · ${Number(r.amount).toLocaleString()}원` : ""}
                  </div>
                  {r.memo && <div className="text-[11px] mt-0.5 truncate" style={{ color: "var(--tc-text-muted)" }}>{r.memo}</div>}
                </div>
                {!isLocked && (
                  <div className="flex gap-0.5 shrink-0">
                    <button onClick={() => onEdit(r)} className="flex p-1.5 cursor-pointer"
                      style={{ background: "none", border: "none", color: "var(--tc-text-muted)" }}>
                      <Pencil size={13} />
                    </button>
                    <button onClick={async () => {
                        const ok = await confirm({ title: "근태 삭제", message: "이 근태 기록을 삭제하시겠습니까?", confirmText: "삭제", danger: true });
                        if (ok) deleteMut.mutate(r.id);
                      }}
                      className="flex p-1.5 cursor-pointer"
                      style={{ background: "none", border: "none", color: "var(--tc-danger)" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState scope="panel" tone="empty" title="근태 기록이 없습니다" />
      )}
    </div>
  );
}

/* ─── Expense Tab ─── */
function ExpenseTab({ staffId, month }: { staffId: number; month: string }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data, isLoading } = useQuery({
    queryKey: ["teacher-staff-expense", staffId, month],
    queryFn: () => fetchExpenseRecords({ staff: staffId, month }),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "approved" | "rejected" }) => updateExpenseStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-staff-expense", staffId, month] });
      teacherToast.success("처리되었습니다.");
    },
    onError: (e) => teacherToast.error(extractApiError(e, "처리에 실패했습니다.")),
  });

  const deleteMut = useMutation({
    mutationFn: deleteExpenseRecord,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teacher-staff-expense", staffId, month] }),
    onError: (e) => teacherToast.error(extractApiError(e, "비용 기록을 삭제하지 못했습니다.")),
  });

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!data || data.length === 0) return <EmptyState scope="panel" tone="empty" title="비용 기록이 없습니다" />;

  const total = data.filter(e => e.status === "approved").reduce((s, e) => s + (e.amount ?? 0), 0);
  const pending = data.filter(e => e.status === "pending").length;

  return (
    <div className="flex flex-col gap-2">
      <Card style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>승인된 비용 합계</div>
            <div className="text-sm font-bold" style={{ color: "var(--tc-text)" }}>{total.toLocaleString()}원</div>
          </div>
          {pending > 0 && <Badge tone="warning">승인 대기 {pending}</Badge>}
        </div>
      </Card>

      <div className="flex flex-col gap-1.5">
        {data.map((e) => (
          <Card key={e.id} style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>{e.title}</span>
                  <StatusBadge status={e.status} />
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
                  {e.date} · {e.amount?.toLocaleString()}원{e.memo ? ` · ${e.memo}` : ""}
                </div>
              </div>
            </div>
            {e.status === "pending" && (
              <div className="flex gap-1.5 mt-2">
                <button onClick={() => statusMut.mutate({ id: e.id, status: "approved" })}
                  className="flex items-center justify-center gap-1 flex-1 text-xs font-bold cursor-pointer"
                  style={{ padding: "6px", borderRadius: "var(--tc-radius-sm)", border: "none", background: "var(--tc-success-bg)", color: "var(--tc-success)" }}>
                  <Check size={12} /> 승인
                </button>
                <button onClick={() => statusMut.mutate({ id: e.id, status: "rejected" })}
                  className="flex items-center justify-center gap-1 flex-1 text-xs font-bold cursor-pointer"
                  style={{ padding: "6px", borderRadius: "var(--tc-radius-sm)", border: "none", background: "var(--tc-danger-bg)", color: "var(--tc-danger)" }}>
                  <X size={12} /> 반려
                </button>
                <button onClick={async () => {
                    const ok = await confirm({ title: "비용 기록 삭제", message: "이 비용 기록을 삭제하시겠습니까?", confirmText: "삭제", danger: true });
                    if (ok) deleteMut.mutate(e.id);
                  }}
                  className="flex items-center justify-center text-xs cursor-pointer shrink-0"
                  style={{ padding: "6px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border)", background: "var(--tc-surface)", color: "var(--tc-text-muted)" }}>
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (status === "approved") return <Badge tone="success" size="xs">승인</Badge>;
  if (status === "rejected") return <Badge tone="danger" size="xs">반려</Badge>;
  return <Badge tone="warning" size="xs">대기</Badge>;
}

/* ─── Payroll Tab ─── */
function PayrollTab({ staffId, month, isLocked }: { staffId: number; month: string; isLocked: boolean }) {
  const [year, m] = month.split("-").map(Number);
  const { data, isLoading } = useQuery({
    queryKey: ["teacher-staff-payroll", staffId, year, m],
    // 백엔드는 year / month 분리 파라미터
    queryFn: () => fetchPayrollSnapshots({ staff: staffId, year, month: m }),
  });

  const snap = data?.[0];

  if (!snap && !isLocked) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-1.5 py-3">
          <Lock size={18} style={{ color: "var(--tc-text-muted)" }} />
          <div className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>월을 마감하면 급여가 확정됩니다</div>
          <div className="text-[11px] text-center" style={{ color: "var(--tc-text-muted)" }}>
            위의 <span style={{ fontWeight: 600 }}>월 마감</span> 버튼을 눌러 확정하세요.
          </div>
        </div>
      </Card>
    );
  }

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!snap) return <EmptyState scope="panel" tone="empty" title="급여 데이터가 없습니다" />;

  return (
    <Card>
      <div className="text-[13px] font-bold mb-2" style={{ color: "var(--tc-text)" }}>
        {snap.year}년 {snap.month}월 확정 급여
      </div>
      <div className="flex flex-col gap-1.5">
        <Row label="근무 시간" value={`${Number(snap.work_hours ?? 0).toFixed(1)}시간`} />
        <Row label="근무 금액" value={`${Number(snap.work_amount ?? 0).toLocaleString()}원`} />
        {Number(snap.approved_expense_amount) > 0 && (
          <Row label="승인된 비용" value={`+${Number(snap.approved_expense_amount).toLocaleString()}원`} />
        )}
        <div className="flex items-center justify-between py-2 mt-1.5"
          style={{ borderTop: "1px solid var(--tc-border-subtle)" }}>
          <span className="text-sm font-bold" style={{ color: "var(--tc-text)" }}>총 지급액</span>
          <span className="text-[17px] font-bold" style={{ color: "var(--tc-primary)" }}>
            {Number(snap.total_amount ?? 0).toLocaleString()}원
          </span>
        </div>
        {snap.generated_by_name && (
          <div className="text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
            확정자: {snap.generated_by_name}
          </div>
        )}
      </div>
    </Card>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px]" style={{ color: "var(--tc-text-muted)" }}>{label}</span>
      <span className="text-[13px] font-semibold" style={{ color: tone === "danger" ? "var(--tc-danger)" : "var(--tc-text)" }}>{value}</span>
    </div>
  );
}

/* ─── Work Form Sheet ─── */
function WorkFormSheet({ open, onClose, staffId, month, editData }: {
  open: boolean; onClose: () => void; staffId: number; month: string; editData: WorkRecord | null;
}) {
  const qc = useQueryClient();
  const isEdit = !!editData;
  const defaultDate = editData?.date || `${month}-${String(new Date().getDate()).padStart(2, "0")}`;
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState(editData?.start_time?.slice(0, 5) || "09:00");
  const [endTime, setEndTime] = useState(editData?.end_time?.slice(0, 5) || "18:00");
  const [breakMin, setBreakMin] = useState(String(editData?.break_minutes ?? 0));
  const [workTypeId, setWorkTypeId] = useState<number | null>(
    typeof editData?.work_type === "number" ? editData.work_type : null
  );
  const [memo, setMemo] = useState(editData?.memo || "");

  const { data: workTypes } = useQuery({
    queryKey: ["teacher-staff-work-types"],
    queryFn: fetchWorkTypes,
    enabled: open,
  });

  // Auto-select first work type when loaded (only if creating new)
  useEffect(() => {
    if (!isEdit && workTypeId == null && workTypes && workTypes.length > 0) {
      setWorkTypeId(workTypes[0].id);
    }
  }, [workTypes, isEdit, workTypeId]);

  const mutation = useMutation({
    mutationFn: () => {
      if (workTypeId == null) throw new Error("근무 유형을 선택하세요.");
      const payload = {
        staff: staffId,
        date,
        start_time: startTime,
        end_time: endTime,
        break_minutes: Number(breakMin) || 0,
        work_type: workTypeId,
        memo: memo || undefined,
      };
      return isEdit ? updateWorkRecord(editData!.id, payload) : createWorkRecord(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-staff-work", staffId, month] });
      teacherToast.success(isEdit ? "수정되었습니다." : "근태가 등록되었습니다.");
      onClose();
    },
    onError: (e: any) => teacherToast.error(e?.message ?? "저장에 실패했습니다."),
  });

  const hasWorkTypes = !!(workTypes && workTypes.length > 0);

  return (
    <BottomSheet open={open} onClose={onClose} title={isEdit ? "근태 편집" : "근태 등록"}>
      <div className="flex flex-col gap-2.5" style={{ padding: "var(--tc-space-3) 0" }}>
        <Fld label="날짜" value={date} onChange={setDate} type="date" />
        <div className="flex gap-2">
          <Fld label="시작" value={startTime} onChange={setStartTime} type="time" />
          <Fld label="종료" value={endTime} onChange={setEndTime} type="time" />
        </div>
        <Fld label="휴게(분)" value={breakMin} onChange={setBreakMin} type="number" />

        {/* 근무 유형 드롭다운 (FK 선택) */}
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>근무 유형</label>
          {hasWorkTypes ? (
            <div className="flex flex-wrap gap-1.5">
              {workTypes!.map((wt) => (
                <button key={wt.id} type="button" onClick={() => setWorkTypeId(wt.id)}
                  className="text-[12px] font-semibold cursor-pointer"
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--tc-radius-full)",
                    border: `1px solid ${workTypeId === wt.id ? "var(--tc-primary)" : "var(--tc-border-strong)"}`,
                    background: workTypeId === wt.id ? "var(--tc-primary-bg)" : "var(--tc-surface-soft)",
                    color: workTypeId === wt.id ? "var(--tc-primary)" : "var(--tc-text-secondary)",
                  }}>
                  {wt.color && (
                    <span style={{
                      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                      background: wt.color, marginRight: 6,
                    }} />
                  )}
                  {wt.name}
                  {wt.base_hourly_wage != null && (
                    <span style={{ fontWeight: 400, marginLeft: 4, opacity: 0.7 }}>
                      {wt.base_hourly_wage.toLocaleString()}원
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-[11px] py-2" style={{ color: "var(--tc-text-muted)" }}>
              등록된 근무 유형이 없습니다. PC 어드민에서 먼저 시급 태그를 생성하세요.
            </div>
          )}
        </div>

        <Fld label="메모" value={memo} onChange={setMemo} placeholder="메모 (선택)" />

        <button onClick={() => mutation.mutate()} disabled={mutation.isPending || workTypeId == null}
          className="w-full text-sm font-bold cursor-pointer mt-1"
          style={{
            padding: "12px", borderRadius: "var(--tc-radius)", border: "none",
            background: workTypeId == null ? "var(--tc-surface-soft)" : "var(--tc-primary)",
            color: workTypeId == null ? "var(--tc-text-muted)" : "#fff",
          }}>
          {mutation.isPending ? "저장 중…" : isEdit ? "수정" : "등록"}
        </button>
      </div>
    </BottomSheet>
  );
}

function Fld({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="flex-1">
      <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full text-sm"
        style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
    </div>
  );
}
