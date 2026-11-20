import { dawonStaffPreviewRole } from "./staffPreview";
import { dawonQueryKeys } from "./queryKeys";
import { lazy, Suspense, useId, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { resolveTenantCodeString } from "@/shared/tenant";
import { Button } from "@/shared/ui/ds";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { teacherLectureQueryKeys } from "@/app_teacher/domains/lectures/queryKeys";
import DawonDirectoryTable, { type DirectorySort } from "./DawonDirectoryTable";
import { DomainListToolbar, DomainTable } from "@/shared/ui/domain";
import { ChevronRight } from "lucide-react";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import ClassRosterModal, { type RosterStudent } from "./ClassRosterModal";
import styles from "./ClassGroupsPage.module.css";

const LectureCreateModal = lazy(() => import("@admin/domains/lectures/components/LectureCreateModal"));

const endpoint = "/students/class-groups/";
const tracks = ["1%", "HYPER", "SKY"] as const;
const periods = { vacation: "방학", midterm: "내신 · 중간", final: "내신 · 기말" };

type Kind = "union" | "school";
type Period = keyof typeof periods;
type Group = { id: number; name: string; kind: Kind; track: string; school: string; student_count: number; lecture_count: number };
type Lecture = { id: number; title: string; period: Period; school: string; start_date: string; end_date: string; student_count: number; cycle_status: "upcoming" | "current" | "past"; color?: string; chip_label?: string; lecture_time?: string };
type Detail = Group & { assigned_teacher?: {id:number;name:string} | null; students: RosterStudent[]; lectures: Lecture[] };

function groupType(group: Group) {
  return group.kind === "union" ? `연합반 · ${group.track}` : `학교반 · ${group.school}`;
}

function failure(error: unknown) {
  return <p role="alert" className={styles.error}>{getApiErrorMessage(error, "저장하거나 불러오지 못했습니다. 다시 시도해 주세요.")}</p>;
}

function GroupForm({ admin, onCreated, onCancel }: { admin: boolean; onCreated: (id: number) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<Kind>("union");
  const formId = useId();
  const instructors = useQuery({
    queryKey: dawonQueryKeys.assignableInstructors,
    enabled: admin,
    queryFn: async ({signal}) => (await api.get<{id:number;name:string}[]>(endpoint, {params:{view:"instructors"},signal})).data,
  });
  const create = useMutation({
    mutationFn: async (form: FormData) => {
      const { data } = await api.post<Group>(endpoint, {
        name: form.get("name"),
        ...(admin && form.get("assignedTeacher") ? {assigned_teacher_id: Number(form.get("assignedTeacher"))} : {}),
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
          {admin && <>
            <label>담당 강사 <select name="assignedTeacher" disabled={instructors.isPending || instructors.isError}>
              <option value="">담당 미지정</option>
              {instructors.data?.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}
            </select></label>
            {instructors.isPending && <p role="status">담당 강사를 불러오는 중입니다.</p>}
            {instructors.isError && <p role="alert">담당 강사를 불러오지 못했습니다. <Button type="button" onClick={()=>void instructors.refetch()}>다시 시도</Button></p>}
          </>}
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
        <Button intent="primary" type="submit" form={formId} loading={create.isPending} disabled={admin && (instructors.isPending || instructors.isError)}>반 저장</Button>
      </>} />
    </AdminModal>
  );
}

function CourseList({ group, lectureRoot, admin }: { admin: boolean; group: Detail; lectureRoot: string }) {
  const [past, setPast] = useState(false);
  const [query, setQuery] = useState("");
  const pastCount = group.lectures.filter((course) => course.cycle_status === "past").length;
  const visible = group.lectures.filter((course) => (course.cycle_status === "past") === past)
    .filter((course) => matches(query, course.title, course.school, periods[course.period], course.lecture_time))
    .sort((left, right) => (right.start_date || "").localeCompare(left.start_date || "") || right.id - left.id);
  return <section className={styles.coursePanel} aria-label="강의 목록">
    <DomainListToolbar totalLabel={`강의 ${visible.length}개`} searchSlot={<ListSearch label="강의명 · 학교 · 수업 시간 검색" value={query} change={setQuery} />} primaryAction={null} filterSlot={
      <div className={styles.courseTabs} aria-label="강의 기간">
        <button aria-pressed={!past} onClick={() => setPast(false)}>현재·예정 <span>{group.lectures.length - pastCount}</span></button>
        <button aria-pressed={past} onClick={() => setPast(true)}>지난 강의 <span>{pastCount}</span></button>
      </div>} />
    {visible.length ? <DomainTable scrollLabel="반별 강의" tableClassName={`ds-table--flat ${styles.courseTable}`}>
      <thead><tr><th>강의 이름</th><th>대상</th><th>수강생</th><th>수업 기간</th><th aria-label="강의 열기" /></tr></thead>
      <tbody>{visible.map((course) => {
        const audience = course.school || (group.kind === "school" ? group.school : "연합반 전체");
        return <tr key={course.id}><td>
          <Link className={styles.courseLink} to={admin ? `/workspace/dashboard?group=${group.id}&course=${course.id}` : `${lectureRoot}/${course.id}`} aria-label={`${course.title} 운영`}>
            <LectureChip size={32} lectureName={course.title} chipLabel={course.chip_label || (course.period === "vacation" ? "방학" : "내신")} color={course.color || "#AE531F"} />
            <span><strong>{course.title}</strong><small>{course.cycle_status === "upcoming" ? "개강 예정 · " : ""}{periods[course.period]}<span className={styles.mobileAudience}> · {audience}</span></small></span>
          </Link></td>
          <td>{audience}</td><td>{course.student_count}명</td>
          <td><time>{course.start_date}</time> ~ <time>{course.end_date}</time>{course.lecture_time && <small>{course.lecture_time}</small>}</td>
          <td aria-hidden="true"><ChevronRight size={16} /></td></tr>;
      })}</tbody>
    </DomainTable> : <p className={styles.emptyCourse}>{query.trim() ? "검색 조건에 맞는 강의가 없습니다." : past ? "지난 강의가 없습니다." : "현재 진행 중이거나 예정된 강의가 없습니다."}</p>}
  </section>;
}

function GroupDetail({ admin, id, root, lectureRoot, rosterRoot, lectureEntry, assignOnOpen, afterInitialAssignment }: { admin: boolean; id: number; root: string; lectureRoot: string; rosterRoot: string; lectureEntry: boolean; assignOnOpen: boolean; afterInitialAssignment: () => void }) {
  const client = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const previous = admin && location.state?.roster?.group === id ? location.state.roster : undefined;
  const [query, setQuery] = useState<string>(() => typeof previous?.query === "string" ? previous.query : "");
  const [sort, setSort] = useState<DirectorySort>(() => previous?.sort &&
    typeof previous.sort.key === "string" && typeof previous.sort.ascending === "boolean"
    ? previous.sort : {key:"name", ascending:true});
  const rosterState = {roster: {group:id, query, sort}};
  const [mode, setMode] = useState<"add" | "remove" | "lecture" | null>(assignOnOpen ? "add" : null);
  const [selectedStudent, setStudent] = useState<RosterStudent | null>(null);
  const [notice, setNotice] = useState("");
  const [createdCourse, setCreatedCourse] = useState<Lecture | null>(null);
  const [period, setPeriod] = useState<Period>("vacation");
  const [school, setSchool] = useState("");
  const detailKey = admin ? dawonQueryKeys.adminGroup(id) : dawonQueryKeys.group(id);
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
    void client.invalidateQueries({ queryKey: admin ? dawonQueryKeys.adminGroups : dawonQueryKeys.groups, exact: true });
    if (admin) void client.invalidateQueries({queryKey:dawonQueryKeys.adminOperations});
    void client.invalidateQueries({ queryKey: dawonQueryKeys.roster });
    setNotice(mode === "add" ? `${ids.length}명을 배정했습니다.` : `${ids.length}명을 반 명단에서 제외했습니다.`);
    stopEditing();
  };
  const openEditor = (next: typeof mode) => {
    setNotice("");
    setCreatedCourse(null);
    setPeriod("vacation");
    setSchool("");
    setMode(next);
  };
  if (detail.isPending) return <p role="status">반 정보를 불러오는 중입니다.</p>;
  if (detail.isError) return <div className={styles.panel}>{failure(detail.error)}<button onClick={() => void detail.refetch()}>다시 시도</button> <Link to={root}>반 목록</Link></div>;
  const group = detail.data;
  const members = group.students;
  const visibleMembers = members.filter((student) => matches(query, student.name, student.school, student.phone, student.parent_phone));
  const eligibleMembers = members.filter((student) => student.eligible !== false);
  const schoolScoped = group.kind === "union" && period !== "vacation";
  const schools = [...new Set(eligibleMembers.map((student) => student.school).filter(Boolean))].sort();
  const enrollmentCount = schoolScoped ? eligibleMembers.filter((student) => student.school === school).length : eligibleMembers.length;

  return (
    <div className={styles.detail}>
      <header className={styles.heading}>
        <div><Link to={root} className={styles.back}>반 목록</Link><h2>{group.name}</h2><span className={styles.kind}>{groupType(group)}</span>{admin && <p>담당 강사 · {group.assigned_teacher?.name || "미지정"}</p>}</div>
        {lectureEntry && !admin && <Button intent="primary" onClick={() => openEditor("lecture")} disabled={!eligibleMembers.length}>수업 개설</Button>}
      </header>
      <nav className={styles.groupNav} aria-label="반 업무">
        <Link to={admin ? `${rosterRoot}?class=${id}&view=courses` : `${lectureRoot}?class=${id}`} aria-current={lectureEntry ? "page" : undefined}>강의 목록</Link>
        <Link to={`${rosterRoot}?class=${id}`} aria-current={!lectureEntry ? "page" : undefined}>반 명단</Link>
      </nav>
      {lectureEntry && !admin && !eligibleMembers.length && <p>수업을 개설하려면 <Link to={`${rosterRoot}?class=${id}`}>반 명단</Link>에서 수강 가능한 학생을 배정하세요.</p>}
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      {createdCourse && <div className={styles.createdCourse}>
        <p role="status"><strong>{createdCourse.title}</strong> 개설 완료 · 수강생 {createdCourse.student_count}명 등록</p>
        <Link className={styles.primary} to={`${lectureRoot}/${createdCourse.id}`}>수업 운영 열기 <ChevronRight size={16} aria-hidden /></Link>
      </div>}
      {mode === "lecture" && <Suspense fallback={<p role="status">강의 개설 창을 불러오는 중입니다.</p>}>
        <LectureCreateModal isOpen onClose={stopEditing} classGroup={{
          name: group.name,
          ready: enrollmentCount > 0,
          count: enrollmentCount,
          create: async (payload) => {
            const { data } = await api.post<Lecture>(`${endpoint}${id}/lectures/`, { ...payload, period, school });
            setCreatedCourse(data);
            void Promise.all([
              client.invalidateQueries({ queryKey: dawonQueryKeys.groups }),
              client.invalidateQueries({ queryKey: teacherLectureQueryKeys.lectures }),
            ]);
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
      {lectureEntry && <CourseList admin={admin} group={group} lectureRoot={lectureRoot} />}
      {!lectureEntry && <section className={styles.detail} aria-label="반 명단">
        <DomainListToolbar totalLabel={`반 명단 ${query.trim() ? visibleMembers.length + " / " : ""}${members.length}명`}
          searchSlot={<ListSearch label="이름 · 학교 · 전화번호 검색" value={query} change={setQuery} />}
          primaryAction={<div className={styles.actions}>
            {members.length > 0 && <Button intent="secondary" onClick={() => openEditor("remove")}>명단에서 제외</Button>}
            <Button intent="primary" onClick={() => openEditor("add")}>반 인원 배정</Button>
          </div>} />
        <DawonDirectoryTable sort={sort} onSort={setSort} id="dawon-class-members" label="반 학생 명단" rows={visibleMembers}
          empty={members.length ? "검색 조건에 맞는 학생이 없습니다." : "배정된 학생이 없습니다."}
          columns={[
            {key: "name", label: "학생 이름", defaultWidth: 160, value: student => student.name, render: student => <>
              {admin ? <button type="button" className={styles.rowLink} onClick={()=>{
                navigate(location.pathname + location.search, {replace:true, state:rosterState, preventScrollReset:true});
                setStudent(student);
              }}>{student.name}</button> : <Link className={styles.rowLink} to={`/workspace/students/${student.id}`} state={{backgroundLocation: location}}>{student.name}</Link>}
              {student.eligible === false && <small>배정 자격 확인 필요</small>}</>},
            {key: "school", label: "학교", defaultWidth: 120, value: student => student.school},
            {key: "grade", label: "학년", defaultWidth: 70, value: student => student.grade ?? 0, render: student => student.grade ? `${student.grade}학년` : "—"},
            {key: "parent", label: "학부모 연락처", defaultWidth: 145, value: student => student.parent_phone || ""},
            {key: "phone", label: "학생 연락처", defaultWidth: 145, value: student => student.phone || ""},
          ]} />
        {admin && selectedStudent && <AdminModal open noMinimize trapFocus width={MODAL_WIDTH.sm} onClose={()=>setStudent(null)}>
          <ModalHeader title={selectedStudent.name+" · 학생 학습 기록"}/>
          <ModalBody>{selectedStudent.course_ids?.length ? <>
            <p>학습 기록을 확인할 수강 강의를 선택하세요.</p>
            <ul>{group.lectures.filter(course=>selectedStudent.course_ids?.includes(course.id)).map(course=>
              <li key={course.id}><Link state={rosterState} to={`/workspace/dashboard?panel=student&origin=roster&group=${id}&course=${course.id}&student=${selectedStudent.id}`}>{course.title}</Link></li>)}</ul>
          </> : <p>이 반에서 현재 수강 중인 강의가 없습니다.</p>}</ModalBody>
          <ModalFooter right={<Button onClick={()=>setStudent(null)}>닫기</Button>}/>
        </AdminModal>}
        {(mode === "add" || mode === "remove") && <ClassRosterModal
          title={mode === "add" ? "반 인원 배정" : "반 명단에서 제외"}
          description={mode === "add" ? group.name : `${group.name} · 기존 수강·출결 기록은 유지됩니다.`}
          candidateUrl={mode === "add" ? `${endpoint}${id}/candidates/` : undefined}
          roster={mode === "remove" ? members : undefined}
          submitLabel={mode === "add" ? "배정 저장" : "명단에서 제외"}
          onSave={saveMembers}
          onClose={stopEditing}
        />}
      </section>}
    </div>
  );
}

function matches(query: string, ...values: (string | undefined)[]) {
  const normalize = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[\s-]+/g, "");
  return values.some((value) => normalize(value ?? "").includes(normalize(query)));
}

function ListSearch({label, value, change}: {label: string; value: string; change: (query: string) => void}) {
  return <input type="search" className="ds-input w-full max-w-[360px]" aria-label={label} placeholder={label}
    value={value} onChange={(event) => change(event.target.value)} />;
}

export default function ClassGroupsPage({ lectureEntry = false }: { lectureEntry?: boolean }) {
  const admin = dawonStaffPreviewRole() === "admin";
  const mobile = useLocation().pathname.startsWith("/workspace/mobile/");
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const client = useQueryClient();
  const isDawon = resolveTenantCodeString() === "dawon";
  const rawId = params.get("class");
  const id = rawId && /^\d+$/.test(rawId) ? Number(rawId) : null;
  const lectureRoot = mobile ? "/workspace/mobile/classes" : "/workspace/lectures";
  const rosterRoot = mobile ? "/workspace/mobile/students/class-groups" : "/workspace/students/class-groups";
  const root = lectureEntry ? lectureRoot : rosterRoot;
  const groups = useQuery({
    queryKey: admin ? dawonQueryKeys.adminGroups : dawonQueryKeys.groups,
    enabled: isDawon && !id,
    staleTime: 30_000,
    queryFn: async ({ signal }) => (await api.get<Group[]>(endpoint, { signal })).data,
  });
  if (!isDawon) return <Navigate to={mobile ? "/workspace/mobile/students" : "/workspace/students/home"} replace />;
  if (id && lectureEntry && params.get("assign") === "1") return <Navigate to={`${rosterRoot}?class=${id}&assign=1`} replace />;
  if (id) return <div className={styles.page}><GroupDetail admin={admin} key={`${root}-${id}`} id={id} rosterRoot={rosterRoot} lectureEntry={lectureEntry || (admin && params.get("view") === "courses")} root={root} lectureRoot={lectureRoot} assignOnOpen={params.get("assign") === "1"} afterInitialAssignment={() => setParams({ class: String(id) }, { replace: true })} /></div>;
  const all = groups.data ?? [];
  const visible = all.filter((group) => matches(query, group.name, groupType(group), group.track, group.school));
  return (
    <div className={styles.page}>
      <DomainListToolbar totalLabel={`반 ${query.trim() ? visible.length + " / " : ""}${all.length}개`}
        searchSlot={<ListSearch label="반 이름 · 학교 · 과정 검색" value={query} change={setQuery} />}
        primaryAction={<div className={styles.actions}>
          {lectureEntry && <Link className="ds-btn" to={`${lectureRoot}?view=all`}>전체 강의 목록</Link>}
          <Button intent="primary" onClick={() => setCreating(true)}>반 만들기</Button>
        </div>} />
      {creating && <GroupForm admin={admin} onCancel={() => setCreating(false)} onCreated={(createdId) => {
        setCreating(false);
        void client.invalidateQueries({ queryKey: dawonQueryKeys.groups });
        if (admin) void client.invalidateQueries({queryKey:dawonQueryKeys.adminOperations});
        navigate(`${rosterRoot}?class=${createdId}&assign=1`);
      }} />}
      {groups.isPending && <p role="status">반 목록을 불러오는 중입니다.</p>}
      {groups.isError && <div className={styles.panel}>{failure(groups.error)}<button onClick={() => void groups.refetch()}>다시 시도</button></div>}
      {groups.isSuccess && <DawonDirectoryTable id="dawon-class-directory" label="반 목록" rows={visible}
        empty={all.length ? "검색 조건에 맞는 반이 없습니다." : "아직 편성한 반이 없습니다."}
        columns={[
          {key: "name", label: "반 이름", defaultWidth: 215, value: group => group.name,
            render: group => <Link className={styles.rowLink} to={`${root}?class=${group.id}`}>{group.name}</Link>},
          {key: "kind", label: "반 구분", defaultWidth: 125, value: group => group.kind === "union" ? "연합반" : "학교별 내신반"},
          {key: "scope", label: "과정 · 학교", defaultWidth: 140, value: group => group.kind === "union" ? group.track : group.school},
          {key: "members", label: "학생 수", defaultWidth: 78, value: group => group.student_count, render: group => group.student_count + "명"},
          {key: "courses", label: "강의 수", defaultWidth: 78, value: group => group.lecture_count, render: group => group.lecture_count + "개"},
        ]} />}
    </div>
  );
}
