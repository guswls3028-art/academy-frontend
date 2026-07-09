// PATH: src/app_admin/domains/materials/messages/MessagesPage.tsx
import { useNavigate } from "react-router-dom";
import { Section, Panel, EmptyState, Button } from "@/shared/ui/ds";

export default function MessagesPage() {
  const navigate = useNavigate();

  return (
    <Section>
      <Panel>
        <div className="panel-body">
          <EmptyState
            title="알림톡 문구와 발송 이력은 메시지 메뉴에서 관리합니다"
            description="자료 메뉴 안의 메시지 보관함은 아직 별도 기능으로 분리하지 않았습니다. 운영 중인 알림톡 본문, 자동 발송 설정, 발송 이력은 메시지 메뉴에서 관리합니다."
            actions={
              <div className="flex flex-wrap justify-center gap-2">
                <Button intent="primary" size="md" onClick={() => navigate("/admin/message/templates")}>
                  문구 관리
                </Button>
                <Button intent="secondary" size="md" onClick={() => navigate("/admin/message/log")}>
                  발송 이력 보기
                </Button>
              </div>
            }
          />
        </div>
      </Panel>
    </Section>
  );
}
