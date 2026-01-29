// PATH: src/features/staff/components/StaffTable.tsx
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Staff } from "../api/staff.api";
import { RoleBadge } from "./StatusBadge";

type Props = {
  staffs: Staff[];
  onRowClick?: (staffId: number) => void;
};

export default function StaffTable({ staffs, onRowClick }: Props) {
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
    {
      title: "전화번호",
      dataIndex: "phone",
      render: (v) => v || "-",
    },
    {
      title: "역할",
      dataIndex: "is_manager",
      render: (v) => <RoleBadge isManager={!!v} />,
    },
    {
      title: "급여",
      dataIndex: "pay_type",
      render: (v) => (v === "HOURLY" ? "시급" : "월급"),
    },
  ];

  return (
    <Table
      rowKey="id"
      dataSource={staffs}
      columns={columns}
      pagination={false}
      onRow={(r) => ({
        onClick: () => onRowClick?.(r.id),
      })}
    />
  );
}
