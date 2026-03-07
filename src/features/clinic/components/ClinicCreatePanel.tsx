// PATH: src/features/clinic/components/ClinicCreatePanel.tsx
// 클리닉 생성 — 모달 SSOT(TimeRangeInput, DatePicker, ds-choice-btn, DS Button) + 한 페이지 컴팩트 레이아웃

import { useEffect, useMemo, useState } from "react";
import { Input, Checkbox, message } from "antd";
import dayjs from "dayjs";

import { DatePicker } from "@/shared/ui/date";
import { TimeRangeInput } from "@/shared/ui/time";
import { Button } from "@/shared/ui/ds";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useClinicTargets } from "../hooks/useClinicTargets";
import { useClinicStudentSearch } from "../hooks/useClinicStudentSearch";
import { fetchClinicStudentsDefault } from "../api/clinicStudents.api";

import api from "@/shared/api/axios";

type TargetRow = { enrollment_id: number; student_name: string };
type StudentRow = { id: number; name: string };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
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

type Props = {
  date?: string;
  defaultMode?: "targets" | "students";
  hideDatePicker?: boolean;
  selectedTargetEnrollmentIds?: number[];
  onChangeSelectedTargetEnrollmentIds?: (ids: number[]) => void;
  onCreated?: () => void;
};

export default function ClinicCreatePanel({
  date,
  defaultMode = "targets",
  hideDatePicker = false,
  selectedTargetEnrollmentIds,
  onChangeSelectedTargetEnrollmentIds,
  onCreated,
}: Props) {
  const qc = useQueryClient();

  const initialDate = date ?? todayISO();
  const [selectedDate, setSelectedDate] = useState(dayjs(initialDate));

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
        start_time: start,
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
      onCreated?.();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "생성 실패");
    }
  };

  return (
    <div className="ds-card-modal clinic-panel overflow-hidden">
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

      <div className="ds-card-modal__body clinic-input-filled space-y-5">
        {!hideDatePicker && (
          <section className="modal-form-group">
            <label className="modal-section-label">날짜</label>
            <DatePicker
              value={selectedDate.format("YYYY-MM-DD")}
              onChange={(s) => setSelectedDate(dayjs(s))}
              placeholder="날짜 선택"
            />
          </section>
        )}

        <section className="modal-form-group">
          <label className="modal-section-label">시작 · 종료 시간</label>
          <div className="flex gap-2">
            <Select
              placeholder="시작 시간"
              options={TIME_OPTIONS.map((t) => ({ label: t, value: t }))}
              value={startTime}
              onChange={(v) => {
                setStartTime(v);
                setEndTime(undefined);
              }}
              className="flex-1"
            />
            <Select
              placeholder="종료 시간"
              options={TIME_OPTIONS.map((t) => ({ label: t, value: t }))}
              value={endTime}
              onChange={setEndTime}
              className="flex-1"
            />
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              type="default"
              onClick={() => quickAdd(30)}
              className="clinic-quick-time-btn flex-1"
            >
              +30분
            </Button>
            <Button
              type="default"
              onClick={() => quickAdd(60)}
              className="clinic-quick-time-btn flex-1"
            >
              +1시간
            </Button>
          </div>
        </section>

        <section className="modal-form-group">
          <label className="modal-section-label">장소 · 정원</label>
          <Input
            placeholder="장소 / 룸"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            className="mb-3"
          />
          <div className="flex items-center gap-2">
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
              className="w-24"
            />
            <span className="text-xs text-[var(--color-text-muted)]">
              {selected.length > 0 ? "선택 인원으로 설정됨" : "명 (학생 없이 클리닉만 생성 시)"}
            </span>
          </div>
          <Input.TextArea
            rows={2}
            placeholder="메모 (선택)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="mt-3"
          />
        </section>

        <section className="modal-form-group">
          <label className="modal-section-label">대상자 선택</label>
          <Segmented
            options={[
              { label: "예약 대상자", value: "targets" },
              { label: "전체 학생", value: "students" },
            ]}
            value={mode}
            onChange={(v) => {
              setMode(v as any);
              setKeyword("");
              setSelected([]);
            }}
          />
          <Input
            placeholder={
              mode === "students"
                ? "학생 검색 (2글자 이상)"
                : "대상자 내 검색"
            }
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            allowClear
            className="mt-3"
          />
          <div
            className="clinic-action-row mt-3"
            onClick={() => toggleAll()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && toggleAll()}
          >
            <Checkbox checked={allChecked} onChange={toggleAll} onClick={(e) => e.stopPropagation()}>
              전체 선택
            </Checkbox>
          </div>
          <div className="max-h-[280px] overflow-auto border border-[var(--color-border-divider)] rounded-xl mt-3 p-2 space-y-1 bg-[var(--color-bg-surface-soft)]">
            {rows.map((r: any) => {
              const key =
                mode === "targets" ? r.enrollment_id : r.id;
              const label =
                mode === "targets" ? r.student_name : r.name;
              return (
                <label
                  key={key}
                  className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg hover:bg-[var(--color-bg-surface-hover)] cursor-pointer border border-transparent hover:border-[var(--color-border-divider)] transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(key)}
                    onChange={(e) => {
                      setSelected((prev) =>
                        e.target.checked
                          ? [...prev, key]
                          : prev.filter((id) => id !== key)
                      );
                    }}
                  />
                  <span className="flex-1 font-medium text-[var(--color-text-primary)]">{label}</span>
                </label>
              );
            })}
          </div>
          <Button
            type="primary"
            block
            size="large"
            loading={createSessionM.isPending}
            onClick={submit}
            className="mt-4 !rounded-xl !font-semibold !h-11"
          >
            {selected.length > 0
              ? `선택 ${selected.length}명 클리닉 생성`
              : `클리닉만 생성 (정원 ${maxParticipants}명)`}
          </Button>
        </section>
      </div>
    </div>
  );
}
