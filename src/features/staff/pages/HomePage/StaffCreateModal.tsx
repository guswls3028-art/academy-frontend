// PATH: src/features/staff/pages/HomePage/StaffCreateModal.tsx

import { Modal } from "antd";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";

type Props = {
  open: boolean;
  onClose: () => void;
};

type PermissionRole = "ADMIN" | "TEACHER" | "ASSISTANT" | "OWNER";

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
      /**
       * 🔒 스펙 단일진실
       * - backend는 role 필드만 인식
       * - OWNER는 프론트에서 전송 금지
       */
      const role =
        form.permission_role === "OWNER"
          ? undefined
          : form.permission_role;

      const res = await api.post("/staffs/", {
        username: form.username,
        password: form.password,
        name: form.name,
        phone: form.phone || undefined,
        role, // ✅ 핵심 수정
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

  return (
    <Modal
      title="직원 등록"
      open={open}
      onCancel={onClose}
      onOk={() => {
        if (
          !form.username.trim() ||
          !form.password.trim() ||
          !form.name.trim() ||
          !form.permission_role
        ) {
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
            onChange={(e) =>
              setForm((p) => ({ ...p, username: e.target.value }))
            }
            placeholder="로그인에 사용됩니다"
          />
        </Field>

        <Field label="비밀번호 *">
          <input
            type="password"
            className="input"
            value={form.password}
            onChange={(e) =>
              setForm((p) => ({ ...p, password: e.target.value }))
            }
          />
        </Field>

        <Field label="이름 *">
          <input
            className="input"
            value={form.name}
            onChange={(e) =>
              setForm((p) => ({ ...p, name: e.target.value }))
            }
          />
        </Field>

        <Field label="전화번호">
          <input
            className="input"
            value={form.phone}
            onChange={(e) =>
              setForm((p) => ({ ...p, phone: e.target.value }))
            }
          />
        </Field>

        <Field label="권한 *">
          <select
            className="input"
            value={form.permission_role}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                permission_role: e.target.value as PermissionRole,
              }))
            }
          >
            <option value="ASSISTANT">조교 (일반 직원)</option>
            <option value="TEACHER">강사</option>
            <option value="ADMIN">관리자</option>
            <option value="OWNER" disabled>
              오너 (백엔드 지정)
            </option>
          </select>
        </Field>

        <div className="text-xs text-[var(--text-muted)] leading-relaxed">
          • <b>관리자</b>: 직원 관리 · 승인 · 마감 가능<br />
          • <b>강사</b>: 강의 담당 (권한은 백엔드 정책에 따름)<br />
          • <b>조교</b>: 일반 직원<br />
          • <b>오너</b>: 시스템 전용 (프론트에서 지정 불가)
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
