// PATH: src/features/community/pages/CommunitySettingsPage.tsx
// 커뮤니티 설정 — 자동발송 등

import AutoSendSettingsPanel from "@/features/messages/components/AutoSendSettingsPanel";
import "@/features/community/community.css";

const COMMUNITY_TRIGGERS = [
  "qna_answer_registered",
  "counsel_approved",
];

export default function CommunitySettingsPage() {
  return (
    <div className="max-w-4xl">
      {/* 자동발송 설정 */}
      <section style={{ marginBottom: 32 }}>
        <AutoSendSettingsPanel
          triggerKeys={COMMUNITY_TRIGGERS}
          title="커뮤니티 자동발송 설정"
          description="Q&A 답변 등록, 상담 승인 시 학생·학부모에게 자동 발송하는 메시지를 설정합니다."
        />
      </section>
    </div>
  );
}
