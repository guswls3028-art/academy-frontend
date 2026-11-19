import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { resolveTenantCodeString } from "@/shared/tenant";
import styles from "./ClassGroupsPage.module.css";

const endpoint = "/students/class-groups/";
const groupsKey = ["dawon", "class-groups"];
const tracks = ["1%", "HYPER", "SKY"] as const;
const periods = { vacation: "방학", midterm: "내신 · 중간", final: "내신 · 기말" };

type Kind = "union" | "school";
type Period = keyof typeof periods;
type Member = { id: number; name: string; school: string; eligible?: boolean };
type Group = { id: number; name: string; kind: Kind; track: string; school: string; student_count: number };
type Lecture = { id: number; title: string; period: Period; school: string; start_date: string; end_date: string; student_count: number };
type Detail = Group & { students: Member[]; lectures: Lecture[] };

function groupType(group: Group) {
  return group.kind === "union" ? `연합반 · ${group.track}` : `학교반 · ${group.school}`;
}

function failure(error: unknown) {
  return <p role="alert" className={styles.error}>{getApiErrorMessage(error, "저장하거나 불러오지 못했습니다. 다시 시도해 주세요.")}</p>;
}

function GroupForm({ onCreated, onCancel }: { onCreated: (id: number) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<Kind>("union");
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
    <form className={styles.form} onSubmit={(event) => {
      event.preventDefault();
      create.mutate(new FormData(event.currentTarget));
    }}>
      <h2>새 반 만들기</h2>
      <label>반 이름 <input name="name" maxLength={100} required autoFocus /></label>
      <label>반 종류 <select value={kind} onChange={(event) => setKind(event.target.value as Kind)}>
        <option value="union">연합반</option>
        <option value="school">학교반</option>
      </select></label>
      {kind === "union"
        ? <label>연합반 과정 <select name="track" required>{tracks.map((track) => <option key={track}>{track}</option>)}</select></label>
        : <label>학교 이름 <input name="school" maxLength={100} required placeholder="학생 정보에 등록된 학교 이름" /></label>}
      {create.isError && failure(create.error)}
      <div className={styles.actions}>
        <button type="button" onClick={onCancel} disabled={create.isPending}>취소</button>
        <button type="submit" className={styles.primary} disabled={create.isPending}>반 저장</button>
      </div>
    </form>
  );
}

