// PATH: src/app_admin/domains/staff/pages/OperationsPage/CreateWorkRecordModal.tsx
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkMonth } from "../../operations/context/workMonthHooks";
import { useWorkRecords } from "../../hooks/useWorkRecords";
import { fetchStaffWorkTypes } from "../../api/staffWorkType.api";
import type { WorkRecord } from "../../api/workRecords.api";
import { staffQueryKeys } from "../../queryKeys";

import {
  AdminModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/shared/ui/modal";
import { ActionButton } from "@/shared/ui/ds";
import { DatePicker } from "@/shared/ui/date";
import { feedback } from "@/shared/ui/feedback/feedback";

type Props = {
  open: boolean;
  onClose: () => void;
  initial?: WorkRecord | null;
};

export default function CreateWorkRecordModal({ open, onClose, initial = null }: Props) {
  const { staffId, range, writeBlocked } = useWorkMonth();

  const { createM, patchM } = useWorkRecords({
    staff: staffId,
    date_from: range.from,
    date_to: range.to,
  });

  const workTypesQ = useQuery({
    queryKey: staffQueryKeys.staffWorkTypes(staffId),
    queryFn: () => fetchStaffWorkTypes(staffId),
    enabled: open,
  });

  const staffWorkTypes = workTypesQ.data ?? [];

  const [form, setForm] = useState({
    date: range.from,
    work_type: undefined as number | undefined,
    start_time: "",
    end_time: "",
    break_minutes: "",
    memo: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        date: initial?.date ?? range.from,
        work_type: initial?.work_type,
        start_time: initial?.start_time ?? "",
        end_time: initial?.end_time ?? "",
        break_minutes: initial ? String(initial.break_minutes) : "",
        memo: initial?.memo ?? "",
      });
    }
  }, [initial, open, range.from]);

  if (writeBlocked) return null;

  const handleSubmit = () => {
    if (workTypesQ.isError || workTypesQ.isLoading) {
      feedback.error("근무유형을 다시 불러온 뒤 시도해 주세요.");
      return;
    }
    if (!form.work_type || !form.start_time || !form.end_time) {
      feedback.warning("필수 항목을 입력하세요.");
      return;
    }
    if (form.date < range.from || form.date > range.to) {
      feedback.warning("현재 선택한 월 안의 날짜를 선택해 주세요.");
      return;
    }
    if (form.end_time === form.start_time) {
      feedback.warning("종료 시간은 시작 시간과 같을 수 없습니다.");
      return;
    }
    const breakMinutes = form.break_minutes === "" ? 0 : Number(form.break_minutes);
    if (!Number.isFinite(breakMinutes) || breakMinutes < 0) {
      feedback.warning("휴게시간은 0분 이상으로 입력하세요.");
      return;
    }
    if (createM.isPending || patchM.isPending) return;
    const payload = {
        work_type: form.work_type,
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        break_minutes: breakMinutes,
        memo: form.memo,
    };
    const options = {
      onSuccess: () => {
        onClose();
      },
    };
    if (initial) {
      patchM.mutate({ id: initial.id, payload }, options);
      return;
    }
    createM.mutate(
      {
        staff: staffId,
        ...payload,
      },
      {
        ...options,
      }
    );
  };

  const isPending = createM.isPending || patchM.isPending;

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      type="action"
      closeDisabled={isPending}
      onEnterConfirm={!isPending ? handleSubmit : undefined}
    >
      <ModalHeader
        title={initial ? "근무 기록 수정" : "근무 기록 추가"}
        description={initial ? "잘못 입력된 근무 기록을 바로잡습니다." : "직원의 근무 기록을 등록합니다."}
        type="action"
      />

      <ModalBody>
        {workTypesQ.isError && (
          <div role="alert" className="mb-3 rounded border border-[var(--color-error)] p-3 text-sm text-[var(--color-error)]">
            근무유형을 불러오지 못했습니다. <button type="button" className="underline" onClick={() => void workTypesQ.refetch()}>다시 시도</button>
          </div>
        )}
        <div className="grid gap-3">
          <Field label="날짜" htmlFor="work-record-date">
            <DatePicker
              value={form.date}
              id="work-record-date"
              onChange={(v) =>
                setForm((p) => ({ ...p, date: v }))
              }
            />
          </Field>

          <Field label="근무유형 *" htmlFor="work-record-type">
            <select
              id="work-record-type"
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
              disabled={workTypesQ.isLoading || workTypesQ.isError || isPending}
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
            <Field label="시작 시간 *" htmlFor="work-record-start-time">
              <input
                id="work-record-start-time"
                type="time"
                className="ds-input"
                value={form.start_time}
                onChange={(e) =>
                  setForm((p) => ({ ...p, start_time: e.target.value }))
                }
              />
            </Field>

            <Field label="종료 시간 *" htmlFor="work-record-end-time">
              <input
                id="work-record-end-time"
                type="time"
                className="ds-input"
                value={form.end_time}
                onChange={(e) =>
                  setForm((p) => ({ ...p, end_time: e.target.value }))
                }
              />
            </Field>
          </div>
          {form.start_time && form.end_time && form.end_time < form.start_time && (
            <p className="text-xs text-[var(--color-text-muted)]">
              종료 시간이 더 이르면 다음 날 퇴근으로 계산됩니다.
            </p>
          )}

          <Field label="휴게시간(분)" htmlFor="work-record-break-minutes">
            <input
              id="work-record-break-minutes"
              type="number"
              className="ds-input"
              min={0}
              value={form.break_minutes}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  break_minutes: e.target.value,
                }))
              }
            />
          </Field>

          <Field label="메모" htmlFor="work-record-memo">
            <textarea
              id="work-record-memo"
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
              loading={isPending}
              disabled={workTypesQ.isLoading || workTypesQ.isError}
              onClick={handleSubmit}
            >
              {initial ? "저장" : "추가"}
            </ActionButton>
          </>
        }
      />
    </AdminModal>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-[var(--text-muted)]">
        {label}
      </label>
      {children}
    </div>
  );
}
