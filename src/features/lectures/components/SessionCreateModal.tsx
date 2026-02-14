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
import { SessionBlockView } from "@/shared/ui/session-block";

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
  // 정규차시끼리만 날짜 연속 — 보강은 제외하고 마지막 정규차시 날짜 + 7일
  const lastRegularSessionWithDate = useMemo(() => {
    const regular = (sortedSessions as { title?: string; date?: string | null }[]).filter(
      (s) => s.date && !s.title?.includes?.("보강")
    );
    return regular.slice(-1)[0];
  }, [sortedSessions]);
  const defaultDateFromLecture = useMemo(
    () =>
      nextWeekDate(lastRegularSessionWithDate?.date ?? (lecture as { start_date?: string | null })?.start_date ?? null),
    [lastRegularSessionWithDate?.date, lecture?.start_date]
  );

  const defaultTitle =
    sessionType === "n+1" ? `${nextOrder}차시` : sessionType === "supplement" ? "보강" : "";
  const lectureTimeRaw = lecture?.lecture_time?.trim() || "";
  const lectureTimeExtract = useMemo(() => extractTimeFromLectureTime(lecture?.lecture_time), [lecture?.lecture_time]);

  // 보강 선택 시 날짜·시간 모두 직접선택만 가능
  useEffect(() => {
    if (sessionType === "supplement") {
      setDateMode("custom");
      setTimeMode("custom");
    } else if (sessionType === "n+1") {
      // N차시 선택 시 항상 기본 선택값으로 초기화 (보강→2차시 전환 시 복원)
      setDateMode("default");
      setTimeMode("default");
    }
  }, [sessionType]);

  // 직접선택으로 전환 시 시간이 비어 있으면 강의 기본 시간을 초기값으로 설정 (버튼 활성화용)
  useEffect(() => {
    if ((timeMode === "custom" || sessionType === "supplement") && !timeInput.trim() && lectureTimeExtract) {
      setTimeInput(lectureTimeExtract);
    }
  }, [timeMode, sessionType, lectureTimeExtract]); // timeInput 제외하여 무한 루프 방지

  // N+1 + 날짜 기본값 사용 시 날짜 자동 채우기 (다음 주 같은 요일)
  useEffect(() => {
    if (sessionType === "n+1" && dateMode === "default" && defaultDateFromLecture) {
      setDate(defaultDateFromLecture);
    }
  }, [sessionType, dateMode, defaultDateFromLecture]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleSubmit();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionType, date, timeMode, timeInput, busy]);

  const effectiveDate = dateMode === "default" ? (defaultDateFromLecture || date) : date;

  function validate(): string | null {
    if (!sessionType) return "차시 유형을 선택하세요.";
    if (!effectiveDate?.trim()) return "날짜를 선택하세요.";
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
      await createSession(lectureId, title, effectiveDate || undefined, nextOrder);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const isSupplement = sessionType === "supplement";
  const showDefaultDateOption = sessionType === "n+1";
  const showDefaultTimeOption = sessionType === "n+1";

  return (
    <AdminModal open={true} onClose={onClose} type="action" width={620}>
      <ModalHeader
        type="action"
        title="차시 추가"
        description="⌘/Ctrl + Enter 로 저장"
      />

      <ModalBody>
        <div
          className="grid gap-6 w-full max-w-full box-border"
          style={{
            width: "100%",
            minWidth: 0,
            overflowX: "hidden",
            overflowY: "auto",
            maxHeight: "calc(100vh - 200px)",
          }}
        >
          {/* 차시 유형: 2차시 / 보강 — 카드형 블록으로 직관적 선택 */}
          <div>
            <div className="text-[13px] font-semibold text-[var(--color-text-secondary)] mb-3">
              차시 유형
            </div>
            <div className="grid grid-cols-2 gap-5">
              <button
                type="button"
                onClick={() => setSessionType("n+1")}
                className={cx(
                  "session-block session-block--n1",
                  sessionType === "n+1" && "session-block--selected"
                )}
                aria-pressed={sessionType === "n+1"}
              >
                <span className="session-block__check" aria-hidden>✓</span>
                <span className="session-block__title">{nextOrder}차시</span>
                <span className="session-block__desc">정규 차시 추가 · 기본 날짜/시간 사용</span>
              </button>
              <button
                type="button"
                onClick={() => setSessionType("supplement")}
                className={cx(
                  "session-block session-block--supplement",
                  sessionType === "supplement" && "session-block--selected"
                )}
                aria-pressed={sessionType === "supplement"}
              >
                <span className="session-block__check" aria-hidden>✓</span>
                <span className="session-block__title">보강</span>
                <span className="session-block__desc">보강 차시 · 날짜·시간 직접 선택</span>
              </button>
            </div>
          </div>

          {/* 차시 유형 선택 후에만 날짜·시간 섹션 표시 */}
          {sessionType && (
          <>
          {/* 날짜: 강의 기본값 사용 | 직접선택 (보강 시 기본값 비활성화) */}
          <div>
            <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-2">
              날짜
            </label>
            <div className="flex flex-col gap-2">
              {showDefaultDateOption && (
                <label
                  className={cx(
                    "session-option-row flex items-center gap-3 rounded-xl border p-3 transition",
                    isSupplement
                      ? "cursor-not-allowed border-[var(--border-divider)] bg-[var(--color-bg-surface-soft)] opacity-60"
                      : "cursor-pointer border-[var(--border-divider)] hover:bg-[var(--color-bg-surface-soft)]"
                  )}
                >
                  <input
                    type="radio"
                    name="dateMode"
                    checked={dateMode === "default"}
                    onChange={() => setDateMode("default")}
                    disabled={isSupplement}
                    className="w-4 h-4"
                  />
                  <span className="text-[14px] font-medium text-[var(--color-text-primary)] shrink-0">
                    강의 기본값 사용
                  </span>
                  <span className="text-[13px] text-[var(--color-text-muted)] truncate">
                    {defaultDateFromLecture ? `다음 주 같은 요일 (${defaultDateFromLecture})` : "미설정"}
                  </span>
                </label>
              )}
              <label className="session-option-row flex flex-col gap-2 rounded-xl border border-[var(--border-divider)] p-3 hover:bg-[var(--color-bg-surface-soft)]">
                <div className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="dateMode"
                    checked={dateMode === "custom" || isSupplement}
                    onChange={() => setDateMode("custom")}
                    className="w-4 h-4"
                  />
                  <span className="text-[14px] font-medium text-[var(--color-text-primary)]">
                    직접선택
                  </span>
                </div>
                {(dateMode === "custom" || isSupplement) && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <DatePicker
                      value={date}
                      onChange={setDate}
                      placeholder="날짜 선택"
                      disabled={busy}
                    />
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* 시간: 강의 기본값 사용 | 직접선택 (보강 시 기본값 비활성화) */}
          <div>
            <div className="text-[13px] font-semibold text-[var(--color-text-secondary)] mb-2">
              시간
            </div>
            <div className="flex flex-col gap-2">
              {showDefaultTimeOption && (
                <label
                  className={cx(
                    "session-option-row flex items-center gap-3 rounded-xl border p-3 transition",
                    isSupplement
                      ? "cursor-not-allowed border-[var(--border-divider)] bg-[var(--color-bg-surface-soft)] opacity-60"
                      : "cursor-pointer border-[var(--border-divider)] hover:bg-[var(--color-bg-surface-soft)]"
                  )}
                >
                  <input
                    type="radio"
                    name="timeMode"
                    checked={timeMode === "default"}
                    onChange={() => setTimeMode("default")}
                    disabled={isSupplement}
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
              <label className="session-option-row flex flex-col gap-2 rounded-xl border border-[var(--border-divider)] p-3 hover:bg-[var(--color-bg-surface-soft)]">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setTimeMode("custom")}>
                  <input
                    type="radio"
                    name="timeMode"
                    checked={timeMode === "custom" || isSupplement}
                    onChange={() => setTimeMode("custom")}
                    className="w-4 h-4"
                  />
                  <span className="text-[14px] font-medium text-[var(--color-text-primary)]">
                    직접선택
                  </span>
                </div>
                {(timeMode === "custom" || isSupplement) && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    role="group"
                    aria-label="시간 선택"
                  >
                    <TimeRangeInput
                      value={timeInput}
                      onChange={setTimeInput}
                      disabled={busy}
                    />
                  </div>
                )}
              </label>
            </div>
          </div>
          </>
          )}
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
