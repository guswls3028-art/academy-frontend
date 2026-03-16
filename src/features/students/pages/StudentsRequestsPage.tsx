// PATH: src/features/students/pages/StudentsRequestsPage.tsx
// 선생용: 가입 신청 — 패널형 카드 UI (PanelWithTreeLayout SSOT 준수, 학생 도메인 정합)

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Checkbox, Switch } from "antd";
import {
  FiUserCheck,
  FiUserX,
  FiChevronRight,
} from "react-icons/fi";
import { UserPlus } from "lucide-react";
import {
  fetchRegistrationRequests,
  approveRegistrationRequest,
  rejectRegistrationRequest,
  bulkApproveRegistrationRequests,
  bulkRejectRegistrationRequests,
  fetchRegistrationRequestSettings,
  updateRegistrationRequestSettings,
  type ClientRegistrationRequest,
} from "../api/students";
import {
  fetchAutoSendConfigs,
  updateAutoSendConfigs,
} from "@/features/messages/api/messages.api";
import { Button, EmptyState } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import AdminModal from "@/shared/ui/modal/AdminModal";
import ModalHeader from "@/shared/ui/modal/ModalHeader";
import ModalBody from "@/shared/ui/modal/ModalBody";
import ModalFooter from "@/shared/ui/modal/ModalFooter";
import panelStyles from "@/shared/ui/domain/PanelWithTreeLayout.module.css";
import "@/styles/design-system/modal.css";
import "./StudentsRequestsPage.css";

/* ── 유틸 ── */

