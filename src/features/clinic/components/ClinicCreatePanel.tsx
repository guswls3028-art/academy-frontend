// PATH: src/features/clinic/components/ClinicCreatePanel.tsx
// 클리닉 생성 — 차시 추가 모달과 똑같은 DatePicker·TimeRangeInput만 사용 (같은 컴포넌트·같은 props, 직접선택 행 없음)

import { useEffect, useMemo, useState } from "react";
import { Input, Checkbox, App, Dropdown } from "antd";
import dayjs from "dayjs";

import { DatePicker } from "@/shared/ui/date";
import { TimeRangeInput } from "@/shared/ui/time";
import { Button } from "@/shared/ui/ds";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useClinicTargets } from "../hooks/useClinicTargets";
import { useClinicStudentSearch } from "../hooks/useClinicStudentSearch";
import { fetchClinicStudentsDefault } from "../api/clinicStudents.api";
import { fetchClinicLocations } from "../api/clinicSessions.api";

import api from "@/shared/api/axios";

type TargetRow = { enrollment_id: number; student_name: string };
type StudentRow = { id: number; name: string };

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
  return eh * 60 + em - (sh * 60 + sm);
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

type Props = {
  date?: string;
  defaultMode?: "targets" | "students";
  hideDatePicker?: boolean;
  selectedTargetEnrollmentIds?: number[];
  onChangeSelectedTargetEnrollmentIds?: (ids: number[]) => void;
  onCreated?: (createdDate?: string) => void;
};

