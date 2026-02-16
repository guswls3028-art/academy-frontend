// PATH: src/features/staff/pages/HomePage/StaffCreateModal.tsx
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

type Props = {
  open: boolean;
  onClose: () => void;
};

type PermissionRole = "TEACHER" | "ASSISTANT";

export default function StaffCreateModal({ open, onClose }: Props) {
  const qc = useQueryClient();

  const [form, setForm] = useState({
    username: "",
    password: "",
    name: "",
    phone: "",
    permission_role: "ASSISTANT" as PermissionRole,
  });

  const createM = useMutation({
    mutationFn: async () => {
      const res = await api.post("/staffs/", {
        username: form.username,
        password: form.password,
        name: form.name,
        phone: form.phone || undefined,
        role: form.permission_role,
      });

      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staffs"] });
      alert("직원이 생성되었습니다.");
      onClose();
      setForm({
        username: "",
        password: "",
        name: "",
        phone: "",
        permission_role: "ASSISTANT",
      });
    },
    onError: (e: any) => {
      const msg =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        "직원 생성에 실패했습니다.";
      alert(msg);
    },
  });

  const invalidUsername = !String(form.username || "").trim();
  const invalidPassword = !String(form.password || "").trim();
  const invalidName = !String(form.name || "").trim();

  return (
    <AdminModal open={open} onClose={onClose} type="action">
      <ModalHeader
        title="직원 등록"
        description="로그인 계정을 포함한 직원 정보를 등록합니다."
        type="action"
      />

      <ModalBody>
        <div style={{ display: "grid", gap: 12 }}>
          <Field label="로그인 아이디 *">
            <input
              className="ds-input"
              value={form.username}
              onChange={(e) =>
                setForm((p) => ({ ...p, username: e.target.value }))
              }
              data-required="true"
              data-invalid={invalidUsername ? "true" : "false"}
              autoFocus
            />
          </Field>

          <Field label="비밀번호 *">
            <input
              type="password"
              className="ds-input"
              value={form.password}
              onChange={(e) =>
                setForm((p) => ({ ...p, password: e.target.value }))
              }
              data-required="true"
              data-invalid={invalidPassword ? "true" : "false"}
            />
          </Field>

          <Field label="이름 *">
            <input
              className="ds-input"
              value={form.name}
              onChange={(e) =>
                setForm((p) => ({ ...p, name: e.target.value }))
              }
              data-required="true"
              data-invalid={invalidName ? "true" : "false"}
            />
          </Field>

          <Field label="전화번호">
            <input
              className="ds-input"
              value={form.phone}
              onChange={(e) =>
                setForm((p) => ({ ...p, phone: e.target.value }))
              }
              placeholder="010XXXXXXXX"
            />
          </Field>

          <Field label="권한 *">
            <select
              className="ds-input"
              value={form.permission_role}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  permission_role: e.target.value as PermissionRole,
                }))
              }
              data-required="true"
              aria-label="권한 선택"
            >
              <option value="ASSISTANT">조교 (일반 직원)</option>
              <option value="TEACHER">강사</option>
            </select>
          </Field>
        </div>
      </ModalBody>

      <ModalFooter
        right={
          <>
            <ActionButton
              action="close"
              onClick={onClose}
              disabled={createM.isPending}
            />
            <ActionButton
              action="create"
              loading={createM.isPending}
              onClick={() => {
                if (invalidUsername || invalidPassword || invalidName) {
                  alert("필수 항목을 모두 입력하세요.");
                  return;
                }
                createM.mutate();
              }}
            >
              등록
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
    <div style={{ display: "grid", gap: 4 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: "var(--color-text-muted)",
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
