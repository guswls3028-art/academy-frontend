// PATH: src/features/community/pages/ReviewBoardPage.tsx

import { EmptyState } from "@/shared/ui/ds";

export default function ReviewBoardPage() {
  return (
    <div style={{ padding: "var(--space-6)" }}>
      <EmptyState
        scope="panel"
        title="아직 등록된 후기가 없습니다."
        description="학생들이 수강 후기를 작성하면 여기에 표시됩니다."
      />
    </div>
  );
}
