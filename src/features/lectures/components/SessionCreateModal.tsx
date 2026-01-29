// src/features/lectures/components/SessionCreateModal.tsx

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";

interface Props {
  lectureId: number;
  sessionCount: number;
  onClose: () => void;
}

export default function SessionCreateModal({
  lectureId,
  sessionCount,
  onClose,
}: Props) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState("");

  if (!Number.isFinite(lectureId)) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="rounded bg-[var(--bg-surface)] p-6 text-red-500 shadow">
          잘못된 강의 ID
        </div>
      </div>
    );
  }

  const safeCount = Number.isFinite(sessionCount) ? sessionCount : 0;
  const title = `${safeCount + 1}차시`;

  const { mutate, isPending, isError } = useMutation({
    mutationFn: async () => {
      await api.post("/lectures/sessions/", {
        lecture: lectureId,
        title,
        date,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["lecture-sessions", lectureId],
      });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[360px] rounded-lg bg-[var(--bg-surface)] p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
          새 차시 생성
        </h2>

        {isError && (
          <div className="mb-2 text-sm text-[var(--color-danger)]">
            생성에 실패했습니다.
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!date) return;
            mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
              차시 제목
            </label>
            <div className="rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 py-2 text-sm">
              {title}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
              날짜
            </label>
            <input
              type="date"
              className="w-full rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 py-2 text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="
                rounded-md px-3 py-1.5 text-sm
                border border-[var(--border-divider)]
                bg-[var(--bg-surface)]
                text-[var(--text-secondary)]
                hover:bg-[var(--bg-surface-soft)]
              "
            >
              취소
            </button>

            <button
              type="submit"
              disabled={isPending}
              className="
                rounded-md px-3 py-1.5 text-sm
                bg-[var(--color-primary)]
                text-white
                disabled:opacity-60
              "
            >
              생성
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
