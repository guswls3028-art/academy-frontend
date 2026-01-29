// PATH: src/features/staff/pages/StaffDetailPage.tsx

import { useParams } from "react-router-dom";
import { Tabs } from "antd";

import StaffHeader from "../components/StaffHeader";
import StaffInfoPanel from "../components/StaffInfoPanel";

import StaffSummaryTab from "../tabs/StaffSummaryTab";
import StaffWorkRecordsTab from "../tabs/StaffWorkRecordsTab";
import StaffExpensesTab from "../tabs/StaffExpensesTab";
import StaffPayrollSnapshotTab from "../tabs/StaffPayrollSnapshotTab";
import StaffPayrollHistoryTab from "../tabs/StaffPayrollHistoryTab";
import StaffWagesTab from "../tabs/StaffWagesTab";
import StaffProfileTab from "../tabs/StaffProfileTab";
import StaffReportTab from "../tabs/StaffReportTab";

import { useStaffDetail } from "../hooks/useStaffDetail";

export default function StaffDetailPage() {
  const { staffId } = useParams<{ staffId: string }>();
  const { staff, isLoading } = useStaffDetail(Number(staffId));

  if (isLoading || !staff) return null;

  return (
    <div>
      {/* 🔹 헤더: 직원 식별용 (유지) */}
      <StaffHeader staff={staff} />

      {/* 🔹 기본 정보 패널 (유지) */}
      <StaffInfoPanel staff={staff} />

      {/* 🔹 Detail Tabs (실사용 기준 재정렬) */}
      <Tabs
        defaultActiveKey="summary"
        items={[
          {
            key: "summary",
            label: "요약",
            children: <StaffSummaryTab staff={staff} />,
          },
          {
            key: "work-records",
            label: "근무 기록",
            children: <StaffWorkRecordsTab staff={staff} />,
          },
          {
            key: "expenses",
            label: "비용",
            children: <StaffExpensesTab staff={staff} />,
          },
          {
            key: "payroll-snapshot",
            label: "급여 스냅샷",
            children: <StaffPayrollSnapshotTab staff={staff} />,
          },
          {
            key: "payroll-history",
            label: "급여 히스토리",
            children: <StaffPayrollHistoryTab staff={staff} />,
          },
          {
            key: "report",
            label: "리포트",
            children: <StaffReportTab staff={staff} />,
          },
          {
            key: "wages",
            label: "시급/근무유형",
            children: <StaffWagesTab staff={staff} />,
          },
          {
            key: "profile",
            label: "기본 정보",
            children: <StaffProfileTab staff={staff} />,
          },
        ]}
      />
    </div>
  );
}
