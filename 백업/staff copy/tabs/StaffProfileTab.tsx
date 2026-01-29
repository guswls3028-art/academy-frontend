// PATH: src/features/staff/tabs/StaffProfileTab.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchStaffDetail,
  patchStaffDetail,
  StaffDetail,
} from "../api/staff.detail.api";
import api from "@/shared/api/axios";

export default function StaffProfileTab() {
  const { staffId } = useParams();
  const sid = Number(staffId);
  const nav = useNavigate();
  const qc = useQueryClient();

  const detailQ = useQuery({
    queryKey: ["staff", sid],
    queryFn: () => fetchStaffDetail(sid),
    enabled: !!sid,
  });

  const patchM = useMutation({
    mutationFn: (payload: Partial<StaffDetail>) =>
      patchStaffDetail(sid, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff", sid] });
      alert("저장되었습니다.");
    },
  });

  const deleteM = useMutation({
    mutationFn: async () => {
      await api.delete(`/staffs/${sid}/`);
    },
    onSuccess: async () => {
      alert("직원이 삭제되었습니다.");
      await qc.invalidateQueries({ queryKey: ["staffs"] });
      nav("/admin/staff");
    },
  });

  const [form, setForm] = useState({
    name: "",
    phone: "",
    is_active: true,
    pay_type: "HOURLY" as "HOURLY" | "MONTHLY",
  });

  useEffect(() => {
    if (!detailQ.data) return;
    setForm({
      name: detailQ.data.name || "",
      phone: detailQ.data.phone || "",
      is_active: detailQ.data.is_active,
      pay_type: detailQ.data.pay_type,
    });
  }, [detailQ.data]);

  if (detailQ.isLoading || !detailQ.data) {
    return <div className="text-sm text-[var(--text-muted)]">불러오는 중...</div>;
  }

  return (
    <div className="max-w-[520px] space-y-6">
      <div className="space-y-3">
        <Field label="이름">
          <input
            value={form.name}
            onChange={(e) =>
              setForm((p) => ({ ...p, name: e.target.value }))
            }
            className="input"
          />
        </Field>

        <Field label="전화번호">
          <input
            value={form.phone}
            onChange={(e) =>
              setForm((p) => ({ ...p, phone: e.target.value }))
            }
            className="input"
          />
        </Field>

        <Field label="급여 타입">
          <select
            value={form.pay_type}
            onChange={(e) =>
              setForm((p) => ({ ...p, pay_type: e.target.value as any }))
            }
            className="input"
          >
            <option value="HOURLY">시급 (조교)</option>
            <option value="MONTHLY">월급 (강사)</option>
          </select>
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) =>
              setForm((p) => ({ ...p, is_active: e.target.checked }))
            }
          />
          활성
        </label>
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <button
          onClick={() => patchM.mutate(form)}
          className="btn-primary"
          disabled={patchM.isPending}
        >
          저장
        </button>

        <button
          onClick={() => {
            if (
              !confirm(
                "⚠️ 이 직원은 근무 / 급여 / 강의 데이터와 연결되어 있을 수 있습니다.\n삭제 시 관련 데이터도 함께 정리됩니다.\n\n정말 삭제할까요?"
              )
            )
              return;
            deleteM.mutate();
          }}
          className="px-3 py-1.5 text-sm rounded-md border border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
        >
          직원 삭제
        </button>
      </div>
    </div>
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
