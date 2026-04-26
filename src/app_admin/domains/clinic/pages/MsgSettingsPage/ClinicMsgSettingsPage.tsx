// PATH: src/app_admin/domains/clinic/pages/MsgSettingsPage/ClinicMsgSettingsPage.tsx
// 클리닉 메시지 설정 — 알림톡 설정

import AutoSendSettingsPanel from "@admin/domains/messages/components/AutoSendSettingsPanel";

const CLINIC_TRIGGERS = [
  "clinic_reservation_created",
  "clinic_check_in",
  "clinic_absent",
  "clinic_self_study_completed",
  "clinic_cancelled",
  "clinic_reservation_changed",
  "clinic_result_notification",
  "clinic_reminder",
  "counseling_reservation_created",
];

export default function ClinicMsgSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AutoSendSettingsPanel
        triggerKeys={CLINIC_TRIGGERS}
        channelMode="alimtalk"
        title="알림톡 자동발송"
        description="클리닉 이벤트 발생 시 알림톡(카카오)으로 자동 발송합니다."
      />
    </div>
  );
}
