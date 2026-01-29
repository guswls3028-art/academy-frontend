// PATH: src/features/staff/pages/HomePage/HomePage.tsx
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { StaffHomeTable } from "./StaffHomeTable";
import { useStaffs } from "../../hooks/useStaffs";
import StaffCreateModal from "./StaffCreateModal";
import WorkTypeCreateModal from "./WorkTypeCreateModal";
import { useQuery } from "@tanstack/react-query";
import { fetchStaffMe } from "../../api/staffMe.api";
import { Input } from "antd";

export default function HomePage() {
  const navigate = useNavigate();
  const { data: staffs, isLoading } = useStaffs();
  const [openCreate, setOpenCreate] = useState(false);
  const [openWorkType, setOpenWorkType] = useState(false);
  const [q, setQ] = useState("");

  const meQ = useQuery({
    queryKey: ["staff-me"],
    queryFn: fetchStaffMe,
  });

  const canManage = !!meQ.data?.is_payroll_manager;

  const rows = useMemo(() => {
    const list = Array.isArray(staffs) ? staffs : [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;

    return list.filter((s) => {
      return (
        (s.name ?? "").toLowerCase().includes(needle) ||
        (s.phone ?? "").toLowerCase().includes(needle)
      );
    });
  }, [staffs, q]);

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-lg font-semibold">직원 관리</div>
          <div className="text-xs text-[var(--text-muted)]">
            * 급여/시간/합계는 백엔드 기준 · 마감된 월은 변경 불가
          </div>
        </div>

        {canManage && (
          <div className="flex gap-2">
            <button
              onClick={() => setOpenWorkType(true)}
              className="btn-outline"
            >
              + 근무유형 생성
            </button>
            <button
              onClick={() => setOpenCreate(true)}
              className="btn-primary"
            >
              + 직원 등록
            </button>
          </div>
        )}
      </div>

      <div className="max-w-[420px]">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          allowClear
          placeholder="이름/전화번호 검색"
        />
      </div>

      <StaffHomeTable
        staffs={rows}
        canManage={canManage}
        onOperate={(id) => navigate(`/admin/staff/operations?staffId=${id}`)}
        onDetail={(id) => navigate(`/admin/staff/${id}`)}
      />

      <StaffCreateModal open={openCreate} onClose={() => setOpenCreate(false)} />
      <WorkTypeCreateModal
        open={openWorkType}
        onClose={() => setOpenWorkType(false)}
      />
    </div>
  );
}
