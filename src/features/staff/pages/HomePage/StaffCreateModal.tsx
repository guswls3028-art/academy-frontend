// PATH: src/features/staff/pages/HomePage/StaffCreateModal.tsx

import { Modal } from "antd";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";

type Props = {
  open: boolean;
  onClose: () => void;
};

type Role = "ASSISTANT" | "TEACHER";

export default function StaffCreateModal({ open, onClose }: Props) {
  const qc = useQueryClient();

  const [form, setForm] = useState({
    username: "",
    password: "",
    name: "",
    phone: "",
    role: "ASSISTANT" as Role,
  });

  const createM = useMutation({
    mutationFn: async () => {
      const res = await api.post("/staffs/", {
        username: form.username,
        password: form.password,
        role: form.role,
        name: form.name,
        phone: form.phone,
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
        role: "ASSISTANT",
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

  return (
    <Modal
      title="직원 등록"
      open={open}
      onCancel={onClose}
      onOk={() => {
        if (!form.username || !form.password || !form.name || !form.role) {
          alert("필수 항목을 모두 입력하세요.");
          return;
        }
        createM.mutate();
      }}
      okText="등록"
      cancelText="취소"
      confirmLoading={createM.isPending}
    >
      <div className="space-y-3">
        <Field label="로그인 아이디 *">
          <input
            className="input"
            value={form.username}
            onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
            placeholder="로그인에 사용됩니다"
          />
        </Field>

        <Field label="비밀번호 *">
          <input
            type="password"
            className="input"
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          />
        </Field>

        <Field label="이름 *">
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
        </Field>

        <Field label="전화번호">
          <input
            className="input"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          />
        </Field>

        <Field label="역할 *">
          <select
            className="input"
            value={form.role}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                role: e.target.value as Role,
              }))
            }
          >
            <option value="ASSISTANT">조교 (시급)</option>
            <option value="TEACHER">강사 (월급 · 관리자)</option>
          </select>
        </Field>

        {form.role === "TEACHER" && (
          <div className="text-xs text-gray-500">
            * 강사는 자동으로 관리자 권한이 부여되며 월급제로 설정됩니다.
          </div>
        )}
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-[var(--text-muted)]">{label}</div>
      {children}
    </div>
  );
}
