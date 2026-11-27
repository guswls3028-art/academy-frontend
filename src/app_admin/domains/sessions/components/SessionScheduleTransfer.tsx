import { useId, useMemo, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { ArrowRight, Search } from 'lucide-react';
import { fetchSessionSchedules, saveSessionSchedules, type SessionSchedule, type SessionSchedules } from '@/shared/api/contracts/sessionSchedules';
import { Button } from '@/shared/ui/ds';
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from '@/shared/ui/modal';
import { extractApiError } from '@/shared/utils/extractApiError';
import { shortDateWeekday } from '@/shared/utils/localDate';
import styles from './SessionScheduleStrip.module.css';

type Transfer = { enrollment: number; target: number };
type Props = {
  sessionId: number;
  data: SessionSchedules;
  scope: string | null;
  busy: boolean;
  setBusy: (value: boolean) => void;
  onClose: () => void;
  onSaved: (data: SessionSchedules, target: SessionSchedule) => void;
};

const scheduleLabel = (day: SessionSchedule) => `${day.label} · ${shortDateWeekday(day.date)}`;

export default function SessionScheduleTransfer({ sessionId, data, scope, busy, setBusy, onClose, onSaved }: Props) {
  const studentGroup = useId();
  const inFlight = useRef(false);
  const [base, setBase] = useState(data);
  const [search, setSearch] = useState('');
  const [enrollment, setEnrollment] = useState<number | null>(null);
  const [target, setTarget] = useState(() => data.schedules.some(day => String(day.id) === scope) ? (scope ?? '') : '');
  const [error, setError] = useState('');
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const ambiguous = useRef<Transfer | null>(null);

  const assignment = useMemo(() => new Map(base.schedules.flatMap(day => day.enrollment_ids.map(id => [id, day] as const))), [base.schedules]);
  const sameNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const student of base.roster) counts.set(student.student_name, (counts.get(student.student_name) ?? 0) + 1);
    return counts;
  }, [base.roster]);
  const term = search.trim().toLocaleLowerCase();
  const visible = base.roster.filter(student => student.student_name.toLocaleLowerCase().includes(term) || String(student.enrollment_id) === term);
  const student = base.roster.find(item => item.enrollment_id === enrollment);
  const from = enrollment !== null ? assignment.get(enrollment) : undefined;
  const destination = base.schedules.find(day => String(day.id) === target);
  const unchanged = !!destination && from?.id === destination.id;

  async function refresh() {
    try {
      const latest = await fetchSessionSchedules(sessionId);
      const request = ambiguous.current;
      const moved = request && latest.schedules.find(day => day.id === request.target && day.enrollment_ids.includes(request.enrollment));
      ambiguous.current = null;
      if (moved) {
        onSaved(latest, moved);
        return;
      }
      setBase(latest);
      if (!latest.roster.some(item => item.enrollment_id === enrollment)) setEnrollment(null);
      if (!latest.schedules.some(day => String(day.id) === target)) setTarget('');
      setNeedsRefresh(false);
      setError('최신 배정을 불러왔습니다. 현재 수업일과 옮길 수업일을 확인한 뒤 다시 변경해 주세요.');
    } catch {
      setNeedsRefresh(true);
      setError('최신 배정을 확인하지 못했습니다. 명단을 다시 불러와 주세요.');
    }
  }

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try { await action(); }
    finally { inFlight.current = false; setBusy(false); }
  }

  async function transfer() {
    if (!student || !destination || unchanged || needsRefresh) return;
    const id = student.enrollment_id;
    await run(async () => {
      try {
        const schedules = base.schedules.map(day => ({
          ...day,
          enrollment_ids: day.id === destination.id ? [...day.enrollment_ids, id] : day.enrollment_ids.filter(current => current !== id),
        }));
        const latest = await saveSessionSchedules(sessionId, base.version, schedules);
        onSaved(latest, destination);
      } catch (e) {
        const status = isAxiosError(e) ? e.response?.status : undefined;
        if (status === 409 || status == null || status === 408 || status >= 500) {
          ambiguous.current = status === 409 ? null : { enrollment: id, target: destination.id };
          await refresh();
        } else {
          setError(extractApiError(e, '수업일을 변경하지 못했습니다. 다시 시도해 주세요.'));
        }
      }
    });
  }

  return (
    <AdminModal open onClose={onClose} size="default" noMinimize trapFocus closeDisabled={busy}>
      <ModalHeader title="학생 수업일 변경" noIcon description="이 차시에서 출석할 수업일을 변경합니다." />
      <ModalBody>
        <div className={styles.body}>
          {error && <div className={styles.error} role="alert">{error}{needsRefresh && <div className={styles.actions}>
            <Button intent="secondary" size="sm" disabled={busy} onClick={() => void run(refresh)}>명단 다시 불러오기</Button>
          </div>}</div>}
          <fieldset disabled={busy} className={styles.transferForm}>
            <legend className="sr-only">학생 선택</legend>
            <label className={styles.search}>
              <Search size={16} aria-hidden />
              <span className="sr-only">학생 이름 검색</span>
              <input className="ds-input" type="search" value={search} onChange={event => { setSearch(event.target.value); setEnrollment(null); }} placeholder="학생 이름 검색" />
            </label>
            <div className={styles.rosterTable}>
              <div className={styles.rosterHeader}><span>학생 {visible.length}명</span><span>현재 수업일</span></div>
              <div className={`${styles.roster} ${styles.transferRoster}`}>
                {visible.map(item => {
                  const day = assignment.get(item.enrollment_id);
                  return (
                    <label key={item.enrollment_id} className={styles.student} data-selected={enrollment === item.enrollment_id}>
                      <input type="radio" name={studentGroup} checked={enrollment === item.enrollment_id} onChange={() => setEnrollment(item.enrollment_id)} />
                      <span>{item.student_name}{(sameNames.get(item.student_name) ?? 0) > 1 && <small> · 수강번호 {item.enrollment_id}</small>}</span>
                      <span className={styles.assignment}>{day?.label ?? '미배정'}</span>
                    </label>
                  );
                })}
                {!visible.length && <p className={styles.empty}>{term ? '검색 결과가 없습니다.' : '이 차시에 등록된 학생이 없습니다.'}</p>}
              </div>
            </div>
            <label className={styles.transferTarget}>
              옮길 수업일
              <select className="ds-select" value={target} onChange={event => setTarget(event.target.value)}>
                <option value="">수업일 선택</option>
                {base.schedules.map(day => <option key={day.id} value={String(day.id)}>{scheduleLabel(day)}</option>)}
              </select>
            </label>
            {student && destination && <div className={styles.transferPreview} role="status">
              <strong>{student.student_name}</strong>
              {unchanged ? <span>이미 {destination.label}에 배정되어 있습니다.</span> : <span>{from?.label ?? '미배정'} <ArrowRight size={14} aria-label="에서" /> {destination.label}</span>}
            </div>}
          </fieldset>
        </div>
      </ModalBody>
      <ModalFooter left={<p className={styles.footerNote}>이번 차시만 변경됩니다.</p>} right={<>
        <Button intent="secondary" onClick={onClose} disabled={busy}>취소</Button>
        <Button intent="primary" onClick={() => void transfer()} disabled={!student || !destination || unchanged || busy || needsRefresh}>{busy ? '확인 중…' : '수업일 변경'}</Button>
      </>} />
    </AdminModal>
  );
}
