// PATH: src/features/messages/pages/MessageSendPage.tsx
// 발송 — students 도메인 스타일, 메시지 발송 모달 오픈

import { useNavigate } from "react-router-dom";
import { Button, Panel, EmptyState } from "@/shared/ui/ds";
import { useSendMessageModal } from "../context/SendMessageModalContext";

export default function MessageSendPage() {
  const navigate = useNavigate();
  const { openSendMessageModal } = useSendMessageModal();

  return (
    <div className="flex flex-col gap-6">
      <Panel variant="primary" title="메시지 발송" description="학생·학부모에게 SMS 또는 알림톡을 발송합니다.">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            수신자를 선택한 뒤 발송 버튼을 눌러 메시지를 보낼 수 있습니다.
            학생·강의·출결 페이지에서 수신자를 선택하거나, 아래에서 직접 발송 모달을 열 수 있습니다.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              intent="primary"
              onClick={() => openSendMessageModal({ studentIds: [], recipientLabel: "수신자 없음" })}
            >
              메시지 발송
            </Button>
            <Button
              intent="secondary"
              onClick={() => navigate("/admin/students")}
            >
              학생 목록으로 이동
            </Button>
          </div>
        </div>
      </Panel>

      <EmptyState
        scope="panel"
        tone="empty"
        title="발송 방법"
        description={
          <>
            <span className="block mb-2">· 학생·강의·출결 페이지에서 수신자를 선택한 뒤 「메시지 발송」 버튼을 누르세요.</span>
            <span className="block mb-2">· 발송 유형(SMS만 / 알림톡만 / 알림톡→SMS 폴백)을 선택할 수 있습니다.</span>
            <span>· 템플릿을 불러오거나 직접 내용을 입력하여 발송할 수 있습니다.</span>
          </>
        }
      />
    </div>
  );
}
