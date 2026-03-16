// PATH: src/features/community/pages/ReviewBoardPage.tsx

import { EmptyState } from "@/shared/ui/ds";

export default function ReviewBoardPage() {
  return (
    <div style={{ padding: "var(--space-6)" }}>
      <EmptyState
        scope="panel"
        title="수강후기 기능은 준비 중입니다"
        description="곧 이용하실 수 있습니다."
      />
    </div>
  );
}
