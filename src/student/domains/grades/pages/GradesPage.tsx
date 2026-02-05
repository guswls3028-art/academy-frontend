// src/student/domains/grades/pages/GradesPage.tsx
/**
 * ✅ GradesPage (MVP)
 * - 성적 = 결과 모아보기 허브
 * - 상세/집계는 백엔드가 내려주는 값만 렌더링 (추후 API 연결)
 */

import StudentPageShell from "../../../shared/ui/pages/StudentPageShell";
import EmptyState from "../../../shared/ui/layout/EmptyState";

export default function GradesPage() {
  return (
    <StudentPageShell title="성적" description="시험/과제 결과 요약 허브">
      <EmptyState
        title="성적 도메인 연결 예정"
        description="백엔드 grades API 붙이면 리스트/상세를 바로 확장할 수 있습니다."
      />
    </StudentPageShell>
  );
}
