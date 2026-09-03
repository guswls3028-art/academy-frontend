// PATH: src/app_admin/domains/clinic/pages/MsgSettingsPage/ClinicMsgSettingsPage.tsx
// 클리닉 메시지 설정 — 알림톡 설정

import AutoSendSettingsPanel from "@admin/domains/messages/components/AutoSendSettingsPanel";
import ClinicMessageHistoryPanel from "./ClinicMessageHistoryPanel";

const CLINIC_TRIGGERS = [
  "clinic_reservation_created",
  "clinic_check_in",
  "clinic_check_out",
  "clinic_absent",
  "clinic_self_study_completed",
  "clinic_cancelled",
  "clinic_reservation_changed",
  "clinic_result_notification",
  "clinic_reminder",
];

export default function ClinicMsgSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AutoSendSettingsPanel
        triggerKeys={CLINIC_TRIGGERS}
        channelMode="alimtalk"
        title="알림톡 자동발송"
        description="예약·등원·하원 등 클리닉 이벤트를 승인된 공용 알림톡 양식으로 발송합니다."
      />
      <ClinicMessageHistoryPanel />
    </div>
  );
}
