// PATH: src/app_admin/domains/clinic/pages/MsgSettingsPage/ClinicMsgSettingsPage.tsx
// 클리닉 메시지 설정 — 알림톡/SMS 분리 설정

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
        description="클리닉 이벤트 발생 시 알림톡(카카오)으로 자동 발송합니다. SMS와 독립적으로 설정할 수 있습니다."
      />
      <AutoSendSettingsPanel
        triggerKeys={CLINIC_TRIGGERS}
        channelMode="sms"
        title="SMS 자동발송"
        description="클리닉 이벤트 발생 시 문자(SMS/LMS)로 자동 발송합니다. 알림톡과 독립적으로 설정할 수 있습니다."
      />
    </div>
  );
}
