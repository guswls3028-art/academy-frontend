// PATH: src/features/staff/pages/HomePage/StaffHomeTable.tsx
import { Table, Button, Select } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Staff } from "../../api/staff.api";
import { RoleBadge } from "../../components/StatusBadge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { patchStaffDetail } from "../../api/staff.detail.api";

interface Props {
  staffs: Staff[] | undefined;
  onOperate: (staffId: number) => void;
  onDetail: (staffId: number) => void;
  canManage: boolean;
}

export function StaffHomeTable({ staffs, onOperate, onDetail, canManage }: Props) {
  const dataSource: Staff[] = Array.isArray(staffs) ? staffs : [];
  const qc = useQueryClient();

  const patchPayTypeM = useMutation({
    mutationFn: ({ staffId, pay_type }: { staffId: number; pay_type: "HOURLY" | "MONTHLY" }) =>
      patchStaffDetail(staffId, { pay_type }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staffs"] });
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: any) => {
      const msg =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        "급여 유형 변경에 실패했습니다.";
      alert(msg);
    },
  });

  const columns: ColumnsType<Staff> = [
    {
      title: "이름",
      dataIndex: "name",
      render: (_, r) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold">{r.name}</span>
          {!r.is_active && (
            <span className="px-2 py-0.5 rounded-full text-xs border text-[var(--text-muted)] bg-[var(--bg-surface-muted)]">
              비활성
            </span>
          )}
        </div>
      ),
    },
    { title: "전화번호", dataIndex: "phone", render: (v) => v || "-" },
    {
      title: "역할",
      dataIndex: "is_manager",
      render: (v) => <RoleBadge isManager={!!v} />,
    },
    {
      title: "급여 유형",
      dataIndex: "pay_type",
      render: (v: Staff["pay_type"], record) => {
        if (!canManage) return v === "HOURLY" ? "시급" : "월급";

        return (
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Select
              size="small"
              value={v}
              style={{ width: 110 }}
              disabled={patchPayTypeM.isPending}
              options={[
                { value: "HOURLY", label: "시급" },
                { value: "MONTHLY", label: "월급" },
              ]}
              onChange={(next) => {
                if (next === record.pay_type) return;
                patchPayTypeM.mutate({ staffId: record.id, pay_type: next });
              }}
            />
          </div>
        );
      },
    },
    {
      title: "관리",
      render: (_, record) => (
        <div className="flex gap-2">
          <Button
            type="link"
            disabled={!canManage}
            onClick={(e) => {
              e.stopPropagation();
              onOperate(record.id);
            }}
          >
            작업
          </Button>
          <Button
            type="link"
            onClick={(e) => {
              e.stopPropagation();
              onDetail(record.id);
            }}
          >
            상세
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Table
      rowKey="id"
      dataSource={dataSource}
      columns={columns}
      pagination={false}
      onRow={(r) => ({
        onClick: () => onDetail(r.id), // ✅ row 클릭 → 상세 오버레이
      })}
    />
  );
}
