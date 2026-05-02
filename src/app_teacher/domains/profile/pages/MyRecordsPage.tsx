/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any */
// PATH: src/app_teacher/domains/profile/pages/MyRecordsPage.tsx
// 내 근태 + 지출 관리 — 등록/편집/삭제
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { ChevronLeft, Plus, Pencil, Trash2 } from "@teacher/shared/ui/Icons";
import { Card, TabBar } from "@teacher/shared/ui/Card";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import api from "@/shared/api/axios";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";

type Tab = "attendance" | "expense";

/* ─── API ─── */
const today = new Date();
const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

async function fetchAttendance(month: string) {
  const res = await api.get("/core/profile/attendance/", { params: { month } });
  return Array.isArray(res.data) ? res.data : [];
}
async function createAttendance(payload: any) { return (await api.post("/core/profile/attendance/", payload)).data; }
async function updateAttendance(id: number, payload: any) { return (await api.patch(`/core/profile/attendance/${id}/`, payload)).data; }
async function deleteAttendance(id: number) { await api.delete(`/core/profile/attendance/${id}/`); }

async function fetchExpenses(month: string) {
  const res = await api.get("/core/profile/expenses/", { params: { month } });
  return Array.isArray(res.data) ? res.data : [];
}
async function createExpense(payload: any) { return (await api.post("/core/profile/expenses/", payload)).data; }
async function updateExpense(id: number, payload: any) { return (await api.patch(`/core/profile/expenses/${id}/`, payload)).data; }
async function deleteExpense(id: number) { await api.delete(`/core/profile/expenses/${id}/`); }

export default function MyRecordsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("attendance");
  const [month, setMonth] = useState(thisMonth);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);

  const { data: attendance } = useQuery({
    queryKey: ["my-attendance", month],
    queryFn: () => fetchAttendance(month),
    enabled: tab === "attendance",
  });
  const { data: expenses } = useQuery({
    queryKey: ["my-expenses", month],
    queryFn: () => fetchExpenses(month),
    enabled: tab === "expense",
  });

  const deleteAttMut = useMutation({
    mutationFn: deleteAttendance,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-attendance", month] }); teacherToast.info("근태 기록이 삭제되었습니다."); },
    onError: (e) => teacherToast.error(extractApiError(e, "근태 기록을 삭제하지 못했습니다.")),
  });
  const deleteExpMut = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-expenses", month] }); teacherToast.info("지출 기록이 삭제되었습니다."); },
    onError: (e) => teacherToast.error(extractApiError(e, "지출 기록을 삭제하지 못했습니다.")),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <button onClick={() => navigate(-1)} className="flex p-1 cursor-pointer"
          style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[17px] font-bold flex-1" style={{ color: "var(--tc-text)" }}>근태 / 지출</h1>
        <button onClick={() => { setEditTarget(null); setFormOpen(true); }}
          className="flex items-center gap-1 text-xs font-bold cursor-pointer"
          style={{ padding: "6px 12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
          <Plus size={14} /> 등록
        </button>
      </div>

      {/* Month selector */}
      <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
        className="text-sm self-center"
        style={{ padding: "6px 12px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border)", background: "var(--tc-surface)", color: "var(--tc-text)" }} />

      <TabBar tabs={[{ key: "attendance" as Tab, label: "근태" }, { key: "expense" as Tab, label: "지출" }]} value={tab} onChange={setTab} />

      {tab === "attendance" ? (
        attendance?.length ? (
          <div className="flex flex-col gap-1.5">
            {attendance.map((a: any) => (
              <Card key={a.id} style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--tc-text)" }}>{a.date} · {a.work_type}</div>
                    <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>{a.start_time?.slice(0,5)} ~ {a.end_time?.slice(0,5)} ({a.duration_hours}h) {a.memo ? `· ${a.memo}` : ""}</div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditTarget(a); setFormOpen(true); }} className="flex p-1 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-text-muted)" }}><Pencil size={13} /></button>
                    <button onClick={() => { if (confirm("삭제하시겠습니까?")) deleteAttMut.mutate(a.id); }} className="flex p-1 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-danger)" }}><Trash2 size={13} /></button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : <EmptyState scope="panel" tone="empty" title="근태 기록이 없습니다" />
      ) : (
        expenses?.length ? (
          <div className="flex flex-col gap-1.5">
            {expenses.map((e: any) => (
              <Card key={e.id} style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--tc-text)" }}>{e.date} · {e.title}</div>
                    <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>{e.amount?.toLocaleString()}원 {e.memo ? `· ${e.memo}` : ""}</div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditTarget(e); setFormOpen(true); }} className="flex p-1 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-text-muted)" }}><Pencil size={13} /></button>
                    <button onClick={() => { if (confirm("삭제하시겠습니까?")) deleteExpMut.mutate(e.id); }} className="flex p-1 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-danger)" }}><Trash2 size={13} /></button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : <EmptyState scope="panel" tone="empty" title="지출 기록이 없습니다" />
      )}

      {/* Form sheet */}
      <RecordFormSheet open={formOpen} onClose={() => { setFormOpen(false); setEditTarget(null); }}
        tab={tab} month={month} editData={editTarget} />
    </div>
  );
}

