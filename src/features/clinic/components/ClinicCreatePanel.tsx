// PATH: src/features/clinic/components/ClinicCreatePanel.tsx
// 클리닉 생성 — 차시 추가 모달과 똑같은 DatePicker·TimeRangeInput만 사용 (같은 컴포넌트·같은 props, 직접선택 행 없음)

import { useEffect, useState } from "react";
import { Input, App, Popover } from "antd";
import dayjs from "dayjs";
import { Save, FolderOpen, Trash2 } from "lucide-react";

import { DatePicker } from "@/shared/ui/date";
import { TimeRangeInput } from "@/shared/ui/time";
import { Button } from "@/shared/ui/ds";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { fetchClinicSessionTree } from "../api/clinicSessions.api";
import ClinicTargetSelectModal, { type ClinicTargetSelectResult } from "./ClinicTargetSelectModal";

import api from "@/shared/api/axios";

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
  onDateChange?: (date: string) => void;
  onCreated?: (createdDate?: string) => void;
};

export default function ClinicCreatePanel({
  date,
  defaultMode = "targets",
  hideDatePicker = false,
  selectedTargetEnrollmentIds,
  onChangeSelectedTargetEnrollmentIds,
  onDateChange,
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
  const [targetModalOpen, setTargetModalOpen] = useState(false);

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

  const handleTargetModalConfirm = (result: ClinicTargetSelectResult) => {
    setMode(result.mode);
    if (result.mode === "targets" && onChangeSelectedTargetEnrollmentIds) {
      onChangeSelectedTargetEnrollmentIds(result.ids);
    } else {
      setInternalSelected(result.ids);
    }
  };

  const [title, setTitle] = useState("");
  const [targetGrade, setTargetGrade] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState("");
  const [room, setRoom] = useState("");
  const [memo, setMemo] = useState("");
  const [maxParticipants, setMaxParticipants] = useState<number>(10);

  const [savedLocations, setSavedLocations] = useState<string[]>(() => getSavedLocations());
  const [loadPopoverOpen, setLoadPopoverOpen] = useState(false);
  const [addLocationInput, setAddLocationInput] = useState("");

  const createSessionM = useMutation({
    mutationFn: async (payload: {
      title?: string;
      date: string;
      start_time: string;
      duration_minutes: number;
      location: string;
      max_participants: number;
      target_grade?: number | null;
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
        title: title.trim() || undefined,
        date: selectedDate.format("YYYY-MM-DD"),
        start_time: toHHmmss(start),
        duration_minutes: duration,
        location: room.trim(),
        max_participants: cap,
        target_grade: targetGrade,
      });

      message.success("클리닉 생성 완료");
      setSelected([]);
      setMemo("");
      setTimeRange("");
      qc.invalidateQueries({ queryKey: ["clinic-participants"] });
      qc.invalidateQueries({ queryKey: ["clinic-sessions-tree"] });
      qc.invalidateQueries({ queryKey: ["clinic-sessions-month"] });
      // 생성한 날짜의 연·월로 트리 즉시 refetch (목록 반영 보장)
      const y = selectedDate.year();
      const m = selectedDate.month() + 1;
      await qc.fetchQuery({
        queryKey: ["clinic-sessions-tree", y, m],
        queryFn: () => fetchClinicSessionTree({ year: y, month: m }),
      });
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
        <div className="modal-scroll-body modal-scroll-body--compact flex flex-col gap-5 flex-1 min-h-0 w-full max-w-full box-border">
          {/* 날짜 — 모달 SSOT: modal-form-group으로 영역 구분 */}
          {!hideDatePicker && (
            <div className="modal-form-group modal-form-group--compact">
              <label className="modal-section-label">날짜</label>
              <div className="flex flex-col gap-2">
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
            </div>
          )}

          {/* 제목 · 대상 학년 */}
          <div className="modal-form-group modal-form-group--compact flex flex-col gap-3">
            <label className="modal-section-label">제목 · 학년</label>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                placeholder="클리닉 제목 (선택)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="clinic-input-filled flex-1 min-w-[140px]"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-sm font-semibold text-[var(--color-text-muted)] whitespace-nowrap">학년</span>
                {([null, 1, 2, 3] as const).map((g) => (
                  <button
                    key={g ?? "all"}
                    type="button"
                    onClick={() => setTargetGrade(g)}
                    style={{
                      padding: "4px 10px",
                      fontSize: 12,
                      fontWeight: targetGrade === g ? 700 : 500,
                      borderRadius: 6,
                      border: `1px solid ${targetGrade === g ? "var(--color-brand-primary)" : "var(--color-border-divider)"}`,
                      background: targetGrade === g ? "var(--color-brand-primary)" : "var(--color-bg-surface)",
                      color: targetGrade === g ? "#fff" : "var(--color-text-secondary)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {g === null ? "전체" : `${g}학년`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 시간 — 모달 SSOT: modal-form-group으로 영역 구분 */}
          <div className="modal-form-group modal-form-group--compact">
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

          {/* 장소 · 정원 · 메모 — 모달 SSOT */}
          <div className="modal-form-group modal-form-group--compact flex flex-col gap-3">
            <label className="modal-section-label">장소 · 정원</label>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-1 min-w-[180px] gap-2 items-center">
                <Input
                  placeholder="장소 / 룸"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  className="clinic-input-filled flex-1 min-w-0"
                />
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
                  className="clinic-location-icon-btn"
                  title="장소 저장"
                  aria-label="장소 저장"
                >
                  <Save size={16} />
                </button>
                <Popover
                  open={loadPopoverOpen}
                  onOpenChange={(open) => {
                    setLoadPopoverOpen(open);
                    if (open) setSavedLocations(getSavedLocations());
                  }}
                  trigger="click"
                  placement="bottomLeft"
                  content={
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
                              size="small"
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
                            <div
                              key={loc}
                              className="clinic-location-popover-item-row"
                            >
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
                                size="small"
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
                  }
                >
                  <button
                    type="button"
                    className="clinic-location-icon-btn"
                    title="장소 불러오기"
                    aria-label="장소 불러오기"
                  >
                    <FolderOpen size={16} />
                  </button>
                </Popover>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-semibold text-[var(--color-text-muted)] whitespace-nowrap">정원</span>
                <div className="clinic-capacity-stepper">
                  <button
                    type="button"
                    className="clinic-capacity-stepper__btn"
                    onClick={() => setMaxParticipants((p) => Math.max(1, p - 1))}
                    disabled={selected.length > 0}
                    aria-label="정원 1 감소"
                  >
                    −
                  </button>
                  <span className="clinic-capacity-stepper__value">
                    {selected.length > 0 ? selected.length : maxParticipants}
                  </span>
                  <button
                    type="button"
                    className="clinic-capacity-stepper__btn"
                    onClick={() => setMaxParticipants((p) => Math.min(999, p + 1))}
                    disabled={selected.length > 0}
                    aria-label="정원 1 증가"
                  >
                    +
                  </button>
                </div>
                <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                  {selected.length > 0 ? "선택 인원으로 설정" : "명"}
                </span>
              </div>
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

          {/* 대상자 선택 — 모달로 분리 (수강대상등록 스타일) */}
          <div className="modal-form-group modal-form-group--compact flex flex-col gap-2">
            <label className="modal-section-label">대상자 선택</label>
            <div className="flex items-center gap-3 flex-wrap">
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
              <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                {selected.length > 0
                  ? `${mode === "targets" ? "예약 대상자" : "전체 학생"} ${selected.length}명 선택됨`
                  : "선택한 대상 없음"}
              </span>
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
            disabled={isPastDate}
          >
            {isPastDate
              ? "지난 날짜 — 생성 불가"
              : selected.length > 0
                ? `선택 ${selected.length}명 클리닉 생성`
                : `클리닉만 생성 (정원 ${maxParticipants}명)`}
          </Button>
        </div>
      </div>

      <ClinicTargetSelectModal
        open={targetModalOpen}
        onClose={() => setTargetModalOpen(false)}
        initialMode={mode}
        initialSelectedIds={selected}
        onConfirm={handleTargetModalConfirm}
      />
    </div>
  );
}
