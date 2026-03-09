// PATH: src/features/exams/panels/ExamSubmissionsPanel.tsx
/**
 * ExamSubmissionsPanel - "실제 작업대"
 * - 조교 입력칸 없음: 파일만 드롭/선택
 * - 실패해도 UX 막지 않음 (항상 재시도 가능)
 * - 업로드 -> 목록 자동 갱신
 */

import { useState } from "react";
import AdminOmrUploadSection from "@/features/submissions/components/AdminOmrUploadSection";
import AdminSubmissionsPanel from "@/features/submissions/components/AdminSubmissionsPanel";

type Props = {
  examId: number;
};

export default function ExamSubmissionsPanel({ examId }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className=”space-y-6”>
      {/* 상단: 운영 안내 */}
      <section className=”rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] p-5”>
        <div className=”text-sm font-semibold text-[var(--color-text-primary)]”>
          OMR 시험 운영 작업대
        </div>
        <div className=”mt-1.5 text-xs text-[var(--color-text-secondary)] leading-relaxed”>
          조교는 <b>스캔 파일만 업로드</b>하면 됩니다.
          학생 식별(번호 8자리)은 <b>OMR 마킹값</b>을 서버가 읽습니다.
        </div>
        <ol className=”mt-3 list-decimal pl-4 text-xs text-[var(--color-text-secondary)] space-y-1”>
          <li>OMR 스캔본 업로드 (단건/다건)</li>
          <li>서버: 식별 / 답안 추출 / 채점 워커 자동 실행</li>
          <li>아래 목록에서 처리 상태 확인</li>
          <li>실패한 건은 재업로드 / 재처리 가능</li>
        </ol>
      </section>

      {/* 1) 업로드 박스 */}
      <AdminOmrUploadSection
        examId={examId}
        onUploaded={() => setRefreshKey((k) => k + 1)}
      />

      {/* 2) 제출/처리 상태 */}
      <AdminSubmissionsPanel
        examId={examId}
        refreshKey={refreshKey}
      />

      {/* 하단: 실패도 정상 흐름 */}
      <section className=”rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-3”>
        <p className=”text-xs text-[var(--color-text-muted)]”>
          실패 · 지연은 정상 흐름입니다. 처리 중 오류가 발생해도 재업로드 · 재처리가 언제든 가능합니다.
        </p>
      </section>
    </div>
  );
}
