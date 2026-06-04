// PATH: src/app_admin/domains/lectures/components/SessionCreateModal.tsx
// 차시 추가: 2차시/보강 선택 + 날짜·시간 (전역 모달 SSOT: ModalDateSection, ModalTimeSection 사용)

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { extractApiError } from "@/shared/utils/extractApiError";
import {
  AdminModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalDateSection,
  ModalTimeSection,
} from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { createSession } from "../api/sessions";
import { SessionBlockView } from "@/shared/ui/session-block";
import {
  formatSessionLabel,
  getNextRegularOrder,
  getRegularOrder,
  isSupplementSession,
  sortSessionsByDisplayOrder,
  type SessionOrderLike,
} from "@/shared/product/sessions/sessionOrdering";

type SessionCreateKind = "regular" | "supplement";
type DateMode = "default" | "custom";
type TimeMode = "default" | "custom";
type RegularMode = "auto" | "manual";

interface Props {
  lectureId: number;
  /** 반별 차시 생성 시 연결할 section ID */
  sectionId?: number | null;
  /** 반 라벨 (모달 타이틀 표시용) */
  sectionLabel?: string | null;
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

export default function SessionCreateModal({ lectureId, sectionId, sectionLabel, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [sessionType, setSessionType] = useState<SessionCreateKind | null>(null);
  const [regularMode, setRegularMode] = useState<RegularMode>("auto");
  const [regularOrderInput, setRegularOrderInput] = useState("");
  const [supplementAfterOrder, setSupplementAfterOrder] = useState<number | null>(null);
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
    () => sortSessionsByDisplayOrder(sessionsList as SessionOrderLike[]),
    [sessionsList]
  );
  // section_mode: 해당 반 내 차시만 카운트
  const sectionSessions = useMemo(() => {
    if (sectionId == null) return sortedSessions;
    return sortedSessions.filter((s) => (s as { section?: number | null }).section === sectionId);
  }, [sortedSessions, sectionId]);
  const regularSessions = useMemo(
    () => sectionSessions.filter((s) => !isSupplementSession(s)),
    [sectionSessions]
  );
  const nextRegularOrder = getNextRegularOrder(sectionSessions);
  const manualRegularOrder = Number(regularOrderInput);
  const effectiveRegularOrder =
    regularMode === "manual" && Number.isFinite(manualRegularOrder) && manualRegularOrder > 0
      ? manualRegularOrder
      : nextRegularOrder;
  // 정규 차시 기본 날짜: 강의 생성 모달 start_date 연결
  // — 기존 정규 차시 없음 → 강의 시작일(lecture.start_date) / 있음 → 마지막 정규 차시 날짜 + 7일
  const lastRegularSessionWithDate = useMemo(() => {
    const regular = regularSessions.filter((s) => s.date);
    return regular.slice(-1)[0];
  }, [regularSessions]);
  const defaultDateFromLecture = useMemo(() => {
    const lectureStart = (lecture as { start_date?: string | null })?.start_date ?? null;
    if (lastRegularSessionWithDate?.date) return nextWeekDate(lastRegularSessionWithDate.date);
    return lectureStart?.trim() ? lectureStart : nextWeekDate(lectureStart);
  }, [lastRegularSessionWithDate?.date, lecture]);

  const lectureTimeRaw = lecture?.lecture_time?.trim() || "";
  // 정규 차시 기본 시간: 강의 생성 모달 lecture_time(시작~종료) 연결
  const lectureTimeExtract = useMemo(() => extractTimeFromLectureTime(lecture?.lecture_time), [lecture?.lecture_time]);

  const defaultTitle =
    sessionType === "regular" ? `${effectiveRegularOrder}차시` : sessionType === "supplement" ? "보강" : "";

  // 보강 선택 시 날짜·시간 모두 직접선택만 가능
  useEffect(() => {
    if (sessionType === "supplement") {
      setDateMode("custom");
      setTimeMode("custom");
    } else if (sessionType === "regular") {
      // N차시 선택 시 항상 기본 선택값으로 초기화 (보강→2차시 전환 시 복원)
      setDateMode("default");
      setTimeMode("default");
    }
  }, [sessionType]);

  useEffect(() => {
    if (sessionType === "regular" && regularMode === "auto") {
      setRegularOrderInput(String(nextRegularOrder));
    }
  }, [sessionType, regularMode, nextRegularOrder]);

  // 직접선택으로 전환 시 시간이 비어 있으면 강의 기본 시간을 초기값으로 설정 (버튼 활성화용)
  useEffect(() => {
    if ((timeMode === "custom" || sessionType === "supplement") && lectureTimeExtract) {
      setTimeInput((prev) => (prev.trim() ? prev : lectureTimeExtract));
    }
  }, [timeMode, sessionType, lectureTimeExtract]);

  // 정규 차시 + 날짜 기본값 사용 시 날짜 자동 채우기 (다음 주 같은 요일)
  useEffect(() => {
    if (sessionType === "regular" && dateMode === "default" && defaultDateFromLecture) {
      setDate(defaultDateFromLecture);
    }
  }, [sessionType, dateMode, defaultDateFromLecture]);

  const effectiveDate = dateMode === "default" ? (defaultDateFromLecture || date) : date;

  const MAX_SESSIONS = 52;

  function validate(): string | null {
    if (!sessionType) return "차시 유형을 선택하세요.";
    if (sectionSessions.length >= MAX_SESSIONS) return `차시는 최대 ${MAX_SESSIONS}개까지 생성할 수 있습니다.`;
    if (sessionType === "regular" && regularMode === "manual") {
      if (!Number.isFinite(manualRegularOrder) || manualRegularOrder <= 0) {
        return "차시 번호를 입력하세요.";
      }
      if (regularSessions.some((s) => getRegularOrder(s) === manualRegularOrder)) {
        return `이미 ${manualRegularOrder}차시가 있습니다.`;
      }
    }
    if (!effectiveDate?.trim()) return "날짜를 선택하세요.";
    if (sessionType === "supplement" || timeMode === "custom") {
      if (!timeInput.trim()) return "시간을 입력하세요.";
    }
    return null;
  }

  async function handleSubmit() {
    if (busy) return;
    const err = validate();
    if (err) { feedback.warning(err); return; }

    let title = defaultTitle;
    const timeStr =
      sessionType === "supplement" || timeMode === "custom"
        ? timeInput.trim()
        : lectureTimeExtract || lectureTimeRaw;
    if (timeStr) title = `${title} (${timeStr})`;

    setBusy(true);
    try {
      await createSession(
        lectureId,
        title,
        effectiveDate || undefined,
        undefined,
        sectionId,
        sessionType === "regular"
          ? {
              sessionType: "REGULAR",
              regularOrder: regularMode === "manual" ? effectiveRegularOrder : undefined,
            }
          : {
              sessionType: "SUPPLEMENT",
              insertAfterOrder: supplementAfterOrder,
            },
      );
      feedback.success("차시가 추가되었습니다.");
      onClose();
    } catch (e: unknown) {
      feedback.error(extractApiError(e, "차시 추가에 실패했습니다."));
    } finally {
      setBusy(false);
    }
  }

  const isSupplement = sessionType === "supplement";
  const showDefaultDateOption = sessionType === "regular";
  const showDefaultTimeOption = sessionType === "regular";

  return (
    <AdminModal open={true} onClose={onClose} type="action" width={620} onEnterConfirm={!busy ? handleSubmit : undefined}>
      <ModalHeader
        type="action"
        title={sectionLabel ? `${sectionLabel} 차시 추가` : "차시 추가"}
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
                selected={sessionType === "regular"}
                showCheck
                title={`${nextRegularOrder}차시`}
                desc="정규 차시 추가 · 기본 날짜/시간 사용"
                onClick={() => setSessionType("regular")}
                ariaPressed={sessionType === "regular"}
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

          {sessionType === "regular" && (
            <div>
              <div className="modal-section-label mb-3">차시 번호</div>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  intent={regularMode === "auto" ? "primary" : "secondary"}
                  onClick={() => setRegularMode("auto")}
                  disabled={busy}
                >
                  자동 {nextRegularOrder}차시
                </Button>
                <Button
                  intent={regularMode === "manual" ? "primary" : "secondary"}
                  onClick={() => setRegularMode("manual")}
                  disabled={busy}
                >
                  직접 지정
                </Button>
              </div>
              {regularMode === "manual" && (
                <input
                  type="number"
                  min={1}
                  value={regularOrderInput}
                  onChange={(e) => setRegularOrderInput(e.target.value)}
                  className="ds-input mt-3"
                  placeholder={`${nextRegularOrder}차시`}
                  disabled={busy}
                />
              )}
            </div>
          )}

          {sessionType === "supplement" && regularSessions.length > 0 && (
            <div>
              <div className="modal-section-label mb-3">보강 위치</div>
              <select
                className="ds-input"
                value={supplementAfterOrder ?? ""}
                onChange={(e) => setSupplementAfterOrder(e.target.value ? Number(e.target.value) : null)}
                disabled={busy}
              >
                <option value="">마지막에 추가</option>
                {regularSessions.map((s) => (
                  <option key={s.id ?? s.order} value={s.order ?? ""}>
                    {formatSessionLabel(s)} 뒤
                  </option>
                ))}
              </select>
            </div>
          )}

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
