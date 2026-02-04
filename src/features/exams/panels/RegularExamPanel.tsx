// PATH: src/features/exams/panels/RegularExamPanel.tsx
import { useState } from "react";
import { Exam } from "../api/examApi";
import { ExamAssetManager } from "../components/ExamAssetManager";
import { AnswerKeyEditor } from "../components/AnswerKeyEditor";

/**
 * 운영 시험 패널
 * - 정답/자산은 template에서 resolve되어 read-only
 * - 실제 응시/제출/채점은 backend pipeline으로 연결
 */
export function RegularExamPanel({ exam }: { exam: Exam }) {
  // regular exam은 template 구조를 수정할 수 없음
  const locked = true;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-bold">{exam.title}</h2>
        <div className="text-sm text-gray-500">
          운영 시험 (Template 기반)
        </div>
      </header>

      <ExamAssetManager examId={exam.id} disabled={locked} />

      <AnswerKeyEditor examId={exam.id} disabled={locked} />

      <div className="text-xs text-gray-400">
        * 정답/자산은 템플릿 단일진실 기준으로 조회됩니다.
      </div>
    </div>
  );
}
