// PATH: src/features/students/pages/StudentsRequestsPage.tsx
// 선생용: 학생 가입 신청 목록 — 섹션형 UI(이름·전화번호만), 상세 팝업(프로젝트 모달 패턴), 체크박스·일괄 승인·자동승인

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Checkbox, Switch } from "antd";
import {
  fetchRegistrationRequests,
  approveRegistrationRequest,
  bulkApproveRegistrationRequests,
  fetchRegistrationRequestSettings,
  updateRegistrationRequestSettings,
  type ClientRegistrationRequest,
} from "../api/students";
import { Button, EmptyState } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import AdminModal from "@/shared/ui/modal/AdminModal";
import ModalHeader from "@/shared/ui/modal/ModalHeader";
import ModalBody from "@/shared/ui/modal/ModalBody";
import ModalFooter from "@/shared/ui/modal/ModalFooter";
import "@/styles/design-system/modal.css";
import "./StudentsRequestsPage.css";

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
  const school = r.highSchool || r.middleSchool || "-";
  const grade = r.grade != null ? ` ${r.grade}학년` : "";
  return `${school}${grade}`.trim() || "-";
}

/** 목록용: 표시할 전화번호 (학생 전화 우선, 없으면 학부모 전화) */
function displayPhone(r: ClientRegistrationRequest): string {
  if (r.phone && r.phone.trim()) return r.phone.trim();
  if (r.parentPhone && r.parentPhone.trim()) return r.parentPhone.trim();
  return "-";
}

/** 신청 상세 모달 */
function RequestDetailModal({
  request,
  open,
  onClose,
  onApprove,
  approving,
}: {
  request: ClientRegistrationRequest | null;
  open: boolean;
  onClose: () => void;
  onApprove: () => void;
  approving: boolean;
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
    <AdminModal open={open} onClose={onClose} type="action" width={480}>
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
          <Button
            intent="primary"
            size="md"
            onClick={onApprove}
            disabled={approving}
          >
            {approving ? "처리 중..." : "승인"}
          </Button>
        }
      />
    </AdminModal>
  );
}

export default function StudentsRequestsPage() {
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [detailRequest, setDetailRequest] = useState<ClientRegistrationRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["students", "registration_requests"],
    queryFn: () => fetchRegistrationRequests({ status: "pending", page: 1, page_size: 100 }),
  });

  const settingsQ = useQuery({
    queryKey: ["students", "registration_requests_settings"],
    queryFn: fetchRegistrationRequestSettings,
  });

  const list = data?.data ?? [];
  const pendingList = list.filter((r) => r.status === "pending");

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
      if (res.approved > 0) feedback.success(`${res.approved}건 승인되었습니다.`);
      if (res.failed.length > 0) {
        feedback.error(`${res.failed.length}건 실패: ${res.failed.map((f) => f.detail).join(", ")}`);
      }
    },
    onError: (e: Error) => {
      feedback.error(e.message || "일괄 승인에 실패했습니다.");
    },
  });

  const updateAutoApproveM = useMutation({
    mutationFn: (on: boolean) => updateRegistrationRequestSettings({ auto_approve: on }),
    onSuccess: (res) => {
      qc.setQueryData(["students", "registration_requests_settings"], res);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
        ?? (err as Error)?.message
        ?? "자동 승인 설정 저장에 실패했습니다.";
      feedback.error(String(msg));
    },
  });

  const autoApproved = !!settingsQ.data?.auto_approve;
  const selectedList = useMemo(
    () => pendingList.filter((r) => selectedIds.has(r.id)),
    [pendingList, selectedIds],
  );
  const allSelected = pendingList.length > 0 && selectedIds.size === pendingList.length;

  const toggleOne = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(pendingList.map((r) => r.id)) : new Set());
  };

  const openDetail = (r: ClientRegistrationRequest) => {
    setDetailRequest(r);
    setDetailOpen(true);
  };

  const handleBulkApprove = () => {
    if (selectedList.length === 0) return;
    bulkApproveMutation.mutate(selectedList.map((r) => r.id));
  };

  if (isLoading) {
    return (
      <div className="students-requests-page" style={{ padding: "var(--space-6)" }}>
        <div className="flex items-center justify-center min-h-[200px]">
          <span className="text-[var(--color-text-muted)]">불러오는 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="students-requests-page" data-app="admin">
      <div className="students-requests-page__inner" style={{ padding: "var(--space-6)", maxWidth: "1200px", margin: "0 auto" }}>
        <section className="students-requests-section">
          <div className="students-requests-section__header">
            <div className="students-requests-section__title-wrap">
              <h2 className="students-requests-section__title">가입 신청</h2>
              <p className="students-requests-section__meta">
                대기 중 {pendingList.length}건
              </p>
            </div>
            <div className="students-requests-section__actions">
              <label className="students-requests-section__auto-approve">
                <span className="students-requests-section__auto-approve-label">자동 승인</span>
                <Switch
                  checked={autoApproved}
                  onChange={(checked) => updateAutoApproveM.mutate(checked)}
                  disabled={updateAutoApproveM.isPending}
                  aria-describedby="students-requests-auto-approve-desc"
                />
                <span id="students-requests-auto-approve-desc" className="sr-only">
                  {autoApproved ? "활성화됨. 새 가입 신청이 즉시 승인됩니다." : "비활성화됨. 선생님이 직접 승인해야 합니다."}
                </span>
              </label>
              {selectedList.length > 0 && (
                <Button
                  intent="primary"
                  size="md"
                  onClick={handleBulkApprove}
                  disabled={bulkApproveMutation.isPending}
                >
                  {bulkApproveMutation.isPending ? "처리 중..." : `선택 승인 (${selectedList.length}건)`}
                </Button>
              )}
            </div>
          </div>
        </section>

        {pendingList.length === 0 ? (
          <div className="students-requests-section__body" style={{ paddingTop: "var(--space-8)" }}>
            <EmptyState
              title="대기 중인 가입 신청이 없습니다"
              description="학생이 로그인 페이지에서 회원가입을 요청하면 여기에 표시됩니다."
            />
          </div>
        ) : (
          <div className="students-requests-section__body">
            {/* 전체 선택 */}
            <div className="students-requests-select-all">
              <Checkbox
                checked={allSelected}
                indeterminate={selectedIds.size > 0 && !allSelected}
                onChange={(e) => toggleAll(e.target.checked)}
              >
                <span className="students-requests-select-all__label">전체 선택</span>
              </Checkbox>
            </div>

            <ul className="students-requests-section-list">
              {pendingList.map((r) => (
                <li key={r.id} className="students-requests-section-item">
                  <div
                    role="button"
                    tabIndex={0}
                    className="students-requests-section-item__inner"
                    onClick={() => openDetail(r)}
                    onKeyDown={(e) => e.key === "Enter" && openDetail(r)}
                  >
                    <div className="students-requests-section-item__check" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(r.id)}
                        onChange={(e) => toggleOne(r.id, e.target.checked)}
                      />
                    </div>
                    <div className="students-requests-section-item__info">
                      <span className="students-requests-section-item__name">{r.name}</span>
                      <span className="students-requests-section-item__phone">{displayPhone(r)}</span>
                    </div>
                    <div className="students-requests-section-item__action">
                      <Button
                        size="sm"
                        intent="primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(r);
                        }}
                      >
                        상세
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <RequestDetailModal
        request={detailRequest}
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailRequest(null); }}
        onApprove={() => detailRequest && approveMutation.mutate(detailRequest.id)}
        approving={approveMutation.isPending && detailRequest != null && approveMutation.variables === detailRequest.id}
      />
    </div>
  );
}
