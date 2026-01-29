// PATH: src/features/staff/pages/HomePage/WorkTypeCreateModal.tsx
import { Modal } from "antd";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";

export default function WorkTypeCreateModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    base_hourly_wage: 0,
    color: "#22c55e",
    description: "",
  });

  const createM = useMutation({
    mutationFn: async () => {
      const res = await api.post("/staffs/work-types/", {
        name: form.name,
        base_hourly_wage: Number(form.base_hourly_wage),
        color: form.color,
        description: form.description,
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-types"] });
      alert("근무유형이 생성되었습니다.");
      onClose();
      setForm({
        name: "",
        base_hourly_wage: 0,
        color: "#22c55e",
        description: "",
      });
    },
    onError: (e: any) => {
      alert(
        e?.response?.data?.detail ||
          e?.response?.data?.message ||
          "근무유형 생성 실패"
      );
    },
  });

  return (
    <Modal
      title="근무유형 생성"
      open={open}
      onCancel={onClose}
      okText="생성"
      cancelText="취소"
      confirmLoading={createM.isPending}
      onOk={() => {
        if (!form.name.trim()) {
          alert("근무유형 이름은 필수입니다.");
          return;
        }
        if (form.base_hourly_wage <= 0) {
          alert("기본 시급은 0보다 커야 합니다.");
          return;
        }
        createM.mutate();
      }}
    >
      <div className="space-y-3">
        <Field label="근무유형명 *">
          <input
            className="input"
            value={form.name}
            onChange={(e) =>
              setForm((p) => ({ ...p, name: e.target.value }))
            }
            placeholder="예: 강의, 상담, 보조업무"
          />
        </Field>

        <Field label="기본 시급(원) *">
          <input
            type="number"
            className="input"
            min={0}
            value={form.base_hourly_wage}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                base_hourly_wage: Number(e.target.value),
              }))
            }
          />
        </Field>

        <Field label="색상">
          <input
            type="color"
            value={form.color}
            onChange={(e) =>
              setForm((p) => ({ ...p, color: e.target.value }))
            }
          />
        </Field>

        <Field label="설명">
          <textarea
            className="input"
            rows={2}
            value={form.description}
            onChange={(e) =>
              setForm((p) => ({ ...p, description: e.target.value }))
            }
          />
        </Field>

        <div className="text-xs text-[var(--text-muted)]">
          * 생성 즉시 직원 근무유형/근무기록에서 사용 가능합니다.
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
      <div className="text-xs font-medium text-[var(--text-muted)]">
        {label}
      </div>
      {children}
    </div>
  );
}
