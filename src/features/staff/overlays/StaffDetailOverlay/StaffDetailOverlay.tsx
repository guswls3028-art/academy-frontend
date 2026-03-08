// PATH: src/features/staff/overlays/StaffDetailOverlay/StaffDetailOverlay.tsx
// Design SSOT: 학생 상세 오버레이와 동일한 ds-overlay-* 구조 (overlay.css)

import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createPortal } from "react-dom";

import {
  fetchStaffDetail,
  fetchStaffSummaryByRange,
  patchStaffDetail,
} from "../../api/staff.detail.api";
import {
  fetchWorkMonthLocks,
  isLockedFromLocks,
} from "../../api/workMonthLocks.api";
import { fetchStaffMe } from "../../api/staffMe.api";

import { LockBadge } from "../../components/StatusBadge";
import { StaffRoleAvatar } from "@/shared/ui/avatars";
import { Button, CloseButton } from "@/shared/ui/ds";

import StaffSummaryTab from "./StaffSummaryTab";
import StaffWorkTypeTab from "./StaffWorkTypeTab";
import StaffWorkRecordsTab from "./StaffWorkRecordsTab";
import StaffExpensesTab from "./StaffExpensesTab";
import StaffPayrollHistoryTab from "./StaffPayrollHistoryTab";
import StaffReportTab from "./StaffReportTab";
import StaffSettingsTab from "./StaffSettingsTab";
import StaffEditModal from "../../components/StaffEditModal";

function StaffManagerToggle({
  staffId,
  isManager,
}: {
  staffId: number;
  isManager: boolean;
}) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (payload: { is_manager: boolean }) =>
      patchStaffDetail(staffId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staffs"] });
      qc.invalidateQueries({ queryKey: ["staff", staffId] });
    },
  });
  return (
    <button
      type="button"
      className="ds-status-badge cursor-pointer"
      data-status={isManager ? "active" : "inactive"}
      disabled={mutation.isPending}
      onClick={() => mutation.mutate({ is_manager: !isManager })}
      aria-label={isManager ? "관리자 해제" : "관리자 부여"}
    >
      {mutation.isPending ? "…" : isManager ? "ON" : "OFF"}
    </button>
  );
}

function getThisMonthRange() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { y, m, from, to };
}

/** 직원 상세용 아바타 역할 — API role OWNER → owner, 나머지 그대로 */
function staffAvatarRole(
  role: string
): "owner" | "TEACHER" | "ASSISTANT" {
  if (role === "OWNER") return "owner";
  if (role === "TEACHER" || role === "ASSISTANT") return role;
  return "ASSISTANT";
}

