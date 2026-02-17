// PATH: src/features/staff/pages/HomePage/HomePage.tsx
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { StaffHomeTable } from "./StaffHomeTable";
import { useStaffs } from "../../hooks/useStaffs";
import StaffCreateModal from "./StaffCreateModal";
import WorkTypeCreateModal from "./WorkTypeCreateModal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchStaffMe } from "../../api/staffMe.api";
import { deleteStaff } from "../../api/staff.api";
import { DomainListToolbar } from "@/shared/ui/domain";
import { Button, EmptyState } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useSendMessageModal } from "@/features/messages/context/SendMessageModalContext";

export default function HomePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { openSendMessageModal } = useSendMessageModal();
  const { data: staffData, isLoading } = useStaffs();
  const staffs = staffData?.staffs ?? [];
  const meQ = useQuery({
    queryKey: ["staff-me"],
    queryFn: fetchStaffMe,
  });
  /** 원장 행: 목록 API owner 우선, 없으면 /staffs/me 의 owner_display_name·owner_phone */
  const owner = (() => {
    if (staffData?.owner?.name) return staffData.owner;
    const displayName = meQ.data?.owner_display_name ?? (meQ.data?.is_owner ? "대표" : null);
    if (displayName) {
      return {
        id: null,
        name: displayName,
        phone: meQ.data?.owner_phone ?? undefined,
        role: "OWNER" as const,
        is_owner: true as const,
      };
    }
    return null;
  })();
  const [openCreate, setOpenCreate] = useState(false);
  const [openWorkType, setOpenWorkType] = useState(false);
  const [q, setQ] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);

  const canManage = !!meQ.data?.is_payroll_manager;

  /** 직위순 기본 정렬: 대표(owner) → 강사(TEACHER) → 조교(ASSISTANT). 대표는 테이블에서 별도 첫 행. */
  const ROLE_ORDER: Record<string, number> = { TEACHER: 0, ASSISTANT: 1 };
  const rows = useMemo(() => {
    const list = Array.isArray(staffs) ? staffs : [];
    const needle = q.trim().toLowerCase();
    const filtered = !needle
      ? list
      : list.filter(
          (s) =>
            (s.name ?? "").toLowerCase().includes(needle) ||
            (s.phone ?? "").toLowerCase().includes(needle)
        );
    return [...filtered].sort(
      (a, b) => (ROLE_ORDER[a.role] ?? 2) - (ROLE_ORDER[b.role] ?? 2)
    );
  }, [staffs, q]);

  const selectionBar = (
    <div className="flex flex-wrap items-center gap-2 pl-1">
      <span
        className="text-[13px] font-semibold"
        style={{
          color: selectedIds.length > 0 ? "var(--color-primary)" : "var(--color-text-muted)",
        }}
      >
        {selectedIds.length}명 선택됨
      </span>
      <span className="text-[var(--color-border-divider)]">|</span>
      <Button intent="secondary" size="sm" onClick={() => setSelectedIds([])} disabled={selectedIds.length === 0}>
        선택 해제
      </Button>
      <span className="text-[var(--color-border-divider)]">|</span>
      <Button intent="secondary" size="sm" onClick={() => openSendMessageModal({ studentIds: [] })}>
        메시지 발송
      </Button>
      <Button intent="secondary" size="sm" onClick={() => feedback.info("엑셀 다운로드 기능 준비 중입니다.")}>
        엑셀 다운로드
      </Button>
      <Button intent="secondary" size="sm" onClick={() => feedback.info("시급 태그 추가 기능 준비 중입니다.")}>
        시급 태그 추가
      </Button>
      <Button intent="secondary" size="sm" onClick={() => feedback.info("비밀번호 변경 기능 준비 중입니다.")}>
        비밀번호 변경
      </Button>
      <Button
        intent="danger"
        size="sm"
        disabled={selectedIds.filter((id) => id > 0).length === 0 || deleting}
        onClick={async () => {
          const staffIds = selectedIds.filter((id) => id > 0);
          if (staffIds.length === 0) return;
          if (!window.confirm(`선택한 직원 ${staffIds.length}명을 삭제하시겠습니까? (대표는 삭제되지 않습니다)`)) return;
          setDeleting(true);
          try {
            for (const id of staffIds) {
              await deleteStaff(id);
            }
            setSelectedIds(selectedIds.filter((id) => id <= 0));
            qc.invalidateQueries({ queryKey: ["staffs"] });
            qc.invalidateQueries({ queryKey: ["staff"] });
            feedback.success(`${staffIds.length}명 삭제되었습니다.`);
          } catch (e: unknown) {
            feedback.error(e instanceof Error ? e.message : "삭제 중 오류가 발생했습니다.");
          } finally {
            setDeleting(false);
          }
        }}
      >
        {deleting ? "삭제 중…" : "삭제"}
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <DomainListToolbar
        totalLabel={
          isLoading
            ? "…"
            : owner
              ? `총 ${staffs.length + 1}명`
              : Array.isArray(staffs)
                ? `총 ${staffs.length}명`
                : "—"
        }
        searchSlot={
          <input
            className="ds-input"
            placeholder="이름/전화번호 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 360 }}
          />
        }
        primaryAction={
          canManage ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                intent="secondary"
                onClick={() => setOpenWorkType(true)}
              >
                시급태그 생성
              </Button>
              <Button
                type="button"
                intent="primary"
                onClick={() => setOpenCreate(true)}
              >
                + 직원 등록
              </Button>
            </div>
          ) : null
        }
        belowSlot={selectionBar}
      />

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : (
        <StaffHomeTable
          staffs={rows}
          owner={owner}
          canManage={canManage}
          onOperate={(id) => navigate(`/admin/staff/attendance?staffId=${id}`)}
          onDetail={(id) => navigate(`/admin/staff/${id}`)}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      )}

      <StaffCreateModal open={openCreate} onClose={() => setOpenCreate(false)} />
      <WorkTypeCreateModal
        open={openWorkType}
        onClose={() => setOpenWorkType(false)}
      />
    </div>
  );
}
