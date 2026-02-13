// PATH: src/features/lectures/components/SessionCreateModal.tsx
// 차시 추가: 선택지 2개(N+1차시 / 보강) + 날짜 + 시간(강의 기본값 / 직접입력)

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { createSession } from "../api/sessions";

type SessionType = "n+1" | "supplement";
type TimeMode = "default" | "custom";

interface Props {
  lectureId: number;
  onClose: () => void;
}

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function SessionCreateModal({ lectureId, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [sessionType, setSessionType] = useState<SessionType | null>(null);
  const [date, setDate] = useState("");
  const [timeMode, setTimeMode] = useState<TimeMode>("default");
  const [timeInput, setTimeInput] = useState("");

  const { data: lecture } = useQuery({
    queryKey: ["lecture", lectureId],
    queryFn: async () => (await api.get(`/lectures/lectures/${lectureId}/`)).data,
    enabled: Number.isFinite(lectureId),
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions", lectureId],
    queryFn: async () => (await api.get(`/lectures/sessions/?lecture=${lectureId}`)).data,
    enabled: Number.isFinite(lectureId),
  });

  const nextOrder = (sessions as { order?: number }[]).length + 1;
  const defaultTitle =
    sessionType === "n+1" ? `${nextOrder}차시` : sessionType === "supplement" ? "보강" : "";

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleSubmit();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionType, date, timeMode, timeInput, busy]);

  function validate(): string | null {
    if (!sessionType) return "차시 유형을 선택하세요.";
    if (!date.trim()) return "날짜를 선택하세요.";
    if (timeMode === "custom" && !timeInput.trim()) return "시간을 입력하세요.";
    return null;
  }

  async function handleSubmit() {
    if (busy) return;
    const err = validate();
    if (err) return alert(err);

    let title = defaultTitle;
    if (timeMode === "custom" && timeInput.trim()) {
      title = `${title} (${timeInput.trim()})`;
    }

    setBusy(true);
    try {
      await createSession(lectureId, title, date || undefined, nextOrder);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const lectureTimeLabel = lecture?.lecture_time?.trim() || "미설정";

  return (
    <AdminModal open={true} onClose={onClose} type="action" width={520}>
      <ModalHeader
        type="action"
        title="차시 추가"
        description="⌘/Ctrl + Enter 로 저장"
      />

      <ModalBody>
        <div className="grid gap-5">
          {/* 선택지 2개: N+1차시 / 보강 */}
          <div>
            <div className="text-[13px] font-semibold text-[var(--color-text-secondary)] mb-2">
              차시 유형
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSessionType("n+1")}
                className={cx(
                  "rounded-xl border-2 p-4 text-left transition",
                  sessionType === "n+1"
                    ? "border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)]"
                    : "border-[var(--border-divider)] bg-[var(--bg-surface)] hover:border-[var(--color-primary)_60%)]"
                )}
              >
                <span className="text-[15px] font-bold text-[var(--color-text-primary)]">
                  N+1차시
                </span>
                <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                  정규 차시 ({nextOrder}차시)
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSessionType("supplement")}
                className={cx(
                  "rounded-xl border-2 p-4 text-left transition",
                  sessionType === "supplement"
                    ? "border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)]"
                    : "border-[var(--border-divider)] bg-[var(--bg-surface)] hover:border-[var(--color-primary)_60%)]"
                )}
              >
                <span className="text-[15px] font-bold text-[var(--color-text-primary)]">
                  보강
                </span>
                <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                  보강 차시
                </div>
              </button>
            </div>
          </div>

          {/* 날짜 */}
          <div>
            <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-1.5">
              날짜
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="ds-input w-full"
              disabled={busy}
            />
          </div>

          {/* 시간: 강의 기본값 사용 / 직접입력 */}
          <div>
            <div className="text-[13px] font-semibold text-[var(--color-text-secondary)] mb-2">
              시간
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-[var(--border-divider)] p-3 hover:bg-[var(--color-bg-surface-soft)]">
                <input
                  type="radio"
                  name="timeMode"
                  checked={timeMode === "default"}
                  onChange={() => setTimeMode("default")}
                  className="w-4 h-4"
                />
                <span className="text-[14px] font-medium text-[var(--color-text-primary)]">
                  강의 기본값 사용
                </span>
                <span className="text-[13px] text-[var(--color-text-muted)]">
                  {lectureTimeLabel}
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-[var(--border-divider)] p-3 hover:bg-[var(--color-bg-surface-soft)]">
                <input
                  type="radio"
                  name="timeMode"
                  checked={timeMode === "custom"}
                  onChange={() => setTimeMode("custom")}
                  className="w-4 h-4"
                />
                <span className="text-[14px] font-medium text-[var(--color-text-primary)] shrink-0">
                  직접입력
                </span>
                {timeMode === "custom" && (
                  <input
                    type="text"
                    placeholder="예: 12:00~13:00"
                    value={timeInput}
                    onChange={(e) => setTimeInput(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="ds-input flex-1 min-w-0"
                    disabled={busy}
                  />
                )}
              </label>
            </div>
          </div>
        </div>
      </ModalBody>

      <ModalFooter
        left={
          <span className="text-[12px] font-semibold text-[var(--color-text-muted)]">
            ESC 로 닫기
          </span>
        }
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={busy}>
              취소
            </Button>
            <Button intent="primary" onClick={handleSubmit} disabled={busy}>
              {busy ? "저장 중…" : "저장"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