export default function StaffDetailOverlay() {
  const { staffId } = useParams();
  const navigate = useNavigate();
  const sid = Number(staffId);
  const [tab, setTab] = useState("summary");
  const [editOpen, setEditOpen] = useState(false);
  const onClose = () => navigate(-1);

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

  const tabItems = [
    { key: "summary", label: "요약", children: <StaffSummaryTab staffId={sid} /> },
    { key: "worktype", label: "시급·근무유형", children: <StaffWorkTypeTab staffId={sid} /> },
    { key: "records", label: "근무기록", children: <StaffWorkRecordsTab staffId={sid} /> },
    { key: "expenses", label: "비용", children: <StaffExpensesTab staffId={sid} /> },
    { key: "history", label: "급여 히스토리", children: <StaffPayrollHistoryTab /> },
    { key: "report", label: "리포트", children: <StaffReportTab /> },
    ...(canManage ? [{ key: "settings" as const, label: "설정", children: <StaffSettingsTab /> }] : []),
  ];

  return (
    <>
      <div className="ds-overlay-backdrop" onClick={onClose} aria-hidden />

      <div className="ds-overlay-wrap">
        <div
          className="ds-overlay-panel ds-overlay-panel--staff-detail"
          onClick={(e) => e.stopPropagation()}
        >
          <CloseButton className="ds-overlay-panel__close" onClick={onClose} />

          {/* 월 마감 배너 — 학생 오버레이에는 없음, 직원 전용 */}
          {locked && (
            <div
              className="px-6 py-3 border-b"
              style={{
                borderColor: "color-mix(in srgb, var(--color-danger) 55%, transparent)",
                background: "var(--color-danger-soft)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <LockBadge state="LOCKED" />
                  <span className="text-sm font-semibold text-[var(--color-danger)]">
                    이번달은 마감되었습니다. (급여 확정)
                  </span>
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">
                  마감된 월은 근무/비용 생성·수정·삭제가 불가능합니다.
                </span>
              </div>
            </div>
          )}

          <header className="ds-overlay-header">
            <div className="ds-overlay-header__inner">
              <div className="ds-overlay-header__left">
                <div className="ds-overlay-header__avatar-wrap" aria-hidden>
                  <span className="ds-overlay-header__avatar ds-overlay-header__avatar--icon">
                    <StaffRoleAvatar
                      role={staffAvatarRole((staff as { role?: string }).role ?? "ASSISTANT")}
                      size={40}
                      className="text-[var(--color-brand-primary)]"
                    />
                  </span>
                </div>
                <div className="ds-overlay-header__title-block">
                  <h1 className="ds-overlay-header__title">{staff.name}</h1>
                  <div className="ds-overlay-header__pills">
                    {staff.user_is_staff && (
                      <span
                        className="ds-badge ds-overlay-header__badge-id"
                        title="직원 계정"
                      >
                        STAFF
                      </span>
                    )}
                    <span
                      className="ds-badge ds-overlay-header__badge-code"
                      title="계정"
                    >
                      {staff.user_username ?? "계정 없음"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="ds-overlay-header__right">
                <div className="ds-overlay-header__actions">
                  <button
                    type="button"
                    className="ds-status-badge"
                    data-status={staff.is_active ? "active" : "inactive"}
                    disabled
                    aria-label="활성 상태"
                  >
                    {staff.is_active ? "활성" : "비활성"}
                  </button>
                  {canManage && (
                    <Button type="button" intent="primary" size="sm">
                      수정
                    </Button>
                  )}
                  {canManage && (
                    <Button
                      type="button"
                      intent="danger"
                      size="sm"
                      onClick={() => {
                        if (
                          !confirm(
                            "직원을 삭제할까요? 연결된 데이터도 함께 삭제됩니다."
                          )
                        )
                          return;
                        alert(
                          "삭제 API 연결 필요 (StaffSettingsTab의 삭제 로직을 재사용하세요)."
                        );
                      }}
                    >
                      삭제
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </header>

          <div className="ds-overlay-body">
            <div className="ds-overlay-body__grid">
              {/* 좌측 — 정보·이번달 요약 (학생 상세와 동일 카드 톤) */}
              <div
                style={{
                  borderRadius: 12,
                  padding: 16,
                  background: "var(--bg-surface-soft)",
                  border: "1px solid var(--color-border-divider)",
                }}
              >
                <div className="ds-overlay-info-rows">
                  <InfoRow label="계정" value={staff.user_username || "계정 없음"} />
                  <InfoRow label="전화번호" value={staff.phone} />
                  <InfoRow
                    label="급여유형"
                    value={staff.pay_type === "HOURLY" ? "시급" : "월급"}
                  />
                  <InfoRow
                    label="역할"
                    value={
                      (staff as { role?: string }).role === "OWNER"
                        ? "대표"
                        : (staff as { role?: string }).role === "TEACHER"
                          ? "강사"
                          : "조교"
                    }
                  />
                  <div
                    className="ds-overlay-info-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      alignItems: "center",
                      padding: "6px 10px",
                      borderRadius: 8,
                      background: "var(--color-bg-surface)",
                      border: "1px solid var(--color-border-divider)",
                      fontSize: 13,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        color: "var(--color-text-muted)",
                        fontSize: 12,
                      }}
                    >
                      관리자
                    </span>
                    {canManage ? (
                      <StaffManagerToggle
                        staffId={staff.id}
                        isManager={!!staff.is_manager}
                      />
                    ) : (
                      <span
                        className="ds-status-badge"
                        data-status={staff.is_manager ? "active" : "inactive"}
                      >
                        {staff.is_manager ? "ON" : "OFF"}
                      </span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 20,
                    padding: 14,
                    borderRadius: 12,
                    background: "var(--color-bg-surface)",
                    border: "1px solid var(--color-border-divider)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      marginBottom: 10,
                      color: "var(--color-text-muted)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    이번달 요약
                  </div>
                  <InfoRow
                    label="근무시간"
                    value={`${summary?.work_hours ?? 0} h`}
                  />
                  <InfoRow
                    label="지급액"
                    value={`${(summary?.total_amount ?? 0).toLocaleString()} 원`}
                  />
                  <div
                    className="ds-overlay-info-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      alignItems: "center",
                      padding: "6px 10px",
                      borderRadius: 8,
                      background: "var(--color-bg-surface)",
                      border: "1px solid var(--color-border-divider)",
                      fontSize: 13,
                      marginTop: 6,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        color: "var(--color-text-muted)",
                        fontSize: 12,
                      }}
                    >
                      마감상태
                    </span>
                    <div className="flex items-center gap-2">
                      <LockBadge state={locked ? "LOCKED" : "OPEN"} compact />
                      <span
                        className="font-semibold"
                        style={{
                          color: locked
                            ? "var(--color-danger)"
                            : "var(--color-success)",
                        }}
                      >
                        {locked ? "급여 확정" : "진행중"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 우측 — 탭 + 콘텐츠 (학생 상세와 동일 플랫탭) */}
              <div
                style={{
                  borderRadius: 12,
                  padding: 16,
                  background:
                    "color-mix(in srgb, var(--color-brand-primary) 4%, var(--bg-surface-soft))",
                  border: "1px solid var(--color-border-divider)",
                }}
              >
                <div className="ds-overlay-tabs">
                  <div className="ds-tabs ds-tabs--flat" role="tablist">
                    {tabItems.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.key}
                        className={`ds-tab ${tab === t.key ? "is-active" : ""}`}
                        onClick={() => setTab(t.key)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ minHeight: 260, marginTop: 16 }}>
                  {tabItems.find((i) => i.key === tab)?.children}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function InfoRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className="ds-overlay-info-row"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 8,
        background: accent
          ? "color-mix(in srgb, var(--color-brand-primary) 10%, var(--color-bg-surface))"
          : "var(--color-bg-surface)",
        border: "1px solid var(--color-border-divider)",
        fontSize: 13,
      }}
    >
      <span
        style={{
          fontWeight: 600,
          color: "var(--color-text-muted)",
          fontSize: 12,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontWeight: 700,
          color: "var(--color-text-primary)",
          textAlign: "right",
        }}
      >
        {value ?? "-"}
      </span>
    </div>
  );
}
