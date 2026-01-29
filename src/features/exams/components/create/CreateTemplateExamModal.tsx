// PATH: src/features/exams/components/create/CreateTemplateExamModal.tsx

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createTemplateExam } from "../../api/exams";
import ExamCreateErrorBox from "../ExamCreateErrorBox";

export default function CreateTemplateExamModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (examId: number) => void;
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const m = useMutation({
    mutationFn: createTemplateExam,

    onSuccess: (exam) => {
      /**
       * ✅ 핵심 FIX
       * - 서버는 id
       * - sessions 패널은 exam_id 기반
       * → 여기서 통일
       */
      const safeId =
        Number(exam?.id) ||
        Number((exam as any)?.exam_id) ||
        0;

      if (!safeId) {
        alert(
          "시험 생성은 되었지만 ID 확인 실패. 새로고침 후 다시 시도하세요."
        );
        return;
      }

      onCreated(safeId);
      onClose();
    },
  });

  if (!open) return null;

  const canSubmit = title.trim() && subject.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[420px] rounded bg-surface p-6 space-y-4">
        <h2 className="text-lg font-semibold">
          시험 템플릿 생성
        </h2>

        <label className="text-sm">
          시험 제목
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="text-sm">
          과목 (필수)
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </label>

        <label className="text-sm">
          설명 (선택)
          <textarea
            className="mt-1 w-full rounded border px-3 py-2"
            value={description}
            onChange={(e) =>
              setDescription(e.target.value)
            }
          />
        </label>

        <ExamCreateErrorBox error={m.error} />

        <div className="flex justify-end gap-2 pt-2">
          <button className="btn" onClick={onClose}>
            취소
          </button>

          <button
            className="btn-primary"
            disabled={!canSubmit || m.isPending}
            onClick={() =>
              m.mutate({
                title,
                subject,
                description:
                  description || undefined,
              })
            }
          >
            {m.isPending
              ? "생성 중..."
              : "생성"}
          </button>
        </div>
      </div>
    </div>
  );
}
