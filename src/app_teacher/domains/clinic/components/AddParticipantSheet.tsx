/* eslint-disable no-restricted-syntax */
// PATH: src/app_teacher/domains/clinic/components/AddParticipantSheet.tsx
// 클리닉 세션 참가자 추가 — 학생 검색 + 다중 선택 + 일괄 등록
// PC ClinicCreatePanel + ClinicTargetSelectModal 의 모바일 단순화 버전 (student 모드만).
import { useEffect, useMemo, useState } from "react";
import { ICON } from "@/shared/ui/ds";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchStudents } from "@teacher/domains/students/api";
import {
  createClinicParticipantsBulk,
  type TeacherClinicSession,
} from "../api";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { Search, Check } from "@teacher/shared/ui/Icons";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";
import { teacherClinicQueryKeys } from "../queryKeys";
interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: number;
  availableSessions: TeacherClinicSession[];
  alreadyParticipantStudentIds: number[];
}

function hhmm(value?: string | null): string {
  return value?.slice(0, 5) || "시간 미정";
}

function toMinutes(value?: string | null): number {
  const [hour, minute] = hhmm(value).split(":").map(Number);
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : 0;
}

function sessionEndMinutes(session: TeacherClinicSession): number {
  if (session.end_time) return toMinutes(session.end_time);
  return toMinutes(session.start_time) + (session.duration_minutes ?? 0);
}

function isFull(session: TeacherClinicSession): boolean {
  return session.is_full === true || (
    session.max_participants != null
    && (session.booked_count ?? session.participant_count ?? 0) >= session.max_participants
  );
}

