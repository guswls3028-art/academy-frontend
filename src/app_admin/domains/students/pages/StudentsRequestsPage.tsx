// PATH: src/app_admin/domains/students/pages/StudentsRequestsPage.tsx
// 선생용: 가입 신청 — 패널형 카드 UI (PanelWithTreeLayout SSOT 준수, 학생 도메인 정합)

import { useMemo, useRef, useState } from "react";
import { useSchoolLevelMode } from "@/shared/hooks/useSchoolLevelMode";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "antd";
import { History } from "lucide-react";
import {
  fetchRegistrationRequests,
  approveRegistrationRequest,
  rejectRegistrationRequest,
  bulkApproveRegistrationRequests,
  bulkRejectRegistrationRequests,
  fetchRegistrationRequestSettings,
  updateRegistrationRequestSettings,
  deletedRegistrationConflictFromError,
  isSelfRegistrationDisabledError,
  resolveDeletedRegistrationRequest,
  type ClientRegistrationRequest,
  type DeletedRegistrationCandidate,
} from "../api/students.api";
import { Badge, Button, EmptyState } from "@/shared/ui/ds";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import { useRegistrationPasswordConfirmation, type RegistrationPasswordChoice } from "@/shared/product/students/RegistrationPasswordConfirmation";
import AdminModal from "@/shared/ui/modal/AdminModal";
import ModalHeader from "@/shared/ui/modal/ModalHeader";
import ModalBody from "@/shared/ui/modal/ModalBody";
import ModalFooter from "@/shared/ui/modal/ModalFooter";
import ApprovalPolicyPanel from "@/shared/product/approvals/ApprovalPolicyPanel";
import RegistrationRequestCards from "./RegistrationRequestCards";
import panelStyles from "@/shared/ui/domain/PanelWithTreeLayout.module.css";
import { adminStudentsQueryKeys } from "../queryKeys";
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

