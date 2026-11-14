import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { CalendarDays, Pencil, Plus } from 'lucide-react';
import { Button } from '@/shared/ui/ds';
import { sessionSchedulesKey, type SessionSchedules } from '@/shared/api/contracts/sessionSchedules';
import { feedback } from '@/shared/ui/feedback/feedback';
import { SessionScheduleNavigationContext } from '@/shared/hooks/useSessionScheduleScope';
import { SessionScheduleControlsContext } from './sessionScheduleControlsContext';
import SessionScheduleManager from './SessionScheduleManager';
import styles from './SessionScheduleStrip.module.css';

type Props = { sessionId: number; lectureId: number; sessionDate: string; sessionOrder: number; shared: boolean; children: ReactNode; query: UseQueryResult<SessionSchedules, Error> };

export default function SessionScheduleStrip({ sessionId, lectureId, sessionDate, sessionOrder, shared, children, query }: Props) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const scope = params.get('schedule');
  const [open, setOpen] = useState(false);
  const [editDayId, setEditDayId] = useState<string | null>(null);
  const [addRequest, setAddRequest] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const beforeChange = useRef<(() => Promise<boolean>) | undefined>(undefined);
  const navigating = useRef(false);
  const qc = useQueryClient();
  const data = query.data;

  useEffect(() => {
    if (!location.state?.openSessionSchedule) return;
    setEditDayId(null);
    setOpen(true);
    const nextState = { ...location.state };
    delete nextState.openSessionSchedule;
    navigate(location, { replace: true, state: nextState });
  }, [location, navigate]);

  const prepare = async (onReady: () => void) => {
    if (navigating.current) return;
    navigating.current = true;
    setPreparing(true);
    try { if (await beforeChange.current?.() ?? true) onReady(); }
    finally { navigating.current = false; setPreparing(false); }
  };

  const openManager = (add = false, dayId = scope) => {
    void prepare(() => {
      if (window.location.pathname !== location.pathname) return;
      setEditDayId(add ? null : dayId);
      if (add) setAddRequest(request => request + 1);
      setOpen(true);
    });
  };

  const choose = async (value: string | null) => {
    const pathname = window.location.pathname;
    if (pathname !== location.pathname || value === new URLSearchParams(window.location.search).get('schedule')) return;
    await prepare(() => {
      if (window.location.pathname !== pathname) return;
      // Read the current URL after the score save guard completes.
      const next = new URLSearchParams(window.location.search);
      if (value === null) next.delete('schedule'); else next.set('schedule', value);
      setParams(next);
    });
  };

  const saved = (value: SessionSchedules) => {
    qc.setQueryData(sessionSchedulesKey(sessionId), value);
    void qc.invalidateQueries({ queryKey: sessionSchedulesKey(sessionId) });
    for (const key of [['attendance', sessionId], ['attendance-for-pdf', sessionId], ['session-scores', sessionId], ['session-enrollments', sessionId], ['attendance-enrolled-ids', sessionId], ['attendance-matrix', lectureId]]) {
      void qc.invalidateQueries({ queryKey: key });
    }
    const removed = scope !== null && scope !== '0' && !value.schedules.some(s => String(s.id) === scope);
    feedback.success(removed ? '수업일을 저장했습니다. 선택했던 수업일이 삭제되어 다른 수업일을 선택해야 합니다.' : '수업일을 저장했습니다.');
  };

  const hasDays = !!data?.schedules.length || scope !== null;
  const unknown = scope !== null && scope !== '0' && !data?.schedules.some(s => String(s.id) === scope);
  const blocked = scope !== null && (query.isError || query.isPending || unknown);
  const content = (
    <section className={styles.strip} aria-label="수업일 선택" aria-busy={preparing}>
      <div className={styles.stripHeader}>
        <span><CalendarDays size={15} aria-hidden />수업일{data?.schedules.length ? ` ${data.schedules.length}개` : ''}</span>
        {query.isPending ? <span className={styles.note} role="status">불러오는 중…</span> : (
          <div className={styles.actions}>
            <Button intent="ghost" size="sm" onClick={() => openManager()} disabled={!data || query.isError}>수업일 관리</Button>
            {!hasDays && data && !query.isError && <Button intent="ghost" size="sm" leftIcon={<Plus size={15} aria-hidden />} onClick={() => openManager(true)}>수업일 추가</Button>}
          </div>
        )}
      </div>
      {query.isError && <div className={styles.error} role="alert">수업일 정보를 불러오지 못했습니다. <Button intent="secondary" size="sm" onClick={() => void query.refetch()}>수업일 다시 불러오기</Button>{scope !== null && <Button intent="ghost" size="sm" onClick={() => choose(null)}>전체 명단으로 이동</Button>}</div>}
      {data && !query.isError && <>
        {hasDays && <div className={styles.dayChoices}>
          <button type="button" className={styles.dayChoice} aria-pressed={scope === null} onClick={() => choose(null)}>전체</button>
          {data.schedules.map(day => (
            <div key={day.id} className={styles.dayRow}>
              <button type="button" className={styles.dayChoice} aria-pressed={scope === String(day.id)} onClick={() => choose(String(day.id))}>
                <strong>{day.label}</strong><span> · {day.date.slice(5).replace('-', '/')}{day.start_time ? ` ${day.start_time}` : ''} · {day.enrollment_ids.length}명</span>
              </button>
              <button type="button" className={styles.dayEdit} aria-label={`수업일 수정 · ${day.label}`} onClick={() => openManager(false, String(day.id))}>
                <Pencil size={14} aria-hidden />
              </button>
            </div>
          ))}
          {(data.unassigned_enrollment_ids.length > 0 || scope === '0') && <button type="button" className={styles.dayChoice} aria-pressed={scope === '0'} onClick={() => choose('0')}>미배정 · {data.unassigned_enrollment_ids.length}명</button>}
        </div>}
        {!query.isPending && unknown && <p className={styles.error} role="alert">선택한 수업일을 찾을 수 없습니다. 수업일을 다시 선택해 주세요.</p>}
        {shared && data.schedules.length > 0 && <p className={styles.note}>시험·과제·영상·공지는 모든 수업일에 공유됩니다.</p>}
        {hasDays && <Button intent="ghost" size="sm" leftIcon={<Plus size={15} aria-hidden />} onClick={() => openManager(true)}>수업일 추가</Button>}
      </>}
    </section>
  );

  return (
    <SessionScheduleNavigationContext.Provider value={beforeChange}>
      <SessionScheduleControlsContext.Provider value={{
        content,
        blockedNotice: blocked ? <p className={styles.note} role="status">{query.isPending ? '선택한 수업일을 확인하는 중…' : '수업일을 확인한 뒤 명단을 표시합니다.'}</p> : null,
        openManager: () => openManager(),
      }}>
        {children}
        {data && <SessionScheduleManager open={open} addRequest={addRequest} editDayId={editDayId} onClose={() => setOpen(false)} sessionId={sessionId} lectureId={lectureId} sessionDate={sessionDate} sessionOrder={sessionOrder} data={data} onSaved={saved} />}
      </SessionScheduleControlsContext.Provider>
    </SessionScheduleNavigationContext.Provider>
  );
}