function GroupDetail({ id, root, lectureRoot }: { id: number; root: string; lectureRoot: string }) {
  const client = useQueryClient();
  const [mode, setMode] = useState<"add" | "remove" | "lecture" | null>(null);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState("");
  const [period, setPeriod] = useState<Period>("vacation");
  const [school, setSchool] = useState("");
  const detailKey = [...groupsKey, id];
  const detail = useQuery({
    queryKey: detailKey,
    queryFn: async ({ signal }) => (await api.get<Detail>(`${endpoint}${id}/`, { signal })).data,
  });
  const candidates = useQuery({
    queryKey: [...detailKey, "candidates", submittedSearch],
    enabled: mode === "add",
    queryFn: async ({ signal }) => (await api.get<Member[]>(`${endpoint}${id}/candidates/`, {
      params: { search: submittedSearch }, signal,
    })).data,
  });
  const stopEditing = () => {
    setMode(null);
    setSelected(new Set());
  };
  const membership = useMutation({
    mutationFn: async () => (await api.patch<Detail>(`${endpoint}${id}/members/`, {
      add: mode === "add" ? [...selected] : [],
      remove: mode === "remove" ? [...selected] : [],
    })).data,
    onSuccess: (data) => {
      client.setQueryData(detailKey, data);
      void client.invalidateQueries({ queryKey: groupsKey });
      setNotice(mode === "add" ? "학생을 배정했습니다." : "선택한 학생을 반 명단에서 제외했습니다.");
      stopEditing();
    },
  });
  const lecture = useMutation({
    mutationFn: async (form: FormData) => (await api.post<Lecture>(`${endpoint}${id}/lectures/`, Object.fromEntries(form))).data,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: detailKey });
      setNotice("수업을 개설했습니다.");
      stopEditing();
    },
  });
  const openEditor = (next: typeof mode) => {
    setNotice("");
    membership.reset();
    lecture.reset();
    setSelected(new Set());
    setPeriod("vacation");
    setSchool("");
    setMode(next);
  };
  const toggle = (studentId: number) => setSelected((ids) => {
    const next = new Set(ids);
    if (next.has(studentId)) next.delete(studentId);
    else next.add(studentId);
    return next;
  });

  if (detail.isPending) return <p role="status">반 정보를 불러오는 중입니다.</p>;
  if (detail.isError) return <div className={styles.panel}>{failure(detail.error)}<button onClick={() => void detail.refetch()}>다시 시도</button> <Link to={root}>반 목록</Link></div>;
  const group = detail.data;
  const members = group.students;
  const eligibleMembers = members.filter((student) => student.eligible !== false);
  const schoolScoped = group.kind === "union" && period !== "vacation";
  const schools = [...new Set(eligibleMembers.map((student) => student.school).filter(Boolean))].sort();
  const enrollmentCount = schoolScoped ? eligibleMembers.filter((student) => student.school === school).length : members.length;
  const candidatesToAdd = (candidates.data ?? []).filter((row) => !members.some(({ id: studentId }) => studentId === row.id));

  return (
    <div className={styles.detail}>
      <header className={styles.heading}>
        <div><Link to={root} className={styles.back}>반 목록</Link><h2>{group.name}</h2><p>{groupType(group)}</p></div>
        <button className={styles.primary} onClick={() => openEditor("lecture")} disabled={membership.isPending || lecture.isPending || !members.length}>수업 개설</button>
      </header>
      {!members.length && <p>학생을 배정하면 수업을 개설할 수 있습니다.</p>}
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      {mode === "lecture" && (
        <form className={styles.form} onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          lecture.mutate(new FormData(event.currentTarget));
        }}>
          <h3>수업 개설</h3>
          <label>수업 이름 <input name="title" maxLength={150} required autoFocus /></label>
          <label>수업 구분 <select name="period" value={period} onChange={(event) => {
            setPeriod(event.target.value as Period);
            setSchool("");
          }}>{Object.entries(periods).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          {schoolScoped && <label>내신 대상 학교 <select name="school" value={school} onChange={(event) => setSchool(event.target.value)} required>
            <option value="">학교를 선택하세요</option>
            {schools.map((name) => <option key={name}>{name}</option>)}
          </select></label>}
          {schoolScoped && !schools.length && <p>학생 정보에서 학교를 등록하면 학교별 내신 수업을 개설할 수 있습니다.</p>}
          {enrollmentCount > 0 && <p>배정된 대상 학생 {enrollmentCount}명이 이 수업의 수강생으로 등록됩니다.</p>}
          <div className={styles.dates}>
            <label>시작일 <input type="date" name="start_date" required /></label>
            <label>종료일 <input type="date" name="end_date" required /></label>
          </div>
          {lecture.isError && failure(lecture.error)}
          <div className={styles.actions}>
            <button type="button" onClick={stopEditing} disabled={lecture.isPending}>취소</button>
            <button type="submit" className={styles.primary} disabled={lecture.isPending || !enrollmentCount}>수업 저장</button>
          </div>
        </form>
      )}
      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <h3>반 명단 <span>{members.length}명</span></h3>
          <div className={styles.actions}>
            <button onClick={() => openEditor("add")} disabled={membership.isPending || lecture.isPending}>학생 배정</button>
            {members.length > 0 && <button onClick={() => openEditor("remove")} disabled={membership.isPending || lecture.isPending}>명단에서 제외</button>}
          </div>
        </div>
        {mode === "add" && (
          <form className={styles.search} onSubmit={(event) => {
            event.preventDefault();
            setSubmittedSearch(search.trim());
          }}>
            <input aria-label="배정할 학생 검색" placeholder="학생 이름 또는 학교 검색" value={search} onChange={(event) => setSearch(event.target.value)} />
            <button type="submit">검색</button>
          </form>
        )}
        {mode === "add" && candidates.isPending && <p role="status">배정할 학생을 불러오는 중입니다.</p>}
        {mode === "add" && candidates.isError && <div>{failure(candidates.error)}<button onClick={() => void candidates.refetch()}>다시 시도</button></div>}
        {mode === "add" && candidates.isSuccess && !candidatesToAdd.length && <p>배정할 수 있는 학생이 없습니다.</p>}
        {mode !== "add" && !members.length && <p>배정된 학생이 없습니다.</p>}
        <ul className={styles.rows}>
          {(mode === "add" ? candidatesToAdd : members).map((student) => (
            <li key={student.id}>
              {mode === "add" || mode === "remove"
                ? <label className={styles.pick}><input type="checkbox" checked={selected.has(student.id)} onChange={() => toggle(student.id)} />{student.name}</label>
                : <strong>{student.name}</strong>}
              <span>{student.school || "학교 미등록"}{student.eligible === false && " · 배정 자격 확인 필요"}</span>
            </li>
          ))}
        </ul>
        {(mode === "add" || mode === "remove") && (
          <>
            {membership.isError && failure(membership.error)}
            <div className={styles.actions}>
              <button onClick={stopEditing} disabled={membership.isPending}>취소</button>
              <button className={styles.primary} onClick={() => membership.mutate()} disabled={!selected.size || membership.isPending}>
                {selected.size}명 {mode === "add" ? "배정 저장" : "반 명단에서 제외"}
              </button>
            </div>
          </>
        )}
      </section>
      <section className={styles.panel}>
        <h3>개설 수업</h3>
        {!group.lectures.length && <p>아직 개설한 수업이 없습니다.</p>}
        <ul className={styles.rows}>
          {group.lectures.map((course) => <li key={course.id}>
            <div><Link to={`${lectureRoot}/${course.id}`}>{course.title}</Link><p>{periods[course.period]}{course.school && ` · ${course.school}`} · {course.start_date} ~ {course.end_date}</p></div>
            <Link to={`${lectureRoot}/${course.id}`} className={styles.operate} aria-label={`${course.title} 운영`}>수업 운영</Link>
          </li>)}
        </ul>
      </section>
    </div>
  );
}

