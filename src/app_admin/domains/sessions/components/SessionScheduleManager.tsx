import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Plus, Search } from 'lucide-react';
import { Button } from '@/shared/ui/ds';
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from '@/shared/ui/modal';
import { DatePicker } from '@/shared/ui/date';
import { TimeRangeInput } from '@/shared/ui/time';
import { useConfirm } from '@/shared/ui/confirm';
import { extractApiError } from '@/shared/utils/extractApiError';
import { fetchSessions } from '@/shared/api/contracts/sessions';
import { adminSessionQueryKeys } from '../queryKeys';
import { copySessionSchedules, fetchSessionSchedules, saveSessionSchedules, type SessionScheduleDraft, type SessionSchedules } from '@/shared/api/contracts/sessionSchedules';
import styles from './SessionScheduleStrip.module.css';
import { useScheduleLeaveGuard } from './useScheduleLeaveGuard';

type Draft = SessionScheduleDraft & { key: string };
type Props = {
  open: boolean;
  addRequest: number;
  editDayId: string | null;
  onClose: () => void;
  sessionId: number;
  lectureId: number;
  sessionDate: string;
  sessionOrder: number;
  data: SessionSchedules;
  onSaved: (data: SessionSchedules) => void;
};

export default function SessionScheduleManager({ open, addRequest, editDayId, onClose, sessionId, lectureId, sessionDate, sessionOrder, data, onSaved }: Props) {
  const confirm = useConfirm();
  const [base, setBase] = useState<SessionSchedules | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [target, setTarget] = useState('');
  const [source, setSource] = useState('');
  const handledAdd = useRef(0);
  const nameRef = useRef<HTMLInputElement>(null);
  const activeDayRef = useRef<HTMLButtonElement>(null);
  const focusName = useRef(false);
  useScheduleLeaveGuard(lectureId, sessionId, dirty, busy);
  const sessions = useQuery({
    queryKey: adminSessionQueryKeys.scheduleCopySessions(lectureId),
    queryFn: () => fetchSessions(lectureId), enabled: open,
  });
  const previous = (sessions.data ?? []).filter(s => s.id !== sessionId && s.order < sessionOrder).sort((a, b) => b.order - a.order);
  const sourceId = source || String(previous[0]?.id ?? '');
  const reset = (value: SessionSchedules, preferredId?: string | null) => {
    setBase(value);
    setDrafts(value.schedules.map(s => ({ ...s, enrollment_ids: [...s.enrollment_ids], key: String(s.id) })));
    const day = value.schedules.find(item => String(item.id) === preferredId) ?? value.schedules[0];
    setDirty(false);
    setSelected([]);
    setTarget(String(day?.id ?? ''));
    setSearch('');
    setError('');
    setConflict(false);
  };
  useEffect(() => {
    // Reopening an untouched form adopts fresh server state; never overwrite a draft.
    if (!open) return;
    if (!dirty) reset(data, editDayId);
    else if (editDayId && drafts.some(day => day.key === editDayId)) {
      setTarget(editDayId);
      setSelected([]);
    }
  }, [open, data, editDayId]); // eslint-disable-line react-hooks/exhaustive-deps
  const addDay = () => {
    const key = crypto.randomUUID();
    setDrafts(rows => {
      const lastDate = rows[rows.length - 1]?.date;
      const next = lastDate ? new Date(`${lastDate}T00:00:00Z`) : null;
      if (next) next.setUTCDate(next.getUTCDate() + 1);
      const date = next && Number.isFinite(next.getTime()) ? next.toISOString().slice(0, 10) : sessionDate;
      return [...rows, { key, label: '', date, start_time: null, end_time: null, enrollment_ids: [] }];
    });
    setTarget(key);
    setSelected([]);
    setDirty(true);
    if (!conflict) setError('');
    focusName.current = true;
  };
  useEffect(() => {
    if (!open || !base || addRequest === handledAdd.current) return;
    handledAdd.current = addRequest;
    addDay();
  }, [open, base, addRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    activeDayRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (!focusName.current) return;
    nameRef.current?.focus();
    focusName.current = false;
  }, [target]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const roster = base?.roster ?? data.roster;
  const visible = roster.filter(s => s.student_name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const chosen = new Set(selected);
  const allVisible = visible.length > 0 && visible.every(s => chosen.has(s.enrollment_id));
  const change = (key: string, patch: Partial<Draft>) => {
    setDrafts(rows => rows.map(s => s.key === key ? { ...s, ...patch } : s)); setDirty(true); if (!conflict) setError('');
  };
  const assign = (dayKey: string) => {
    setDrafts(rows => rows.map(s => ({ ...s, enrollment_ids: [
      ...s.enrollment_ids.filter(id => !chosen.has(id)), ...(s.key === dayKey ? selected : []),
    ] })));
    setDirty(true); setSelected([]); if (!conflict) setError('');
  };
  const fail = (e: unknown) => {
    const stale = (e as { response?: { status?: number } }).response?.status === 409;
    setConflict(stale);
    setError(stale ? '다른 곳에서 수업일 또는 학생 명단이 변경되었습니다. 작성 내용은 보관 중입니다. 최신 내용을 확인한 뒤 다시 작성해 주세요.' : extractApiError(e, '저장하지 못했습니다. 작성 내용은 유지됩니다. 다시 시도해 주세요.'));
  };
  const save = async () => {
    if (!base || busyRef.current || conflict) return;
    const labels = new Set<string>();
    for (const day of drafts) {
      const name = day.label.trim();
      let message = '';
      if (!name || !day.date) message = '수업일 이름과 날짜를 입력해 주세요.';
      else if (labels.has(name)) message = '수업일마다 다른 이름을 입력해 주세요.';
      else if (day.end_time && (!day.start_time || day.start_time >= day.end_time)) message = '시작 시간을 입력하고 종료 시간을 더 늦게 설정해 주세요.';
      if (message) {
        setTarget(day.key);
        setError(message);
        return;
      }
      labels.add(name);
    }
    if (base.schedules.length > 0 && drafts.length === 0) {
      const ok = await confirm({ title: '마지막 수업일 설정을 삭제할까요?', message: `저장하면 모든 학생의 수업일이 원래 차시 날짜${sessionDate ? ` (${sessionDate})` : ' (날짜 미설정)'}로 돌아갑니다. 출결·성적·시험·과제·영상 기록은 그대로 유지됩니다.`, confirmText: '원래 날짜로 돌아가기', danger: true });
      if (!ok || busyRef.current) return;
    }
    busyRef.current = true; setBusy(true); setError('');
    try {
      const saved = await saveSessionSchedules(sessionId, base.version, drafts.map(s => ({ id: s.id, label: s.label.trim(), date: s.date, start_time: s.start_time, end_time: s.end_time, enrollment_ids: s.enrollment_ids })));
      reset(saved); onSaved(saved); onClose();
    } catch (e) { fail(e); } finally { busyRef.current = false; setBusy(false); }
  };
  const copy = async () => {
    if (!base || base.schedules.length > 0 || !sourceId || busyRef.current || conflict) return;
    const ok = await confirm({ title: '이전 차시의 수업일을 가져올까요?', message: '작성 중인 내용을 대신해 이전 차시의 수업일을 가져와 바로 저장합니다. 날짜는 두 차시의 날짜 차이만큼 이동하며, 학생 배정은 현재 수강 명단을 기준으로 가져옵니다. 기존 출결·성적·영상은 유지됩니다.', confirmText: '가져와 저장' });
    if (!ok || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { const saved = await copySessionSchedules(sessionId, base.version, Number(sourceId)); reset(saved); onSaved(saved); }
    catch (e) { fail(e); } finally { busyRef.current = false; setBusy(false); }
  };
  const reload = async () => {
    if (busyRef.current) return;
    if (dirty && !await confirm({ title: '최신 내용으로 다시 시작할까요?', message: '이 창의 미저장 내용은 버리고 현재 저장된 수업일과 학생 명단을 불러옵니다.', confirmText: '최신 내용 불러오기', danger: true })) return;
    busyRef.current = true; setBusy(true);
    try { const latest = await fetchSessionSchedules(sessionId); reset(latest); }
    catch (e) { setError(extractApiError(e, '최신 내용을 불러오지 못했습니다. 작성 내용은 유지됩니다.')); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const assigned = new Map(drafts.flatMap(day => day.enrollment_ids.map(id => [id, day] as const)));
  const activeIndex = drafts.findIndex(day => day.key === target);
  const active = drafts[activeIndex];
  const activeLabel = active?.label.trim() || '선택한 수업일';
  const unassignedCount = roster.length - assigned.size;
  const canUnassign = selected.some(id => assigned.has(id));
  const removeDay = (key: string) => {
    const remaining = drafts.filter(day => day.key !== key);
    setDrafts(remaining);
    setTarget(remaining[Math.min(activeIndex, remaining.length - 1)]?.key ?? '');
    setSelected([]);
    setDirty(true);
    if (!conflict) setError('');
  };

  function toggleAllVisible() {
    const visibleIds = new Set(visible.map(student => student.enrollment_id));
    setSelected(ids => allVisible ? ids.filter(id => !visibleIds.has(id)) : [...new Set([...ids, ...visibleIds])]);
  }

  return (
    <AdminModal open={open} onClose={onClose} width={980} noMinimize trapFocus closeDisabled={busy}>
      <ModalHeader title="수업일 관리" noIcon description="수업일을 추가하고 날짜별로 학생을 배정하세요." />
      <ModalBody>
        <div className={styles.body}>
          {error && <div className={styles.error} role="alert">{error}{conflict && <div className={styles.actions}>
            <Button size="sm" intent="secondary" disabled={busy} onClick={() => void reload()}>최신 내용으로 다시 시작</Button>
          </div>}</div>}
          <fieldset disabled={busy} className={styles.editor}>
            <legend className="sr-only">수업일과 학생 배정</legend>
            <section className={styles.editorDays} aria-label="수업일 목록">
              <div className={styles.panelTitle}>
                <h3>수업일 <small>{drafts.length}개</small></h3>
                <Button size="sm" intent="secondary" leftIcon={<Plus size={15} aria-hidden />} onClick={addDay}>수업일 추가</Button>
              </div>
              {drafts.length > 0 && <div className={styles.editorDayList}>
                {drafts.map((day, index) => (
                  <button key={day.key} ref={day.key === target ? activeDayRef : undefined} type="button" className={styles.editorDay} aria-pressed={day.key === target}
                    onClick={() => { setTarget(day.key); setSelected([]); }}>
                    <CalendarDays size={16} aria-hidden />
                    <span><strong>{day.label.trim() || `수업일 ${index + 1}`}</strong><small>{day.date || '날짜 선택'} · {day.enrollment_ids.length}명</small></span>
                  </button>
                ))}
              </div>}
              {active ? (
                <section className={styles.fieldsPanel} key={active.key} aria-label={`수업일 ${activeIndex + 1}`}>
                  <div className={styles.fields}>
                    <label>이름<input ref={nameRef} className="ds-input" aria-label={`수업일 ${activeIndex + 1} 이름`} maxLength={40} value={active.label} placeholder="예: 수요일반" onChange={e => change(active.key, { label: e.target.value })} /></label>
                    <div><label htmlFor={`schedule-date-${active.key}`}>날짜</label><DatePicker id={`schedule-date-${active.key}`} value={active.date} onChange={date => change(active.key, { date })} disabled={busy} /></div>
                  </div>
                  <details className={styles.timeOptions}>
                    <summary>시간 설정 (선택){(active.start_time || active.end_time) && <span>{active.start_time || '시작 미설정'} ~ {active.end_time || '종료 미설정'}</span>}</summary>
                    <div role="group" aria-label={`수업일 ${activeIndex + 1} 시간 (선택)`}>
                      <TimeRangeInput value={`${active.start_time ?? ''}~${active.end_time ?? ''}`} onChange={value => {
                        const [start, end] = value.split('~');
                        change(active.key, { start_time: start || null, end_time: end || null });
                      }} disabled={busy} startLabel="시작" endLabel="종료" />
                      {(active.start_time || active.end_time) && <Button intent="ghost" size="sm" onClick={() => change(active.key, { start_time: null, end_time: null })}>시간 지우기</Button>}
                    </div>
                  </details>
                  <Button size="sm" intent="ghost" className={styles.removeDay} aria-label={`수업일 ${activeIndex + 1} 삭제`} onClick={() => removeDay(active.key)}>수업일 삭제</Button>
                </section>
              ) : (
                <p className={styles.empty}>{base?.schedules.length ? '저장하면 원래 차시 날짜로 돌아갑니다. 기존 기록은 유지됩니다.' : '요일별 수업을 운영하려면 수업일을 추가하세요.'}</p>
              )}
              {!base?.schedules.length && previous.length > 0 && (
                <details className={styles.copyDetails}>
                  <summary>이전 차시에서 가져오기</summary>
                  <div className={styles.copy}>
                    <label>이전 차시<select className="ds-select" value={sourceId} onChange={e => setSource(e.target.value)}>
                      {previous.map(s => <option value={s.id} key={s.id}>{s.title || `${s.order}차시`}{s.date ? ` · ${s.date}` : ''}</option>)}
                    </select></label>
                    <Button intent="secondary" size="sm" disabled={!sourceId || conflict} onClick={() => void copy()}>가져와 저장</Button>
                  </div>
                </details>
              )}
              {sessions.isError && <div role="alert" className={styles.error}>이전 차시를 불러오지 못했습니다. <Button intent="ghost" size="sm" onClick={() => void sessions.refetch()}>다시 불러오기</Button></div>}
            </section>
            <section className={styles.rosterPanel} aria-label="학생 배정">
              <div className={styles.panelTitle}>
                <h3>학생 배정 <small>미배정 {unassignedCount}명</small></h3>
              </div>
              <label className={styles.search}>
                <span className="sr-only">학생 검색</span>
                <Search size={16} aria-hidden />
                <input type="search" className="ds-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="학생 이름 검색" />
              </label>
              <div className={styles.rosterTable}>
                <div className={styles.rosterHeader}>
                  <label><input type="checkbox" aria-label="검색 결과 전체 선택" checked={allVisible} disabled={!visible.length} onChange={toggleAllVisible} />이름</label>
                  <span>배정 수업일</span>
                </div>
                <div className={styles.roster}>
                  {visible.map(student => {
                    const day = assigned.get(student.enrollment_id);
                    const checked = chosen.has(student.enrollment_id);
                    return (
                      <label className={styles.student} data-selected={checked} key={student.enrollment_id}>
                        <input type="checkbox" checked={checked} onChange={e => setSelected(ids => e.target.checked ? [...ids, student.enrollment_id] : ids.filter(id => id !== student.enrollment_id))} />
                        <span>{student.student_name}</span>
                        <span className={styles.assignment} data-current={day != null && day.key === target}>{day ? (day.label || '이름 없는 수업일') : '미배정'}</span>
                      </label>
                    );
                  })}
                  {!visible.length && <p className={styles.empty}>{roster.length ? '검색 결과가 없습니다.' : '출결 화면에서 수강생을 등록하면 여기에 표시됩니다.'}</p>}
                </div>
              </div>
              <div className={styles.rosterFooter}>
                <span role="status">{selected.length}명 선택</span>
                <div className={styles.actions}>
                  {canUnassign && <Button size="sm" intent="ghost" onClick={() => assign('')}>배정 해제</Button>}
                  <Button size="sm" intent="secondary" title={`${activeLabel}에 배정`} disabled={!active || !selected.length} onClick={() => assign(target)}>선택 학생 배정</Button>
                </div>
              </div>
              {active && <p className={styles.note}>{activeLabel}에 배정합니다. 다른 수업일에 배정된 학생은 이 날짜로 이동합니다.</p>}
            </section>
          </fieldset>
        </div>
      </ModalBody>
      <ModalFooter left={<span className={styles.footerNote}>{dirty ? '미저장 변경사항' : ''}</span>} right={<>
        <Button intent="secondary" disabled={busy} onClick={onClose}>닫기</Button>
        <Button intent="primary" disabled={busy || !dirty || conflict} onClick={() => void save()}>{busy ? '처리 중…' : '저장'}</Button>
      </>} />
    </AdminModal>
  );
}