function RecordFormSheet({ open, onClose, tab, month, editData }: {
  open: boolean; onClose: () => void; tab: Tab; month: string; editData?: any;
}) {
  const qc = useQueryClient();
  const isEdit = !!editData;
  const [date, setDate] = useState(editData?.date || new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(editData?.start_time?.slice(0, 5) || "09:00");
  const [endTime, setEndTime] = useState(editData?.end_time?.slice(0, 5) || "18:00");
  const [workType, setWorkType] = useState(editData?.work_type || "수업");
  const [title, setTitle] = useState(editData?.title || "");
  const [amount, setAmount] = useState(String(editData?.amount || ""));
  const [memo, setMemo] = useState(editData?.memo || "");

  const mutation = useMutation({
    mutationFn: () => {
      if (tab === "attendance") {
        const payload = { date, start_time: startTime, end_time: endTime, work_type: workType, memo: memo || undefined };
        return isEdit ? updateAttendance(editData.id, payload) : createAttendance(payload);
      } else {
        const payload = { date, title, amount: Number(amount), memo: memo || undefined };
        return isEdit ? updateExpense(editData.id, payload) : createExpense(payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tab === "attendance" ? ["my-attendance", month] : ["my-expenses", month] });
      teacherToast.success(`${label} 기록이 ${isEdit ? "수정" : "등록"}되었습니다.`);
      onClose();
    },
    onError: (e) => teacherToast.error(extractApiError(e, `${label} ${isEdit ? "수정" : "등록"}에 실패했습니다.`)),
  });

  const label = tab === "attendance" ? "근태" : "지출";

  return (
    <BottomSheet open={open} onClose={onClose} title={`${label} ${isEdit ? "편집" : "등록"}`}>
      <div className="flex flex-col gap-2.5" style={{ padding: "var(--tc-space-3) 0" }}>
        <Fld label="날짜" value={date} onChange={setDate} type="date" />
        {tab === "attendance" ? (
          <>
            <div className="flex gap-2">
              <Fld label="시작" value={startTime} onChange={setStartTime} type="time" />
              <Fld label="종료" value={endTime} onChange={setEndTime} type="time" />
            </div>
            <Fld label="근무 유형" value={workType} onChange={setWorkType} placeholder="수업, 행정, 상담 등" />
          </>
        ) : (
          <>
            <Fld label="항목" value={title} onChange={setTitle} placeholder="지출 항목" />
            <Fld label="금액 (원)" value={amount} onChange={setAmount} type="number" placeholder="0" />
          </>
        )}
        <Fld label="메모" value={memo} onChange={setMemo} placeholder="메모 (선택)" />

        <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
          className="w-full text-sm font-bold cursor-pointer mt-1"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
          {mutation.isPending ? "저장 중..." : isEdit ? "수정" : "등록"}
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