export default function ClinicCreatePanel({
  date,
  defaultMode = "targets",
  hideDatePicker = false,
  selectedTargetEnrollmentIds,
  onChangeSelectedTargetEnrollmentIds,
  onCreated,
}: Props) {
  const { message } = App.useApp();
  const qc = useQueryClient();

  const initialDate = date ?? todayISO();
  const [selectedDate, setSelectedDate] = useState(dayjs(initialDate));

  const isPastDate = (selectedDate.format("YYYY-MM-DD") < todayISO());

  useEffect(() => {
    if (date) setSelectedDate(dayjs(date));
  }, [date]);

  const [mode, setMode] = useState<"targets" | "students">(defaultMode);
  const [keyword, setKeyword] = useState("");

  const [internalSelected, setInternalSelected] = useState<number[]>([]);
  const selected =
    mode === "targets" && Array.isArray(selectedTargetEnrollmentIds)
      ? selectedTargetEnrollmentIds
      : internalSelected;

  const setSelected = (next: number[] | ((prev: number[]) => number[])) => {
    const resolved =
      typeof next === "function" ? (next as any)(selected) : next;
    if (mode === "targets" && onChangeSelectedTargetEnrollmentIds) {
      onChangeSelectedTargetEnrollmentIds(resolved);
      return;
    }
    setInternalSelected(resolved);
  };

  const [timeRange, setTimeRange] = useState("");
  const [room, setRoom] = useState("");
  const [memo, setMemo] = useState("");
  const [maxParticipants, setMaxParticipants] = useState<number>(10);

  const targetsQ = useClinicTargets();
  const studentsSearchQ = useClinicStudentSearch(keyword);

  const locationsQ = useQuery({
    queryKey: ["clinic-locations"],
    queryFn: fetchClinicLocations,
    enabled: false,
    staleTime: 60_000,
  });

  const studentsDefaultQ = useQuery({
    queryKey: ["clinic-students-default"],
    queryFn: fetchClinicStudentsDefault,
    enabled: mode === "students" && keyword.trim().length < 2,
    staleTime: 10_000,
    retry: 0,
  });

  const rows = useMemo(() => {
    if (mode === "targets") {
      const arr = (targetsQ.data ?? []) as TargetRow[];
      if (!keyword.trim()) return arr;
      return arr.filter((t) =>
        (t.student_name || "").includes(keyword.trim())
      );
    }
    if (keyword.trim().length >= 2)
      return (studentsSearchQ.data ?? []) as StudentRow[];
    return (studentsDefaultQ.data ?? []) as StudentRow[];
  }, [
    mode,
    targetsQ.data,
    keyword,
    studentsSearchQ.data,
    studentsDefaultQ.data,
  ]);

  const allChecked = rows.length > 0 && selected.length === rows.length;

  const toggleAll = () => {
    if (allChecked) {
      setSelected([]);
      return;
    }
    if (mode === "targets") {
      setSelected((rows as TargetRow[]).map((r) => r.enrollment_id));
    } else {
      setSelected((rows as StudentRow[]).map((r) => r.id));
    }
  };

  const createSessionM = useMutation({
    mutationFn: async (payload: {
      date: string;
      start_time: string;
      duration_minutes: number;
      location: string;
      max_participants: number;
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

    const cap = selected.length > 0 ? selected.length : maxParticipants;
    if (cap < 1) return message.warning("정원을 1명 이상으로 설정하거나 학생을 선택해주세요.");

    try {
      await createSessionM.mutateAsync({
        date: selectedDate.format("YYYY-MM-DD"),
        start_time: toHHmmss(start),
        duration_minutes: duration,
        location: room.trim(),
        max_participants: cap,
      });

      message.success("클리닉 생성 완료");
      setSelected([]);
      setMemo("");
      setTimeRange("");
      qc.invalidateQueries({ queryKey: ["clinic-participants"] });
      qc.invalidateQueries({ queryKey: ["clinic-sessions-tree"] });
      qc.invalidateQueries({ queryKey: ["clinic-sessions-month"] });
      onCreated?.(selectedDate.format("YYYY-MM-DD"));
    } catch (e: any) {
      const res = e?.response?.data;
      let detail = "생성 실패";
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

  return (
    <div className="ds-card-modal clinic-panel overflow-hidden flex flex-col">
      <div className="ds-card-modal__header flex items-center justify-between">
        <div className="ds-card-modal__accent" aria-hidden />
        <div className="ds-card-modal__header-inner">
          <h2 className="ds-card-modal__header-title">클리닉 생성</h2>
          <p className="ds-card-modal__header-description">시작·종료 시간 설정</p>
        </div>
        <div className="ds-card-modal__header-right">
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">
            선택 {selected.length}명
          </span>
        </div>
      </div>

      <div className="ds-card-modal__body clinic-create-body flex-1 min-h-0 flex flex-col">
        {isPastDate && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-[var(--color-bg-surface-soft)] border border-[var(--color-border-divider)] text-sm text-[var(--color-text-muted)]">
            지난 날짜는 조회만 가능합니다. 새 클리닉은 오늘 이후 날짜에만 생성할 수 있습니다.
          </div>
        )}
        <div className="modal-scroll-body modal-scroll-body--compact grid gap-4 flex-1 min-h-0 w-full max-w-full box-border">
          {/* 날짜 — 차시 모달과 디자인 동일: 같은 래퍼 구조(modal-section-label + flex flex-col gap-2), 직접선택 행 없음 */}
          {!hideDatePicker && (
            <div className="min-w-0">
              <label className="modal-section-label">날짜</label>
              <div className="flex flex-col gap-2">
                <DatePicker
                  value={selectedDate.format("YYYY-MM-DD")}
                  onChange={(s) => setSelectedDate(dayjs(s))}
                  placeholder="날짜 선택"
                  minDate={todayISO()}
                  openBelow
                />
              </div>
            </div>
          )}

          {/* 시간 — 차시 모달과 디자인 동일: 같은 래퍼 구조 + role="group" 래퍼, 직접선택 행 없음 */}
          <div className="min-w-0">
            <div className="modal-section-label">시간</div>
            <div className="flex flex-col gap-2">
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
          </div>

          {/* 2행: 장소 · 정원 · 메모 */}
          <div className="modal-form-group modal-form-group--compact flex flex-col gap-3">
            <label className="modal-section-label">장소 · 정원</label>
            <div className="modal-form-row modal-form-row--1-auto-auto gap-2 flex-wrap items-center">
              <div className="flex flex-1 min-w-[120px] gap-2">
                <Input
                  placeholder="장소 / 룸"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  className="clinic-input-filled flex-1 min-w-0"
                />
                <Dropdown
                  trigger={["click"]}
                  onOpenChange={(open) => open && locationsQ.refetch()}
                  menu={{
                    items: (locationsQ.data ?? []).map((loc) => ({
                      key: loc,
                      label: loc,
                      onClick: () => setRoom(loc),
                    })),
                  }}
                >
                  <button
                    type="button"
                    className="text-xs font-semibold px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-surface-hover)] text-[var(--color-text-secondary)] whitespace-nowrap"
                  >
                    {locationsQ.isFetching ? "불러오는 중…" : "장소 불러오기"}
                  </button>
                </Dropdown>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-semibold text-[var(--color-text-muted)] whitespace-nowrap">정원</span>
                <Input
                  type="number"
                  min={1}
                  max={999}
                  value={selected.length > 0 ? selected.length : maxParticipants}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!Number.isNaN(v) && v >= 1) setMaxParticipants(v);
                  }}
                  disabled={selected.length > 0}
                  className="clinic-input-filled w-16"
                />
              </div>
              <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                {selected.length > 0 ? "선택 인원으로 설정" : "명"}
              </span>
            </div>
            <Input.TextArea
              rows={1}
              placeholder="메모 (선택)"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="clinic-input-filled resize-none"
              autoSize={{ minRows: 1, maxRows: 2 }}
            />
          </div>

          {/* 3행: 대상자 — ds-choice-btn (모달 SSOT) */}
          <div className="modal-form-group modal-form-group--compact flex flex-col gap-2 flex-1 min-h-0">
            <label className="modal-section-label">대상자 선택</label>
            <div className="flex gap-2">
              <button
                type="button"
                className={`ds-choice-btn ds-choice-btn--primary flex-1 ${mode === "targets" ? "is-selected" : ""}`}
                onClick={() => { setMode("targets"); setKeyword(""); setSelected([]); }}
                aria-pressed={mode === "targets"}
              >
                예약 대상자
              </button>
              <button
                type="button"
                className={`ds-choice-btn ds-choice-btn--primary flex-1 ${mode === "students" ? "is-selected" : ""}`}
                onClick={() => { setMode("students"); setKeyword(""); setSelected([]); }}
                aria-pressed={mode === "students"}
              >
                전체 학생
              </button>
            </div>
            <Input
              placeholder={mode === "students" ? "학생 검색 (2글자 이상)" : "대상자 내 검색"}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              allowClear
              className="clinic-input-filled"
            />
            <div
              className="clinic-action-row py-2"
              onClick={toggleAll}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && toggleAll()}
            >
              <Checkbox checked={allChecked} onChange={toggleAll} onClick={(e) => e.stopPropagation()}>
                전체 선택
              </Checkbox>
            </div>
            <div className="min-h-0 flex-1 overflow-auto border border-[var(--color-border-divider)] rounded-[var(--radius-md)] p-2 space-y-1 bg-[var(--color-bg-surface-soft)] max-h-[140px]">
              {rows.map((r: any) => {
                const key = mode === "targets" ? r.enrollment_id : r.id;
                const label = mode === "targets" ? r.student_name : r.name;
                return (
                  <label
                    key={key}
                    className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-bg-surface-hover)] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(key)}
                      onChange={(e) => {
                        setSelected((prev) =>
                          e.target.checked ? [...prev, key] : prev.filter((id) => id !== key)
                        );
                      }}
                    />
                    <span className="flex-1 truncate font-medium text-[var(--color-text-primary)]">{label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="pt-3 mt-auto border-t border-[var(--color-border-divider)]">
          <Button
            type="button"
            intent="primary"
            size="lg"
            loading={createSessionM.isPending}
            onClick={submit}
            className="w-full"
          >
            {selected.length > 0
              ? `선택 ${selected.length}명 클리닉 생성`
              : `클리닉만 생성 (정원 ${maxParticipants}명)`}
          </Button>
        </div>
      </div>
    </div>
  );
}
