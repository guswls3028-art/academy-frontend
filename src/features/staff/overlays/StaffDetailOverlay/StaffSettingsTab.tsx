// PATH: src/features/staff/overlays/StaffDetailOverlay/StaffSettingsTab.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchStaffDetail, patchStaffDetail, StaffDetail } from "../../api/staff.detail.api";
import { fetchStaffMe } from "../../api/staffMe.api";
import api from "@/shared/api/axios";

export default function StaffSettingsTab() {
  const { staffId } = useParams();
  const sid = Number(staffId);
  const nav = useNavigate();
  const qc = useQueryClient();

  const meQ = useQuery({
    queryKey: ["staff-me"],
    queryFn: fetchStaffMe,
  });

  const canManage = !!meQ.data?.is_payroll_manager;

  const detailQ = useQuery({
    queryKey: ["staff", sid],
    queryFn: () => fetchStaffDetail(sid),
    enabled: !!sid,
  });

  const patchM = useMutation({
    mutationFn: (payload: Partial<StaffDetail>) => patchStaffDetail(sid, payload),
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

  if (!canManage) {
    return <div className="text-sm text-[var(--text-muted)]">권한이 없습니다.</div>;
  }

  if (detailQ.isLoading || !detailQ.data) {
    return <div className="text-sm text-[var(--text-muted)]">불러오는 중...</div>;
  }

  return (
    <div className="max-w-[520px] space-y-6">
      <div className="space-y-3">
        <Field label="이름">
          <input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="form-input"
          />
        </Field>

        <Field label="전화번호">
          <input
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            className="form-input"
          />
        </Field>

        <Field label="급여 유형">
          <span className="inline-flex rounded-md border border-[var(--border-divider)] p-0.5 bg-[var(--bg-surface-soft)]">
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, pay_type: "HOURLY" }))}
              className={[
                "px-3 py-1.5 text-sm font-semibold rounded transition-colors",
                form.pay_type === "HOURLY"
                  ? "bg-[var(--color-brand-primary)] text-[var(--color-text-inverse)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--bg-surface)]",
              ].join(" ")}
            >
              시급
            </button>
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, pay_type: "MONTHLY" }))}
              className={[
                "px-3 py-1.5 text-sm font-semibold rounded transition-colors",
                form.pay_type === "MONTHLY"
                  ? "bg-[var(--color-brand-primary)] text-[var(--color-text-inverse)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--bg-surface)]",
              ].join(" ")}
            >
              월급
            </button>
          </span>
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
          />
          활성
        </label>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-[var(--border-divider)]">
        <button
          onClick={() => patchM.mutate(form)}
          className="btn-primary"
          disabled={patchM.isPending}
        >
          저장
        </button>

        <button
          onClick={() => {
            if (!confirm("직원을 삭제할까요? 연결된 데이터도 함께 삭제됩니다.")) return;
            deleteM.mutate();
          }}
          className="btn-danger"
        >
          직원 삭제
        </button>
      </div>
    </div>
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
