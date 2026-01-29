// PATH: src/features/staff/components/StaffCreateModal.tsx
import { useState } from "react";
import api from "@/shared/api/axios";

type Role = "TEACHER" | "ASSISTANT";

export default function StaffCreateModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  if (!open) return null;

  const [form, setForm] = useState({
    name: "",
    phone: "",
    username: "",
    password: "",
    role: "ASSISTANT" as Role,
  });

  const submit = async () => {
    if (!form.name.trim()) return alert("이름은 필수입니다.");
    if (!form.username.trim()) return alert("아이디는 필수입니다.");
    if (!form.password.trim()) return alert("비밀번호는 필수입니다.");

    await api.post("/staffs/", {
      name: form.name.trim(),
      phone: form.phone.trim(),
      username: form.username.trim(),
      password: form.password,
      role: form.role,
    });

    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[480px] rounded-2xl bg-[var(--bg-surface)] shadow-2xl overflow-hidden">
        <div className="border-b border-[var(--border-divider)] px-5 py-3">
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            직원 등록
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">
            * 직원 등록 시 계정(User)도 함께 생성됩니다.
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          <input
            placeholder="이름"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="h-[40px] w-full rounded-lg border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 text-sm outline-none"
          />

          <input
            placeholder="전화번호"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            className="h-[40px] w-full rounded-lg border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 text-sm outline-none"
          />

          <input
            placeholder="아이디 (로그인 ID)"
            value={form.username}
            onChange={(e) =>
              setForm((p) => ({ ...p, username: e.target.value }))
            }
            className="h-[40px] w-full rounded-lg border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 text-sm outline-none"
          />

          <input
            type="password"
            placeholder="비밀번호"
            value={form.password}
            onChange={(e) =>
              setForm((p) => ({ ...p, password: e.target.value }))
            }
            className="h-[40px] w-full rounded-lg border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 text-sm outline-none"
          />

          <div>
            <div className="text-xs font-medium text-[var(--text-muted)] mb-1">
              역할
            </div>
            <select
              value={form.role}
              onChange={(e) =>
                setForm((p) => ({ ...p, role: e.target.value as Role }))
              }
              className="h-[40px] w-full rounded-lg border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 text-sm outline-none"
            >
              <option value="ASSISTANT">조교</option>
              <option value="TEACHER">강사</option>
            </select>
            <div className="mt-1 text-[11px] text-[var(--text-muted)]">
              * 강사는 월급(MONTHLY)로, 조교는 시급(HOURLY)으로 자동 설정됩니다.
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border-divider)]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md border border-[var(--border-divider)] text-[var(--text-secondary)]"
          >
            취소
          </button>
          <button
            onClick={submit}
            className="px-3 py-1.5 text-sm rounded-md bg-[var(--color-primary)] text-white"
          >
            등록
          </button>
        </div>
      </div>
    </div>
  );
}
