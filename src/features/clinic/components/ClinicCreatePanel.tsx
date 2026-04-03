// PATH: src/features/clinic/components/ClinicCreatePanel.tsx
// 클리닉 생성 — 대상 필터(학년/학교/강의) + 시간/장소/정원/대상자

import { useEffect, useMemo, useState } from "react";
import { Input, App, Popover, Select } from "antd";
import dayjs from "dayjs";
import { Save, FolderOpen, Trash2, ChevronDown, ChevronUp } from "lucide-react";

import { DatePicker } from "@/shared/ui/date";
import { TimeRangeInput } from "@/shared/ui/time";
import { Button } from "@/shared/ui/ds";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchClinicSessionTree, updateClinicSession } from "../api/clinicSessions.api";
import { fetchLectures, type Lecture } from "@/features/lectures/api/sessions";
import ClinicTargetSelectModal, { type ClinicTargetSelectResult } from "./ClinicTargetSelectModal";
import type { EnrollmentSelection, StudentSelection } from "@/shared/types/selection";
import { buildParticipantPayload } from "../utils/buildParticipantPayload";

import api from "@/shared/api/axios";
import { createClinicParticipant } from "../api/clinicParticipants.api";
import { useClinicTargets } from "../hooks/useClinicTargets";
import { useSchoolLevelMode } from "@/shared/hooks/useSchoolLevelMode";

const SAVED_LOCATIONS_KEY = "academy-clinic-saved-locations";

