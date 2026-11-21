import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { ArrowRightLeft, CalendarDays, Pencil, Plus } from 'lucide-react';
import { Button } from '@/shared/ui/ds';
import { SESSION_SCHEDULE_DAY_LIMIT, sessionSchedulesKey, type SessionSchedule, type SessionSchedules } from '@/shared/api/contracts/sessionSchedules';
import { feedback } from '@/shared/ui/feedback/feedback';
import { SessionScheduleNavigationContext, type ScheduleManagementReadiness, type SessionScheduleAction, type SessionScheduleGuard } from '@/shared/hooks/useSessionScheduleScope';
import { SessionScheduleControlsContext } from './sessionScheduleControlsContext';
import SessionScheduleManager from './SessionScheduleManager';
import SessionScheduleTransfer from './SessionScheduleTransfer';
import styles from './SessionScheduleStrip.module.css';

type Props = { sessionId: number; lectureId: number; sessionDate: string; sessionTitle: string; sessionOrder: number; shared: boolean; children: ReactNode; query: UseQueryResult<SessionSchedules, Error> };

type QueuedManagement = { locationKey: string; add: boolean; dayId?: string };

export default function SessionScheduleStrip({ sessionId, lectureId, sessionDate, sessionTitle, sessionOrder, shared, children, query }: Props) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const scope = params.get('schedule');
  const [open, setOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const [editDayId, setEditDayId] = useState<string | null>(null);
  const [addRequest, setAddRequest] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const beforeChange = useRef<SessionScheduleGuard | undefined>(undefined);
  const [managementReadiness, setManagementReadiness] = useState<ScheduleManagementReadiness>('ready');
  const [queuedManagement, setQueuedManagement] = useState<QueuedManagement | null>(null);
  const scheduleNavigation = useMemo(() => ({ beforeChange, setManagementReadiness }), []);
  const managementPending = managementReadiness === 'pending';
  const hasQueuedManagement = queuedManagement?.locationKey === location.key;
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

  const prepare = useCallback(async (onReady: () => void, action: SessionScheduleAction = 'manage', pathname = location.pathname) => {
    if (navigating.current || window.location.pathname !== pathname) return;
    navigating.current = true;
    setPreparing(true);
    try {
      const ready = await beforeChange.current?.(action) ?? true;
      if (ready && window.location.pathname === pathname) onReady();
    } finally { navigating.current = false; setPreparing(false); }
  }, [location.pathname]);

  const openManager = useCallback((add = false, dayId?: string) => {
    void prepare(() => {
      const selectedDayId = dayId ?? new URLSearchParams(window.location.search).get('schedule');
      setEditDayId(add ? null : selectedDayId);
      if (add) setAddRequest(request => request + 1);
      setOpen(true);
    });
  }, [prepare]);

  const requestManager = (add = false, dayId?: string) => {
    if (hasQueuedManagement) return;
    if (managementPending) {
      setQueuedManagement({ locationKey: location.key, add, dayId });
      return;
    }
    openManager(add, dayId);
  };

  useEffect(() => {
    if (queuedManagement === null) return;
    if (queuedManagement.locationKey !== location.key || window.location.pathname !== location.pathname || window.location.search !== location.search) {
      setQueuedManagement(null);
    } else if (!managementPending) {
      setQueuedManagement(null);
      if (managementReadiness === 'ready') openManager(queuedManagement.add, queuedManagement.dayId);
    }
  }, [location.key, location.pathname, location.search, managementPending, managementReadiness, openManager, queuedManagement]);

  const choose = async (value: string | null) => {
    const pathname = window.location.pathname;
    const sessionPath = `/workspace/lectures/${lectureId}/sessions/${sessionId}/`;
    const sameSessionTab = pathname.startsWith(sessionPath) && location.pathname.startsWith(sessionPath);
    if (pathname !== location.pathname && !sameSessionTab) return;
    if (value === new URLSearchParams(window.location.search).get('schedule')) return;
    await prepare(() => {
      // A tab's URL can commit before its content does. Keep the click on that tab.
      const next = new URLSearchParams(window.location.search);
      if (value === null) next.delete('schedule'); else next.set('schedule', value);
      navigate({ pathname, search: next.toString(), hash: window.location.hash });
    }, 'view', pathname);
  };

  const saved = (value: SessionSchedules, destination?: SessionSchedule) => {
    qc.setQueryData(sessionSchedulesKey(sessionId), value);
    void qc.invalidateQueries({ queryKey: sessionSchedulesKey(sessionId) });
    for (const key of [['attendance', sessionId], ['attendance-for-pdf', sessionId], ['session-scores', sessionId], ['session-enrollments', sessionId], ['attendance-enrolled-ids', sessionId], ['attendance-matrix', lectureId]]) {
      void qc.invalidateQueries({ queryKey: key });
    }
    if (destination) {
      setTransferOpen(false);
      if (window.location.pathname === location.pathname) {
        const next = new URLSearchParams(window.location.search);
        if (next.get('schedule') !== String(destination.id)) {
          next.set('schedule', String(destination.id));
          setParams(next);
        }
      }
      feedback.success(`이번 차시의 수업일을 ${destination.label}(으)로 변경했습니다.`);
      return;
    }
    const removed = scope !== null && scope !== '0' && !value.schedules.some(s => String(s.id) === scope);
    feedback.success(removed ? '수업일을 저장했습니다. 선택했던 수업일이 삭제되어 다른 수업일을 선택해야 합니다.' : '수업일을 저장했습니다.');
  };

  const hasDays = !!data?.schedules.length || scope !== null;
  const unknown = scope !== null && scope !== '0' && !data?.schedules.some(s => String(s.id) === scope);
  const blocked = scope !== null && (query.isError || query.isPending || unknown);
  const canTransfer = location.pathname.endsWith('/attendance') && !!data?.roster.length
    && (data.schedules.length > 1 || (data.schedules.length > 0 && data.unassigned_enrollment_ids.length > 0));
  const content = (
    <section className={styles.strip} data-empty={!!data && !query.isError && !hasDays} aria-label="수업일 선택" aria-busy={preparing}>
      <div className={styles.stripHeader}>
        <span><CalendarDays size={15} aria-hidden />수업일{data?.schedules.length ? ` ${data.schedules.length}개` : ''}</span>
        {query.isPending ? <span className={styles.note} role="status">불러오는 중…</span> : (
          <div className={styles.stripActions}>
            <Button intent="ghost" size="sm" onClick={() => requestManager()} disabled={!data || query.isError || hasQueuedManagement}>수업일 관리</Button>
            {data && !query.isError && data.schedules.length < SESSION_SCHEDULE_DAY_LIMIT && (
              <Button intent="ghost" size="sm" iconOnly aria-label="수업일 추가" title="수업일 추가" disabled={hasQueuedManagement} leftIcon={<Plus size={17} aria-hidden />} onClick={() => requestManager(true)} />
            )}
          </div>
        )}
      </div>
      {managementPending && <p className={styles.note} role="status">
        {hasQueuedManagement ? '수업일 관리를 열기 전에 이전 성적 입력을 확인하는 중…' : '이전 성적 입력을 확인하는 중…'}
      </p>}
      {query.isError && <div className={styles.error} role="alert">수업일 정보를 불러오지 못했습니다. <Button intent="secondary" size="sm" onClick={() => void query.refetch()}>수업일 다시 불러오기</Button>{scope !== null && <Button intent="ghost" size="sm" onClick={() => choose(null)}>전체 명단으로 이동</Button>}</div>}
      {data && !query.isError && <>
        {hasDays && <div className={styles.dayChoices}>
          <button type="button" className={styles.dayChoice} aria-pressed={scope === null} onClick={() => choose(null)}>전체</button>
          {data.schedules.map(day => (
            <div key={day.id} className={styles.dayRow}>
              <button type="button" className={styles.dayChoice} aria-pressed={scope === String(day.id)} onClick={() => choose(String(day.id))}>
                <strong>{day.label}</strong><span> · {day.date.slice(5).replace('-', '/')}{day.start_time ? ` ${day.start_time}` : ''} · {day.enrollment_ids.length}명</span>
              </button>
              <button type="button" className={styles.dayEdit} disabled={hasQueuedManagement} aria-label={`수업일 수정 · ${day.label}`} onClick={() => requestManager(false, String(day.id))}>
                <Pencil size={14} aria-hidden />
              </button>
            </div>
          ))}
          {(data.unassigned_enrollment_ids.length > 0 || scope === '0') && <button type="button" className={styles.dayChoice} aria-pressed={scope === '0'} onClick={() => choose('0')}>미배정 · {data.unassigned_enrollment_ids.length}명</button>}
        </div>}
        {!query.isPending && unknown && <p className={styles.error} role="alert">선택한 수업일을 찾을 수 없습니다. 수업일을 다시 선택해 주세요.</p>}
        {shared && data.schedules.length > 0 && <p className={styles.note}>시험·과제·영상·공지는 모든 수업일에 공유됩니다.</p>}
        {hasDays && canTransfer && <div className={styles.stripActions}>
          <Button intent="secondary" size="sm" leftIcon={<ArrowRightLeft size={15} aria-hidden />} onClick={() => void prepare(() => setTransferOpen(true))}>학생 수업일 변경</Button>
        </div>}
      </>}
    </section>
  );

  return (
    <SessionScheduleNavigationContext.Provider value={scheduleNavigation}>
      <SessionScheduleControlsContext.Provider value={{
        content,
        title: sessionTitle,
        date: sessionDate,
        inlineActions: !!data && !query.isError && !hasDays,
        blockedNotice: blocked ? <p className={styles.note} role="status">{query.isPending ? '선택한 수업일을 확인하는 중…' : '수업일을 확인한 뒤 명단을 표시합니다.'}</p> : null,
        managementPending,
        managementQueued: hasQueuedManagement,
        openManager: () => requestManager(),
        prepareTransition: prepare,
      }}>
        {children}
        {data && <SessionScheduleManager open={open} addRequest={addRequest} editDayId={editDayId} onClose={() => setOpen(false)} sessionId={sessionId} lectureId={lectureId} sessionDate={sessionDate} sessionOrder={sessionOrder} data={data} onSaved={saved} assignmentBusy={transferBusy} />}
        {data && transferOpen && <SessionScheduleTransfer sessionId={sessionId} data={data} scope={scope} busy={transferBusy} setBusy={setTransferBusy} onClose={() => setTransferOpen(false)} onSaved={saved} />}
      </SessionScheduleControlsContext.Provider>
    </SessionScheduleNavigationContext.Provider>
  );
}
