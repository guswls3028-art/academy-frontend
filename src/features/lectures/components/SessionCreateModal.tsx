// PATH: src/features/lectures/components/SessionCreateModal.tsx
// 차시 추가: 2차시/보강 선택 + 날짜·시간 (전역 모달 SSOT: ModalDateSection, ModalTimeSection 사용)

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import {
  AdminModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalDateSection,
  ModalTimeSection,
} from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { createSession } from "../api/sessions";
import { SessionBlockView } from "@/shared/ui/session-block";

type SessionType = "n+1" | "supplement";
type DateMode = "default" | "custom";
type TimeMode = "default" | "custom";

interface Props {
  lectureId: number;
  onClose: () => void;
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
  // 정규 차시 기본 날짜: 강의 생성 모달 start_date 연결
  // — 기존 정규 차시 없음 → 강의 시작일(lecture.start_date) / 있음 → 마지막 정규 차시 날짜 + 7일
  const lastRegularSessionWithDate = useMemo(() => {
    const regular = (sortedSessions as { title?: string; date?: string | null }[]).filter(
      (s) => s.date && !s.title?.includes?.("보강")
    );
    return regular.slice(-1)[0];
  }, [sortedSessions]);
  const defaultDateFromLecture = useMemo(() => {
    const lectureStart = (lecture as { start_date?: string | null })?.start_date ?? null;
    if (lastRegularSessionWithDate?.date) return nextWeekDate(lastRegularSessionWithDate.date);
    return lectureStart?.trim() ? lectureStart : nextWeekDate(lectureStart);
  }, [lastRegularSessionWithDate?.date, lecture]);

  const lectureTimeRaw = lecture?.lecture_time?.trim() || "";
  // 정규 차시 기본 시간: 강의 생성 모달 lecture_time(시작~종료) 연결
  const lectureTimeExtract = useMemo(() => extractTimeFromLectureTime(lecture?.lecture_time), [lecture?.lecture_time]);

  const defaultTitle =
    sessionType === "n+1" ? `${nextOrder}차시` : sessionType === "supplement" ? "보강" : "";

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
        <div className="modal-scroll-body grid gap-6 w-full max-w-full box-border">
          {/* 차시 유형: 2차시 / 보강 (전역 SessionBlockView SSOT) */}
          <div>
            <div className="modal-section-label mb-3">차시 유형</div>
            <div className="grid grid-cols-2 gap-5">
              <SessionBlockView
                variant="n1"
                compact={false}
                selected={sessionType === "n+1"}
                showCheck
                title={`${nextOrder}차시`}
                desc="정규 차시 추가 · 기본 날짜/시간 사용"
                onClick={() => setSessionType("n+1")}
                ariaPressed={sessionType === "n+1"}
              />
              <SessionBlockView
                variant="supplement"
                compact={false}
                selected={sessionType === "supplement"}
                showCheck
                title="보강"
                desc="보강 차시 · 날짜·시간 직접 선택"
                onClick={() => setSessionType("supplement")}
                ariaPressed={sessionType === "supplement"}
              />
            </div>
          </div>

          {sessionType && (
            <>
              <ModalDateSection
                name="dateMode"
                useDefault={dateMode === "default"}
                onUseDefaultChange={(use) => setDateMode(use ? "default" : "custom")}
                customDate={date}
                onCustomDateChange={setDate}
                showDefaultOption={showDefaultDateOption}
                disableDefaultOption={isSupplement}
                defaultLabel={
                  defaultDateFromLecture
                    ? lastRegularSessionWithDate?.date
                      ? `다음 주 같은 요일 (${defaultDateFromLecture})`
                      : `강의 시작일 (${defaultDateFromLecture})`
                    : "미설정"
                }
                placeholder="날짜 선택"
                disabled={busy}
              />
              <ModalTimeSection
                name="timeMode"
                useDefault={timeMode === "default"}
                onUseDefaultChange={(use) => setTimeMode(use ? "default" : "custom")}
                customTime={timeInput}
                onCustomTimeChange={setTimeInput}
                showDefaultOption={showDefaultTimeOption}
                disableDefaultOption={isSupplement}
                defaultLabel={lectureTimeRaw || "미설정"}
                disabled={busy}
              />
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
