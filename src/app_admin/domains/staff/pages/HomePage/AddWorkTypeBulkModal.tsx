// PATH: src/app_admin/domains/staff/pages/HomePage/AddWorkTypeBulkModal.tsx
// 선택한 직원 여러 명에게 시급 태그를 한 번에 추가

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type CSSProperties } from "react";
import {
  AdminModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { fetchWorkTypes, createStaffWorkType } from "../../api/staffWorkType.api";
import { staffQueryKeys } from "../../queryKeys";
import { extractApiError } from "@/shared/utils/extractApiError";

import { contrastTextColor } from "@/shared/ui/domain/constants";
import styles from "./AddWorkTypeBulkModal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  staffs: { id: number; name: string }[];
};

export default function AddWorkTypeBulkModal({ open, onClose, staffs }: Props) {
  const qc = useQueryClient();
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [failures, setFailures] = useState<{ id: number; name: string; reason: string }[] | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const workTypesQ = useQuery({
    queryKey: staffQueryKeys.staffsWorkTypes,
    queryFn: () => fetchWorkTypes({ is_active: true }),
    enabled: open,
  });
  const workTypes = workTypesQ.data ?? [];

  const addBulkM = useMutation({
    mutationFn: async ({ work_type_id }: { work_type_id: number }) => {
      let added = 0;
      const failed: { id: number; name: string; reason: string }[] = [];
      const targets = failures ?? staffs;
      for (const staff of targets) {
        try {
          await createStaffWorkType(staff.id, { work_type_id });
          added += 1;
        } catch (error) {
          failed.push({ ...staff, reason: extractApiError(error, "배정에 실패했습니다. 다시 시도해 주세요.") });
        }
      }
      return { added, failed };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: staffQueryKeys.staffs });
      qc.invalidateQueries({ queryKey: staffQueryKeys.staff });
      qc.invalidateQueries({ queryKey: staffQueryKeys.payrollOverviews });
      qc.invalidateQueries({ queryKey: staffQueryKeys.me });
      for (const staff of staffs) {
        qc.invalidateQueries({ queryKey: staffQueryKeys.staffWorkTypes(staff.id) });
      }
      setCompletedCount((count) => count + result.added);
      setFailures(result.failed);
      if (result.failed.length === 0) {
        feedback.success(`선택한 직원 ${completedCount + result.added}명에게 시급 태그를 추가했습니다.`);
        onClose();
      } else {
        feedback.warning(`${result.failed.length}명에게 배정하지 못했습니다. 아래 직원별 사유를 확인해 주세요.`);
      }
    },
    onError: () => {
      feedback.error("시급 태그 추가에 실패했습니다.");
    },
  });

  if (!open) return null;

  return (
    <AdminModal open={open} onClose={onClose} closeDisabled={addBulkM.isPending}>
      <ModalHeader
        title="시급 태그 추가"
        description={`선택한 직원 ${staffs.length}명에게 적용할 시급 태그를 선택한 뒤 추가하세요.`}
      />
      <ModalBody>
        <p className="mb-3 break-words text-sm">대상: {staffs.map((staff) => staff.name).join(", ")}</p>
        {workTypesQ.isLoading ? (
          <p className="text-sm text-[var(--color-text-muted)]">태그 목록 불러오는 중…</p>
        ) : workTypesQ.isError ? (
          <div className="flex items-center justify-between gap-3 text-sm text-[var(--color-danger)]">
            <span>시급 태그 목록을 불러오지 못했습니다.</span>
            <Button intent="secondary" size="sm" onClick={() => void workTypesQ.refetch()}>
              다시 시도
            </Button>
          </div>
        ) : workTypes.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">등록된 시급 태그가 없습니다. 먼저 시급태그 생성을 해 주세요.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {workTypes.map((wt) => {
              const color = wt.color || "#6b7280";
              const name = wt.name || "";
              const wageText =
                wt.base_hourly_wage != null
                  ? ` (${wt.base_hourly_wage.toLocaleString()}원/시간)`
                  : "";
              const label = `${name}${wageText}`;
              const buttonStyle = {
                "--work-type-bg": color,
                "--work-type-fg": contrastTextColor(color),
              } as CSSProperties;

              return (
                <button
                  key={wt.id}
                  type="button"
                  disabled={addBulkM.isPending || failures !== null}
                  aria-pressed={selectedTypeId === wt.id}
                  onClick={() => setSelectedTypeId(wt.id)}
                  className={styles.workTypeButton}
                  style={buttonStyle}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
        {failures && failures.length > 0 && (
          <div className="mt-4 space-y-2 text-sm" role="alert">
            <p>추가 완료 {completedCount}명 · 실패 {failures.length}명</p>
            <ul className="list-disc space-y-1 pl-5">
              {failures.map((staff) => <li key={staff.id}>{staff.name}: {staff.reason}</li>)}
            </ul>
            <p>완료한 직원은 유지됩니다. 다시 시도하면 실패한 직원만 처리합니다.</p>
          </div>
        )}
      </ModalBody>
      <ModalFooter
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={addBulkM.isPending}>
              {failures ? "닫기" : "취소"}
            </Button>
            <Button intent="primary" disabled={addBulkM.isPending || selectedTypeId === null || staffs.length === 0 || workTypesQ.isError}
              onClick={() => {
                if (selectedTypeId !== null && !addBulkM.isPending) addBulkM.mutate({ work_type_id: selectedTypeId });
              }}>
              {addBulkM.isPending ? "추가 중…" : failures ? `실패한 ${failures.length}명 다시 시도` : `${staffs.length}명에게 추가`}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
