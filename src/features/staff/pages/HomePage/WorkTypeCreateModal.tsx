// PATH: src/features/staff/pages/HomePage/WorkTypeCreateModal.tsx
// 시급 급여유형: 이름·시급·색상(전역 ColorPickerField)

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";

import {
  AdminModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/shared/ui/modal";
import { ActionButton } from "@/shared/ui/ds";
import { ColorPickerField } from "@/shared/ui/domain";

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
    <AdminModal open={open} onClose={onClose} type="action">
      <ModalHeader
        title="근무유형 생성"
        description="직원 근무 기록에 사용될 근무유형을 추가합니다."
        type="action"
      />

      <ModalBody>
        <div className="grid gap-3">
          <Field label="근무유형명 *">
            <input
              className="ds-input"
              value={form.name}
              onChange={(e) =>
                setForm((p) => ({ ...p, name: e.target.value }))
              }
            />
          </Field>

          <Field label="기본 시급(원) *">
            <input
              type="number"
              className="ds-input"
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
            <ColorPickerField
              value={form.color}
              onChange={(color) => setForm((p) => ({ ...p, color: color ?? p.color }))}
            />
          </Field>

          <Field label="설명">
            <textarea
              className="ds-input"
              rows={2}
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
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
                if (!form.name.trim() || form.base_hourly_wage <= 0) {
                  alert("필수 항목을 입력하세요.");
                  return;
                }
                createM.mutate();
              }}
            >
              생성
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