function formatDate(s: string | null) {
  if (!s) return "-";
  try {
    const d = new Date(s);
    return d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

function formatDateShort(s: string | null) {
  if (!s) return "";
  try {
    const d = new Date(s);
    return d.toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "";
  }
}

function schoolLabel(r: ClientRegistrationRequest) {
  const school = r.highSchool || r.middleSchool || "-";
  const grade = r.grade != null ? ` ${r.grade}학년` : "";
  return `${school}${grade}`.trim() || "-";
}

function parentPhone(r: ClientRegistrationRequest): string {
  return r.parentPhone?.trim() || "-";
}

function studentPhone(r: ClientRegistrationRequest): string {
  return r.phone?.trim() || "-";
}

/* ── 상세 모달 ── */

function RequestDetailModal({
  request,
  open,
  onClose,
  onApprove,
  onReject,
  approving,
  rejecting,
}: {
  request: ClientRegistrationRequest | null;
  open: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  approving: boolean;
  rejecting: boolean;
}) {
  if (!request) return null;

  const isHigh = request.schoolType === "HIGH";
  const rows: { label: string; value: string | null }[] = [
    { label: "이름", value: request.name },
    { label: "학부모 전화", value: request.parentPhone || null },
    { label: "학생 전화", value: request.phone || null },
    { label: "구분", value: isHigh ? "고등" : "중등" },
    { label: "학교", value: request.highSchool || request.middleSchool || null },
    { label: "학년", value: request.grade != null ? `${request.grade}학년` : null },
    ...(isHigh ? [{ label: "반", value: request.highSchoolClass || null }] : []),
    ...(isHigh ? [{ label: "계열", value: request.major || null }] : []),
    { label: "주소", value: request.address || null },
    ...(isHigh ? [{ label: "출신 중학교", value: request.originMiddleSchool || null }] : []),
    { label: "성별", value: request.gender || null },
    { label: "메모", value: request.memo || null },
    { label: "신청일시", value: formatDate(request.createdAt) },
  ];

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      type="action"
      width={480}
      onEnterConfirm={!approving && !rejecting ? onApprove : undefined}
    >
      <ModalHeader
        type="action"
        title="가입 신청 상세"
        description={`${request.name} · ${schoolLabel(request)}`}
      />
      <ModalBody>
        <dl className="students-request-detail__list">
          {rows.map(({ label, value }) => (
            <div key={label} className="students-request-detail__row">
              <dt className="students-request-detail__label">{label}</dt>
              <dd className="students-request-detail__value">{value ?? "-"}</dd>
            </div>
          ))}
        </dl>
      </ModalBody>
      <ModalFooter
        left={
          <Button intent="secondary" size="md" onClick={onClose}>
            닫기
          </Button>
        }
        right={
          <>
            <Button
              intent="danger"
              size="md"
              onClick={onReject}
              disabled={rejecting || approving}
            >
              {rejecting ? "처리 중..." : "거절"}
            </Button>
            <Button
              intent="primary"
              size="md"
              onClick={onApprove}
              disabled={approving || rejecting}
            >
              {approving ? "처리 중..." : "승인"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}

/* ── 메인 페이지 ── */

export default function StudentsRequestsPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [detailRequest, setDetailRequest] =
    useState<ClientRegistrationRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["students", "registration_requests"],
    queryFn: () =>
      fetchRegistrationRequests({ status: "pending", page: 1, page_size: 100 }),
  });

  const settingsQ = useQuery({
    queryKey: ["students", "registration_requests_settings"],
    queryFn: fetchRegistrationRequestSettings,
  });

  const list = data?.data ?? [];
  const pendingList = list.filter((r) => r.status === "pending");

  /* ── mutations ── */

  const approveMutation = useMutation({
    mutationFn: (id: number) => approveRegistrationRequest(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["students", "registration_requests"] });
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
      setDetailOpen(false);
      setDetailRequest(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      feedback.success("승인되었습니다. 학생이 등록되었습니다.");
    },
    onError: (e: Error) => {
      feedback.error(e.message || "승인 처리에 실패했습니다.");
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (ids: number[]) => bulkApproveRegistrationRequests(ids),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["students", "registration_requests"] });
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
      setSelectedIds(new Set());
      if (res.approved > 0)
        feedback.success(`${res.approved}건 승인되었습니다.`);
      if (res.failed.length > 0) {
        feedback.error(
          `${res.failed.length}건 실패: ${res.failed.map((f) => f.detail).join(", ")}`
        );
      }
    },
    onError: (e: Error) => {
      feedback.error(e.message || "일괄 승인에 실패했습니다.");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => rejectRegistrationRequest(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["students", "registration_requests"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
      setDetailOpen(false);
      setDetailRequest(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      feedback.success("거절되었습니다.");
    },
    onError: (e: Error) => {
      feedback.error(e.message || "거절 처리에 실패했습니다.");
    },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: (ids: number[]) => bulkRejectRegistrationRequests(ids),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["students", "registration_requests"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
      setSelectedIds(new Set());
      if (res.rejected > 0)
        feedback.success(`${res.rejected}건 거절되었습니다.`);
    },
    onError: (e: Error) => {
      feedback.error(e.message || "일괄 거절에 실패했습니다.");
    },
  });

  const updateAutoApproveM = useMutation({
    mutationFn: (on: boolean) =>
      updateRegistrationRequestSettings({ auto_approve: on }),
    onSuccess: (res) => {
      qc.setQueryData(["students", "registration_requests_settings"], res);
    },
    onError: (err: unknown) => {
      const msg =
        (
          err as {
            response?: { data?: { detail?: string } };
            message?: string;
          }
        )?.response?.data?.detail ??
        (err as Error)?.message ??
        "자동 승인 설정 저장에 실패했습니다.";
      feedback.error(String(msg));
    },
  });

  /* ── 승인 시 자동발송 on/off ── */
  const autoSendQ = useQuery({
    queryKey: ["messaging", "auto-send"],
    queryFn: fetchAutoSendConfigs,
    staleTime: 60_000,
  });

  const studentMsgEnabled = useMemo(
    () =>
      autoSendQ.data?.find(
        (c) => c.trigger === "registration_approved_student"
      )?.enabled ?? false,
    [autoSendQ.data]
  );
  const parentMsgEnabled = useMemo(
    () =>
      autoSendQ.data?.find(
        (c) => c.trigger === "registration_approved_parent"
      )?.enabled ?? false,
    [autoSendQ.data]
  );

  const toggleAutoSendM = useMutation({
    mutationFn: ({
      trigger,
      enabled,
    }: {
      trigger: string;
      enabled: boolean;
    }) => {
      const existing = autoSendQ.data?.find((c) => c.trigger === trigger);
      return updateAutoSendConfigs([
        {
          trigger,
          enabled,
          template: existing?.template ?? null,
          message_mode: existing?.message_mode ?? "both",
          minutes_before: existing?.minutes_before ?? null,
        },
      ]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messaging", "auto-send"] });
    },
    onError: () => {
      feedback.error("알림 설정 변경에 실패했습니다.");
    },
  });

  const autoApproved = !!settingsQ.data?.auto_approve;
  const selectedList = useMemo(
    () => pendingList.filter((r) => selectedIds.has(r.id)),
    [pendingList, selectedIds]
  );
  const allSelected =
    pendingList.length > 0 && selectedIds.size === pendingList.length;

  const toggleOne = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(
      checked ? new Set(pendingList.map((r) => r.id)) : new Set()
    );
  };

  const openDetail = (r: ClientRegistrationRequest) => {
    setDetailRequest(r);
    setDetailOpen(true);
  };

  const handleBulkApprove = () => {
    if (selectedList.length === 0) return;
    bulkApproveMutation.mutate(selectedList.map((r) => r.id));
  };

  const handleBulkReject = async () => {
    if (selectedList.length === 0) return;
    const ok = await confirm({ title: "거절 확인", message: `선택한 ${selectedList.length}건을 거절하시겠습니까?`, danger: true, confirmText: "거절" });
    if (!ok) return;
    bulkRejectMutation.mutate(selectedList.map((r) => r.id));
  };

  /* ── 로딩 ── */
  if (isLoading) {
    return (
      <div className={panelStyles.root}>
        <div className={panelStyles.header}>
          <h2 className={panelStyles.headerTitle}>가입 신청</h2>
          <p className={panelStyles.headerDesc}>
            학생이 로그인 페이지에서 회원가입을 요청하면 여기에 표시됩니다.
          </p>
        </div>
        <div style={{ padding: "var(--space-5)" }}>
          <div className={panelStyles.contentInner}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={panelStyles.skeletonCard} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-app="admin">
      <div className={panelStyles.root}>
        {/* ── 헤더: 제목 + 카운트 뱃지 + 자동승인 토글 ── */}
        <div className={panelStyles.header}>
          <div className="students-requests__header-row">
            <div>
              <div className="students-requests__title-row">
                <h2 className={panelStyles.headerTitle}>가입 신청</h2>
                {pendingList.length > 0 && (
                  <span className="students-requests__count-badge">
                    {pendingList.length}
                  </span>
                )}
              </div>
              <p className={panelStyles.headerDesc}>
                학생이 로그인 페이지에서 회원가입을 요청하면 여기에 표시됩니다.
              </p>
            </div>
            <div className="students-requests__toggles">
              <label className="students-requests__auto-approve">
                <span className="students-requests__auto-approve-label">
                  자동 승인
                </span>
                <Switch
                  checked={autoApproved}
                  onChange={(checked) => updateAutoApproveM.mutate(checked)}
                  disabled={updateAutoApproveM.isPending}
                  size="small"
                />
              </label>
              <label className="students-requests__auto-approve">
                <span className="students-requests__auto-approve-label">
                  학생 알림
                </span>
                <Switch
                  checked={studentMsgEnabled}
                  onChange={(checked) =>
                    toggleAutoSendM.mutate({
                      trigger: "registration_approved_student",
                      enabled: checked,
                    })
                  }
                  disabled={toggleAutoSendM.isPending}
                  size="small"
                />
              </label>
              <label className="students-requests__auto-approve">
                <span className="students-requests__auto-approve-label">
                  학부모 알림
                </span>
                <Switch
                  checked={parentMsgEnabled}
                  onChange={(checked) =>
                    toggleAutoSendM.mutate({
                      trigger: "registration_approved_parent",
                      enabled: checked,
                    })
                  }
                  disabled={toggleAutoSendM.isPending}
                  size="small"
                />
              </label>
            </div>
          </div>
        </div>

        {/* ── 선택 툴바 ── */}
        <div className="students-requests__toolbar">
          <div className="students-requests__toolbar-left">
            <Checkbox
              checked={allSelected}
              indeterminate={selectedIds.size > 0 && !allSelected}
              onChange={(e) => toggleAll(e.target.checked)}
              disabled={pendingList.length === 0}
            />
            <span
              className="students-requests__toolbar-count"
              style={{
                color:
                  selectedIds.size > 0
                    ? "var(--color-primary)"
                    : "var(--color-text-muted)",
              }}
            >
              {selectedIds.size > 0
                ? `${selectedIds.size}건 선택됨`
                : `전체 ${pendingList.length}건`}
            </span>
          </div>
          <div className="students-requests__toolbar-actions">
            {selectedIds.size > 0 && (
              <Button
                intent="secondary"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                선택 해제
              </Button>
            )}
            <Button
              intent="primary"
              size="sm"
              disabled={
                selectedIds.size === 0 || bulkApproveMutation.isPending
              }
              onClick={handleBulkApprove}
            >
              {bulkApproveMutation.isPending ? "승인 중…" : "선택 승인"}
            </Button>
            <Button
              intent="danger"
              size="sm"
              disabled={
                selectedIds.size === 0 || bulkRejectMutation.isPending
              }
              onClick={handleBulkReject}
            >
              {bulkRejectMutation.isPending ? "거절 중…" : "선택 거절"}
            </Button>
          </div>
        </div>

        {/* ── 콘텐츠 ── */}
        <div style={{ padding: "var(--space-5)" }}>
          {pendingList.length === 0 ? (
            <div style={{ paddingTop: "var(--space-6)" }}>
              <EmptyState
                title="대기 중인 가입 신청이 없습니다"
                description="학생이 로그인 페이지에서 회원가입을 요청하면 여기에 표시됩니다."
              />
            </div>
          ) : (
            <div className={panelStyles.contentInner} style={{ maxWidth: 860 }}>
              {pendingList.map((r) => {
                const isSelected = selectedIds.has(r.id);
                const isApproving =
                  approveMutation.isPending &&
                  approveMutation.variables === r.id;
                const isRejecting =
                  rejectMutation.isPending &&
                  rejectMutation.variables === r.id;

                return (
                  <div
                    key={r.id}
                    className={`students-requests__card ${isSelected ? "students-requests__card--selected" : ""}`}
                    onClick={() => openDetail(r)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && openDetail(r)}
                  >
                    {/* 체크박스 */}
                    <div
                      className="students-requests__card-check"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={isSelected}
                        onChange={(e) => toggleOne(r.id, e.target.checked)}
                      />
                    </div>

                    {/* 아이콘 */}
                    <div className="students-requests__card-icon">
                      <UserPlus size={16} aria-hidden />
                    </div>

                    {/* 정보 */}
                    <div className="students-requests__card-info">
                      <div className="students-requests__card-name-row">
                        <span className="students-requests__card-name">
                          {r.name}
                        </span>
                        <span className="students-requests__card-school">
                          {schoolLabel(r)}
                        </span>
                      </div>
                      <div className="students-requests__card-meta">
                        <span>학부모 {parentPhone(r)}</span>
                        <span className="students-requests__card-meta-sep">
                          ·
                        </span>
                        <span>본인 {studentPhone(r)}</span>
                        {r.createdAt && (
                          <>
                            <span className="students-requests__card-meta-sep">
                              ·
                            </span>
                            <span>{formatDateShort(r.createdAt)} 신청</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 액션 */}
                    <div className="students-requests__card-actions">
                      <button
                        type="button"
                        className="students-requests__icon-btn students-requests__icon-btn--approve"
                        title="승인"
                        aria-label="승인"
                        disabled={isApproving || isRejecting}
                        onClick={(e) => {
                          e.stopPropagation();
                          approveMutation.mutate(r.id);
                        }}
                      >
                        <FiUserCheck size={15} />
                      </button>
                      <button
                        type="button"
                        className="students-requests__icon-btn students-requests__icon-btn--reject"
                        title="거절"
                        aria-label="거절"
                        disabled={isApproving || isRejecting}
                        onClick={(e) => {
                          e.stopPropagation();
                          rejectMutation.mutate(r.id);
                        }}
                      >
                        <FiUserX size={15} />
                      </button>
                      <span className="students-requests__card-chevron">
                        <FiChevronRight size={16} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <RequestDetailModal
        request={detailRequest}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailRequest(null);
        }}
        onApprove={() =>
          detailRequest && approveMutation.mutate(detailRequest.id)
        }
        onReject={() =>
          detailRequest && rejectMutation.mutate(detailRequest.id)
        }
        approving={
          approveMutation.isPending &&
          detailRequest != null &&
          approveMutation.variables === detailRequest.id
        }
        rejecting={
          rejectMutation.isPending &&
          detailRequest != null &&
          rejectMutation.variables === detailRequest.id
        }
      />
    </div>
  );
}
