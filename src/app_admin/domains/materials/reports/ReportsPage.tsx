// PATH: src/app_admin/domains/materials/reports/ReportsPage.tsx
import { useNavigate } from "react-router-dom";
import { Section, Panel, EmptyState, Button } from "@/shared/ui/ds";

export default function ReportsPage() {
  const navigate = useNavigate();

  return (
    <Section>
      <Panel>
        <div className="panel-body">
          <EmptyState
            title="성적표는 차시 성적탭에서 바로 확인할 수 있습니다"
            description="현재 성적표 출력과 알림톡 발송은 강의 차시의 성적탭에서 학생별 점수와 함께 검토하는 흐름이 정본입니다. 이 메뉴는 통합 성적표 보관함으로 확장될 예정입니다."
            actions={
              <Button intent="primary" size="md" onClick={() => navigate("/admin/lectures")}>
                강의에서 성적표 열기
              </Button>
            }
          />
        </div>
      </Panel>
    </Section>
  );
}
