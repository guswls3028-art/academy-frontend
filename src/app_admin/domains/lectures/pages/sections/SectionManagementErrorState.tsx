import { Button, EmptyState } from "@/shared/ui/ds";
import { DomainLayout } from "@/shared/ui/layout";

export default function SectionManagementErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <DomainLayout
      title="반 편성"
      description="강의의 반과 학생 편성을 관리합니다."
      breadcrumbs={[
        { label: "강의", to: "/workspace/lectures" },
        { label: "반 편성" },
      ]}
    >
      <EmptyState
        scope="page"
        tone="error"
        title="반 편성 정보를 불러오지 못했습니다"
        description="현재 편성을 빈 상태로 오인해 덮어쓰지 않도록 복구 전에는 이동·해제·자동배정을 할 수 없습니다."
        actions={(
          <Button intent="secondary" onClick={onRetry}>
            다시 시도
          </Button>
        )}
      />
    </DomainLayout>
  );
}
