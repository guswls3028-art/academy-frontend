// PATH: src/features/exams/components/create/CreateTemplateExamModal.tsx

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createTemplateExam } from "../../api/exams";
import ExamCreateErrorBox from "../ExamCreateErrorBox";
import { feedback } from "@/shared/ui/feedback/feedback";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";

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

  // 모달 열릴 때 폼 리셋
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setSubject("");
    setDescription("");
  }, [open]);

  const m = useMutation({
    mutationFn: createTemplateExam,

    onSuccess: (exam) => {
      const safeId =
        Number(exam?.id) ||
        Number((exam as any)?.exam_id) ||
        0;

      if (!safeId) {
        feedback.warning(
          "시험 생성은 되었지만 ID 확인 실패. 새로고침 후 다시 시도하세요."
        );
        return;
      }

      onCreated(safeId);
      onClose();
    },
  });

  const canSubmit = title.trim() && subject.trim();

  return (
    <AdminModal open={open} onClose={onClose} width={420}>
      <ModalHeader title="시험 템플릿 생성" onClose={onClose} />
      <ModalBody>
        <div className="space-y-4">
          <label className="block text-sm font-medium text-[var(--text-primary)]">
            시험 제목
            <input
              className="mt-1 w-full rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 중간고사 수학"
            />
          </label>

          <label className="block text-sm font-medium text-[var(--text-primary)]">
            과목 (필수)
            <input
              className="mt-1 w-full rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="예: 수학"
            />
          </label>

          <label className="block text-sm font-medium text-[var(--text-primary)]">
            설명 (선택)
            <textarea
              className="mt-1 w-full rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이 템플릿에 대한 설명을 입력하세요"
            />
          </label>

          <ExamCreateErrorBox error={m.error} />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button intent="ghost" onClick={onClose}>
          취소
        </Button>
        <Button
          intent="primary"
          disabled={!canSubmit || m.isPending}
          onClick={() =>
            m.mutate({
              title,
              subject,
              description: description || undefined,
            })
          }
        >
          {m.isPending ? "생성 중..." : "생성"}
        </Button>
      </ModalFooter>
    </AdminModal>
  );
}