function getSavedLocations(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_LOCATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveLocationToStorage(name: string): string[] {
  const trimmed = (name || "").trim();
  if (!trimmed) return getSavedLocations();
  const list = getSavedLocations();
  if (list.includes(trimmed)) return list;
  const next = [...list, trimmed];
  try {
    localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

function removeSavedLocation(name: string): string[] {
  const list = getSavedLocations().filter((x) => x !== name);
  try {
    localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}

function todayISO() {
  return dayjs().format("YYYY-MM-DD");
}

function parseTimeRange(s: string): { start: string; end: string } {
  const t = (s || "").trim();
  const idx = t.indexOf("~");
  if (idx >= 0) {
    return { start: t.slice(0, idx).trim(), end: t.slice(idx + 1).trim() };
  }
  return { start: t, end: "" };
}

function durationMinutes(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60; // 자정 넘김 (익일)
  return diff;
}

/** API용: "HH:mm" → "HH:mm:00" (백엔드 TimeField 호환) */
function toHHmmss(s: string): string {
  if (!s?.trim()) return "";
  const parts = s.trim().split(":");
  if (parts.length >= 3) return s.trim();
  const h = parts[0] ?? "00";
  const m = (parts[1] ?? "00").padStart(2, "0");
  return `${h.padStart(2, "0")}:${m}:00`;
}

const filterBtnStyle = (active: boolean) => ({
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: active ? 600 : 500,
  borderRadius: 6,
  border: `1px solid ${active ? "var(--color-brand-primary)" : "var(--color-border-divider)"}`,
  background: active
    ? "color-mix(in srgb, var(--color-brand-primary) 14%, var(--color-bg-surface))"
    : "var(--color-bg-surface)",
  color: active ? "var(--color-brand-primary)" : "var(--color-text-secondary)",
  cursor: "pointer",
  transition: "background-color 0.15s, color 0.15s, border-color 0.15s",
});

type Props = {
  date?: string;
  defaultMode?: "targets" | "students";
  hideDatePicker?: boolean;
  selectedTargetEnrollmentIds?: number[];
  onChangeSelectedTargetEnrollmentIds?: (ids: number[]) => void;
  onDateChange?: (date: string) => void;
  onCreated?: (createdDate?: string) => void;
  /** When true, renders as a flat form (no card shell) — use inside AdminModal */
  asModal?: boolean;
  /** Edit mode: pass existing session to pre-fill form */
  editSession?: {
    id: number;
    title?: string;
    date: string;
    start_time: string; // "HH:MM" or "HH:MM:SS"
    duration_minutes: number;
    location: string;
    max_participants: number;
    target_grade?: number | null;
    target_school_type?: string | null;
    target_lecture_ids?: number[];
  };
  onUpdated?: () => void;
};

export default function ClinicCreatePanel({
  date,
  defaultMode = "targets",
  hideDatePicker = false,
  selectedTargetEnrollmentIds,
  onChangeSelectedTargetEnrollmentIds,
  onDateChange,
  onCreated,
  asModal = false,
  editSession,
  onUpdated,
}: Props) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { data: clinicTargets } = useClinicTargets();
  const slm = useSchoolLevelMode();

  // enrollment_id → clinic_reason 매핑 (참가자 등록 시 사유 전달용)
  const targetReasonMap = useMemo(() => {
    const map = new Map<number, "exam" | "homework" | "both">();
    if (!clinicTargets) return map;
    for (const t of clinicTargets) {
      if (t.clinic_reason && !map.has(t.enrollment_id)) {
        map.set(t.enrollment_id, t.clinic_reason);
      }
    }
    return map;
  }, [clinicTargets]);

  const initialDate = editSession?.date ?? date ?? todayISO();
  const [selectedDate, setSelectedDate] = useState(dayjs(initialDate));

  const isPastDate = (selectedDate.format("YYYY-MM-DD") < todayISO());

  useEffect(() => {
    if (date) setSelectedDate(dayjs(date));
  }, [date]);

  const [selection, setSelection] = useState<ClinicTargetSelectResult | null>(null);
  const [targetModalOpen, setTargetModalOpen] = useState(false);

  // Derive mode and selected IDs from the discriminated union
  const mode: "targets" | "students" = selection?.kind === "student" ? "students" : "targets";

  const selectedFromSelection: number[] = selection
    ? selection.kind === "enrollment"
      ? [...selection.enrollmentIds]
      : [...selection.studentIds]
    : [];

  const [internalSelected, setInternalSelected] = useState<number[]>([]);
  const selected =
    mode === "targets" && Array.isArray(selectedTargetEnrollmentIds)
      ? selectedTargetEnrollmentIds
      : selection
        ? selectedFromSelection
        : internalSelected;

  const setSelected = (next: number[] | ((prev: number[]) => number[])) => {
    const resolved =
      typeof next === "function" ? (next as any)(selected) : next;
    if (mode === "targets" && onChangeSelectedTargetEnrollmentIds) {
      onChangeSelectedTargetEnrollmentIds(resolved);
      return;
    }
    setInternalSelected(resolved);
    setSelection(null);
  };

  const handleTargetModalConfirm = (result: ClinicTargetSelectResult) => {
    setSelection(result);
    if (result.kind === "enrollment" && onChangeSelectedTargetEnrollmentIds) {
      onChangeSelectedTargetEnrollmentIds([...result.enrollmentIds]);
    } else if (result.kind === "student") {
      setInternalSelected([...result.studentIds]);
    }
  };

  const isEdit = !!editSession;

  const [title, setTitle] = useState(editSession?.title ?? "");
  const [targetGrade, setTargetGrade] = useState<number | null>(editSession?.target_grade ?? null);
  const [targetSchoolType, setTargetSchoolType] = useState<string | null>(editSession?.target_school_type ?? null);
  const [targetLectureIds, setTargetLectureIds] = useState<number[]>(editSession?.target_lecture_ids ?? []);
  const [showFilters, setShowFilters] = useState(false);
  const [timeRange, setTimeRange] = useState(() => {
    if (!editSession) return "";
    const st = editSession.start_time.slice(0, 5);
    const dur = editSession.duration_minutes;
    const [h, m] = st.split(":").map(Number);
    const endMin = (h * 60 + m + dur) % 1440;
    const eh = Math.floor(endMin / 60).toString().padStart(2, "0");
    const em = (endMin % 60).toString().padStart(2, "0");
    return `${st} ~ ${eh}:${em}`;
  });
  const [room, setRoom] = useState(editSession?.location ?? "");
  const [memo, setMemo] = useState("");
  const [maxParticipants, setMaxParticipants] = useState<number>(editSession?.max_participants ?? 10);

  const [savedLocations, setSavedLocations] = useState<string[]>(() => getSavedLocations());
  const [loadPopoverOpen, setLoadPopoverOpen] = useState(false);
  const [addLocationInput, setAddLocationInput] = useState("");

  // 강의 목록 (필터 열렸을 때만 로드)
  const lecturesQ = useQuery<Lecture[]>({
    queryKey: ["lectures-for-clinic-filter"],
    queryFn: () => fetchLectures({ is_active: true }),
    enabled: showFilters,
    staleTime: 60_000,
  });

  const hasActiveFilter = targetGrade !== null || targetSchoolType !== null || targetLectureIds.length > 0;
  const filterSummary = [
    targetGrade !== null ? `${targetGrade}학년` : null,
    targetSchoolType ? slm.getLabel(targetSchoolType as Parameters<typeof slm.getLabel>[0]) : null,
    targetLectureIds.length > 0 ? `강의 ${targetLectureIds.length}개` : null,
  ].filter(Boolean).join(" · ");

  const createSessionM = useMutation({
    mutationFn: async (payload: {
      title?: string;
      date: string;
      start_time: string;
      duration_minutes: number;
      location: string;
      max_participants: number;
      target_grade?: number | null;
      target_school_type?: string | null;
      target_lecture_ids?: number[];
    }) => {
      const res = await api.post("/clinic/sessions/", payload);
      return res.data as { id: number };
    },
  });

  const submit = async () => {
    const { start, end } = parseTimeRange(timeRange);
    if (!start || !end)
      return message.warning("시작/종료 시간을 선택해주세요.");
    const duration = durationMinutes(start, end);
    if (duration <= 0)
      return message.error("종료 시간은 시작 시간 이후여야 합니다.");
    if (!room.trim()) return message.warning("장소/룸을 입력해주세요.");

    if (isEdit && editSession) {
      try {
        await updateClinicSession(editSession.id, {
          title: title.trim() || undefined,
          date: selectedDate.format("YYYY-MM-DD"),
          start_time: toHHmmss(start),
          duration_minutes: duration,
          location: room.trim(),
          max_participants: maxParticipants,
          target_grade: targetGrade,
          target_school_type: targetSchoolType,
          target_lecture_ids: targetLectureIds.length > 0 ? targetLectureIds : [],
        });
        message.success("클리닉이 수정되었습니다.");
        qc.invalidateQueries({ queryKey: ["clinic-sessions-tree"] });
        qc.invalidateQueries({ queryKey: ["clinic-participants"] });
        onUpdated?.();
      } catch (e: any) {
        const res = e?.response?.data;
        let detail = "클리닉을 수정하지 못했습니다.";
        if (res) {
          if (typeof res.detail === "string") detail = res.detail;
          else if (Array.isArray(res.detail))
            detail = res.detail.map((x: any) => x?.msg ?? JSON.stringify(x)).join(", ");
          else if (res.detail && typeof res.detail === "object")
            detail = JSON.stringify(res.detail);
          else if (typeof res === "object" && !res.detail) {
            const parts = Object.entries(res).map(
              ([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`
            );
            if (parts.length) detail = parts.join(" · ");
          }
        }
        message.error(detail);
      }
      return;
    }

    const cap = selected.length > 0 ? selected.length : maxParticipants;
    if (cap < 1) return message.warning("정원을 1명 이상으로 설정하거나 학생을 선택해주세요.");

    try {
      const created = await createSessionM.mutateAsync({
        title: title.trim() || undefined,
        date: selectedDate.format("YYYY-MM-DD"),
        start_time: toHHmmss(start),
        duration_minutes: duration,
        location: room.trim(),
        max_participants: cap,
        target_grade: targetGrade,
        target_school_type: targetSchoolType,
        target_lecture_ids: targetLectureIds.length > 0 ? targetLectureIds : [],
      });

      // B-01: 선택된 학생들을 참가자로 등록
      // Dispatch on selection.kind to prevent ID domain confusion
      if (selected.length > 0 && selection) {
        const results = await Promise.allSettled(
          selected.map((selectedId) => {
            const reason = selection.kind === "enrollment" ? targetReasonMap.get(selectedId) : undefined;
            return createClinicParticipant(
              buildParticipantPayload(created.id, selectedId, selection, reason)
            );
          })
        );
        const failed = results.filter((r) => r.status === "rejected");
        if (failed.length > 0) {
          message.warning(
            `클리닉이 만들어졌습니다. (${selected.length - failed.length}명 등록, ${failed.length}명 실패)`
          );
        } else {
          message.success(`클리닉이 만들어졌습니다. (${selected.length}명 등록)`);
        }
      } else {
        message.success("클리닉이 만들어졌습니다.");
      }
      setSelected([]);
      setMemo("");
      setTimeRange("");
      qc.invalidateQueries({ queryKey: ["clinic-participants"] });
      qc.invalidateQueries({ queryKey: ["clinic-sessions-tree"] });
      qc.invalidateQueries({ queryKey: ["clinic-sessions-month"] });
      const y = selectedDate.year();
      const m = selectedDate.month() + 1;
      await qc.fetchQuery({
        queryKey: ["clinic-sessions-tree", y, m],
        queryFn: () => fetchClinicSessionTree({ year: y, month: m }),
      });
      onCreated?.(selectedDate.format("YYYY-MM-DD"));
    } catch (e: any) {
      const res = e?.response?.data;
      let detail = "클리닉을 만들지 못했습니다.";
      if (res) {
        if (typeof res.detail === "string") detail = res.detail;
        else if (Array.isArray(res.detail))
          detail = res.detail.map((x: any) => x?.msg ?? JSON.stringify(x)).join(", ");
        else if (res.detail && typeof res.detail === "object")
          detail = JSON.stringify(res.detail);
        else if (typeof res === "object" && !res.detail) {
          const parts = Object.entries(res).map(
            ([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`
          );
          if (parts.length) detail = parts.join(" · ");
        }
      }
      message.error(detail);
    }
  };

  /* ── location save/load popover content (shared) ── */
  const locationPopoverContent = (
    <div className="clinic-location-popover">
      {savedLocations.length === 0 ? (
        <div className="clinic-location-popover-empty">
          <p className="text-xs text-[var(--color-text-muted)] mb-2">
            저장된 장소가 없습니다.
          </p>
          <div className="flex gap-2">
            <Input
              size="small"
              placeholder="장소 입력"
              value={addLocationInput}
              onChange={(e) => setAddLocationInput(e.target.value)}
              onPressEnter={() => {
                const v = addLocationInput.trim();
                if (v) {
                  setSavedLocations(saveLocationToStorage(v));
                  setRoom(v);
                  setAddLocationInput("");
                  setLoadPopoverOpen(false);
                  message.success("추가됨");
                }
              }}
              className="flex-1 min-w-0"
            />
            <Button
              size="sm"
              intent="primary"
              onClick={() => {
                const v = addLocationInput.trim();
                if (v) {
                  setSavedLocations(saveLocationToStorage(v));
                  setRoom(v);
                  setAddLocationInput("");
                  setLoadPopoverOpen(false);
                  message.success("추가됨");
                }
              }}
            >
              추가
            </Button>
          </div>
        </div>
      ) : (
        <div className="clinic-location-popover-list">
          {savedLocations.map((loc) => (
            <div key={loc} className="clinic-location-popover-item-row">
              <button
                type="button"
                className="clinic-location-popover-item flex-1 min-w-0 text-left"
                onClick={() => {
                  setRoom(loc);
                  setLoadPopoverOpen(false);
                }}
              >
                {loc}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSavedLocations(removeSavedLocation(loc));
                  message.success("삭제됨");
                }}
                className="clinic-location-popover-delete"
                title="장소 삭제"
                aria-label={`${loc} 삭제`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="border-t border-[var(--color-border-divider)] mt-2 pt-2">
            <p className="text-[11px] text-[var(--color-text-muted)] mb-1">장소 추가하기</p>
            <div className="flex gap-2">
              <Input
                size="small"
                placeholder="새 장소"
                value={addLocationInput}
                onChange={(e) => setAddLocationInput(e.target.value)}
                onPressEnter={() => {
                  const v = addLocationInput.trim();
                  if (v) {
                    setSavedLocations(saveLocationToStorage(v));
                    setRoom(v);
                    setAddLocationInput("");
                    setLoadPopoverOpen(false);
                    message.success("추가됨");
                  }
                }}
                className="flex-1 min-w-0"
              />
              <Button
                size="sm"
                intent="secondary"
                onClick={() => {
                  const v = addLocationInput.trim();
                  if (v) {
                    setSavedLocations(saveLocationToStorage(v));
                    setRoom(v);
                    setAddLocationInput("");
                    setLoadPopoverOpen(false);
                    message.success("추가됨");
                  }
                }}
              >
                추가
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* ── form fields (shared between card and modal layouts) ── */
  const formFields = (
    <>
      {/* 날짜 */}
      {!hideDatePicker && (
        <div className="clinic-create__field">
          <label className="clinic-create__label">날짜</label>
          <DatePicker
            value={selectedDate.format("YYYY-MM-DD")}
            onChange={(s) => {
              const next = dayjs(s);
              setSelectedDate(next);
              onDateChange?.(next.format("YYYY-MM-DD"));
            }}
            placeholder="날짜 선택"
            minDate={todayISO()}
            openBelow
          />
        </div>
      )}

      {/* 시간 */}
      <div className="clinic-create__field">
        <label className="clinic-create__label">시간</label>
        <div role="group" aria-label="시간 선택">
          <TimeRangeInput
            value={timeRange}
            onChange={setTimeRange}
            startLabel="시작"
            endLabel="종료"
            startPlaceholder="시작"
            endPlaceholder="종료"
          />
        </div>
      </div>

      {/* 제목 + 정원 (한 행) */}
      <div className="clinic-create__row">
        <div className="clinic-create__field" style={{ flex: 1 }}>
          <label className="clinic-create__label">제목 (선택)</label>
          <Input
            placeholder="예: 수학 보충"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="clinic-input-filled"
            size="small"
          />
        </div>
        <div className="clinic-create__field" style={{ flex: 0, minWidth: 120 }}>
          <label className="clinic-create__label">정원</label>
          <div className="clinic-create__capacity-row">
            <div className="clinic-capacity-stepper">
              <button
                type="button"
                className="clinic-capacity-stepper__btn"
                onClick={() => setMaxParticipants((p) => Math.max(1, p - 1))}
                disabled={selected.length > 0}
                aria-label="정원 1 감소"
              >−</button>
              <span className="clinic-capacity-stepper__value">
                {selected.length > 0 ? selected.length : maxParticipants}
              </span>
              <button
                type="button"
                className="clinic-capacity-stepper__btn"
                onClick={() => setMaxParticipants((p) => Math.min(999, p + 1))}
                disabled={selected.length > 0}
                aria-label="정원 1 증가"
              >+</button>
            </div>
          </div>
        </div>
      </div>

      {/* 장소 */}
      <div className="clinic-create__field">
        <label className="clinic-create__label">장소</label>
        <div className="clinic-create__location-row">
          <Input
            placeholder="장소 / 룸"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            className="clinic-input-filled clinic-create__location-input"
          />
          <div className="clinic-create__location-actions">
            <button
              type="button"
              onClick={() => {
                const v = room.trim();
                if (!v) {
                  message.warning("장소를 입력한 뒤 저장해주세요.");
                  return;
                }
                setSavedLocations(saveLocationToStorage(v));
                message.success("저장됨");
              }}
              className="clinic-create__location-btn"
              title="현재 장소를 저장"
              aria-label="장소 저장"
            >
              <Save size={14} />
              <span>저장</span>
            </button>
            <Popover
              open={loadPopoverOpen}
              onOpenChange={(open) => {
                setLoadPopoverOpen(open);
                if (open) setSavedLocations(getSavedLocations());
              }}
              trigger="click"
              placement="bottomRight"
              content={locationPopoverContent}
            >
              <button
                type="button"
                className="clinic-create__location-btn"
                title="저장된 장소 불러오기"
                aria-label="장소 불러오기"
              >
                <FolderOpen size={14} />
                <span>불러오기</span>
              </button>
            </Popover>
          </div>
        </div>
      </div>

      {/* 대상 조건 — 접이식 */}
      <div className="clinic-create__field">
        <button
          type="button"
          className="clinic-create__collapse-trigger"
          onClick={() => setShowFilters((v) => !v)}
        >
          <span className="clinic-create__label" style={{ margin: 0 }}>대상 조건</span>
          {hasActiveFilter && (
            <span className="clinic-create__filter-badge">{filterSummary}</span>
          )}
          {!hasActiveFilter && (
            <span className="clinic-create__filter-default">전체 학생</span>
          )}
          <span className="clinic-create__collapse-icon">
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>

        {/* 필터 경고 — 접힌 상태에서만 */}
        {hasActiveFilter && !showFilters && (
          <div className="clinic-create__filter-warning">
            <span aria-hidden>&#9888;</span>
            필터가 적용되어 일부 학생만 표시됩니다.
          </div>
        )}

        {showFilters && (
          <div className="clinic-create__filter-body">
            {/* 학년 */}
            <div className="clinic-create__filter-row">
              <span className="clinic-create__filter-row-label">학년</span>
              <div className="clinic-create__filter-chips">
                {([null, ...Array.from(new Set(slm.schoolTypes.flatMap((st) => slm.gradeRange(st))))] as const).map((g) => (
                  <button
                    key={g ?? "all"}
                    type="button"
                    onClick={() => setTargetGrade(g as number | null)}
                    style={filterBtnStyle(targetGrade === g)}
                  >
                    {g === null ? "전체" : `${g}학년`}
                  </button>
                ))}
              </div>
            </div>

            {/* 학교 유형 */}
            <div className="clinic-create__filter-row">
              <span className="clinic-create__filter-row-label">학교</span>
              <div className="clinic-create__filter-chips">
                {([null, ...slm.schoolTypes] as const).map((s) => (
                  <button
                    key={s ?? "all"}
                    type="button"
                    onClick={() => setTargetSchoolType(s)}
                    style={filterBtnStyle(targetSchoolType === s)}
                  >
                    {s === null ? "전체" : slm.getLabel(s)}
                  </button>
                ))}
              </div>
            </div>

            {/* 강의 선택 */}
            <div className="clinic-create__filter-row clinic-create__filter-row--top">
              <span className="clinic-create__filter-row-label">강의</span>
              <Select
                mode="multiple"
                placeholder="전체 (강의 제한 없음)"
                value={targetLectureIds}
                onChange={(ids) => setTargetLectureIds(ids)}
                options={(lecturesQ.data ?? []).map((l) => ({
                  label: l.title,
                  value: l.id,
                }))}
                loading={lecturesQ.isLoading}
                className="flex-1 min-w-0"
                maxTagCount={2}
                maxTagPlaceholder={(omitted) => `+${omitted.length}개`}
                allowClear
                style={{ minWidth: 0 }}
                size="small"
              />
            </div>

            {/* 필터 초기화 */}
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => {
                  setTargetGrade(null);
                  setTargetSchoolType(null);
                  setTargetLectureIds([]);
                }}
                className="clinic-create__filter-reset"
              >
                필터 초기화
              </button>
            )}
          </div>
        )}
      </div>

      {/* 대상자 선택 */}
      <div className="clinic-create__field">
        <label className="clinic-create__label">대상자 선택</label>
        <div className="clinic-create__target-row">
          <Button
            type="button"
            intent="secondary"
            size="md"
            onClick={() => setTargetModalOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={targetModalOpen}
          >
            대상자 추가
          </Button>
          <span className="clinic-create__target-count">
            {selected.length > 0
              ? `${mode === "targets" ? "예약 대상자" : "전체 학생"} ${selected.length}명 선택됨`
              : "아직 선택 안 됨"}
          </span>
        </div>
      </div>

      {/* 메모 */}
      <div className="clinic-create__field">
        <label className="clinic-create__label">메모</label>
        <Input.TextArea
          rows={2}
          placeholder="메모 (선택)"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className="clinic-input-filled resize-none"
          autoSize={{ minRows: 2, maxRows: 4 }}
        />
      </div>
    </>
  );

  /* ── submit button (shared) ── */
  const submitButton = (
    <Button
      type="button"
      intent="primary"
      size="lg"
      loading={createSessionM.isPending}
      onClick={submit}
      className="w-full"
      disabled={isPastDate}
    >
      {isPastDate
        ? "지난 날짜입니다"
        : isEdit
          ? "클리닉 수정"
          : selected.length > 0
            ? `${selected.length}명 클리닉 만들기`
            : `클리닉 만들기 (정원 ${maxParticipants}명)`}
    </Button>
  );

  /* ── target select modal (always rendered) ── */
  const targetSelectModal = (
    <ClinicTargetSelectModal
      open={targetModalOpen}
      onClose={() => setTargetModalOpen(false)}
      initialMode={mode}
      initialSelectedIds={selected}
      onConfirm={handleTargetModalConfirm}
    />
  );

  /* ══════════ asModal layout — clean flat form ══════════ */
  if (asModal) {
    return (
      <div className="clinic-create">
        <div className="clinic-create__form">
          {formFields}
        </div>
        <div className="clinic-create__footer">
          {submitButton}
        </div>
        {targetSelectModal}
      </div>
    );
  }

  /* ══════════ standalone card layout (original) ══════════ */
  return (
    <div className="ds-card-modal clinic-panel overflow-hidden flex flex-col">
      <div className="ds-card-modal__header flex items-center justify-between">
        <div className="ds-card-modal__accent" aria-hidden />
        <div className="ds-card-modal__header-inner">
          <h2 className="ds-card-modal__header-title">{isEdit ? "클리닉 수정" : "클리닉 만들기"}</h2>
          <p className="ds-card-modal__header-description">시간, 장소, 대상자를 설정하세요.</p>
        </div>
        <div className="ds-card-modal__header-right">
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">
            선택 {selected.length}명
          </span>
        </div>
      </div>

      <div className="ds-card-modal__body clinic-create-body flex-1 min-h-0 flex flex-col">
        <div className="clinic-create__form">
          {formFields}
        </div>
        <div className="clinic-create__footer">
          {submitButton}
        </div>
      </div>

      {targetSelectModal}
    </div>
  );
}
