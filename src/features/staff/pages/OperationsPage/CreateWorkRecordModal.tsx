// PATH: src/features/staff/pages/OperationsPage/CreateWorkRecordModal.tsx
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkMonth } from "../../operations/context/WorkMonthContext";
import { useWorkRecords } from "../../hooks/useWorkRecords";
import { fetchStaffWorkTypes } from "../../api/staffWorkType.api";

import {
  AdminModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/shared/ui/modal";
import { ActionButton } from "@/shared/ui/ds";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function CreateWorkRecordModal({ open, onClose }: Props) {
  const { staffId, range, locked } = useWorkMonth();

  const { createM } = useWorkRecords({
    staff: staffId,
    date_from: range.from,
    date_to: range.to,
  });

  const workTypesQ = useQuery({
    queryKey: ["staff-work-types", staffId],
    queryFn: () => fetchStaffWorkTypes(staffId),
    enabled: open,
  });

  const staffWorkTypes = workTypesQ.data ?? [];

  const [form, setForm] = useState({
    date: range.from,
    work_type: undefined as number | undefined,
    start_time: "",
    end_time: "",
    break_minutes: 0,
    memo: "",
  });

  useEffect(() => {
    if (open) {
      setForm((p) => ({ ...p, date: range.from, work_type: undefined }));
    }
  }, [open, range.from]);

  if (locked) return null;

  return (
    <AdminModal open={open} onClose={onClose} type="action">
      <ModalHeader
        title="근무 기록 추가"
        description="직원의 근무 기록을 등록합니다."
        type="action"
      />

      <ModalBody>
        <div className="grid gap-3">
          <Field label="날짜">
            <input
              type="date"
              className="ds-input"
              value={form.date}
              onChange={(e) =>
                setForm((p) => ({ ...p, date: e.target.value }))
              }
            />
          </Field>

          <Field label="근무유형 *">
            <select
              className="ds-input"
              value={form.work_type ?? ""}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  work_type: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
            >
              <option value="">선택</option>
              {staffWorkTypes.map((st) => (
                <option key={st.id} value={st.work_type.id}>
                  {st.work_type.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="시작 시간 *">
              <input
                type="time"
                className="ds-input"
                value={form.start_time}
                onChange={(e) =>
                  setForm((p) => ({ ...p, start_time: e.target.value }))
                }
              />
            </Field>

            <Field label="종료 시간 *">
              <input
                type="time"
                className="ds-input"
                value={form.end_time}
                onChange={(e) =>
                  setForm((p) => ({ ...p, end_time: e.target.value }))
                }
              />
            </Field>
          </div>

          <Field label="휴게시간(분)">
            <input
              type="number"
              className="ds-input"
              min={0}
              value={form.break_minutes}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  break_minutes: Number(e.target.value),
                }))
              }
            />
          </Field>

          <Field label="메모">
            <textarea
              className="ds-input"
              rows={3}
              value={form.memo}
              onChange={(e) =>
                setForm((p) => ({ ...p, memo: e.target.value }))
              }
            />
          </Field>
        </div>
      </ModalBody>

      <ModalFooter
        right={
          <>
            <ActionButton action="close" onClick={onClose} />
            <ActionButton
              action="create"
              loading={createM.isPending}
              onClick={() => {
                if (
                  !form.work_type ||
                  !form.start_time ||
                  !form.end_time
                ) {
                  alert("필수 항목을 입력하세요.");
                  return;
                }

                createM.mutate(
                  {
                    staff: staffId,
                    work_type: form.work_type,
                    date: form.date,
                    start_time: form.start_time,
                    end_time: form.end_time,
                    break_minutes: form.break_minutes,
                    memo: form.memo,
                  },
                  {
                    onSuccess: () => {
                      onClose();
                      setForm({
                        date: range.from,
                        work_type: undefined,
                        start_time: "",
                        end_time: "",
                        break_minutes: 0,
                        memo: "",
                      });
                    },
                  }
                );
              }}
            >
              추가
            </ActionButton>
          </>
        }
      />
    </AdminModal>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <div className="text-xs font-semibold text-[var(--text-muted)]">
        {label}
      </div>
      {children}
    </div>
  );
}
