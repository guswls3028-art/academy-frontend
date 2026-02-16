// PATH: src/features/clinic/components/ClinicCreatePanel.tsx

import { useEffect, useMemo, useState } from "react";
import {
  Input,
  Button,
  Checkbox,
  Segmented,
  Select,
  message,
  Divider,
} from "antd";
import dayjs from "dayjs";

import { DatePicker } from "@/shared/ui/date";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useClinicTargets } from "../hooks/useClinicTargets";
import { useClinicStudentSearch } from "../hooks/useClinicStudentSearch";
import { fetchClinicStudentsDefault } from "../api/clinicStudents.api";

import api from "@/shared/api/axios";

type TargetRow = {
  enrollment_id: number;
  student_name: string;
};

type StudentRow = {
  id: number;
  name: string;
};

const TIME_OPTIONS = Array.from({ length: 26 }, (_, i) => {
  const h = Math.floor(i / 2) + 9;
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addMinutes(base: string | undefined, minutes: number) {
  if (!base) return undefined;
  const [h, m] = base.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  d.setMinutes(d.getMinutes() + minutes);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
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

  const [startTime, setStartTime] = useState<string>();
  const [endTime, setEndTime] = useState<string>();

  /**
   * ✅ UX 수정 포인트
   * - +30 / +1시간 버튼은 "누적"
   * - endTime이 있으면 endTime 기준으로 추가
   * - 없으면 startTime 기준으로 최초 계산
   */
  const quickAdd = (m: number) => {
    if (!startTime) {
      message.warning("시작 시간을 먼저 선택하세요.");
      return;
    }

    // 기준점: endTime이 있으면 그 뒤에 누적, 없으면 startTime 기준
    const base = endTime ?? startTime;
    setEndTime(addMinutes(base, m));
  };

  const [room, setRoom] = useState("");
  const [memo, setMemo] = useState("");

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
    if (!startTime || !endTime)
      return message.warning("시작/종료 시간을 선택해주세요.");
    if (selected.length === 0)
      return message.warning("학생을 1명 이상 선택해주세요.");
    if (!room.trim()) return message.warning("장소/룸을 입력해주세요.");

    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const duration = eh * 60 + em - (sh * 60 + sm);

    if (duration <= 0)
      return message.error("종료 시간은 시작 시간 이후여야 합니다.");

    try {
      await createSessionM.mutateAsync({
        date: selectedDate.format("YYYY-MM-DD"),
        start_time: startTime,
        duration_minutes: duration,
        location: room.trim(),
        max_participants: selected.length,
      });

      message.success("클리닉 생성 완료");
      setSelected([]);
      setMemo("");
      setEndTime(undefined);
      qc.invalidateQueries({ queryKey: ["clinic-participants"] });
      qc.invalidateQueries({ queryKey: ["clinic-sessions-tree"] });
      onCreated?.();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "생성 실패");
    }
  };

  return (
    <div className="rounded-2xl border bg-[var(--bg-surface)] overflow-hidden">
      <div className="px-5 py-4 border-b bg-[var(--bg-surface-soft)] flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">클리닉 생성</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
            시작·종료 시간 설정
          </div>
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          선택 {selected.length}명
        </div>
      </div>

      <div className="p-5 space-y-4">
        {!hideDatePicker && (
          <DatePicker
            value={selectedDate.format("YYYY-MM-DD")}
            onChange={(s) => setSelectedDate(dayjs(s))}
            placeholder="날짜 선택"
          />
        )}

        <div className="flex gap-2">
          <Select
            placeholder="시작 시간"
            options={TIME_OPTIONS.map((t) => ({ label: t, value: t }))}
            value={startTime}
            onChange={(v) => {
              setStartTime(v);
              setEndTime(undefined); // 시작 시간 바뀌면 종료 리셋
            }}
            className="flex-1 bg-[var(--bg-surface)]"
          />
          <Select
            placeholder="종료 시간"
            options={TIME_OPTIONS.map((t) => ({ label: t, value: t }))}
            value={endTime}
            onChange={setEndTime}
            className="flex-1 bg-[var(--bg-surface)]"
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={() => quickAdd(30)}>+30분</Button>
          <Button onClick={() => quickAdd(60)}>+1시간</Button>
        </div>

        <Input
          placeholder="장소 / 룸"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          className="bg-[var(--bg-surface)]"
        />

        <Input.TextArea
          rows={2}
          placeholder="메모 (선택)"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className="bg-[var(--bg-surface)]"
        />

        <Divider className="my-2" />

        <div className="space-y-2">
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
            className="bg-[var(--bg-surface)]"
          />

          <div className="flex items-center justify-between text-xs">
            <Checkbox checked={allChecked} onChange={toggleAll}>
              전체 선택
            </Checkbox>
          </div>

          <div className="max-h-[360px] overflow-auto border rounded-lg p-2 space-y-1">
            {rows.map((r: any) => {
              const key =
                mode === "targets" ? r.enrollment_id : r.id;
              const label =
                mode === "targets" ? r.student_name : r.name;
              return (
                <label
                  key={key}
                  className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-[var(--bg-surface-soft)]"
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
                  <span className="flex-1">{label}</span>
                </label>
              );
            })}
          </div>

          <Button
            type="primary"
            block
            loading={createSessionM.isPending}
            onClick={submit}
          >
            선택 {selected.length}명 클리닉 생성
          </Button>
        </div>
      </div>
    </div>
  );
}
