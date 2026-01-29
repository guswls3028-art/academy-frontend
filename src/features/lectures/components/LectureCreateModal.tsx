// src/features/lectures/components/LectureCreateModal.tsx
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";

interface Props {
  onClose: () => void;
}

interface CreateLecturePayload {
  title: string;
  name: string;
  subject: string;
  description: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export default function LectureCreateModal({ onClose }: Props) {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { mutate, isPending, isError } = useMutation({
    mutationFn: async (payload: CreateLecturePayload) => {
      await api.post("/lectures/lectures/", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lectures"] });
      onClose();
    },
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    mutate({
      title,
      name,
      subject,
      description,
      start_date: startDate,
      end_date: endDate,
      is_active: true,
    });
  };

  // ✅ 학생앱 스타일 기준 input class (전역CSS 없이 인라인으로만)
  const inputCls =
    "w-full rounded-md px-3 py-2 text-sm " +
    "border border-[var(--border-divider)] " +
    "bg-[var(--bg-app)] text-[var(--text-primary)] " +
    "placeholder:text-[var(--text-muted)] " +
    "focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]";

  const labelCls = "mb-1 block text-sm font-medium text-[var(--text-secondary)]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[500px] rounded-xl bg-[var(--bg-surface)] p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
          강의 추가
        </h2>

        {isError && (
          <div className="mb-3 text-sm text-[var(--color-danger)]">
            등록 중 오류가 발생했습니다.
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>강의 이름</label>
            <input
              type="text"
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label className={labelCls}>담당 강사</label>
            <input
              type="text"
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls}>과목</label>
            <input
              type="text"
              className={inputCls}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls}>설명</label>
            <textarea
              className={
                inputCls +
                " h-24 resize-none"
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className={labelCls}>시작일</label>
              <input
                type="date"
                className={inputCls}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="flex-1">
              <label className={labelCls}>종료일</label>
              <input
                type="date"
                className={inputCls}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="
                px-4 py-2 rounded-md text-sm
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
                px-4 py-2 rounded-md text-sm font-semibold
                bg-[var(--color-primary)]
                text-white
                hover:opacity-90
                disabled:opacity-60
              "
            >
              {isPending ? "등록 중..." : "등록"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
