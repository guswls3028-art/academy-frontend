// PATH: src/features/materials/sheets/components/SheetsCreateModal.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import { createSheetApi, type SheetEntity } from "../sheets.api";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (sheet: SheetEntity) => void;
};

const QUESTION_COUNTS = [10, 20, 30] as const;

export function SheetsCreateModal({ open, onClose, onCreated }: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [questionCount, setQuestionCount] = useState<(typeof QUESTION_COUNTS)[number]>(20);

  const canCreate = useMemo(() => subject.trim().length > 0, [subject]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const createMut = useMutation({
    mutationFn: async () =>
      createSheetApi({
        title: title.trim() || "제목 없는 시험지",
        subject: subject.trim(),
        questionCount,
        mode: "preset",
      }),
    onSuccess: (sheet) => {
      onCreated(sheet);
      setTitle("");
      setSubject("");
      setQuestionCount(20);
    },
    onError: (e: any) => {
      alert(e?.message || "시험지 생성 실패");
    },
  });

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="w-full max-w-xl rounded-xl bg-white shadow-lg border"
      >
        <div className="px-4 py-3 border-b flex justify-between items-center">
          <div className="font-semibold">시험지 생성</div>
          <Button type="button" intent="ghost" size="sm" onClick={onClose}>닫기</Button>
        </div>

        <div className="p-4 space-y-4">
          <input
            className="input w-full"
            placeholder="시험지 이름"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <input
            className="input w-full"
            placeholder="과목 (필수)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />

          <div className="flex gap-2">
            {QUESTION_COUNTS.map((qc) => (
              <Button
                key={qc}
                type="button"
                intent={questionCount === qc ? "primary" : "secondary"}
                size="sm"
                onClick={() => setQuestionCount(qc)}
              >
                {qc}
              </Button>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" intent="secondary" size="md" onClick={onClose}>취소</Button>
            <Button
              type="button"
              intent="primary"
              size="md"
              disabled={!canCreate || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "생성 중..." : "생성"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