export default function AddParticipantSheet({
  open,
  onClose,
  sessionId,
  availableSessions,
  alreadyParticipantStudentIds,
}: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<number[]>([sessionId]);

  const sessions = useMemo(() => {
    const initial = availableSessions.find((session) => session.id === sessionId);
    return availableSessions
      .filter((session) => session.date === initial?.date)
      .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
  }, [availableSessions, sessionId]);

  const selectedSessions = sessions.filter((session) => selectedSessionIds.includes(session.id));
  const firstSelected = selectedSessions[0];
  const lastSelected = selectedSessions[selectedSessions.length - 1];
  const selectedSessionsAllowMultiple = selectedSessions.every(
    (session) => session.allow_multi_slot_booking === true,
  );
  const selectedRange = firstSelected && lastSelected
    ? `${hhmm(firstSelected.start_time)}–${hhmm(lastSelected.end_time ?? lastSelected.start_time)}`
    : "시간대를 선택하세요";

  const selectThrough = (targetSession: TeacherClinicSession) => {
    const anchorIndex = sessions.findIndex((session) => session.id === sessionId);
    const targetIndex = sessions.findIndex((session) => session.id === targetSession.id);
    if (anchorIndex < 0 || targetIndex < 0) return;
    const startIndex = Math.min(anchorIndex, targetIndex);
    const endIndex = Math.max(anchorIndex, targetIndex);
    const range = sessions.slice(startIndex, endIndex + 1);
    const isContinuous = range.every((session, index) => (
      index === 0 || sessionEndMinutes(range[index - 1]) === toMinutes(session.start_time)
    ));
    if (!isContinuous) {
      teacherToast.info("이어진 시간대만 함께 선택할 수 있습니다.");
      return;
    }
    if (range.some((session) => session.allow_multi_slot_booking !== true)) {
      teacherToast.info("여러 시간대 예약을 허용한 일정끼리만 선택할 수 있습니다.");
      return;
    }
    if (range.some((session) => session.id !== sessionId && isFull(session))) {
      teacherToast.info("정원이 남아 있는 시간대만 함께 선택할 수 있습니다.");
      return;
    }
    setSelectedSessionIds(range.map((session) => session.id));
  };

  useEffect(() => {
    if (!open) return;
    setSelectedSessionIds([sessionId]);
    setSelected([]);
    setSearch("");
  }, [open, sessionId]);

  const { data } = useQuery({
    queryKey: teacherClinicQueryKeys.addStudents(search),
    queryFn: () => fetchStudents({ search: search || undefined, page_size: 100 }),
    enabled: open,
  });

  const students = (data?.data ?? []).filter(
    (s) => !alreadyParticipantStudentIds.includes(s.id),
  );

  const mutation = useMutation({
    mutationFn: () => createClinicParticipantsBulk({
      session_ids: selectedSessionIds,
      student_ids: selected,
    }),
    onSuccess: () => {
      selectedSessionIds.forEach((selectedSessionId) => {
        qc.invalidateQueries({
          queryKey: teacherClinicQueryKeys.participants(selectedSessionId),
        });
      });
      qc.invalidateQueries({ queryKey: teacherClinicQueryKeys.sessions });
      teacherToast.success(
        selectedSessionIds.length > 1
          ? `${selected.length}명이 ${selectedSessionIds.length}개 시간대에 추가되었습니다.`
          : `${selected.length}명이 클리닉에 추가되었습니다.`,
      );
      setSelected([]);
      setSelectedSessionIds([sessionId]);
      setSearch("");
      onClose();
    },
    onError: (e) => teacherToast.error(extractApiError(e, "학생 추가에 실패했습니다.")),
  });

  const toggle = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="학생 추가">
      <div className="flex flex-col gap-2" style={{ padding: "var(--tc-space-2) 0" }}>
        <div
          className="flex flex-col gap-2"
          style={{
            padding: "var(--tc-space-3)",
            border: "1px solid var(--tc-border)",
            borderRadius: "var(--tc-radius)",
            background: "var(--tc-surface-soft)",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold" style={{ color: "var(--tc-text)" }}>
              추가할 시간대
            </span>
            <span className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
              허용된 일정끼리 여러 개 선택
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sessions.map((session) => {
              const checked = selectedSessionIds.includes(session.id);
              const fixed = session.id === sessionId;
              const full = isFull(session);
              const policyBlocked = !checked && (
                session.allow_multi_slot_booking !== true || !selectedSessionsAllowMultiple
              );
              return (
                <button
                  key={session.id}
                  type="button"
                  aria-pressed={checked}
                  disabled={fixed || full || policyBlocked}
                  onClick={() => selectThrough(session)}
                  className="text-xs font-bold cursor-pointer disabled:cursor-not-allowed"
                  style={{
                    padding: "7px 9px",
                    border: checked ? "1px solid var(--tc-primary)" : "1px solid var(--tc-border)",
                    borderRadius: "999px",
                    background: checked ? "var(--tc-primary)" : "var(--tc-surface)",
                    color: checked ? "#fff" : "var(--tc-text-muted)",
                    opacity: full && !checked ? 0.45 : 1,
                  }}
                >
                  {hhmm(session.start_time)}–{hhmm(session.end_time ?? session.start_time)}
                  {session.allow_multi_slot_booking === true ? " · 여러 시간대" : " · 한 타임"}
                </button>
              );
            })}
          </div>
          <section
            role="region"
            aria-label="선택한 클리닉 시간"
            className="flex items-end justify-between gap-2"
          >
            <strong
              className="text-xl"
              style={{ color: "var(--tc-text)", fontVariantNumeric: "tabular-nums" }}
            >
              {selectedRange}
            </strong>
            <span className="text-[11px] font-bold" style={{ color: "var(--tc-primary)" }}>
              {selectedSessionIds.length}개 시간대
            </span>
          </section>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2" style={{ padding: "0 0 var(--tc-space-2)", borderBottom: "1px solid var(--tc-border-subtle)" }}>
          <Search size={ICON.sm} style={{ color: "var(--tc-text-muted)" }} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="학생 이름/전화 검색"
            className="flex-1 text-sm"
            style={{ border: "none", background: "transparent", color: "var(--tc-text)", outline: "none" }} />
        </div>

        {/* Student list */}
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {students.length === 0 ? (
            <div className="text-sm text-center py-4" style={{ color: "var(--tc-text-muted)" }}>
              {search ? "검색 결과 없음" : "추가 가능한 학생이 없습니다"}
            </div>
          ) : (
            students.map((s) => {
              const checked = selected.includes(s.id);
              return (
                <button key={s.id} onClick={() => toggle(s.id)}
                  className="flex items-center gap-2 w-full text-left cursor-pointer"
                  style={{ padding: "8px 4px", background: "none", border: "none", borderBottom: "1px solid var(--tc-border-subtle)" }}>
                  <span className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                    style={{ border: checked ? "none" : "1.5px solid var(--tc-border-strong)", background: checked ? "var(--tc-primary)" : "transparent" }}>
                    {checked && <Check size={ICON.xs} style={{ color: "#fff" }} />}
                  </span>
                  <span className="text-sm font-medium" style={{ color: "var(--tc-text)" }}>{s.name}</span>
                  <span className="text-[11px] ml-auto" style={{ color: "var(--tc-text-muted)" }}>
                    {s.grade ? `${s.grade}학년` : ""} {s.school || ""}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Submit */}
        <button onClick={() => mutation.mutate()} disabled={selected.length === 0 || selectedSessionIds.length === 0 || mutation.isPending}
          className="w-full text-sm font-bold cursor-pointer mt-1"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: selected.length > 0 ? "var(--tc-primary)" : "var(--tc-surface-soft)", color: selected.length > 0 ? "#fff" : "var(--tc-text-muted)" }}>
          {mutation.isPending
            ? "추가 중..."
            : selectedSessionIds.length > 1
              ? `${selected.length}명을 ${selectedSessionIds.length}개 시간대에 추가`
              : `${selected.length}명 추가`}
        </button>
      </div>
    </BottomSheet>
  );
}
