// PATH: src/features/staff/pages/OperationsPage/CreateWorkRecordModal.tsx
import { Modal } from "antd";
import { useEffect, useState } from "react";
import { useWorkMonth } from "../../operations/context/WorkMonthContext";
import { useWorkRecords } from "../../hooks/useWorkRecords";
import { useQuery } from "@tanstack/react-query";
import { fetchStaffWorkTypes } from "../../api/staffWorkType.api";
import ActionButton from "../../components/ActionButton";

export default function CreateWorkRecordModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
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
  const hasWorkTypes = staffWorkTypes.length > 0;

  const [form, setForm] = useState({
    date: range.from,
    work_type: undefined as number | undefined,
    start_time: "",
    end_time: "",
    break_minutes: 0,
    memo: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm((p) => ({ ...p, date: range.from, work_type: undefined }));
  }, [open, range.from]);

  if (locked) return null;

  return (
    <Modal
      title="근무 기록 추가"
      open={open}
      onCancel={onClose}
      okText="추가"
      cancelText="취소"
      confirmLoading={createM.isPending}
      onOk={() => {
        if (!hasWorkTypes) {
          alert("먼저 직원에게 근무유형을 등록하세요.");
          return;
        }
        if (!form.work_type) {
          alert("근무유형을 선택하세요.");
          return;
        }
        if (!form.start_time || !form.end_time) {
          alert("시작/종료 시간을 입력하세요.");
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
      <div className="space-y-3">
        <Field label="날짜">
          <input
            type="date"
            className="input"
            value={form.date}
            onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
          />
        </Field>

        <Field label="근무유형 *">
          <select
            className="input"
            disabled={!hasWorkTypes}
            value={form.work_type ?? ""}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                work_type: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          >
            <option value="">
              {hasWorkTypes ? "선택" : "등록된 근무유형 없음"}
            </option>
            {staffWorkTypes.map((st) => (
              <option key={st.id} value={st.work_type.id}>
                {st.work_type.name}
              </option>
            ))}
          </select>

          {!hasWorkTypes && (
            <div className="text-xs text-[var(--color-danger)] mt-1">
              * 근무기록을 추가하려면 먼저 <b>시급·근무유형</b> 탭에서 근무유형을
              등록하세요.
            </div>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="시작 시간 *">
            <input
              type="time"
              className="input"
              value={form.start_time}
              onChange={(e) =>
                setForm((p) => ({ ...p, start_time: e.target.value }))
              }
            />
          </Field>

          <Field label="종료 시간 *">
            <input
              type="time"
              className="input"
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
            className="input"
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
            className="input"
            rows={3}
            value={form.memo}
            onChange={(e) =>
              setForm((p) => ({ ...p, memo: e.target.value }))
            }
          />
        </Field>

        <div className="text-xs text-[var(--text-muted)]">
          * 근무시간·금액은 서버에서 자동 계산됩니다.
        </div>
      </div>
    </Modal>
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
    <div className="space-y-1">
      <div className="text-xs font-medium text-[var(--text-muted)]">{label}</div>
      {children}
    </div>
  );
}
