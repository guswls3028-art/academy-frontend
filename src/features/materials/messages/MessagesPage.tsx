// PATH: src/features/materials/messages/MessagesPage.tsx
import { Section, Panel, EmptyState } from "@/shared/ui/ds";

export default function MessagesPage() {
  return (
    <Section>
      <Panel>
        <div className="panel-body">
          <EmptyState
            title="메시지"
            description="아직 구현되지 않은 기능입니다."
          />
        </div>
      </Panel>
    </Section>
  );
}
