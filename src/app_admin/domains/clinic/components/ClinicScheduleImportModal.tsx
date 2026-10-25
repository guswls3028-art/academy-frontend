import { useId, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import { Check, Clock, MapPin, Users } from "lucide-react";

import AdminModal from "@/shared/ui/modal/AdminModal";
import ModalHeader from "@/shared/ui/modal/ModalHeader";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import api from "@/shared/api/axios";
import { fetchClinicSessionTree, type ClinicSessionTreeNode } from "../api/clinicSessions.api";
import { clinicQueryKeys } from "../queryKeys";
import { apiErrorMessage } from "./clinicCreatePanel.utils";

function mondayOfWeek(value: string) {
  const date = dayjs(value).startOf("day");
  return date.subtract((date.day() + 6) % 7, "day");
}

function weekLabel(start: string) {
  return `${dayjs(start).format("YYYY.M.D")} ~ ${dayjs(start).add(6, "day").format("YYYY.M.D")}`;
}

// Match the server's tenant/date/time/location/grade uniqueness contract.
function sessionKey(session: ClinicSessionTreeNode, date = session.date) {
  return JSON.stringify([
    date,
    session.start_time.length === 5 ? `${session.start_time}:00` : session.start_time,
    session.location.trim(),
    session.target_grade ?? null,
  ]);
}

type Props = { open: boolean; onClose: () => void; currentDate: string };

export default function ClinicScheduleImportModal({ open, currentDate, onClose }: Props) {
  // Reset inputs and selections on every opening or target-week change.
  return open ? <ImportContent key={currentDate} currentDate={currentDate} onClose={onClose} /> : null;
}

function ImportContent({ currentDate, onClose }: Omit<Props, "open">) {
  const qc = useQueryClient();
  const dateInputId = useId();
  const importLock = useRef(false);
  const targetStart = mondayOfWeek(currentDate).format("YYYY-MM-DD");
  const targetEnd = dayjs(targetStart).add(6, "day").format("YYYY-MM-DD");
  const [sourceDate, setSourceDate] = useState(() => dayjs(targetStart).subtract(7, "day").format("YYYY-MM-DD"));
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [createdKeys, setCreatedKeys] = useState<Set<string>>(new Set());
  const [failures, setFailures] = useState<Map<number, string>>(new Map());
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState(0);
  const validSource = /^\d{4}-\d{2}-\d{2}$/.test(sourceDate)
    && dayjs(sourceDate).isValid()
    && dayjs(sourceDate).format("YYYY-MM-DD") === sourceDate
    && sourceDate < targetStart;
  const sourceStart = validSource ? mondayOfWeek(sourceDate).format("YYYY-MM-DD") : "";
  const sourceEnd = validSource ? dayjs(sourceStart).add(6, "day").format("YYYY-MM-DD") : "";

  const sessionsQ = useQuery({
    queryKey: clinicQueryKeys.sessionsTreeImport(sourceStart, sourceEnd, "import"),
    queryFn: () => fetchClinicSessionTree({ date_from: sourceStart, date_to: sourceEnd }),
    enabled: validSource,
    refetchOnWindowFocus: !creating,
  });
  const targetQ = useQuery({
    queryKey: clinicQueryKeys.sessionsTreeImport(targetStart, targetEnd, "import-current"),
    queryFn: () => fetchClinicSessionTree({ date_from: targetStart, date_to: targetEnd }),
    refetchOnWindowFocus: !creating,
  });
  const loading = sessionsQ.isFetching || targetQ.isFetching;
  const dependencyError = sessionsQ.isError || targetQ.isError;
  const sourceSessions = useMemo(() => (sessionsQ.data ?? [])
    .filter((s) => s.date >= sourceStart && s.date <= sourceEnd)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)),
  [sessionsQ.data, sourceStart, sourceEnd]);
  const targetKeys = useMemo(() => new Set([
    ...createdKeys,
    ...(targetQ.data ?? []).map((s) => sessionKey(s)),
  ]), [createdKeys, targetQ.data]);
  const mappedDate = (date: string) => dayjs(targetStart)
    .add(dayjs(date).diff(dayjs(sourceStart), "day"), "day").format("YYYY-MM-DD");
  const isDuplicate = (s: ClinicSessionTreeNode) => targetKeys.has(sessionKey(s, mappedDate(s.date)));
  const available = sourceSessions.filter((s) => !isDuplicate(s));
  const selected = available.filter((s) => selectedIds.has(s.id));
  const grouped = useMemo(() => {
    const groups = new Map<string, ClinicSessionTreeNode[]>();
    for (const s of sourceSessions) {
      const group = groups.get(s.date) ?? [];
      group.push(s);
      groups.set(s.date, group);
    }
    return [...groups.entries()];
  }, [sourceSessions]);

  function changeSource(value: string) {
    if (importLock.current) return;
    setSourceDate(value);
    setSelectedIds(new Set());
    setFailures(new Map());
    setMessage("");
  }

  function toggleSession(id: number) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleImport() {
    if (importLock.current || !validSource || !selected.length || loading || dependencyError) return;
    importLock.current = true;
    setCreating(true);
    setProgress(0);
    setMessage("");
    setFailures(new Map());
    try {
      // Reconcile concurrent edits and requests whose responses were lost before any POST.
      const latest = await targetQ.refetch({ throwOnError: true });
      if (!latest.data) throw new Error("적용할 주의 일정을 확인하지 못했습니다.");
      const existing = new Set([...createdKeys, ...latest.data.map((s) => sessionKey(s))]);
      const toCreate = selected.filter((s) => !existing.has(sessionKey(s, mappedDate(s.date))));
      const skipped = selected.length - toCreate.length;
      const failed = new Map<number, string>();
      const saved = new Set<string>();
      // Bound request concurrency; each saved session remains independently recoverable.
      for (let offset = 0; offset < toCreate.length; offset += 3) {
        const batch = toCreate.slice(offset, offset + 3);
        const results = await Promise.allSettled(batch.map((s) => api.post("/clinic/sessions/", {
          title: s.title || "",
          date: mappedDate(s.date),
          start_time: s.start_time.length === 5 ? `${s.start_time}:00` : s.start_time,
          duration_minutes: s.duration_minutes ?? 60,
          location: s.location,
          max_participants: s.max_participants ?? 20,
          target_grade: s.target_grade ?? null,
          target_school_type: s.target_school_type ?? null,
          target_lecture_ids: s.target_lecture_ids ?? [],
          section: s.section ?? null,
          allow_time_preference: s.allow_time_preference === true,
          allow_multi_slot_booking: s.allow_multi_slot_booking === true,
          booking_mode: s.booking_mode ?? "fixed_slot",
          booking_interval_minutes: s.booking_interval_minutes ?? 60,
          booking_max_stay_minutes: s.booking_max_stay_minutes ?? 240,
        })));
        results.forEach((result, index) => {
          const session = batch[index];
          if (result.status === "fulfilled") saved.add(sessionKey(session, mappedDate(session.date)));
          else failed.set(session.id, apiErrorMessage(result.reason, "저장 결과를 확인하지 못했습니다. 다시 시도하면 기존 일정을 먼저 확인합니다."));
        });
        setProgress(Math.min(offset + batch.length, toCreate.length));
      }
      setCreatedKeys(new Set([...createdKeys, ...saved]));
      await Promise.all([
        qc.invalidateQueries({ queryKey: clinicQueryKeys.sessionsTree, predicate: (query) => query.queryKey[3] !== "import" }),
        qc.invalidateQueries({ queryKey: clinicQueryKeys.sessionsMonth }),
      ]);
      // A failed response may still have committed, or another operator may have won the race.
      const confirmed = qc.getQueryData<ClinicSessionTreeNode[]>(
        clinicQueryKeys.sessionsTreeImport(targetStart, targetEnd, "import-current"),
      );
      const confirmedKeys = new Set((confirmed ?? []).map((s) => sessionKey(s)));
      let reconciled = 0;
      for (const session of toCreate) {
        if (failed.has(session.id) && confirmedKeys.has(sessionKey(session, mappedDate(session.date)))) {
          failed.delete(session.id);
          reconciled += 1;
        }
      }
      if (failed.size) {
        setSelectedIds(new Set(failed.keys()));
        setFailures(failed);
        setMessage(`${saved.size}건 생성, ${failed.size}건 확인 필요. 항목별 안내를 확인하고 다시 시도해 주세요.`);
        return;
      }
      feedback.success(skipped + reconciled
        ? `${saved.size}건 생성, 이미 있는 ${skipped + reconciled}건은 건너뛰었습니다.`
        : `${saved.size}건의 클리닉을 ${weekLabel(targetStart)}에 불러왔습니다.`);
      onClose();
    } catch (error) {
      setMessage(apiErrorMessage(error, "적용할 주의 일정을 확인하지 못했습니다. 선택은 유지됩니다. 목록을 다시 불러온 뒤 시도해 주세요."));
    } finally {
      importLock.current = false;
      setCreating(false);
    }
  }

  return (
    <AdminModal open onClose={() => { if (!importLock.current) onClose(); }} width={620}
      closeDisabled={creating} noMinimize trapFocus>
      <ModalHeader title="지난 일정 불러오기" noIcon description="시험·방학으로 쉬었던 주가 있어도 원하는 주의 일정을 다시 사용할 수 있습니다." />
      <div className="clinic-import">
        <div className="clinic-import__body" aria-busy={creating}>
          <div className="clinic-import__target">
            <span>적용할 주</span><strong>{weekLabel(targetStart)}</strong>
            <small>같은 요일과 시간으로 복사합니다. 학생 예약·출결은 복사하지 않습니다.</small>
          </div>
          <div className="clinic-import__source">
            <label htmlFor={dateInputId}>가져올 주의 날짜</label>
            <input id={dateInputId} type="date" value={sourceDate}
              max={dayjs(targetStart).subtract(1, "day").format("YYYY-MM-DD")}
              onChange={(event) => changeSource(event.target.value)} disabled={creating}
              aria-invalid={!validSource} aria-describedby={`${dateInputId}-hint`} />
            <div className="clinic-import__shortcuts" aria-label="가져올 주 빠른 선택">
              {[1, 2, 4].map((weeks) => {
                const start = dayjs(targetStart).subtract(weeks * 7, "day").format("YYYY-MM-DD");
                return <Button key={weeks} intent={sourceStart === start ? "primary" : "secondary"}
                  size="sm" disabled={creating} aria-pressed={sourceStart === start}
                  onClick={() => changeSource(start)}>{weeks}주 전</Button>;
              })}
            </div>
            <p id={`${dateInputId}-hint`} className="clinic-import__hint">
              {validSource ? `가져올 주: ${weekLabel(sourceStart)} (월~일)` : "적용할 주보다 앞선 날짜를 선택해 주세요."}
            </p>
          </div>
          {message && <p className="clinic-import__error" role="alert">{message}</p>}
          {!validSource ? null : loading && !creating ? (
            <div className="clinic-import__loading" role="status">일정을 확인하는 중...</div>
          ) : dependencyError ? (
            <div className="clinic-import__empty" role="alert">
              <span>가져올 주 또는 적용할 주의 일정을 불러오지 못했습니다.</span>
              <Button intent="secondary" size="sm" disabled={creating} onClick={() => {
                void sessionsQ.refetch();
                void targetQ.refetch();
              }}>다시 시도</Button>
            </div>
          ) : sourceSessions.length === 0 ? (
            <div className="clinic-import__empty">
              <strong>선택한 주에는 클리닉이 없습니다.</strong>
              <span>위 날짜를 바꾸거나 2주 전·4주 전 일정을 확인해 보세요.</span>
              <Button intent="secondary" size="sm" onClick={() => changeSource(dayjs(sourceStart).subtract(7, "day").format("YYYY-MM-DD"))}>한 주 더 이전 보기</Button>
            </div>
          ) : <>
            <div className="clinic-import__select-all">
              <button type="button" className="clinic-import__select-all-btn"
                disabled={creating || available.length === 0} aria-pressed={available.length > 0 && selected.length === available.length}
                onClick={() => setSelectedIds(selected.length === available.length ? new Set() : new Set(available.map((s) => s.id)))}>
                <span aria-hidden className={`clinic-import__checkbox ${available.length > 0 && selected.length === available.length ? "clinic-import__checkbox--checked" : ""}`}>
                  {available.length > 0 && selected.length === available.length && <Check size={12} />}
                </span>
                전체 선택 ({available.length}건)
              </button>
              <span>{sourceSessions.length - available.length > 0 && `이미 있는 ${sourceSessions.length - available.length}건 제외`}</span>
            </div>
            {available.length === 0 && <p className="clinic-import__hint" role="status">모든 일정이 적용할 주에 이미 있습니다. 다른 주를 선택할 수 있습니다.</p>}
            <div className="clinic-import__list" key={sourceStart}>
              {grouped.map(([date, rows]) => <div key={date} className="clinic-import__date-group">
                <div className="clinic-import__date-label">{dayjs(date).locale("ko").format("M/D (dd)")}</div>
                {rows.map((s) => {
                  const duplicate = isDuplicate(s);
                  const checked = !duplicate && selectedIds.has(s.id);
                  return <div key={s.id}>
                    <button type="button" disabled={creating || duplicate} aria-pressed={checked}
                      className={`clinic-import__session-item ${checked ? "clinic-import__session-item--selected" : ""} ${duplicate ? "clinic-import__session-item--duplicate" : ""}`}
                      onClick={() => toggleSession(s.id)}>
                      <span aria-hidden className={`clinic-import__checkbox ${checked ? "clinic-import__checkbox--checked" : ""}`}>{checked && <Check size={12} />}</span>
                      <span className="clinic-import__session-info">
                        <span className="clinic-import__session-time"><Clock size={12} aria-hidden />{s.start_time.slice(0, 5)}</span>
                        <span className="clinic-import__session-location"><MapPin size={12} aria-hidden />{s.location}</span>
                        {s.title && <span className="clinic-import__session-title">{s.title}</span>}
                        <span className="clinic-import__session-capacity"><Users size={12} aria-hidden />{s.max_participants ?? "—"}명 · {s.target_grade ? `${s.target_grade}학년` : "전체 학년"}</span>
                        <span className="clinic-import__session-mapped">→ {dayjs(mappedDate(s.date)).locale("ko").format("M/D(dd)")}
                          {duplicate && <span className="clinic-import__dup-badge">이미 있음</span>}
                        </span>
                      </span>
                    </button>
                    {failures.has(s.id) && !duplicate && <p className="clinic-import__error">{failures.get(s.id)}</p>}
                  </div>;
                })}
              </div>)}
            </div>
          </>}
        </div>
        <div className="clinic-import__footer">
          <span className="clinic-import__hint" role="status">{creating ? `${progress}건 처리 · 저장 중입니다` : `${selected.length}건 선택`}</span>
          <Button intent="secondary" size="md" onClick={onClose} disabled={creating}>취소</Button>
          <Button intent="primary" size="md" onClick={handleImport} loading={creating}
            disabled={!validSource || selected.length === 0 || creating || loading || dependencyError}>
            {selected.length > 0 ? `${selected.length}건 불러오기` : "선택하세요"}
          </Button>
        </div>
      </div>
    </AdminModal>
  );
}

