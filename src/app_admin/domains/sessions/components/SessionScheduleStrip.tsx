import { useRef, useState, type ReactNode } from 'react';
import { useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useLocation, useSearchParams } from 'react-router';
import { Button } from '@/shared/ui/ds';
import { sessionSchedulesKey, type SessionSchedules } from '@/shared/api/contracts/sessionSchedules';
import { feedback } from '@/shared/ui/feedback/feedback';
import { SessionScheduleNavigationContext } from '@/shared/hooks/useSessionScheduleScope';
import SessionScheduleManager from './SessionScheduleManager';
import styles from './SessionScheduleStrip.module.css';

type Props = { sessionId: number; lectureId: number; sessionDate: string; sessionOrder: number; shared: boolean; children: ReactNode; query: UseQueryResult<SessionSchedules, Error> };
export default function SessionScheduleStrip({ sessionId, lectureId, sessionDate, sessionOrder, shared, children, query }: Props) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const scope = params.get('schedule');
  const [open, setOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const beforeChange = useRef<(() => Promise<boolean>) | undefined>(undefined);
  const navigating = useRef(false);
  const qc = useQueryClient();
  const data = query.data;
  const prepare = async (onReady: () => void) => {
    if (navigating.current) return;
    navigating.current = true;
    setPreparing(true);
    try { if (await beforeChange.current?.() ?? true) onReady(); }
    finally { navigating.current = false; setPreparing(false); }
  };
  const choose = async (value: string | null) => {
    const pathname = window.location.pathname;
    if (pathname !== location.pathname || value === new URLSearchParams(window.location.search).get('schedule')) return;
    await prepare(() => {
      if (window.location.pathname !== pathname) return;
      // BrowserRouter updates history before React commits. Read after the save
      // guard too, so a quick list/tools navigation cannot restore an old view.
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
  const unknown = scope !== null && scope !== '0' && !data?.schedules.some(s => String(s.id) === scope);
  const blocked = scope !== null && (query.isError || query.isPending || unknown);
  return <>
    <section className={styles.strip} aria-label="수업일 선택" aria-busy={preparing}>
      <span className={styles.label}>수업일</span>
      {data && (data.schedules.length > 0 || scope !== null) && <div className={styles.chips}>
        <button type="button" className={styles.chip} aria-pressed={scope === null} onClick={() => choose(null)}>전체</button>
        {data.schedules.map(s => <button type="button" key={s.id} className={styles.chip} aria-pressed={scope === String(s.id)} onClick={() => choose(String(s.id))}>
          {s.label} · {s.date.slice(5).replace('-', '/')}{s.start_time ? ` ${s.start_time}` : ''} · {s.enrollment_ids.length}명
        </button>)}
        <button type="button" className={styles.chip} aria-pressed={scope === '0'} onClick={() => choose('0')}>미배정 · {data.unassigned_enrollment_ids.length}명</button>
      </div>}
      {query.isPending ? <span className={styles.note} role="status">불러오는 중…</span> : <Button intent="ghost" size="sm" onClick={() => prepare(() => { if (window.location.pathname === location.pathname) setOpen(true); })} disabled={!data || query.isError}>수업일 관리</Button>}
    </section>
    {query.isError && <div className={styles.error} role="alert">수업일 정보를 불러오지 못했습니다. 선택한 범위는 유지됩니다. <Button intent="secondary" size="sm" onClick={() => void query.refetch()}>수업일 다시 불러오기</Button>{scope !== null && <Button intent="ghost" size="sm" onClick={() => choose(null)}>전체 명단으로 이동</Button>}</div>}
    {!query.isError && !query.isPending && unknown && <div className={styles.error} role="alert">선택한 수업일을 찾을 수 없습니다. 수업일을 다시 선택해 주세요.</div>}
    {shared && data && data.schedules.length > 0 && <p className={styles.note}>이 화면의 시험·과제·영상·공지는 모든 수업일이 함께 사용합니다. 수업일 선택은 출결·성적의 학생 명단에 적용됩니다.</p>}
    {!shared && !blocked && data && data.schedules.length > 0 && <p className={styles.note}>{scope === null ? '전체 수업일의 학생 명단입니다.' : scope === '0' ? '수업일 미배정 학생 명단입니다.' : '선택한 수업일의 학생 명단입니다.'} 시험·과제·영상과 기존 기록은 차시 전체가 함께 사용합니다.</p>}
    {data && <SessionScheduleManager key={sessionId} open={open} onClose={() => setOpen(false)} sessionId={sessionId} lectureId={lectureId} sessionDate={sessionDate} sessionOrder={sessionOrder} data={data} onSaved={saved} />}
    <SessionScheduleNavigationContext.Provider value={beforeChange}>{blocked ? <p className={styles.note} role="status">{query.isPending ? '선택한 수업일을 확인하는 중…' : '수업일을 확인한 뒤 명단을 표시합니다.'}</p> : children}</SessionScheduleNavigationContext.Provider>
  </>;
}
