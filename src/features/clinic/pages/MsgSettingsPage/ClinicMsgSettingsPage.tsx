// PATH: src/features/clinic/pages/MsgSettingsPage/ClinicMsgSettingsPage.tsx
// 클리닉 메시지 설정 — 자동발송 트리거 on/off 및 템플릿 관리

import AutoSendSettingsPanel from "@/features/messages/components/AutoSendSettingsPanel";

const CLINIC_TRIGGERS = [
  "clinic_reminder",
  "clinic_reservation_created",
  "clinic_reservation_changed",
  "counseling_reservation_created",
];

export default function ClinicMsgSettingsPage() {
  return (
    <AutoSendSettingsPanel
      triggerKeys={CLINIC_TRIGGERS}
      title="클리닉 자동발송 설정"
      description="클리닉 예약 완료, 예약 변경, 시작 전 리마인드, 상담 예약 완료 시 학생·학부모에게 자동 발송하는 메시지를 설정합니다."
    />
  );
}
