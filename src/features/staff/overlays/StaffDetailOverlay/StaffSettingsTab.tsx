// PATH: src/features/staff/overlays/StaffDetailOverlay/StaffSettingsTab.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchStaffDetail, patchStaffDetail, StaffDetail } from "../../api/staff.detail.api";
import { fetchStaffMe } from "../../api/staffMe.api";
import { useDeleteStaff } from "../../hooks/useDeleteStaff";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";

export default function StaffSettingsTab() {
  const { staffId } = useParams();
  const sid = Number(staffId);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const deleteMutation = useDeleteStaff();

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
      feedback.success("저장되었습니다.");
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
          onClick={async () => {
            const ok = await confirm({
              title: "직원 삭제",
              message: "직원을 삭제할까요? 연결된 근무기록, 비용 등 모든 데이터가 함께 삭제됩니다.",
              confirmText: "삭제",
              danger: true,
            });
            if (!ok) return;
            deleteMutation.mutate(sid);
          }}
          className="btn-danger"
          disabled={deleteMutation.isPending}
        >
          {deleteMutation.isPending ? "삭제 중…" : "직원 삭제"}
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
