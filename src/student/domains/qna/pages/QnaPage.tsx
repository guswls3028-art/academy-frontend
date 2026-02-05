// src/student/domains/qna/pages/QnaPage.tsx
/**
 * ✅ QnaPage (MVP)
 * - Q&A 목록/작성은 추후 연결
 */

import StudentPageShell from "../../../shared/ui/pages/StudentPageShell";
import EmptyState from "../../../shared/ui/layout/EmptyState";

export default function QnaPage() {
  return (
    <StudentPageShell title="Q&A" description="질문/답변">
      <EmptyState
        title="Q&A 도메인 연결 예정"
        description="목록/작성/상세 API 연결 시 바로 확장합니다."
      />
    </StudentPageShell>
  );
}
