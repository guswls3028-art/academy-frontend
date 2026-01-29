// PATH: src/features/homework/components/CreateHomeworkModal.tsx
// ------------------------------------------------------------
// CreateHomeworkModal ✅ FINAL (시험 생성 UX와 동일한 위치에서 사용)
// ------------------------------------------------------------
// 책임:
// - 과제 생성 UI
// - 생성 성공 시 onCreated(newId) 호출
//
// ✅ 백엔드 편차 흡수:
// - session_id / session 둘 다 전송
// ------------------------------------------------------------

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { createHomework } from "../api/homeworks";

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: number;
  onCreated: (newId: number) => void;
};

type HomeworkStatus = "DRAFT" | "OPEN" | "CLOSED";

export default function CreateHomeworkModal({
  open,
  onClose,
  sessionId,
  onCreated,
}: Props) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<HomeworkStatus>("DRAFT");

  // 모달 열릴 때 기본값 리셋
  useEffect(() => {
    if (open) {
      setTitle("");
      setStatus("DRAFT");
    }
  }, [open]);

  const m = useMutation({
    mutationFn: async () => {
      const res = await createHomework({
        session_id: sessionId,
        title: title.trim(),
        status,
      });
      return res;
    },
    onSuccess: (data: any) => {
      const newId = Number(data?.id);
      if (Number.isFinite(newId) && newId > 0) {
        onCreated(newId);
        onClose();
        return;
      }

      // id가 다른 키로 오면 여기도 흡수
      const fallbackId = Number(data?.homework_id ?? data?.pk ?? NaN);
      if (Number.isFinite(fallbackId) && fallbackId > 0) {
        onCreated(fallbackId);
        onClose();
        return;
      }

      alert(
        "과제 생성은 성공했지만 응답에서 id를 찾지 못했습니다.\n백엔드 응답 포맷을 확인하세요."
      );
    },
    onError: (e: any) => {
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "과제 생성 실패 (API 연결 확인 필요)";
      alert(detail);
    },
  });

  if (!open) return null;

  const disabled =
    m.isPending || title.trim().length === 0 || !(sessionId > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-xl bg-[var(--bg-surface)] p-5 shadow-lg">
        <div className="mb-3 text-lg font-semibold text-[var(--text-primary)]">
          과제 생성
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">
              제목
            </div>
            <input
              className="w-full rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              placeholder="예) 1주차 과제"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">
              상태
            </div>
            <select
              className="w-full rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-primary)]"
              value={status}
              onChange={(e) => setStatus(e.target.value as HomeworkStatus)}
            >
              <option value="DRAFT">DRAFT</option>
              <option value="OPEN">OPEN</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </div>

          <div className="pt-2 text-xs text-[var(--text-muted)]">
            session_id: {sessionId}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded border border-[var(--border-divider)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)]"
            onClick={onClose}
            disabled={m.isPending}
          >
            취소
          </button>

          <button
            className="rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => m.mutate()}
            disabled={disabled}
          >
            {m.isPending ? "생성 중..." : "생성"}
          </button>
        </div>
      </div>
    </div>
  );
}