export default function ClassGroupsPage() {
  const mobile = useLocation().pathname.startsWith("/workspace/mobile/");
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const client = useQueryClient();
  const isDawon = resolveTenantCodeString() === "dawon";
  const rawId = params.get("class");
  const id = rawId && /^\d+$/.test(rawId) ? Number(rawId) : null;
  const root = mobile ? "/workspace/mobile/students/class-groups" : "/workspace/students/class-groups";
  const groups = useQuery({
    queryKey: groupsKey,
    enabled: isDawon && !id,
    queryFn: async ({ signal }) => (await api.get<Group[]>(endpoint, { signal })).data,
  });
  if (!isDawon) return <Navigate to={mobile ? "/workspace/mobile/students" : "/workspace/students/home"} replace />;
  if (id) return <div className={styles.page}><GroupDetail key={id} id={id} root={root} lectureRoot={mobile ? "/workspace/mobile/classes" : "/workspace/lectures"} /></div>;
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div><h2>반 편성</h2><p>반을 만들고 학생을 배정한 뒤 수업을 개설하세요.</p></div>
        {!creating && <button className={styles.primary} onClick={() => setCreating(true)}>반 만들기</button>}
      </header>
      {creating && <GroupForm onCancel={() => setCreating(false)} onCreated={(createdId) => {
        setCreating(false);
        void client.invalidateQueries({ queryKey: groupsKey });
        setParams({ class: String(createdId) });
      }} />}
      {groups.isPending && <p role="status">반 목록을 불러오는 중입니다.</p>}
      {groups.isError && <div className={styles.panel}>{failure(groups.error)}<button onClick={() => void groups.refetch()}>다시 시도</button></div>}
      {groups.data?.length === 0 && <p className={styles.panel}>아직 편성한 반이 없습니다.</p>}
      <ul className={styles.groupList}>
        {groups.data?.map((group) => <li key={group.id}><Link to={`${root}?class=${group.id}`}>
          <div><strong>{group.name}</strong><span>{groupType(group)}</span></div><span>{group.student_count}명</span>
        </Link></li>)}
      </ul>
    </div>
  );
}
