// PATH: src/app_admin/domains/staff/pages/SettingsPage/StaffSettingsPage.tsx
// 직원 관리 설정 — 알림톡/SMS 분리 자동발송

import AutoSendSettingsPanel from "@admin/domains/messages/components/AutoSendSettingsPanel";

const STAFF_TRIGGERS = [
  "staff_attendance_summary",
  "staff_expense_report",
  "staff_month_close",
  "staff_payroll_snapshot",
  "staff_payroll_report",
];

export default function StaffSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AutoSendSettingsPanel
        triggerKeys={STAFF_TRIGGERS}
        channelMode="alimtalk"
        title="알림톡 자동발송"
        description="근태 요약, 비용/경비 리포트, 급여 명세서 발행 시 알림톡(카카오)으로 자동 발송합니다."
      />
      <AutoSendSettingsPanel
        triggerKeys={STAFF_TRIGGERS}
        channelMode="sms"
        title="SMS 자동발송"
        description="근태 요약, 비용/경비 리포트, 급여 명세서 발행 시 문자(SMS/LMS)로 자동 발송합니다."
      />
    </div>
  );
}
