// PATH: src/features/staff/overlays/StaffDetailOverlay/StaffDetailOverlay.tsx
// Design SSOT: 학생 상세 오버레이와 동일한 ds-overlay-* 구조 (overlay.css)

import { useParams, useNavigate, Navigate } from "react-router-dom";
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
import { useDeleteStaff } from "../../hooks/useDeleteStaff";

import { LockBadge } from "../../components/StatusBadge";
import { StaffRoleAvatar } from "@/shared/ui/avatars";
import { Button, CloseButton } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { formatPhone } from "@/shared/utils/formatPhone";
import { useConfirm } from "@/shared/ui/confirm";

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
  const qc = useQueryClient();
  const sid = Number(staffId);
  const [tab, setTab] = useState("summary");
  const [editOpen, setEditOpen] = useState(false);
  const confirm = useConfirm();
  const deleteMutation = useDeleteStaff();
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

  // 권한 확인 완료 전 렌더 차단 — 비관리자에게 급여 데이터 노출 방지
  if (!meQ.data) return null;
  if (!meQ.data.is_payroll_manager) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const staff = staffQ.data;
  const summary = summaryQ.data;
  const locked = isLockedFromLocks(locksQ.data);
  const canManage = true; // meQ guard 통과 = payroll manager 확정

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
                    <Button
                      type="button"
                      intent="primary"
                      size="sm"
                      onClick={() => setEditOpen(true)}
                    >
                      수정
                    </Button>
                  )}
                  {canManage && (
                    <Button
                      type="button"
                      intent="danger"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      onClick={async () => {
                        const ok = await confirm({
                          title: "직원 삭제",
                          message: `${staff.name}을(를) 삭제하시겠습니까?\n연결된 근무기록, 비용 등 모든 데이터가 함께 삭제됩니다.`,
                          confirmText: "삭제",
                          danger: true,
                        });
                        if (!ok) return;
                        deleteMutation.mutate(sid);
                      }}
                    >
                      {deleteMutation.isPending ? "삭제 중…" : "삭제"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </header>

          <div className="ds-overlay-body">
            <div className="ds-overlay-body__grid">
              {/* 좌측 — 정보·이번달 요약 (섹션별 그룹화) */}
              <div className="ds-overlay-sidebar">
                {/* 기본 정보 섹션 */}
                <div className="ds-overlay-section">
                  <div className="ds-overlay-section__title">
                    <span className="ds-overlay-section__title-icon">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </span>
                    기본 정보
                  </div>
                  <div className="ds-overlay-info-rows">
                    <InfoRow label="계정" value={staff.user_username || "계정 없음"} />
                    <InfoRow label="전화번호" value={formatPhone(staff.phone)} />
                    <InfoRow label="급여유형" value={staff.pay_type === "HOURLY" ? "시급" : "월급"} />
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
                    <div className="ds-overlay-info-row">
                      <span className="ds-overlay-info-row__label">관리자</span>
                      <span className="ds-overlay-info-row__value">
                        {canManage ? (
                          <StaffManagerToggle staffId={staff.id} isManager={!!staff.is_manager} />
                        ) : (
                          <span className="ds-status-badge" data-status={staff.is_manager ? "active" : "inactive"}>
                            {staff.is_manager ? "ON" : "OFF"}
                          </span>
                        )}
                      </span>
                    </div>
                    <InfoRow label="등록일" value={(staff as any).created_at?.slice(0, 10)} />
                  </div>
                </div>

                {/* 이번달 요약 섹션 */}
                <div className="ds-overlay-section">
                  <div className="ds-overlay-section__title">
                    <span className="ds-overlay-section__title-icon">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </span>
                    이번달 요약
                  </div>
                  <div className="ds-overlay-stat-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    <div className="ds-overlay-stat-card">
                      <div className="ds-overlay-stat-card__label">근무시간</div>
                      <div className="ds-overlay-stat-card__value ds-overlay-stat-card__value--brand">
                        {summary?.work_hours ?? 0}<span style={{ fontSize: 12, fontWeight: 600, marginLeft: 2 }}>h</span>
                      </div>
                    </div>
                    <div className="ds-overlay-stat-card">
                      <div className="ds-overlay-stat-card__label">지급액</div>
                      <div className="ds-overlay-stat-card__value">
                        {(summary?.total_amount ?? 0).toLocaleString()}<span style={{ fontSize: 11, fontWeight: 600, marginLeft: 2 }}>원</span>
                      </div>
                    </div>
                  </div>
                  <div className="ds-overlay-info-rows" style={{ marginTop: 4 }}>
                    <div className="ds-overlay-info-row">
                      <span className="ds-overlay-info-row__label">마감상태</span>
                      <span className="ds-overlay-info-row__value">
                        <div className="flex items-center gap-2">
                          <LockBadge state={locked ? "LOCKED" : "OPEN"} compact />
                          <span
                            className="font-semibold"
                            style={{ color: locked ? "var(--color-danger)" : "var(--color-success)" }}
                          >
                            {locked ? "급여 확정" : "진행중"}
                          </span>
                        </div>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 우측 — 탭 + 콘텐츠 (학생 상세와 동일 플랫탭) */}
              <div className="ds-overlay-content-panel">
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

      {editOpen &&
        createPortal(
          <StaffEditModal
            open={true}
            staff={staff}
            onClose={() => setEditOpen(false)}
            onSuccess={() => {
              setEditOpen(false);
              qc.invalidateQueries({ queryKey: ["staff", sid] });
              qc.invalidateQueries({ queryKey: ["staffs"] });
            }}
          />,
          document.body
        )}
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
    <div className="ds-overlay-info-row">
      <span className="ds-overlay-info-row__label">{label}</span>
      <span className={`ds-overlay-info-row__value${accent ? " ds-overlay-info-row__value--accent" : ""}`}>
        {value ?? "-"}
      </span>
    </div>
  );
}
