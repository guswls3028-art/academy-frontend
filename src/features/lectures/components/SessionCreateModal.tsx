// PATH: src/features/lectures/components/SessionCreateModal.tsx
// 차시 추가: 2차시/보강을 큰 블록으로 선택. 날짜·시간은 강의 기본값 사용 | 직접선택(전역 달력/시간 UI).

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { DatePicker } from "@/shared/ui/date";
import { TimeRangeInput } from "@/shared/ui/time";
import { createSession } from "../api/sessions";

type SessionType = "n+1" | "supplement";
type DateMode = "default" | "custom";
type TimeMode = "default" | "custom";

interface Props {
  lectureId: number;
  onClose: () => void;
}

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/** lecture_time에서 시간 부분만 추출 (예: "매주 토요일 12:30~14:30" → "12:30~14:30") */
function extractTimeFromLectureTime(lectureTime: string | null | undefined): string {
  if (!lectureTime?.trim()) return "";
  const s = lectureTime.trim();
  const match = s.match(/\d{1,2}:\d{2}\s*~?\s*-?\s*\d{1,2}:\d{2}/);
  return match ? match[0].replace(/\s/g, "") : s;
}

/** 마지막 차시 날짜 + 7일 (다음 주 같은 요일) */
function nextWeekDate(lastDateStr: string | null | undefined): string {
  if (!lastDateStr) return "";
  const d = new Date(lastDateStr + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + 7);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function SessionCreateModal({ lectureId, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [sessionType, setSessionType] = useState<SessionType | null>(null);
  const [dateMode, setDateMode] = useState<DateMode>("default");
  const [date, setDate] = useState("");
  const [timeMode, setTimeMode] = useState<TimeMode>("default");
  const [timeInput, setTimeInput] = useState("");

  const { data: lecture } = useQuery({
    queryKey: ["lecture", lectureId],
    queryFn: async () => (await api.get(`/lectures/lectures/${lectureId}/`)).data,
    enabled: Number.isFinite(lectureId),
  });

  const { data: sessionsData } = useQuery({
    queryKey: ["sessions", lectureId],
    queryFn: async () => (await api.get(`/lectures/sessions/?lecture=${lectureId}`)).data,
    enabled: Number.isFinite(lectureId),
  });

  const sessionsList = useMemo(() => {
    const raw = sessionsData;
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray((raw as { results?: unknown[] }).results)) return (raw as { results: unknown[] }).results;
    return [];
  }, [sessionsData]);

  const sortedSessions = useMemo(
    () => (sessionsList as { order?: number; date?: string | null }[]).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [sessionsList]
  );
  const nextOrder = sortedSessions.length + 1;
  const lastSessionWithDate = useMemo(
    () => sortedSessions.filter((s) => s.date).slice(-1)[0],
    [sortedSessions]
  );
  const defaultDateFromLecture = useMemo(
    () => nextWeekDate(lastSessionWithDate?.date ?? lecture?.start_date ?? null),
    [lastSessionWithDate?.date, lecture?.start_date]
  );

  const defaultTitle =
    sessionType === "n+1" ? `${nextOrder}차시` : sessionType === "supplement" ? "보강" : "";
  const lectureTimeRaw = lecture?.lecture_time?.trim() || "";
  const lectureTimeExtract = useMemo(() => extractTimeFromLectureTime(lecture?.lecture_time), [lecture?.lecture_time]);

  // 보강 선택 시 무조건 직접입력
  useEffect(() => {
    if (sessionType === "supplement") setTimeMode("custom");
  }, [sessionType]);

  // N+1 + 강의 기본값 사용 시 날짜 자동 채우기 (다음 주 같은 요일)
  useEffect(() => {
    if (sessionType === "n+1" && timeMode === "default" && defaultDateFromLecture) {
      setDate(defaultDateFromLecture);
    }
  }, [sessionType, timeMode, defaultDateFromLecture]);

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
    if (sessionType === "supplement" || timeMode === "custom") {
      if (!timeInput.trim()) return "시간을 입력하세요.";
    }
    return null;
  }

  async function handleSubmit() {
    if (busy) return;
    const err = validate();
    if (err) return alert(err);

    let title = defaultTitle;
    const timeStr =
      sessionType === "supplement" || timeMode === "custom"
        ? timeInput.trim()
        : lectureTimeExtract || lectureTimeRaw;
    if (timeStr) title = `${title} (${timeStr})`;

    setBusy(true);
    try {
      await createSession(lectureId, title, date || undefined, nextOrder);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const isSupplement = sessionType === "supplement";
  const showDefaultTimeOption = sessionType === "n+1";

  return (
    <AdminModal open={true} onClose={onClose} type="action" width={520}>
      <ModalHeader
        type="action"
        title="차시 추가"
        description="⌘/Ctrl + Enter 로 저장"
      />

      <ModalBody>
        <div className="grid gap-5">
          {/* 선택지 2개: N차시 / 보강 */}
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
                    : "border-[var(--border-divider)] bg-[var(--bg-surface)] hover:border-[color-mix(in_srgb,var(--color-primary)_60%,transparent)]"
                )}
              >
                <span className="text-[15px] font-bold text-[var(--color-text-primary)]">
                  {nextOrder}차시
                </span>
                <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                  정규 차시 (매주 강의일 기준)
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSessionType("supplement")}
                className={cx(
                  "rounded-xl border-2 p-4 text-left transition",
                  sessionType === "supplement"
                    ? "border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)]"
                    : "border-[var(--border-divider)] bg-[var(--bg-surface)] hover:border-[color-mix(in_srgb,var(--color-primary)_60%,transparent)]"
                )}
              >
                <span className="text-[15px] font-bold text-[var(--color-text-primary)]">
                  보강
                </span>
                <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                  보강 차시 (직접입력)
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
            {showDefaultTimeOption && timeMode === "default" && defaultDateFromLecture && (
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                강의 기본값 사용 시: 다음 주 같은 요일 ({defaultDateFromLecture})로 자동 입력됨. 필요 시 수정 가능.
              </p>
            )}
          </div>

          {/* 시간: N+1은 강의 기본값 사용 / 직접입력, 보강은 직접입력만 */}
          <div>
            <div className="text-[13px] font-semibold text-[var(--color-text-secondary)] mb-2">
              시간
            </div>
            <div className="flex flex-col gap-2">
              {showDefaultTimeOption && (
                <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-[var(--border-divider)] p-3 hover:bg-[var(--color-bg-surface-soft)]">
                  <input
                    type="radio"
                    name="timeMode"
                    checked={timeMode === "default"}
                    onChange={() => setTimeMode("default")}
                    className="w-4 h-4"
                  />
                  <span className="text-[14px] font-medium text-[var(--color-text-primary)] shrink-0">
                    강의 기본값 사용
                  </span>
                  <span className="text-[13px] text-[var(--color-text-muted)] truncate">
                    {lectureTimeRaw || "미설정"}
                  </span>
                </label>
              )}
              <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-[var(--border-divider)] p-3 hover:bg-[var(--color-bg-surface-soft)]">
                <input
                  type="radio"
                  name="timeMode"
                  checked={timeMode === "custom" || isSupplement}
                  onChange={() => setTimeMode("custom")}
                  disabled={isSupplement}
                  className="w-4 h-4"
                />
                <span className="text-[14px] font-medium text-[var(--color-text-primary)] shrink-0">
                  {isSupplement ? "직접입력 (보강은 필수)" : "직접입력"}
                </span>
                {(timeMode === "custom" || isSupplement) && (
                  <input
                    type="text"
                    placeholder="예: 12:30~14:30"
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
