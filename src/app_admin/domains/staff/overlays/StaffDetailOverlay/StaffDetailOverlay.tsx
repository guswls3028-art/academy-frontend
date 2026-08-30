// PATH: src/app_admin/domains/staff/overlays/StaffDetailOverlay/StaffDetailOverlay.tsx
// Design SSOT: 학생 상세 오버레이와 동일한 ds-overlay-* 구조 (overlay.css)

import { useParams, useNavigate, useLocation, Navigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useState,
  useEffect,
  useCallback,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
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
import { fetchStaffMe } from "@/shared/staff/api";
import { useDeleteStaff } from "../../hooks/useDeleteStaff";
import { staffQueryKeys } from "../../queryKeys";

import { LockBadge } from "../../components/StatusBadge";
import { StaffRoleAvatar } from "@/shared/ui/avatars";
import { Badge, Button, CloseButton, EmptyState } from "@/shared/ui/ds";
import { formatPhone } from "@/shared/utils/formatPhone";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";

import StaffSummaryTab from "./StaffSummaryTab";
import StaffWorkTypeTab from "./StaffWorkTypeTab";
import StaffWorkRecordsTab from "./StaffWorkRecordsTab";
import StaffExpensesTab from "./StaffExpensesTab";
import StaffPayrollHistoryTab from "./StaffPayrollHistoryTab";
import StaffReportTab from "./StaffReportTab";
import StaffEditModal from "../../components/StaffEditModal";
import StaffPasswordModal from "../../components/StaffPasswordModal";
import {
  canEditStaffAccountRole,
  staffAccountRoleLabel,
  staffPositionLabel,
} from "../../utils/staffIdentity";
import styles from "./StaffDetailOverlay.module.css";

type StaffTabKey = "summary" | "worktype" | "records" | "expenses" | "history" | "report";

function StaffManagerToggle({
  staffId,
  isManager,
}: {
  staffId: number;
  isManager: boolean;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const mutation = useMutation({
    mutationFn: (payload: { is_manager: boolean }) =>
      patchStaffDetail(staffId, payload),
    onSuccess: () => {
      feedback.success(isManager ? "직원관리 권한을 회수했습니다." : "직원관리 권한을 부여했습니다.");
      qc.invalidateQueries({ queryKey: staffQueryKeys.staffs });
      qc.invalidateQueries({ queryKey: staffQueryKeys.staffDetail(staffId) });
    },
    onError: (error: unknown) => {
      feedback.error(extractApiError(error, "직원관리 권한 변경에 실패했습니다."));
    },
  });
  return (
    <button
      type="button"
      className={styles.managerToggle}
      data-active={isManager ? "true" : "false"}
      disabled={mutation.isPending}
      onClick={async () => {
        const nextManager = !isManager;
        const ok = await confirm({
          title: nextManager ? "직원관리 권한 부여" : "직원관리 권한 회수",
          message: nextManager
            ? "직원·시급·비용·급여 정보를 조회하고 관리할 수 있게 됩니다. 권한을 부여하시겠습니까?"
            : "직원·급여 관리 접근 권한을 해제하시겠습니까?",
          confirmText: nextManager ? "권한 부여" : "권한 해제",
          danger: nextManager,
        });
        if (ok) mutation.mutate({ is_manager: nextManager });
      }}
      aria-label={isManager ? "직원관리 권한 있음, 권한 회수" : "직원관리 권한 없음, 권한 부여"}
      title={isManager ? "눌러서 직원관리 권한 회수" : "눌러서 직원관리 권한 부여"}
    >
      <span className={styles.managerDot} aria-hidden />
      {mutation.isPending ? "변경 중" : isManager ? "권한 있음" : "권한 없음"}
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

type StaffDetailOverlayProps = {
  /** 목록 라우트 위에 띄울 때 전달. 없으면 URL의 staffId를 사용한다. */
  staffId?: number;
  onClose?: () => void;
};

export default function StaffDetailOverlay({
  staffId,
  onClose: closeOverride,
}: StaffDetailOverlayProps = {}) {
  const routeParams = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const sid = staffId ?? Number(routeParams.staffId);
  const [tab, setTab] = useState<StaffTabKey>("summary");
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const tabPanelId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // staffId 변경 시 탭을 기본값으로 리셋
  useEffect(() => { setTab("summary"); }, [sid]);
  const confirm = useConfirm();
  const deleteMutation = useDeleteStaff();
  const onClose = useCallback(() => {
    if (closeOverride) {
      closeOverride();
      return;
    }
    if (location.key === "default") {
      navigate("/workspace/staff/home", { replace: true });
      return;
    }
    navigate(-1);
  }, [closeOverride, location.key, navigate]);

  const { y, m, from, to } = getThisMonthRange();

  const staffQ = useQuery({
    queryKey: staffQueryKeys.staffDetail(sid),
    queryFn: () => fetchStaffDetail(sid),
    enabled: !!sid,
  });

  const meQ = useQuery({
    queryKey: staffQueryKeys.me,
    queryFn: fetchStaffMe,
  });

  const summaryQ = useQuery({
    queryKey: staffQueryKeys.summaryRange(sid, from, to),
    queryFn: () => fetchStaffSummaryByRange(sid, from, to),
    enabled: !!sid,
  });

  const locksQ = useQuery({
    queryKey: staffQueryKeys.workMonthLocksForMonth(sid, y, m),
    queryFn: () => fetchWorkMonthLocks({ staff: sid, year: y, month: m }),
    enabled: !!sid,
  });

  const offboardMutation = useMutation({
    mutationFn: () => patchStaffDetail(sid, { is_active: false }),
    onSuccess: () => {
      feedback.success("퇴사 처리했습니다. 기존 근무·비용·급여 이력은 보존됩니다.");
      qc.invalidateQueries({ queryKey: staffQueryKeys.staffs });
      qc.invalidateQueries({ queryKey: staffQueryKeys.staffDetail(sid) });
    },
    onError: (error: unknown) => {
      feedback.error(extractApiError(error, "퇴사 처리에 실패했습니다."));
    },
  });

  if (!sid) return null;
  if (staffQ.isError || meQ.isError) {
    return (
      <StaffDetailShell onClose={onClose}>
        <div className="ds-overlay-body">
          <EmptyState
            scope="panel"
            tone="error"
            title="직원 정보를 불러올 수 없습니다"
            actions={
              <Button
                intent="secondary"
                size="sm"
                onClick={() => {
                  staffQ.refetch();
                  meQ.refetch();
                }}
              >
                다시 시도
              </Button>
            }
          />
        </div>
      </StaffDetailShell>
    );
  }
  if (staffQ.isLoading || meQ.isLoading || !staffQ.data || !meQ.data) {
    return (
      <StaffDetailShell onClose={onClose}>
        <div className="ds-overlay-body">
          <EmptyState scope="panel" tone="loading" title="직원 정보를 불러오는 중…" />
        </div>
      </StaffDetailShell>
    );
  }

  // 권한 확인 완료 전 렌더 차단 — 비관리자에게 급여 데이터 노출 방지
  if (!meQ.data.is_payroll_manager) {
    return <Navigate to="/workspace/dashboard" replace />;
  }

  const staff = staffQ.data;
  const summary = summaryQ.data;
  const locked = isLockedFromLocks(locksQ.data);
  const lockFailed = locksQ.isError;
  const canManage = true; // meQ guard 통과 = payroll manager 확정

  const tabItems: Array<{ key: StaffTabKey; label: string; children: ReactNode }> = [
    { key: "summary", label: "요약", children: <StaffSummaryTab staffId={sid} /> },
    { key: "worktype", label: "시급·근무유형", children: <StaffWorkTypeTab staffId={sid} /> },
    { key: "records", label: "근무기록", children: <StaffWorkRecordsTab staffId={sid} /> },
    { key: "expenses", label: "비용", children: <StaffExpensesTab staffId={sid} /> },
    { key: "history", label: "급여 히스토리", children: <StaffPayrollHistoryTab /> },
    { key: "report", label: "리포트", children: <StaffReportTab /> },
  ];

  function handleTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabItems.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabItems.length) % tabItems.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabItems.length - 1;
    if (nextIndex == null) return;

    event.preventDefault();
    setTab(tabItems[nextIndex].key);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <>
      <StaffDetailShell onClose={onClose}>
          {/* 월 마감 배너 — 학생 오버레이에는 없음, 직원 전용 */}
          {locked && (
            <div
              className="ds-overlay-lock-banner px-6 py-3 border-b"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <LockBadge state="LOCKED" />
                  <span className="text-sm font-semibold text-[var(--color-danger)]">
                    이번달 근태·환급 정산이 고정되었습니다.
                  </span>
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">
                  마감된 월은 근무/비용 생성·수정·삭제가 불가능합니다.
                </span>
              </div>
            </div>
          )}

          <header className={`ds-overlay-header ${styles.detailHeader}`}>
            <div className="ds-overlay-header__inner">
              <div className="ds-overlay-header__left">
                <div className="ds-overlay-header__avatar-wrap" aria-hidden>
                  <span className={`ds-overlay-header__avatar ds-overlay-header__avatar--icon ${styles.identityAvatar}`}>
                    <StaffRoleAvatar
                      role={staffAvatarRole(staff.role)}
                      size={40}
                      className="text-[var(--color-brand-primary)]"
                    />
                  </span>
                </div>
                <div className={`ds-overlay-header__title-block ${styles.headerTitleBlock}`}>
                  <h1 id="staff-detail-title" className="ds-overlay-header__title">{staff.name}</h1>
                  <dl className={styles.identityMeta}>
                    <div className={styles.identityMetaItem}>
                      <dt>직위</dt>
                      <dd>{staffPositionLabel(staff.position, staff.role)}</dd>
                    </div>
                    <div className={styles.identityMetaItem}>
                      <dt>계정</dt>
                      <dd>{staffAccountRoleLabel(staff.account_role, staff.role)}</dd>
                    </div>
                    <div className={styles.identityMetaItem}>
                      <dt>로그인</dt>
                      <dd>{staff.user_username || "없음"}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              <div className="ds-overlay-header__right">
                <div className={`ds-overlay-header__actions ${styles.headerActions}`}>
                  <div className={styles.employmentStatus} aria-label={`재직 상태: ${staff.is_active ? "재직" : "퇴사"}`}>
                    <span className={styles.statusLabel}>재직 상태</span>
                    <span className={styles.statusValue} data-active={staff.is_active ? "true" : "false"}>
                      <span className={styles.statusDot} aria-hidden />
                      {staff.is_active ? "재직" : "퇴사"}
                    </span>
                  </div>
                  <span className={styles.actionDivider} aria-hidden />
                  {canManage && (
                    <Button
                      type="button"
                      intent="secondary"
                      size="sm"
                      onClick={() => setEditOpen(true)}
                    >
                      정보 수정
                    </Button>
                  )}
                  {canManage &&
                    staff.is_active &&
                    staff.user != null &&
                    staff.account_role !== "OWNER" &&
                    (staff.account_role !== "ADMIN" || meQ.data.is_owner) && (
                      <Button
                        type="button"
                        intent="secondary"
                        size="sm"
                        onClick={() => setPasswordOpen(true)}
                      >
                        비밀번호 변경
                      </Button>
                    )}
                  {canManage && staff.is_active && canEditStaffAccountRole(staff.account_role) && (
                    <Button
                      type="button"
                      intent="ghost"
                      size="sm"
                      className={styles.destructiveAction}
                      disabled={offboardMutation.isPending}
                      onClick={async () => {
                        const ok = await confirm({
                          title: "퇴사 처리",
                          message: `${staff.name}의 로그인을 중지하고 퇴사 처리하시겠습니까?\n기존 근무·비용·급여 이력은 보존됩니다.`,
                          confirmText: "퇴사 처리",
                          danger: true,
                        });
                        if (!ok) return;
                        offboardMutation.mutate();
                      }}
                    >
                      {offboardMutation.isPending ? "처리 중…" : "퇴사 처리"}
                    </Button>
                  )}
                  {canManage && !staff.is_active && canEditStaffAccountRole(staff.account_role) && (
                    <Button
                      type="button"
                      intent="ghost"
                      size="sm"
                      className={styles.destructiveAction}
                      disabled={deleteMutation.isPending}
                      onClick={async () => {
                        const ok = await confirm({
                          title: "잘못 등록한 직원 삭제",
                          message: `${staff.name}을(를) 영구 삭제하시겠습니까?\n근무·비용·마감·급여 이력이 한 건이라도 있으면 삭제되지 않습니다.`,
                          confirmText: "영구 삭제",
                          danger: true,
                        });
                        if (ok) deleteMutation.mutate(sid);
                      }}
                    >
                      {deleteMutation.isPending ? "삭제 중…" : "잘못 등록한 직원 삭제"}
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
                    <InfoRow label="급여유형" value={staff.pay_type === "HOURLY" ? "시급" : "월급(수동 확인)"} />
                    <InfoRow label="직위" value={staffPositionLabel(staff.position, staff.role)} />
                    <InfoRow label="계정 유형" value={staffAccountRoleLabel(staff.account_role, staff.role)} />
                    <div className="ds-overlay-info-row" title="강사·조교의 직원 관리(시급·급여·비용) 접근 권한입니다. 대표·관리자는 항상 접근할 수 있고, OFF여도 본인 출퇴근 등 일반 기능은 사용할 수 있습니다.">
                      <span className="ds-overlay-info-row__label">직원관리 권한</span>
                      <span className="ds-overlay-info-row__value">
                        {canManage && canEditStaffAccountRole(staff.account_role) ? (
                          <StaffManagerToggle staffId={staff.id} isManager={!!(staff.can_manage_staff ?? staff.is_manager)} />
                        ) : (
                          <Badge
                            variant="solid"
                            status={(staff.can_manage_staff ?? staff.is_manager) ? "active" : "inactive"}
                            title={staff.account_role === "ADMIN" ? "관리자 계정은 직원관리 권한이 항상 있습니다." : undefined}
                          >
                            {(staff.can_manage_staff ?? staff.is_manager) ? "ON" : "OFF"}
                          </Badge>
                        )}
                      </span>
                    </div>
                    <InfoRow label="등록일" value={staff.created_at?.slice(0, 10)} />
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
                  <div className="ds-overlay-stat-grid ds-overlay-stat-grid--two">
                    <div className="ds-overlay-stat-card">
                      <div className="ds-overlay-stat-card__label">근무시간</div>
                      <div className="ds-overlay-stat-card__value ds-overlay-stat-card__value--brand">
                        {summary?.work_hours ?? 0}<span className="ds-overlay-stat-card__unit">h</span>
                      </div>
                    </div>
                    <div className="ds-overlay-stat-card">
                      <div className="ds-overlay-stat-card__label">공제 전 합계</div>
                      <div className="ds-overlay-stat-card__value">
                        {summaryQ.isError ? "—" : (summary?.total_amount ?? 0).toLocaleString()}<span className="ds-overlay-stat-card__unit ds-overlay-stat-card__unit--currency">원</span>
                      </div>
                    </div>
                  </div>
                  <div className="ds-overlay-info-rows ds-overlay-info-rows--summary">
                    <div className="ds-overlay-info-row">
                      <span className="ds-overlay-info-row__label">마감상태</span>
                      <span className="ds-overlay-info-row__value">
                        <div className="flex items-center gap-2">
                          {lockFailed ? (
                            <span className="font-semibold ds-overlay-lock-state">확인 실패</span>
                          ) : (
                            <LockBadge state={locked ? "LOCKED" : "OPEN"} />
                          )}
                        </div>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 우측 — 탭 + 콘텐츠 (학생 상세와 동일 플랫탭) */}
              <div className="ds-overlay-content-panel">
                <div className={styles.staffTabs} role="tablist" aria-label="직원 상세 보기">
                    {tabItems.map((t, index) => (
                      <button
                        key={t.key}
                        ref={(node) => { tabRefs.current[index] = node; }}
                        id={`${tabPanelId}-${t.key}`}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.key}
                        aria-controls={tabPanelId}
                        tabIndex={tab === t.key ? 0 : -1}
                        className={`${styles.staffTab}${tab === t.key ? ` ${styles.staffTabActive}` : ""}`}
                        onClick={() => setTab(t.key)}
                        onKeyDown={(event) => handleTabKeyDown(event, index)}
                      >
                        {t.label}
                      </button>
                    ))}
                </div>

                <div
                  id={tabPanelId}
                  role="tabpanel"
                  aria-labelledby={`${tabPanelId}-${tab}`}
                  className={`ds-overlay-tab-content ${styles.tabPanel}`}
                >
                  {tabItems.find((i) => i.key === tab)?.children}
                </div>
              </div>
            </div>
          </div>
      </StaffDetailShell>

      {editOpen &&
        createPortal(
          <StaffEditModal
            open={true}
            staff={staff}
            onClose={() => setEditOpen(false)}
            onSuccess={() => {
              setEditOpen(false);
              qc.invalidateQueries({ queryKey: staffQueryKeys.staffDetail(sid) });
              qc.invalidateQueries({ queryKey: staffQueryKeys.staffs });
            }}
          />,
          document.body
        )}
      {passwordOpen &&
        createPortal(
          <StaffPasswordModal
            open={true}
            staffList={[{ id: staff.id, name: staff.name }]}
            onClose={() => setPasswordOpen(false)}
          />,
          document.body
        )}
    </>
  );
}

function StaffDetailShell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableSelector =
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";
    const focusCloseButton = window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>("button[aria-label='닫기']")?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusCloseButton);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <>
      <div className="ds-overlay-backdrop" onClick={onClose} aria-hidden />
      <div className="ds-overlay-wrap">
        <div
          ref={panelRef}
          className="ds-overlay-panel ds-overlay-panel--staff-detail"
          role="dialog"
          aria-modal="true"
          aria-label="직원 상세"
          data-testid="staff-detail-overlay"
          tabIndex={-1}
          onClick={(event) => event.stopPropagation()}
        >
          <CloseButton className="ds-overlay-panel__close" onClick={onClose} />
          {children}
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
    <div className="ds-overlay-info-row">
      <span className="ds-overlay-info-row__label">{label}</span>
      <span className={`ds-overlay-info-row__value${accent ? " ds-overlay-info-row__value--accent" : ""}`}>
        {value ?? "-"}
      </span>
    </div>
  );
}
