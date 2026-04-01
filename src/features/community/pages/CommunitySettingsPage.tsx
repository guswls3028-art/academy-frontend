// PATH: src/features/community/pages/CommunitySettingsPage.tsx
// 커뮤니티 설정 — 알림톡/SMS 분리 자동발송

import AutoSendSettingsPanel from "@/features/messages/components/AutoSendSettingsPanel";
import "@/features/community/community.css";

const COMMUNITY_TRIGGERS = [
  "qna_answer_registered",
  "counsel_approved",
];

export default function CommunitySettingsPage() {
  return (
    <div className="max-w-4xl flex flex-col gap-6">
      <AutoSendSettingsPanel
        triggerKeys={COMMUNITY_TRIGGERS}
        channelMode="alimtalk"
        title="알림톡 자동발송"
        description="QnA 답변 등록, 상담 승인 시 알림톡(카카오)으로 자동 발송합니다."
      />
      <AutoSendSettingsPanel
        triggerKeys={COMMUNITY_TRIGGERS}
        channelMode="sms"
        title="SMS 자동발송"
        description="QnA 답변 등록, 상담 승인 시 문자(SMS/LMS)로 자동 발송합니다."
      />
    </div>
  );
}
