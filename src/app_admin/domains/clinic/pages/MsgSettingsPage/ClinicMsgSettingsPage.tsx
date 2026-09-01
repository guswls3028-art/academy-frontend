// PATH: src/app_admin/domains/clinic/pages/MsgSettingsPage/ClinicMsgSettingsPage.tsx
// 클리닉 메시지 설정 — 알림톡 설정

import AutoSendSettingsPanel from "@admin/domains/messages/components/AutoSendSettingsPanel";
import ClinicMessageHistoryPanel from "./ClinicMessageHistoryPanel";

const CLINIC_TRIGGERS = [
  "clinic_reservation_created",
  "clinic_check_in",
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
        description="승인된 클리닉 전용 양식이 있는 이벤트만 알림톡으로 발송합니다. 하원 처리는 기록만 남기며 발송하지 않습니다."
      />
      <ClinicMessageHistoryPanel />
    </div>
  );
}
