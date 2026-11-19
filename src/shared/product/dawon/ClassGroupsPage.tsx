import { lazy, Suspense, useId, useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { resolveTenantCodeString } from "@/shared/tenant";
import { Button } from "@/shared/ui/ds";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { teacherLectureQueryKeys } from "@/app_teacher/domains/lectures/queryKeys";
import { ChevronRight, UsersRound } from "lucide-react";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import ClassRosterModal, { type RosterStudent } from "./ClassRosterModal";
import styles from "./ClassGroupsPage.module.css";

const LectureCreateModal = lazy(() => import("@admin/domains/lectures/components/LectureCreateModal"));

const endpoint = "/students/class-groups/";
const groupsKey = ["dawon", "class-groups"];
const tracks = ["1%", "HYPER", "SKY"] as const;
const periods = { vacation: "방학", midterm: "내신 · 중간", final: "내신 · 기말" };

type Kind = "union" | "school";
type Period = keyof typeof periods;
type Group = { id: number; name: string; kind: Kind; track: string; school: string; student_count: number; lecture_count: number };
type Lecture = { id: number; title: string; period: Period; school: string; start_date: string; end_date: string; student_count: number; cycle_status: "upcoming" | "current" | "past"; color?: string; chip_label?: string; lecture_time?: string };
type Detail = Group & { students: RosterStudent[]; lectures: Lecture[] };

function groupType(group: Group) {
  return group.kind === "union" ? `연합반 · ${group.track}` : `학교반 · ${group.school}`;
}

function failure(error: unknown) {
  return <p role="alert" className={styles.error}>{getApiErrorMessage(error, "저장하거나 불러오지 못했습니다. 다시 시도해 주세요.")}</p>;
}

function GroupForm({ onCreated, onCancel }: { onCreated: (id: number) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<Kind>("union");
  const formId = useId();
  const create = useMutation({
    mutationFn: async (form: FormData) => {
      const { data } = await api.post<Group>(endpoint, {
        name: form.get("name"),
        kind,
        ...(kind === "union" ? { track: form.get("track") } : { school: form.get("school") }),
      });
      return data;
    },
    onSuccess: (group) => onCreated(group.id),
  });

  return (
    <AdminModal open onClose={onCancel} width={MODAL_WIDTH.md} noMinimize trapFocus closeDisabled={create.isPending}>
      <ModalHeader title="반 만들기" />
      <ModalBody>
        <form id={formId} className={styles.form} onSubmit={(event) => {
          event.preventDefault();
          create.mutate(new FormData(event.currentTarget));
        }}>
          <label>반 이름 <input name="name" maxLength={100} required autoFocus /></label>
          <fieldset className={styles.typeOptions}>
            <legend>반 종류</legend>
            <label>
              <input type="radio" name="kind" checked={kind === "union"} onChange={() => setKind("union")} />
              <span><strong>연합반</strong><small>여러 학교 학생을 함께 편성</small></span>
            </label>
            <label>
              <input type="radio" name="kind" checked={kind === "school"} onChange={() => setKind("school")} />
              <span><strong>학교반</strong><small>같은 학교 학생을 편성</small></span>
            </label>
          </fieldset>
          {kind === "union"
            ? <label>연합반 과정 <select name="track" required>{tracks.map((track) => <option key={track}>{track}</option>)}</select></label>
            : <label>학교 이름 <input name="school" maxLength={100} required placeholder="학생 정보에 등록된 학교 이름" /></label>}
          {create.isError && failure(create.error)}
        </form>
      </ModalBody>
      <ModalFooter right={<>
        <Button onClick={onCancel} disabled={create.isPending}>취소</Button>
        <Button intent="primary" type="submit" form={formId} loading={create.isPending}>반 저장</Button>
      </>} />
    </AdminModal>
  );
}

function CourseList({ group, lectureRoot }: { group: Detail; lectureRoot: string }) {
  const [past, setPast] = useState(false);
  const pastCount = group.lectures.filter((course) => course.cycle_status === "past").length;
  const visible = group.lectures.filter((course) => (course.cycle_status === "past") === past)
    .sort((left, right) => (right.start_date || "").localeCompare(left.start_date || "") || right.id - left.id);
  return <section className={styles.coursePanel} aria-label="강의 목록">
    <div className={styles.courseHeading}><h3>강의 목록</h3>
      <div className={styles.courseTabs} aria-label="강의 기간">
        <button aria-pressed={!past} onClick={() => setPast(false)}>현재·예정 <span>{group.lectures.length - pastCount}</span></button>
        <button aria-pressed={past} onClick={() => setPast(true)}>지난 강의 <span>{pastCount}</span></button>
      </div>
    </div>
    {visible.length ? <table className={styles.courseTable}>
      <thead><tr><th>강의 이름</th><th>대상</th><th>수강생</th><th>수업 기간</th><th aria-label="강의 열기" /></tr></thead>
      <tbody>{visible.map((course) => {
        const audience = course.school || (group.kind === "school" ? group.school : "연합반 전체");
        return <tr key={course.id}><td>
          <Link className={styles.courseLink} to={`${lectureRoot}/${course.id}`} aria-label={`${course.title} 운영`}>
            <LectureChip size={32} lectureName={course.title} chipLabel={course.chip_label || (course.period === "vacation" ? "방학" : "내신")} color={course.color || "#AE531F"} />
            <span><strong>{course.title}</strong><small>{course.cycle_status === "upcoming" ? "개강 예정 · " : ""}{periods[course.period]}<span className={styles.mobileAudience}> · {audience}</span></small></span>
          </Link></td>
          <td>{audience}</td><td>{course.student_count}명</td>
          <td><time>{course.start_date}</time> ~ <time>{course.end_date}</time>{course.lecture_time && <small>{course.lecture_time}</small>}</td>
          <td aria-hidden="true"><ChevronRight size={16} /></td></tr>;
      })}</tbody>
    </table> : <p className={styles.emptyCourse}>{past ? "지난 강의가 없습니다." : "현재 진행 중이거나 예정된 강의가 없습니다."}</p>}
  </section>;
}

function GroupDetail({ id, root, lectureRoot, lectureEntry, assignOnOpen, afterInitialAssignment }: { id: number; root: string; lectureRoot: string; lectureEntry: boolean; assignOnOpen: boolean; afterInitialAssignment: () => void }) {
  const client = useQueryClient();
  const [mode, setMode] = useState<"add" | "remove" | "lecture" | null>(assignOnOpen ? "add" : null);
  const [notice, setNotice] = useState("");
  const [period, setPeriod] = useState<Period>("vacation");
  const [school, setSchool] = useState("");
  const detailKey = [...groupsKey, id];
  const detail = useQuery({
    queryKey: detailKey,
    staleTime: 30_000,
    queryFn: async ({ signal }) => (await api.get<Detail>(`${endpoint}${id}/`, { signal })).data,
  });
  const stopEditing = () => {
    setMode(null);
    if (assignOnOpen) afterInitialAssignment();
  };
  const saveMembers = async (ids: number[]) => {
    const { data } = await api.patch<Detail>(`${endpoint}${id}/members/`, {
      add: mode === "add" ? ids : [],
      remove: mode === "remove" ? ids : [],
    });
    client.setQueryData(detailKey, data);
    void client.invalidateQueries({ queryKey: groupsKey, exact: true });
    void client.invalidateQueries({ queryKey: ["dawon-roster"] });
    setNotice(mode === "add" ? `${ids.length}명을 배정했습니다.` : `${ids.length}명을 반 명단에서 제외했습니다.`);
    stopEditing();
  };
  const openEditor = (next: typeof mode) => {
    setNotice("");
    setPeriod("vacation");
    setSchool("");
    setMode(next);
  };
  if (detail.isPending) return <p role="status">반 정보를 불러오는 중입니다.</p>;
  if (detail.isError) return <div className={styles.panel}>{failure(detail.error)}<button onClick={() => void detail.refetch()}>다시 시도</button> <Link to={root}>반 목록</Link></div>;
  const group = detail.data;
  const members = group.students;
  const eligibleMembers = members.filter((student) => student.eligible !== false);
  const schoolScoped = group.kind === "union" && period !== "vacation";
  const schools = [...new Set(eligibleMembers.map((student) => student.school).filter(Boolean))].sort();
  const enrollmentCount = schoolScoped ? eligibleMembers.filter((student) => student.school === school).length : eligibleMembers.length;

  return (
    <div className={styles.detail}>
      <header className={styles.heading}>
        <div><Link to={root} className={styles.back}>반 목록</Link><h2>{group.name}</h2><span className={styles.kind}>{groupType(group)}</span></div>
        <button className={styles.primary} onClick={() => openEditor("lecture")} disabled={!eligibleMembers.length}>수업 개설</button>
      </header>
      {!members.length && <p>학생을 배정하면 수업을 개설할 수 있습니다.</p>}
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      {mode === "lecture" && <Suspense fallback={<p role="status">강의 개설 창을 불러오는 중입니다.</p>}>
        <LectureCreateModal isOpen onClose={stopEditing} classGroup={{
          name: group.name,
          ready: enrollmentCount > 0,
          count: enrollmentCount,
          create: async (payload) => {
            await api.post<Lecture>(`${endpoint}${id}/lectures/`, { ...payload, period, school });
            await Promise.all([
              client.invalidateQueries({ queryKey: groupsKey }),
              client.invalidateQueries({ queryKey: teacherLectureQueryKeys.lectures }),
            ]);
            setNotice("수업을 개설했습니다.");
          },
          field: <div className={styles.form}>
            <label>수업 구분 <select value={period} onChange={(event) => {
              setPeriod(event.target.value as Period);
              setSchool("");
            }}>{Object.entries(periods).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            {schoolScoped && <label>내신 대상 학교 <select value={school} onChange={(event) => setSchool(event.target.value)} required>
              <option value="">학교를 선택하세요</option>
              {schools.map((name) => <option key={name}>{name}</option>)}
            </select></label>}
            {schoolScoped && !schools.length && <p>학생 정보에서 학교를 등록하면 학교별 내신 수업을 개설할 수 있습니다.</p>}
            {enrollmentCount > 0 && <p>대상 학생 {enrollmentCount}명이 수강생으로 등록됩니다.</p>}
          </div>,
        }} />
      </Suspense>}
      {lectureEntry && <CourseList group={group} lectureRoot={lectureRoot} />}
      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <h3>반 명단 <span>{members.length}명</span></h3>
          <div className={styles.actions}>
            <button onClick={() => openEditor("add")}>반 인원 배정</button>
            {members.length > 0 && <button onClick={() => openEditor("remove")}>명단에서 제외</button>}
          </div>
        </div>
        {members.length === 0 && <p>배정된 학생이 없습니다.</p>}
        <ul className={styles.rows}>
          {members.map((student) => <li key={student.id}>
            <strong>{student.name}</strong>
            <span>{student.school || "학교 미등록"}{student.eligible === false && " · 배정 자격 확인 필요"}</span>
          </li>)}
        </ul>
        {(mode === "add" || mode === "remove") && <ClassRosterModal
          title={mode === "add" ? "반 인원 배정" : "반 명단에서 제외"}
          description={mode === "add" ? group.name : `${group.name} · 기존 수강·출결 기록은 유지됩니다.`}
          candidateUrl={mode === "add" ? `${endpoint}${id}/candidates/` : undefined}
          roster={mode === "remove" ? members : undefined}
          submitLabel={mode === "add" ? "배정 저장" : "명단에서 제외"}
          onSave={saveMembers}
          onClose={stopEditing}
        />}
      </section>
      {!lectureEntry && <CourseList group={group} lectureRoot={lectureRoot} />}
    </div>
  );
}

export default function ClassGroupsPage({ lectureEntry = false }: { lectureEntry?: boolean }) {
  const mobile = useLocation().pathname.startsWith("/workspace/mobile/");
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const client = useQueryClient();
  const isDawon = resolveTenantCodeString() === "dawon";
  const rawId = params.get("class");
  const id = rawId && /^\d+$/.test(rawId) ? Number(rawId) : null;
  const lectureRoot = mobile ? "/workspace/mobile/classes" : "/workspace/lectures";
  const root = lectureEntry ? lectureRoot : mobile ? "/workspace/mobile/students/class-groups" : "/workspace/students/class-groups";
  const groups = useQuery({
    queryKey: groupsKey,
    enabled: isDawon && !id,
    staleTime: 30_000,
    queryFn: async ({ signal }) => (await api.get<Group[]>(endpoint, { signal })).data,
  });
  if (!isDawon) return <Navigate to={mobile ? "/workspace/mobile/students" : "/workspace/students/home"} replace />;
  if (id) return <div className={styles.page}><GroupDetail key={id} id={id} lectureEntry={lectureEntry} root={root} lectureRoot={lectureRoot} assignOnOpen={params.get("assign") === "1"} afterInitialAssignment={() => setParams({ class: String(id) }, { replace: true })} /></div>;
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div><h2>{lectureEntry ? "반별 강의" : "반 편성"}</h2><p>반을 선택해 수업을 개설하고 운영합니다.</p></div>
        <div className={styles.actions}>
          {lectureEntry && <Link to={`${lectureRoot}?view=all`} className={styles.operate}>전체 강의 목록</Link>}
          <button className={styles.primary} onClick={() => setCreating(true)}>반 만들기</button>
        </div>
      </header>
      {creating && <GroupForm onCancel={() => setCreating(false)} onCreated={(createdId) => {
        setCreating(false);
        void client.invalidateQueries({ queryKey: groupsKey });
        setParams({ class: String(createdId), assign: "1" });
      }} />}
      {groups.isPending && <p role="status">반 목록을 불러오는 중입니다.</p>}
      {groups.isError && <div className={styles.panel}>{failure(groups.error)}<button onClick={() => void groups.refetch()}>다시 시도</button></div>}
      {groups.data?.length === 0 && <p className={styles.panel}>아직 편성한 반이 없습니다.</p>}
      <ul className={styles.groupList}>
        {groups.data?.map((group) => <li key={group.id}><Link to={`${root}?class=${group.id}`}>
          <span className={styles.groupIcon} aria-hidden="true"><UsersRound size={19} /></span>
          <div><strong>{group.name}</strong><span>{groupType(group)}</span></div>
          <div className={styles.groupCounts}><span>학생 <strong>{group.student_count}명</strong></span><span>수업 <strong>{group.lecture_count ?? 0}개</strong></span></div><ChevronRight size={16} aria-hidden="true" />
        </Link></li>)}
      </ul>
    </div>
  );
}