function schoolLabel(r: ClientRegistrationRequest) {
  const school = r.highSchool || r.middleSchool || r.elementarySchool || "-";
  const grade = r.grade != null ? ` ${r.grade}학년` : "";
  return `${school}${grade}`.trim() || "-";
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
  actionError,
}: {
  request: ClientRegistrationRequest | null;
  open: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  approving: boolean;
  rejecting: boolean;
  actionError: string | null;
}) {
  const slm = useSchoolLevelMode();

  if (!request) return null;

  const isHigh = request.schoolType === "HIGH";
  const rows: { label: string; value: string | null }[] = [
    { label: "이름", value: request.name },
    { label: "학부모 전화", value: request.parentPhone || null },
    { label: "학생 전화", value: request.phone || null },
    { label: "구분", value: slm.getLabel(request.schoolType as "ELEMENTARY" | "MIDDLE" | "HIGH") },
    { label: "학교", value: request.highSchool || request.middleSchool || request.elementarySchool || null },
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
      closeDisabled={approving || rejecting}
      type="action"
      width={480}
      onEnterConfirm={undefined}
    >
      <ModalHeader
        type="action"
        title="가입 신청 상세"
        description={`${request.name} · ${schoolLabel(request)}`}
      />
      <ModalBody>
        {actionError && <p role="alert" className="students-requests__result" data-error="true">{actionError}</p>}
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
          <Button intent="secondary" size="md" onClick={onClose} disabled={approving || rejecting}>
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

function DeletedAccountRecoveryModal({
  request,
  candidates,
  selectedId,
  open,
  resolving,
  onSelect,
  onClose,
  onConfirm,
}: {
  request: ClientRegistrationRequest | null;
  candidates: DeletedRegistrationCandidate[];
  selectedId: number | null;
  open: boolean;
  resolving: boolean;
  onSelect: (studentId: number) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!request) return null;
  return (
    <AdminModal open={open} onClose={onClose} closeDisabled={resolving} type="action" width={520} onEnterConfirm={selectedId ? onConfirm : undefined}>
      <ModalHeader
        type="action"
        title="과거 계정을 선택해 주세요"
        description={`${request.name} 학생과 같은 정보의 삭제 이력이 있습니다.`}
      />
      <ModalBody>
        <p className="students-request-recovery__guide">
          복구할 계정을 직접 선택하면 수강 이력을 보존하고, 이번 가입 신청의
          아이디와 비밀번호를 적용합니다. 선택하지 않은 삭제 이력은 그대로 둡니다.
        </p>
        <div className="students-request-recovery__list" role="radiogroup" aria-label="복구할 과거 계정">
          {candidates.map((candidate) => {
            const selected = selectedId === candidate.studentId;
            return (
              <button
                key={candidate.studentId}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`students-request-recovery__option ${selected ? "students-request-recovery__option--selected" : ""}`}
                disabled={resolving}
                onClick={() => onSelect(candidate.studentId)}
              >
                <span className="students-request-recovery__icon" aria-hidden><History size={18} /></span>
                <span className="students-request-recovery__option-copy">
                  <strong>{formatDate(candidate.createdAt)} 등록 계정</strong>
                  <span>수강 이력 {candidate.enrollmentCount}건 · {formatDate(candidate.deletedAt)} 삭제</span>
                </span>
                <span className="students-request-recovery__radio" aria-hidden />
              </button>
            );
          })}
        </div>
      </ModalBody>
      <ModalFooter
        left={<Button intent="secondary" size="md" onClick={onClose} disabled={resolving}>취소</Button>}
        right={
          <Button intent="primary" size="md" onClick={onConfirm} disabled={!selectedId || resolving}>
            {resolving ? "복구 중…" : "이 계정 복구·승인"}
          </Button>
        }
      />
    </AdminModal>
  );
}

/* ── 메인 페이지 ── */

export default function StudentsRequestsPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const confirmPasswords = useRegistrationPasswordConfirmation();
  const approvalConfirmationRef = useRef(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [detailRequest, setDetailRequest] =
    useState<ClientRegistrationRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [recoveryRequest, setRecoveryRequest] = useState<ClientRegistrationRequest | null>(null);
  const [recoveryCandidates, setRecoveryCandidates] = useState<DeletedRegistrationCandidate[]>([]);
  const [selectedRecoveryId, setSelectedRecoveryId] = useState<number | null>(null);
  const recoverySubmissionRef = useRef(false);
  const [actionResult, setActionResult] = useState<{ error: boolean; message: string } | null>(null);

  const requestsQ = useInfiniteQuery({
    queryKey: adminStudentsQueryKeys.registrationRequestPages,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchRegistrationRequests({ status: "pending", page: pageParam, page_size: 50 }),
    getNextPageParam: (last, pages) => last.data.length > 0 && pages.reduce((count, page) => count + page.data.length, 0) < last.count ? pages.length + 1 : undefined,
  });
  const { data, isLoading, isError, error, refetch } = requestsQ;

  const settingsQ = useQuery({
    queryKey: adminStudentsQueryKeys.registrationRequestSettings,
    queryFn: fetchRegistrationRequestSettings,
    enabled: !isLoading && !isError,
  });

  const pendingList = useMemo(() => {
    const unique = new Map<number, ClientRegistrationRequest>();
    for (const page of data?.pages ?? []) for (const row of page.data) {
      if (row.status === "pending") unique.set(row.id, row);
    }
    return [...unique.values()];
  }, [data]);
  const pendingCount = data?.pages[0]?.count ?? 0;

  const finishApproval = async (id: number, message: string) => {
    await qc.invalidateQueries({ queryKey: adminStudentsQueryKeys.registrationRequests });
    qc.invalidateQueries({ queryKey: adminStudentsQueryKeys.students });
    qc.invalidateQueries({ queryKey: adminStudentsQueryKeys.adminNotificationCounts });
    setDetailOpen(false);
    setDetailRequest(null);
    setRecoveryRequest(null);
    setRecoveryCandidates([]);
    setSelectedRecoveryId(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setActionResult({ error: false, message: "학생 계정을 등록했습니다. 학생 목록에서 확인하세요." });
    feedback.success(message);
  };

  /* ── mutations ── */

  const approveMutation = useMutation({
    onMutate: () => setActionResult(null),
    mutationFn: ({ id, choice }: { id: number; choice: RegistrationPasswordChoice }) => approveRegistrationRequest(id, choice),
    onSuccess: (_data, { id }) => {
      return finishApproval(id, "승인되었습니다. 학생이 등록되었습니다.");
    },
    onError: (e: unknown, { id }) => {
      const conflict = deletedRegistrationConflictFromError(e);
      const request = pendingList.find((item) => item.id === id) ?? null;
      if (conflict && request) {
        setRecoveryRequest(request);
        setRecoveryCandidates(conflict.candidates);
        setSelectedRecoveryId(null);
        setDetailOpen(false);
        return;
      }
      setActionResult({ error: true, message: getApiErrorMessage(e, "승인 처리에 실패했습니다. 신청을 다시 확인한 뒤 재시도해 주세요.") });
    },
  });

  const resolveDeletedMutation = useMutation({
    mutationFn: ({ requestId, studentId, choice }: { requestId: number; studentId: number; choice: RegistrationPasswordChoice }) =>
      resolveDeletedRegistrationRequest(requestId, studentId, choice),
    onSuccess: (_data, variables) => {
      return finishApproval(variables.requestId, "과거 계정과 수강 이력을 복구하고 가입을 승인했습니다.");
    },
    onError: (e: unknown) => {
      feedback.error(getApiErrorMessage(
        e,
        "과거 계정을 복구하지 못했습니다. 목록을 새로 확인해 주세요.",
      ));
    },
    onSettled: () => {
      recoverySubmissionRef.current = false;
    },
  });

  const bulkApproveMutation = useMutation({
    onMutate: () => setActionResult(null),
    mutationFn: ({ ids, choice }: { ids: number[]; choice: RegistrationPasswordChoice }) => bulkApproveRegistrationRequests(ids, choice),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: adminStudentsQueryKeys.registrationRequests });
      qc.invalidateQueries({ queryKey: adminStudentsQueryKeys.students });
      qc.invalidateQueries({ queryKey: adminStudentsQueryKeys.adminNotificationCounts });
      setSelectedIds(new Set(res.failed.map((item) => item.id)));
      setActionResult({
        error: res.failed.length > 0,
        message: res.failed.length > 0
          ? `${res.approved}건 승인 · ${res.failed.length}건 처리하지 못했습니다. 실패한 신청은 선택을 유지했습니다. ${res.failed.map((item) => `${pendingList.find((request) => request.id === item.id)?.name ?? "신청"}: ${item.detail}`).join(" / ")}`
          : `${res.approved}건 승인했습니다. 학생 목록에서 확인할 수 있습니다.`,
      });
    },
    onError: (e: Error) => {
      setActionResult({ error: true, message: getApiErrorMessage(e, "일괄 승인에 실패했습니다. 선택은 유지됩니다. 다시 시도해 주세요.") });
    },
  });

  const rejectMutation = useMutation({
    onMutate: () => setActionResult(null),
    mutationFn: (id: number) => rejectRegistrationRequest(id),
    onSuccess: async (_data, id) => {
      await qc.invalidateQueries({ queryKey: adminStudentsQueryKeys.registrationRequests });
      qc.invalidateQueries({ queryKey: adminStudentsQueryKeys.adminNotificationCounts });
      setDetailOpen(false);
      setDetailRequest(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setActionResult({ error: false, message: "가입 신청을 거절했습니다." });
    },
    onError: (e: Error) => {
      setActionResult({ error: true, message: getApiErrorMessage(e, "거절 처리에 실패했습니다. 다시 시도해 주세요.") });
    },
  });

  const bulkRejectMutation = useMutation({
    onMutate: () => setActionResult(null),
    mutationFn: (requestIds: number[]) => bulkRejectRegistrationRequests(requestIds),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: adminStudentsQueryKeys.registrationRequests });
      qc.invalidateQueries({ queryKey: adminStudentsQueryKeys.adminNotificationCounts });
      setSelectedIds(new Set());
      setActionResult({ error: false, message: `${res.rejected}건 거절했습니다.` });
    },
    onError: (e: Error) => {
      setActionResult({ error: true, message: getApiErrorMessage(e, "일괄 거절에 실패했습니다. 선택은 유지됩니다. 다시 시도해 주세요.") });
    },
  });

  const updateAutoApproveM = useMutation({
    mutationFn: (on: boolean) =>
      updateRegistrationRequestSettings({ auto_approve: on }),
    onSuccess: (res) => {
      qc.setQueryData(adminStudentsQueryKeys.registrationRequestSettings, res);
    },
    onMutate: () => qc.cancelQueries({ queryKey: adminStudentsQueryKeys.registrationRequestSettings }),
  });

  const autoApproved = !!settingsQ.data?.auto_approve;
  const selectedList = useMemo(
    () => pendingList.filter((r) => selectedIds.has(r.id)),
    [pendingList, selectedIds]
  );
  const allSelected = pendingList.length > 0 && selectedList.length === pendingList.length;
  const busy = approveMutation.isPending || rejectMutation.isPending || bulkApproveMutation.isPending || bulkRejectMutation.isPending || resolveDeletedMutation.isPending;
  const handleReject = async (request: ClientRegistrationRequest) => {
    if (approvalConfirmationRef.current || busy) return;
    approvalConfirmationRef.current = true;
    try {
      const ok = await confirm({ title: "거절 확인", message: `${request.name} 학생의 가입을 거절하시겠습니까?`, danger: true, confirmText: "거절" });
      if (ok) await rejectMutation.mutateAsync(request.id).catch(() => undefined);
    } finally { approvalConfirmationRef.current = false; }
  };

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
    setActionResult(null);
    setDetailRequest(r);
    setDetailOpen(true);
  };

  const handleBulkApprove = async () => {
    if (!selectedList.length || approvalConfirmationRef.current || busy) return;
    approvalConfirmationRef.current = true;
    try {
      const choice = await confirmPasswords({ title: "가입 승인 최종 확인", message: `선택한 ${selectedList.length}건을 승인합니다. 가입 신청에서 선택한 비밀번호는 유지하며, 선택이 없는 신청의 신규 학부모 비밀번호만 지정합니다.`, confirmText: "승인", studentAlreadySelected: true, parentAlreadySelected: selectedList.every((r) => r.parentPasswordSelected), parentPhoneAvailable: selectedList.every((r) => /^010\d{8}$/.test(r.parentPhone ?? "")) });
      if (choice) await bulkApproveMutation.mutateAsync({ ids: selectedList.map((r) => r.id), choice }).catch(() => undefined);
    } finally { approvalConfirmationRef.current = false; }
  };

  const handleApprove = async (request: ClientRegistrationRequest) => {
    if (approvalConfirmationRef.current || busy) return;
    approvalConfirmationRef.current = true;
    try {
      const choice = await confirmPasswords({ title: "가입 승인 최종 확인", message: `${request.name} 학생의 가입을 승인합니다. 가입 신청의 비밀번호 선택을 유지하며, 선택이 없다면 신규 학부모 비밀번호를 지정합니다.`, confirmText: "승인", studentAlreadySelected: true, parentAlreadySelected: request.parentPasswordSelected, parentPhone: request.parentPhone });
      if (choice) await approveMutation.mutateAsync({ id: request.id, choice }).catch(() => undefined);
    } finally { approvalConfirmationRef.current = false; }
  };

  const handleBulkReject = async () => {
    if (!selectedList.length || approvalConfirmationRef.current || busy) return;
    approvalConfirmationRef.current = true;
    try {
      const ok = await confirm({ title: "거절 확인", message: `선택한 ${selectedList.length}건을 거절하시겠습니까?`, danger: true, confirmText: "거절" });
      if (ok) await bulkRejectMutation.mutateAsync(selectedList.map((r) => r.id)).catch(() => undefined);
    } finally { approvalConfirmationRef.current = false; }
  };

  /* ── 로딩 ── */
  if (isLoading) {
    return (
      <div className={panelStyles.root}>
        <div className={panelStyles.header}>
          <h2 className={panelStyles.headerTitle}>가입 신청</h2>
          <p className={panelStyles.headerDesc}>
            학생이 로그인 페이지에서 회원가입을 요청하면 여기에 표시됩니다.
            <br />
            계정 안내 알림톡은 승인 시점이 아니라 첫 수강 확정 후 발송됩니다.
          </p>
        </div>
        <div className="students-requests__body">
          <div className={panelStyles.contentInner}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={panelStyles.skeletonCard} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError && isSelfRegistrationDisabledError(error)) {
    return (
      <div className={panelStyles.root}>
        <div className={panelStyles.header}>
          <h2 className={panelStyles.headerTitle}>가입 신청</h2>
          <p className={panelStyles.headerDesc}>
            이 학원은 학생 자가 가입을 사용하지 않습니다.
          </p>
        </div>
        <div className="students-requests__body">
          <div className={panelStyles.contentInner}>
            <EmptyState
              title="학생 자가 가입을 사용하지 않습니다"
              description="정책 변경 전에 접수된 요청은 기록으로 보존되며 승인하거나 거절할 수 없습니다. 학생은 직접 등록해 주세요."
            />
          </div>
        </div>
      </div>
    );
  }

  if (isError && (!data || [401, 403].includes((error as { response?: { status?: number } })?.response?.status ?? 0))) {
    return (
      <div className={panelStyles.root}>
        <div className={panelStyles.header}>
          <h2 className={panelStyles.headerTitle}>가입 신청</h2>
          <p className={panelStyles.headerDesc}>
            가입 신청 목록을 확인한 뒤에만 설정과 처리 기능을 사용할 수 있습니다.
          </p>
        </div>
        <div className="students-requests__body">
          <div className={panelStyles.contentInner}>
            <EmptyState
              tone="error"
              title="가입 신청을 불러오지 못했습니다"
              description="연결을 확인한 뒤 다시 시도해 주세요."
              actions={
                <Button intent="secondary" size="sm" onClick={() => void refetch()}>
                  다시 시도
                </Button>
              }
            />
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
                <Badge tone="primary">대기 {pendingCount}건</Badge>
              </div>
              <p className={panelStyles.headerDesc}>
                학생이 로그인 페이지에서 회원가입을 요청하면 여기에 표시됩니다.
                <br />
                계정 안내 알림톡은 승인 시점이 아니라 첫 수강 확정 후 발송됩니다.
              </p>
            </div>

          </div>
        </div>

        <div className="students-requests__policy">
          <ApprovalPolicyPanel title="가입 자동 승인" enabled={autoApproved}
            enabledDescription="학생이 가입 신청을 마치면 바로 계정이 등록됩니다."
            disabledDescription="신청 내용을 확인하고 승인하면 학생 계정이 등록됩니다."
            loading={settingsQ.isLoading} loadError={settingsQ.isError} saving={updateAutoApproveM.isPending}
            saved={updateAutoApproveM.isSuccess} saveError={updateAutoApproveM.isError ? getApiErrorMessage(updateAutoApproveM.error, "설정을 저장하지 못했습니다.") : null}
            onChange={(enabled) => updateAutoApproveM.mutate(enabled)} onReload={() => void settingsQ.refetch()}
            onRetry={() => { if (updateAutoApproveM.variables !== undefined) updateAutoApproveM.mutate(updateAutoApproveM.variables); }} />
        </div>
        {actionResult && <div className="students-requests__result" role={actionResult.error ? "alert" : "status"} data-error={actionResult.error}>
          {actionResult.message}
        </div>}
        {isError && !requestsQ.isFetchNextPageError && <div className="students-requests__result" role="alert">
          목록을 갱신하지 못했습니다. <Button size="sm" onClick={() => void refetch()}>목록 다시 시도</Button>
        </div>}
        {/* ── 선택 툴바 ── */}
        <div className="students-requests__toolbar">
          <div className="students-requests__toolbar-left">
            <Checkbox
              aria-label="불러온 신청 전체 선택"
              checked={allSelected}
              indeterminate={selectedList.length > 0 && !allSelected}
              onChange={(e) => toggleAll(e.target.checked)}
              disabled={pendingList.length === 0 || busy || isError}
            />
            <span
              className={`students-requests__toolbar-count ${selectedList.length > 0 ? "students-requests__toolbar-count--active" : ""}`}
            >
              {selectedList.length > 0
                ? `${selectedList.length}건 선택됨`
                : `대기 ${pendingCount}건 · 불러온 ${pendingList.length}건`}
            </span>
          </div>
          <div className="students-requests__toolbar-actions">
            {selectedList.length > 0 && (
              <Button
                intent="secondary"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                disabled={busy}
              >
                선택 해제
              </Button>
            )}
            <Button
              intent="primary"
              size="sm"
              disabled={
                selectedList.length === 0 || busy || isError
              }
              onClick={handleBulkApprove}
            >
              {bulkApproveMutation.isPending ? "승인 중…" : "선택 승인"}
            </Button>
            <Button
              intent="danger"
              size="sm"
              disabled={
                selectedList.length === 0 || busy || isError
              }
              onClick={handleBulkReject}
            >
              {bulkRejectMutation.isPending ? "거절 중…" : "선택 거절"}
            </Button>
          </div>
        </div>

        {/* ── 콘텐츠 ── */}
        <div className="students-requests__body">
          {pendingList.length === 0 ? (
            <div className="students-requests__empty-wrap">
              <EmptyState
                title="대기 중인 가입 신청이 없습니다"
                description="학생이 로그인 페이지에서 회원가입을 요청하면 여기에 표시됩니다."
              />
            </div>
          ) : (
            <RegistrationRequestCards requests={pendingList} selectedIds={selectedIds} busy={busy || isError && !requestsQ.isFetchNextPageError}
              approvingId={approveMutation.isPending ? approveMutation.variables?.id : undefined}
              rejectingId={rejectMutation.isPending ? rejectMutation.variables : undefined}
              onSelect={toggleOne} onDetail={openDetail} onApprove={(request) => void handleApprove(request)} onReject={(request) => void handleReject(request)} />
          )}
          {requestsQ.hasNextPage && <div className="students-requests__load-more">
            {requestsQ.isFetchNextPageError && <p role="alert">다음 신청을 불러오지 못했습니다. 기존 선택은 유지됩니다.</p>}
            <Button loading={requestsQ.isFetchingNextPage} disabled={busy} onClick={() => void requestsQ.fetchNextPage()}>
              {requestsQ.isFetchNextPageError ? "다음 신청 다시 시도" : "신청 더 보기"}
            </Button>
          </div>}
        </div>
      </div>

      <RequestDetailModal
        actionError={actionResult?.error ? actionResult.message : null}
        request={detailRequest}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailRequest(null);
        }}
        onApprove={async () => {
          if (!detailRequest) return;
          await handleApprove(detailRequest);
        }}
        onReject={() => { if (detailRequest) void handleReject(detailRequest); }}
        approving={
          approveMutation.isPending &&
          detailRequest != null &&
          approveMutation.variables?.id === detailRequest.id
        }
        rejecting={
          rejectMutation.isPending &&
          detailRequest != null &&
          rejectMutation.variables === detailRequest.id
        }
      />
      <DeletedAccountRecoveryModal
        request={recoveryRequest}
        candidates={recoveryCandidates}
        selectedId={selectedRecoveryId}
        open={recoveryRequest != null}
        resolving={resolveDeletedMutation.isPending || recoverySubmissionRef.current}
        onSelect={setSelectedRecoveryId}
        onClose={() => {
          if (resolveDeletedMutation.isPending || recoverySubmissionRef.current) return;
          setRecoveryRequest(null);
          setRecoveryCandidates([]);
          setSelectedRecoveryId(null);
        }}
        onConfirm={async () => {
          if (!recoveryRequest || !selectedRecoveryId || recoverySubmissionRef.current) return;
          recoverySubmissionRef.current = true;
          const choice = await confirmPasswords({ title: "과거 계정 복구 최종 확인", message: "가입 신청의 비밀번호 선택을 유지하여 계정을 복구합니다. 선택이 없는 신청은 누락 학부모 계정의 비밀번호를 지정합니다.", confirmText: "복구하고 승인", studentAlreadySelected: true, parentAlreadySelected: recoveryRequest.parentPasswordSelected, parentPhone: recoveryRequest.parentPhone });
          if (choice) resolveDeletedMutation.mutate({ requestId: recoveryRequest.id, studentId: selectedRecoveryId, choice });
          else recoverySubmissionRef.current = false;
        }}
      />
    </div>
  );
}
