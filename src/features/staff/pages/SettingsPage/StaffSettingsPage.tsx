// PATH: src/features/staff/pages/SettingsPage/StaffSettingsPage.tsx
// 직원 관리 설정 — 자동발송 트리거 on/off 및 템플릿 관리

import AutoSendSettingsPanel from "@/features/messages/components/AutoSendSettingsPanel";

const STAFF_TRIGGERS = [
  "staff_attendance_summary",
  "staff_expense_report",
  "staff_month_close",
  "staff_payroll_snapshot",
  "staff_payroll_report",
];

export default function StaffSettingsPage() {
  return (
    <AutoSendSettingsPanel
      triggerKeys={STAFF_TRIGGERS}
      title="직원 자동발송 설정"
      description="근태 요약, 비용/경비 리포트, 월 마감 완료, 급여 스냅샷, 급여 명세서 발행 시 해당 직원에게 자동 발송하는 메시지를 설정합니다."
    />
  );
}
