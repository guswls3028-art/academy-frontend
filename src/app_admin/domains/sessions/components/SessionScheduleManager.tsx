import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/shared/ui/ds';
import { AdminModal, ModalHeader, ModalFooter } from '@/shared/ui/modal';
import { DatePicker } from '@/shared/ui/date';
import { TimeRangeInput } from '@/shared/ui/time';
import { useConfirm } from '@/shared/ui/confirm';
import { extractApiError } from '@/shared/utils/extractApiError';
import { fetchSessions } from '@admin/domains/lectures/api/sessions';
import { copySessionSchedules, fetchSessionSchedules, saveSessionSchedules, type SessionScheduleDraft, type SessionSchedules } from '@/shared/api/contracts/sessionSchedules';
import styles from './SessionScheduleStrip.module.css';
import { useScheduleLeaveGuard } from './useScheduleLeaveGuard';

type Draft = SessionScheduleDraft & { key: string };
type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: number;
  lectureId: number;
  sessionDate: string;
  sessionOrder: number;
  data: SessionSchedules;
  onSaved: (data: SessionSchedules) => void;
};

export default function SessionScheduleManager({ open, onClose, sessionId, lectureId, sessionDate, sessionOrder, data, onSaved }: Props) {
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
  useScheduleLeaveGuard(lectureId, sessionId, dirty, busy);
  const sessions = useQuery({
    queryKey: ['schedule-copy-sessions', lectureId],
    queryFn: () => fetchSessions(lectureId), enabled: open,
  });
  const previous = (sessions.data ?? []).filter(s => s.id !== sessionId && s.order < sessionOrder).sort((a, b) => b.order - a.order);
  const sourceId = source || String(previous[0]?.id ?? '');
  const reset = (value: SessionSchedules) => {
    setBase(value);
    setDrafts(value.schedules.map(s => ({ ...s, enrollment_ids: [...s.enrollment_ids], key: String(s.id) })));
    setDirty(false); setSelected([]); setTarget(''); setError(''); setConflict(false);
  };
  useEffect(() => {
    // Reopening an untouched form adopts fresh server state; never overwrite a draft.
    if (open && !dirty) reset(data);
  }, [open, data]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const assign = () => {
    setDrafts(rows => rows.map(s => ({ ...s, enrollment_ids: [
      ...s.enrollment_ids.filter(id => !chosen.has(id)), ...(s.key === target ? selected : []),
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
    if (drafts.some(s => !s.label.trim() || !s.date)) { setError('각 수업일의 이름과 날짜를 입력해 주세요.'); return; }
    if (drafts.some(s => s.start_time && s.end_time && s.start_time >= s.end_time)) { setError('종료 시간은 시작 시간보다 늦어야 합니다.'); return; }
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
  const assigned = new Map(drafts.flatMap(s => s.enrollment_ids.map(id => [id, s.label || '이름 없는 수업일'] as const)));
  return <AdminModal open={open} onClose={onClose} width={680} noMinimize trapFocus closeDisabled={busy}>
    <ModalHeader title="수업일 관리" noIcon description="한 차시를 여러 날짜에 진행해도 출결·성적·시험·과제·영상은 함께 유지됩니다." />
    <div className={styles.body}>
      {error && <div className={styles.error} role="alert">{error}{conflict && <div className={styles.actions}><Button size="sm" intent="secondary" disabled={busy} onClick={() => void reload()}>최신 내용으로 다시 시작</Button></div>}</div>}
      <fieldset disabled={busy}>
        <div className={styles.copy}>
          <label>이전 차시<select value={sourceId} onChange={e => setSource(e.target.value)} disabled={!previous.length}>
            {!previous.length && <option value="">{sessions.isPending ? '불러오는 중…' : '이전 차시 없음'}</option>}
            {previous.map(s => <option value={s.id} key={s.id}>{s.title || `${s.order}차시`}{s.date ? ` · ${s.date}` : ''}</option>)}
          </select></label>
          <Button intent="secondary" size="sm" disabled={!sourceId || sessions.isError || conflict || Boolean(base?.schedules.length)} onClick={() => void copy()}>이전 차시에서 가져오기</Button>
        </div>
        {Boolean(base?.schedules.length) && <p className={styles.note}>이전 차시 가져오기는 저장된 수업일이 없을 때 사용할 수 있습니다.</p>}
        {sessions.isError && <div role="alert" className={styles.error}>이전 차시를 불러오지 못했습니다. <Button intent="ghost" size="sm" onClick={() => void sessions.refetch()}>다시 불러오기</Button></div>}
      </fieldset>
      <fieldset disabled={busy}>
        <legend className={styles.label}>수업일 · {drafts.length}개</legend>
        {drafts.length === 0 && <p className={styles.note}>{base?.schedules.length ? `저장하면 원래 차시 날짜${sessionDate ? ` (${sessionDate})` : ''}로 돌아갑니다. 기존 기록은 유지됩니다.` : '요일별로 수업한다면 수업일을 추가해 주세요.'}</p>}
        {drafts.map((s, index) => <section className={styles.card} key={s.key} aria-label={`수업일 ${index + 1}`}>
          <div className={styles.fields}>
            <label>이름<input aria-label={`수업일 ${index + 1} 이름`} value={s.label} placeholder="예: 수요일반" onChange={e => change(s.key, { label: e.target.value })} /></label>
            <div><label htmlFor={`schedule-date-${s.key}`}>날짜</label><DatePicker id={`schedule-date-${s.key}`} value={s.date} onChange={date => change(s.key, { date })} disabled={busy} /></div>
          </div>
          <div role="group" aria-label={`수업일 ${index + 1} 시간 (선택)`}>
            <TimeRangeInput value={`${s.start_time ?? ''}~${s.end_time ?? ''}`} onChange={value => { const [start, end] = value.split('~'); change(s.key, { start_time: start || null, end_time: end || null }); }} disabled={busy} startLabel="시작" endLabel="종료" />
            {(s.start_time || s.end_time) && <Button intent="ghost" size="sm" onClick={() => change(s.key, { start_time: null, end_time: null })}>시간 지우기</Button>}
          </div>
          <div className={styles.actions}><span className={styles.note}>{s.enrollment_ids.length}명 배정</span><Button size="sm" intent="ghost" onClick={() => { setDrafts(rows => rows.filter(r => r.key !== s.key)); setTarget(''); setDirty(true); }}>수업일 {index + 1} 삭제</Button></div>
        </section>)}
        <Button size="sm" intent="secondary" onClick={() => { const key = crypto.randomUUID(); setDrafts(rows => [...rows, { key, label: '', date: sessionDate || '', start_time: null, end_time: null, enrollment_ids: [] }]); setTarget(key); setDirty(true); }}>수업일 추가</Button>
        <p className={styles.note}>수업일을 삭제하면 배정만 해제됩니다. 학생의 기존 기록은 유지됩니다.</p>
      </fieldset>
      <fieldset disabled={busy}>
        <legend className={styles.label}>학생 배정 · 미배정 {roster.filter(s => !assigned.has(s.enrollment_id)).length}명</legend>
        <div className={styles.rosterTools}>
          <label>학생 검색<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="학생 이름" /></label>
          <div className={styles.actions}>
            <Button size="sm" intent="secondary" disabled={!visible.length} onClick={() => setSelected(ids => allVisible ? ids.filter(id => !visible.some(s => s.enrollment_id === id)) : [...new Set([...ids, ...visible.map(s => s.enrollment_id)])])}>{allVisible ? '검색 결과 선택 해제' : '검색 결과 전체 선택'}</Button>
            <span role="status" className={styles.footerNote}>{selected.length}명 선택</span>
            {!!selected.length && <Button size="sm" intent="ghost" onClick={() => setSelected([])}>선택 해제</Button>}
          </div>
          <label>배정할 수업일<select value={target} onChange={e => setTarget(e.target.value)}><option value="">미배정 (배정 해제)</option>{drafts.map((s, index) => <option key={s.key} value={s.key}>{s.label || `수업일 ${index + 1}`}{s.date ? ` · ${s.date}` : ''}</option>)}</select></label>
          <Button size="sm" intent="secondary" disabled={!selected.length} onClick={assign}>선택 학생 배정</Button>
        </div>
        <p className={styles.note}>학생은 한 수업일에만 배정됩니다. 다른 수업일을 고르면 배정이 이동합니다.</p>
        <div className={styles.roster}>{visible.map(s => <label className={styles.student} key={s.enrollment_id}>
          <input type="checkbox" checked={chosen.has(s.enrollment_id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, s.enrollment_id] : ids.filter(id => id !== s.enrollment_id))} />
          <span>{s.student_name}</span><span className={styles.assignment}>{assigned.get(s.enrollment_id) ?? '미배정'}</span>
        </label>)}{!visible.length && <p className={styles.note}>{roster.length ? '검색 결과가 없습니다.' : '등록된 학생이 없습니다. 출결 화면에서 수강생을 등록해 주세요.'}</p>}</div>
      </fieldset>
    </div>
    <ModalFooter left={<span className={styles.footerNote}>{dirty ? '미저장 · 창을 닫아도 작성 내용은 유지됩니다.' : '저장된 수업일'}</span>} right={<><Button intent="secondary" disabled={busy} onClick={onClose}>닫기</Button><Button intent="primary" disabled={busy || !dirty || conflict} onClick={() => void save()}>{busy ? '처리 중…' : '저장'}</Button></>} />
  </AdminModal>;
}
