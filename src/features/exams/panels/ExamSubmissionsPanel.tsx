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
    <div className="space-y-6">
      {/* 상단: 운영 안내 */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
        <div className="text-sm font-semibold text-neutral-100">
          OMR 시험 운영 작업대
        </div>
        <div className="mt-2 text-xs text-neutral-400 leading-relaxed">
          조교는 <b>스캔 파일만 업로드</b>하면 됩니다. <br />
          학생 식별(번호 8자리)은 <b>OMR 마킹값</b>을 서버가 읽습니다. (수동 입력 ❌)
        </div>

        <ol className="mt-3 list-decimal pl-4 text-xs text-neutral-300 space-y-1">
          <li>OMR 스캔본 업로드 (단건/다건)</li>
          <li>서버: 식별/답안추출/채점 워커 자동 실행</li>
          <li>아래 목록에서 처리 상태 확인</li>
          <li>실패한 건은 재업로드/재처리 가능</li>
        </ol>
      </div>

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
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="text-xs text-neutral-400">
          ⚠️ 실패/지연은 정상입니다. <br />
          운영은 “막히지 않고 계속 시도”가 정답입니다. (재업로드/재처리 가능)
        </div>
      </div>
    </div>
  );
}
