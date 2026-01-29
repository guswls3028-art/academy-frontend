/**
 * PATH: src/features/exams/panels/AdminExam
 *
 * ✅ STEP 1 보조 UX
 *
 * 설계 계약:
 * - Session → Exam 진입 시 Results 탭 자동 활성화
 * - exams 도메인은 results 내부 로직을 침범하지 않는다
 */

import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function AdminExamDetail() {
  const [searchParams] = useSearchParams();

  /**
   * Session 경로에서 진입한 경우
   * Results 탭 자동 선택
   */
  useEffect(() => {
    if (searchParams.get("from") === "session") {
      setActiveTab("results"); // 기존 탭 상태 setter 유지
    }
  }, [searchParams]);

  // ... 기존 코드 전체 유지
}
