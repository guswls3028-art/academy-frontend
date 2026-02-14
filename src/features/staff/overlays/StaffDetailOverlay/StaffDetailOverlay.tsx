// PATH: src/features/staff/overlays/StaffDetailOverlay/StaffDetailOverlay.tsx
// SSOT: 오버레이 탭 → 플랫탭 (ds-tabs--flat + ds-tab)
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import {
  fetchStaffDetail,
  fetchStaffSummaryByRange,
} from "../../api/staff.detail.api";
import {
  fetchWorkMonthLocks,
  isLockedFromLocks,
} from "../../api/workMonthLocks.api";
import { fetchStaffMe } from "../../api/staffMe.api";

import ActionButton from "../../components/ActionButton";
import { LockBadge, RoleBadge } from "../../components/StatusBadge";

import StaffSummaryTab from "./StaffSummaryTab";
import StaffWorkTypeTab from "./StaffWorkTypeTab";
import StaffWorkRecordsTab from "./StaffWorkRecordsTab";
import StaffExpensesTab from "./StaffExpensesTab";
import StaffPayrollHistoryTab from "./StaffPayrollHistoryTab";
import StaffReportTab from "./StaffReportTab";
import StaffSettingsTab from "./StaffSettingsTab";

function getThisMonthRange() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(
    2,
    "0"
  )}`;
  return { y, m, from, to };
}

export default function StaffDetailOverlay() {
  const { staffId } = useParams();
  const navigate = useNavigate();
  const sid = Number(staffId);
  const [tab, setTab] = useState("summary");

  const { y, m, from, to } = getThisMonthRange();

  const staffQ = useQuery({
    queryKey: ["staff", sid],
    queryFn: () => fetchStaffDetail(sid),
    enabled: !!sid,
  });

  const meQ = useQuery({
    queryKey: ["staff-me"],
    queryFn: fetchStaffMe,
  });

  const summaryQ = useQuery({
    queryKey: ["staff-summary", sid, from, to],
    queryFn: () => fetchStaffSummaryByRange(sid, from, to),
    enabled: !!sid,
  });

  const locksQ = useQuery({
    queryKey: ["work-month-locks", sid, y, m],
    queryFn: () => fetchWorkMonthLocks({ staff: sid, year: y, month: m }),
    enabled: !!sid,
  });

  if (!sid || !staffQ.data) return null;

  const staff = staffQ.data;
  const summary = summaryQ.data;
  const locked = isLockedFromLocks(locksQ.data);
  const canManage = !!meQ.data?.is_payroll_manager;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={() => navigate(-1)}
      />

      {/* Overlay */}
      <div className="fixed inset-0 z-50 flex justify-center items-start p-6">
        <div className="w-full max-w-[1200px] max-h-[90vh] overflow-auto rounded-xl bg-[var(--bg-surface)] shadow-xl">
          {/* Top Banner (월 마감 UX 임팩트) */}
          {locked && (
            <div className="px-6 py-3 border-b border-[color-mix(in_srgb,var(--color-danger)_55%,transparent)] bg-[var(--color-danger-soft)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <LockBadge state="LOCKED" />
                  <div className="text-sm font-semibold text-[var(--color-danger)]">
                    이번달은 마감되었습니다. (급여 확정)
                  </div>
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  마감된 월은 근무/비용 생성·수정·삭제가 불가능합니다.
                </div>
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex justify-end gap-2 px-6 py-3 border-b border-[var(--border-divider)]">
            {canManage && (
              <ActionButton variant="secondary" size="sm">
                수정
              </ActionButton>
            )}

            {canManage && (
              <ActionButton
                variant="danger-outline"
                size="sm"
                title="삭제는 되돌릴 수 없습니다."
                onClick={() => {
                  if (!confirm("직원을 삭제할까요? 연결된 데이터도 함께 삭제됩니다.")) return;
                  alert("삭제 API 연결 필요 (StaffSettingsTab의 삭제 로직을 재사용하세요).");
                }}
              >
                삭제
              </ActionButton>
            )}

            <ActionButton variant="outline" size="sm" onClick={() => navigate(-1)}>
              닫기
            </ActionButton>
          </div>

          {/* Body */}
          <div className="flex gap-5 p-6">
            {/* LEFT */}
            <div className="w-[280px] shrink-0 space-y-4">
              <div className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold flex items-center gap-2">
                    {staff.name}
                    {staff.user_is_staff && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-primary-soft)] text-[var(--color-primary)] border border-[color-mix(in_srgb,var(--color-primary)_45%,transparent)]">
                        STAFF
                      </span>
                    )}
                  </div>
                  <span
                    className={[
                      "px-2 py-0.5 rounded-full text-xs font-semibold border",
                      staff.is_active
                        ? "bg-[var(--color-success-soft)] text-[var(--color-success)] border-[color-mix(in_srgb,var(--color-success)_45%,transparent)]"
                        : "bg-[var(--bg-surface-muted)] text-[var(--text-disabled)] border-[var(--border-divider)]",
                    ].join(" ")}
                  >
                    {staff.is_active ? "활성" : "비활성"}
                  </span>
                </div>

                <Divider />

                <Info label="계정" value={staff.user_username || "계정 없음"} />
                <Info label="전화번호" value={staff.phone || "-"} />
                <Info
                  label="급여유형"
                  value={staff.pay_type === "HOURLY" ? "시급" : "월급"}
                />

                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-muted)]">역할</span>
                  <RoleBadge isManager={!!staff.is_manager} />
                </div>
              </div>

              <div className="rounded-lg border border-[var(--border-divider)] p-4 space-y-2 bg-[var(--bg-surface)]">
                <div className="text-sm font-semibold">이번달 요약</div>
                <Info label="근무시간" value={`${summary?.work_hours ?? 0} h`} />
                <Info
                  label="지급액"
                  value={`${(summary?.total_amount ?? 0).toLocaleString()} 원`}
                />

                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-muted)]">마감상태</span>
                  <div className="flex items-center gap-2">
                    <LockBadge state={locked ? "LOCKED" : "OPEN"} compact />
                    <span
                      className={[
                        "font-semibold",
                        locked
                          ? "text-[var(--color-danger)]"
                          : "text-[var(--color-success)]",
                      ].join(" ")}
                    >
                      {locked ? "급여 확정" : "진행중"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT — 플랫탭 + 패널 */}
            <div className="flex-1 flex flex-col min-h-0">
              {(() => {
                const items = [
                  { key: "summary", label: "요약", children: <StaffSummaryTab staffId={sid} /> },
                  { key: "worktype", label: "시급·근무유형", children: <StaffWorkTypeTab staffId={sid} /> },
                  { key: "records", label: "근무기록", children: <StaffWorkRecordsTab staffId={sid} /> },
                  { key: "expenses", label: "비용", children: <StaffExpensesTab staffId={sid} /> },
                  { key: "history", label: "급여 히스토리", children: <StaffPayrollHistoryTab /> },
                  { key: "report", label: "리포트", children: <StaffReportTab /> },
                  ...(canManage ? [{ key: "settings", label: "설정", children: <StaffSettingsTab /> }] : []),
                ];
                return (
                  <>
                    <div className="ds-tabs ds-tabs--flat border-b border-[var(--color-border-divider)] mb-3" role="tablist">
                      {items.map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          role="tab"
                          aria-selected={tab === t.key}
                          onClick={() => setTab(t.key)}
                          className={`ds-tab ${tab === t.key ? "is-active" : ""}`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex-1 min-h-0 overflow-auto">
                      {items.find((i) => i.key === tab)?.children}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Info({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: any;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className={`font-semibold ${valueClass ?? ""}`}>{value || "-"}</span>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-[var(--border-divider)]" />;
}
