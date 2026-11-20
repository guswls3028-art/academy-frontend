import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { skipToken, useQuery } from "@tanstack/react-query";
import { ChevronRight, ScanLine } from "lucide-react";
import { fetchLectures, fetchSessions, sortSessionsByDisplayOrder, type Lecture, type Session } from "@/shared/api/contracts/sessions";
import { attendanceQueryKeys } from "@/shared/api/queryKeys/attendance";
import { isSupplementSession } from "@/shared/product/sessions/sessionOrdering";
import { sessionScheduleDateLabel } from "@/shared/product/sessions/sessionScheduleDisplay";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { Button, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalHeader } from "@/shared/ui/modal";
import { formatSessionBlockLabel, SessionBlockView } from "@/shared/ui/session-block";
import { richHtmlToPlainText } from "@/shared/utils/richHtml";
import styles from "./AttendanceQrManager.module.css";

const Manager = lazy(() => import("./AttendanceQrManager").then(module => ({ default: module.QrManagerDialog })));

export default function DashboardAttendanceQr() {
  const [open, setOpen] = useState(false);
  return <div>
    <Button leftIcon={<ScanLine size={ICON_FOR_BUTTON.md} />} onClick={() => setOpen(true)}>수업 출석 QR</Button>
    {open && <ClassPicker onClose={() => setOpen(false)} />}
  </div>;
}

function ClassPicker({ onClose }: { onClose: () => void }) {
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [search, setSearch] = useState("");
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const lectures = useQuery({
    queryKey: attendanceQueryKeys.qrActiveLectures,
    queryFn: () => fetchLectures({ is_active: true }),
  });
  const sessions = useQuery({
    queryKey: attendanceQueryKeys.qrLectureSessions(lecture?.id),
    queryFn: lecture ? () => fetchSessions(lecture.id) : skipToken,
  });
  useEffect(() => {
    stepHeading.current?.focus({ preventScroll: true });
  }, [lecture, session]);

  const lectureName = lecture?.title || lecture?.name || "";
  const active = lectures.data?.filter(row => row.is_active && !row.is_system) ?? [];
  const matches = active.filter(row => (row.title || row.name || "").toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const isToday = (row: Session) => row.schedule_dates?.length
    ? row.schedule_dates.some(schedule => schedule.date === today) : row.date === today;
  const rows = sortSessionsByDisplayOrder((sessions.data ?? []).filter(row => row.lecture === lecture?.id))
    .sort((a, b) => Number(isToday(b)) - Number(isToday(a)));
  const list = lecture ? sessions : lectures;
  const sessionLabel = (row: Session) => richHtmlToPlainText(formatSessionBlockLabel(row));
  const sessionDetail = (row: Session) => [sessionScheduleDateLabel(row), row.section_label].filter(Boolean).join(" · ");

  if (lecture && session) {
    return <Suspense fallback={<AdminModal open onClose={onClose} noMinimize trapFocus>
      <ModalHeader title="차시 출석 QR" noIcon /><ModalBody><p role="status">QR을 여는 중…</p></ModalBody>
    </AdminModal>}>
      <Manager kind="class" lectureId={lecture.id} lectureTitle={lectureName}
        session={{ id: session.id, label: sessionLabel(session), detail: sessionDetail(session) }}
        onBack={() => setSession(null)} onClose={onClose} />
    </Suspense>;
  }

  return <AdminModal open onClose={onClose} width={560} noMinimize trapFocus>
    <ModalHeader title="수업 출석 QR" noIcon />
    <ModalBody>
      <div className={styles.picker}>
        <h3 ref={stepHeading} tabIndex={-1} className={styles.stepHeading}>{lecture ? "차시 선택" : "강의 선택"}</h3>
        {lecture && <div className={styles.currentLecture}>
          <LectureChip lectureName={lectureName} chipLabel={lecture.chip_label} color={lecture.color ?? undefined} size={28} />
          <span>{lectureName}</span>
          <Button intent="ghost" size="sm" onClick={() => setLecture(null)}>강의 다시 선택</Button>
        </div>}
        {list.isPending ? <p role="status">{lecture ? "차시" : "강의"}를 불러오는 중…</p>
          : list.isError ? <div role="alert"><p>{lecture ? "차시" : "강의"} 목록을 불러오지 못했습니다.</p>
            <Button onClick={() => void list.refetch()}>다시 불러오기</Button></div>
          : lecture ? (rows.length ? <div className={styles.sessionGrid}>
            {rows.map(row => <SessionBlockView key={row.id} compact className={styles.sessionTile}
              variant={isSupplementSession(row) ? "supplement" : "n1"}
              title={sessionLabel(row)} desc={(isToday(row) ? "오늘 · " : "") + sessionDetail(row)}
              onClick={() => setSession(row)} />)}
          </div> : <p>이 강의에 등록된 차시가 없습니다.</p>)
          : <>
            {active.length > 8 && <input type="search" aria-label="강의 검색" placeholder="강의명 검색" className={styles.search}
              value={search} onChange={event => setSearch(event.target.value)} />}
            {matches.length ? <div className={styles.lectureList}>
              {matches.map(row => {
                const name = row.title || row.name;
                return <button key={row.id} type="button" className={styles.lectureRow} aria-label={name} onClick={() => setLecture(row)}>
                  <LectureChip lectureName={name} chipLabel={row.chip_label} color={row.color ?? undefined} size={36} />
                  <span>{name}</span><ChevronRight size={18} aria-hidden="true" />
                </button>;
              })}
            </div> : <p>{active.length ? "검색 결과가 없습니다." : "출석 QR을 발급할 운영 중인 강의가 없습니다."}</p>}
          </>}
      </div>
    </ModalBody>
  </AdminModal>;
}
