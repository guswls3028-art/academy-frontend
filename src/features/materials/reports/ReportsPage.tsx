// PATH: src/features/materials/reports/ReportsPage.tsx
import { Section, Panel, EmptyState } from "@/shared/ui/ds";

export default function ReportsPage() {
  return (
    <Section>
      <Panel>
        <div className="panel-body">
          <EmptyState
            title="성적표"
            description="아직 구현되지 않은 기능입니다."
          />
        </div>
      </Panel>
    </Section>
  );
}
