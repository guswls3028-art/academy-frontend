// PATH: src/app_admin/domains/community/pages/CommunitySettingsPage.tsx
// 커뮤니티 설정 — 알림톡 자동발송

import AutoSendSettingsPanel from "@admin/domains/messages/components/AutoSendSettingsPanel";
import "@admin/domains/community/community.css";

const COMMUNITY_TRIGGERS = [
  "qna_answered",
  "counsel_answered",
];

export default function CommunitySettingsPage() {
  return (
    <div className="max-w-4xl flex flex-col gap-6">
      <AutoSendSettingsPanel
        triggerKeys={COMMUNITY_TRIGGERS}
        channelMode="alimtalk"
        title="알림톡 자동발송"
        description="QnA 답변 등록, 상담 답변 등록 시 알림톡(카카오)으로 자동 발송합니다."
      />
    </div>
  );
}
