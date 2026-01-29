import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createDday } from "../api/ddays";

interface Props {
  lectureId: number;
  onClose: () => void;
}

export default function DdayModal({ lectureId, onClose }: Props) {
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("12:00");

  const { mutate, isLoading } = useMutation({
    mutationFn: () => {
      const iso = date && time ? `${date}T${time}:00` : `${date}T00:00:00`;
      return createDday({ lecture: lectureId, title, date: iso });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ddays", lectureId] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-[var(--bg-surface)] p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
          D-Day 추가
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="mb-1 block font-medium text-[var(--text-secondary)]">
              제목
            </label>
            <input
              className="w-full rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="mb-1 block font-medium text-[var(--text-secondary)]">
                날짜
              </label>
              <input
                type="date"
                className="w-full rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 py-2"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="w-32">
              <label className="mb-1 block font-medium text-[var(--text-secondary)]">
                시간
              </label>
              <input
                type="time"
                className="w-full rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 py-2"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[var(--border-divider)] px-3 py-2 text-[var(--text-secondary)]"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-white disabled:opacity-60"
            >
              {isLoading ? "저장 중..." : "추가"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
