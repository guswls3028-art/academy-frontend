// PATH: src/features/staff/pages/HomePage/AddWorkTypeBulkModal.tsx
// 선택한 직원 여러 명에게 시급 태그를 한 번에 추가

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AdminModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { fetchWorkTypes, createStaffWorkType, type WorkType } from "../../api/staffWorkType.api";

const LIGHT_TAG_COLORS = ["#eab308", "#06b6d4"];
function isLightTagColor(c: string) {
  return LIGHT_TAG_COLORS.some((x) => String(c || "").toLowerCase() === x);
}

type Props = {
  open: boolean;
  onClose: () => void;
  staffIds: number[];
};

export default function AddWorkTypeBulkModal({ open, onClose, staffIds }: Props) {
  const qc = useQueryClient();
  const workTypesQ = useQuery({
    queryKey: ["staffs", "work-types"],
    queryFn: () => fetchWorkTypes({ is_active: true }),
    enabled: open,
  });
  const workTypes = workTypesQ.data ?? [];

  const addBulkM = useMutation({
    mutationFn: async ({ work_type_id }: { work_type_id: number }) => {
      let added = 0;
      let failed = 0;
      for (const staffId of staffIds) {
        try {
          await createStaffWorkType(staffId, { work_type_id });
          added += 1;
        } catch {
          failed += 1;
        }
      }
      return { added, failed };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["staffs"] });
      qc.invalidateQueries({ queryKey: ["staff"] });
      if (result.failed === 0) {
        feedback.success(`선택한 직원 ${result.added}명에게 시급 태그를 추가했습니다.`);
      } else {
        feedback.success(`${result.added}명 추가, ${result.failed}명은 이미 해당 태그가 있거나 오류로 건너뛰었습니다.`);
      }
      onClose();
    },
    onError: () => {
      feedback.error("시급 태그 추가에 실패했습니다.");
    },
  });

  const handleSelect = (wt: WorkType) => {
    if (addBulkM.isPending) return;
    addBulkM.mutate({ work_type_id: wt.id });
  };

  if (!open) return null;

  return (
    <AdminModal open={open} onClose={onClose}>
      <ModalHeader
        title="시급 태그 추가"
        description={`선택한 직원 ${staffIds.length}명에게 적용할 시급 태그를 선택하세요.`}
      />
      <ModalBody>
        {workTypesQ.isLoading ? (
          <p className="text-sm text-[var(--color-text-muted)]">태그 목록 불러오는 중…</p>
        ) : workTypes.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">등록된 시급 태그가 없습니다. 먼저 시급태그 생성을 해 주세요.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {workTypes.map((wt) => {
              const color = wt.color || "#6b7280";
              const name = wt.name || "";
              const wageText =
                wt.base_hourly_wage != null
                  ? ` (${(wt.base_hourly_wage / 10000).toFixed(1)}만/시)`
                  : "";
              const label = `${name}${wageText}`;
              return (
                <button
                  key={wt.id}
                  type="button"
                  disabled={addBulkM.isPending}
                  onClick={() => handleSelect(wt)}
                  className="inline-flex items-center shrink-0 px-3 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
                  style={{
                    backgroundColor: color,
                    color: isLightTagColor(color) ? "#1a1a1a" : "#fff",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
                  }}
                >
                  {addBulkM.isPending ? "…" : label}
                </button>
              );
            })}
          </div>
        )}
      </ModalBody>
      <ModalFooter
        right={
          <Button intent="secondary" onClick={onClose}>
            취소
          </Button>
        }
      />
    </AdminModal>
  );
}
