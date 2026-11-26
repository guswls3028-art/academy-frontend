import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import api from "@/shared/api/axios";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { AdminModal, ModalBody, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { formatPhone, formatStudentPhoneDisplay } from "@/shared/utils/formatPhone";
import { DirectoryPerformance } from "./DawonAdminLearning";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { DomainLayout, DomainTable } from "@/shared/ui/domain";
import { Button } from "@/shared/ui/ds";
import styles from "./DawonAdminDesk.module.css";
import { dawonUnionTracks, type DawonClassKind } from "./classTypes";
import { dawonQueryKeys } from "./queryKeys";
import { dawonStaffPreviewRole } from "./staffPreview";

type Group = { id: number; name: string; kind: DawonClassKind; track: string };
type Student = {
  id: number;
  name: string;
  school: string;
  grade: number | null;
  phone: string;
  parent_phone: string;
  groups: Pick<Group, "id" | "name">[];
  courses?: { id: number; title: string; group: number; color: string; chip_label: string }[];
};
type Page = { count: number; results: Student[] };
type Filter = "kind" | "track" | "grade" | "group" | "page";
const root = "/workspace/students/home";
const endpoint = "/students/class-groups/";
const pageSize = 25;

import { getApiErrorMessage } from "@/shared/api/errorMessage";
import DawonRosterMessages from "./DawonRosterMessages";
import DawonRosterUtilities from "./DawonRosterUtilities";
import { studentDirectoryTabs } from "./studentDirectoryTabs";

export default function DawonAdminStudents() {
  const role = dawonStaffPreviewRole();
  return role ? <StudentDirectory key={role} role={role} /> : null;
}

function StudentDirectory({ role }: { role: "admin" | "teacher" }) {
  const [params, setParams] = useSearchParams();
  const { key, state } = useLocation();
  const teacher = role === "teacher";
  const navigate = useNavigate();
  const list = useRef<HTMLElement>(null);
  const savedSearch = typeof state?.directoryTerm === "string" ? state.directoryTerm : "";
  // Replacing this history entry after a debounce must not interrupt a newer keystroke.
  const entry = state?.directorySearchEntry ?? key;
  const [draft, setDraft] = useState<{ entry: string; text: string } | null>(null);
  const [composing, setComposing] = useState(false);
  const search = draft && draft.entry === entry ? draft.text : savedSearch;
  const settledSearch = useDebouncedValue(search);
  useEffect(() => {
    if (composing || search === savedSearch || settledSearch !== search) return;
    const next = new URLSearchParams(params);
    next.delete("student");
    next.delete("page");
    setParams(next, {
      replace: true, preventScrollReset: true, state: { directoryTerm: search, directorySearchEntry: entry },
    });
  }, [composing, entry, params, savedSearch, search, setParams, settledSearch]);
  const group = params.get("group") || params.get("class") || "";
  const grade = params.get("grade") || "";
  const selected = params.get("student");
  const previousStudent = useRef(selected);
  useEffect(() => {
    const prior = previousStudent.current;
    previousStudent.current = selected;
    if (prior && !selected) {
      const row = list.current?.querySelector<HTMLAnchorElement>(`[data-student-id="${CSS.escape(prior)}"]`);
      (row ?? document.getElementById("dawon-directory-search"))?.focus({ preventScroll: true });
    }
  }, [selected]);

  function closeStudent() {
    if (state?.alertReturn) {
      void navigate(state.alertReturn, {replace:true, preventScrollReset:true});
    } else if (state?.courseReturn) {
      void navigate(state.courseReturn, {replace:true, preventScrollReset:true});
    } else if (state?.studentListEntry && window.history.state?.idx > 0) {
      void navigate(-1);
    } else {
      void navigate(detailUrl(), {replace:true, preventScrollReset:true, state:{directoryTerm:search}});
    }
  }
  const pageParam = Number(params.get("page"));
  const page = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const groups = useQuery({
    queryKey: teacher ? dawonQueryKeys.groups : dawonQueryKeys.adminGroups,
    queryFn: async ({ signal }) => (await api.get<Group[]>(endpoint, { signal })).data,
  });
  const currentGroup = groups.data?.find(item => String(item.id) === group);
  const kind = params.get("kind") || currentGroup?.kind || "";
  const track = kind === "union" ? params.get("track") || "" : "";
  const groupOptions = groups.data?.filter(item => item.kind === kind && (!track || item.track === track)) ?? [];
  const filters = { view: "students", kind, track, group, grade, search: savedSearch.trim(), offset: (page - 1) * pageSize, limit: pageSize };
  const people = useQuery({
    queryKey: dawonQueryKeys.studentPage(role, filters),
    queryFn: async ({ signal }) => (await api.get<Page>(endpoint, { params: filters, signal })).data,
  });

  function update(key: Filter, value: string) {
    const next = new URLSearchParams(params);
    next.delete("student");
    if (key !== "page") next.delete("page");
    if (key === "kind") next.delete("track");
    if (key === "kind" || key === "track" || key === "group") {
      next.delete("group");
      next.delete("class");
      if (key !== "kind" && kind) next.set("kind", kind);
    }
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, {
      preventScrollReset: true, state: { directoryTerm: search },
    });
  }

  function detailUrl(id?: number) {
    const next = new URLSearchParams(params);
    if (id) next.set("student", String(id));
    else next.delete("student");
    return { pathname: root, search: next.toString() };
  }

  const client=useQueryClient();
  const [checked,setChecked]=useState<Map<number, Student>>(new Map());
  const [target,setTarget]=useState("");
  const [assigning,setAssigning]=useState(false);
  const [notice,setNotice]=useState("");
  const selectedStudents=[...checked.values()];
  const assign=useMutation({mutationFn:async()=>{
    const ids=selectedStudents.filter(row=>!row.groups.some(g=>String(g.id)===target)).map(row=>row.id);
    if (!target || !ids.length) throw new Error("새로 배정할 학생과 반을 선택하세요.");
    await api.patch(endpoint+target+"/members/",{add:ids,remove:[]});
    return ids.length;
  },onSuccess:async count=>{
    setNotice(count+"명을 반에 배정했습니다."); setAssigning(false); setChecked(new Map());
    await Promise.all([dawonQueryKeys.groups,dawonQueryKeys.roster,dawonQueryKeys.adminStudents,
      dawonQueryKeys.adminStudentRoot,dawonQueryKeys.adminOperations].map(queryKey=>client.invalidateQueries({queryKey})));
  }});
  const exportFile=useMutation({mutationFn:async()=>{
    const { downloadArrayWorksheet } = await import("@/shared/utils/excelWorkbook");
    await downloadArrayWorksheet({ filename: "다원수학 학생 명단.xlsx", sheetName: "학생 명단", rows: [
      ["학생 이름", "학교", "학년", "소속 반", "학생 연락처", "학부모 연락처"],
      ...selectedStudents.map(row => [row.name, row.school, row.grade, row.groups.map(g => g.name).join(", "), row.phone, row.parent_phone]),
    ] });
  }});
  function check(rows:Student[],add:boolean) {
    const next=new Map(checked);
    for(const row of rows) { if(add) next.set(row.id,row); else next.delete(row.id); }
    if(next.size>200){setNotice("한 번에 200명까지 선택할 수 있습니다.");return;}
    setNotice("");setChecked(next);
  }
  const currentRows=people.data?.results ?? [];
  const eligible=selectedStudents.filter(student=>!student.groups.some(g=>String(g.id)===target)).length;
  const hasFilters = Boolean(search || grade || kind || group);
  const pages = Math.max(1, Math.ceil((people.data?.count ?? 0) / pageSize));
  const busy = people.isFetching || search.trim() !== savedSearch.trim();
  const countLabel = busy ? "조회 중…" : people.isError ? "조회 실패" : `학생 ${people.data?.count ?? 0}명`;

  return <DomainLayout title="학생" breadcrumbs={[]} density="compact" tabs={teacher ? undefined : studentDirectoryTabs}>
    <div className={styles.studentFilters} role="group" aria-label="학생 조회 조건">
      <input id="dawon-directory-search" type="search" className="ds-input" aria-label="학생 검색" placeholder="이름 · 학교 · 전화번호 검색"
        value={search} onChange={event => setDraft({ entry, text: event.target.value })}
        onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)} />
      <div className={styles.filterOptions}>
        <select className="ds-select" aria-label="반 유형" value={kind} onChange={event => update("kind", event.target.value)}>
          <option value="">전체 반 유형</option><option value="union">연합반</option><option value="school">내신반</option>
        </select>
        {kind === "union" && <select className="ds-select" aria-label="연합반 과정" value={track} onChange={event => update("track", event.target.value)}>
          <option value="">전체 과정</option>{dawonUnionTracks.map(item => <option key={item}>{item}</option>)}
        </select>}
        {(kind || group) && <select className="ds-select" aria-label="소속 반" value={group} onChange={event => update("group", event.target.value)}>
          <option value="">전체 반</option>{groupOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>}
        <select className="ds-select" aria-label="학년" value={grade} onChange={event => update("grade", event.target.value)}>
          <option value="">전체 학년</option>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}학년</option>)}
        </select>
      </div>
      <div className={styles.directoryStatus}>
        <span role="status">{countLabel}</span>{!teacher && <DawonRosterMessages students={selectedStudents}/>}
        {!teacher && <DawonRosterUtilities onChanged={()=>void client.invalidateQueries({queryKey:dawonQueryKeys.adminStudents})}/>}
        {hasFilters && <Button size="sm" intent="ghost" onClick={() => {
          setDraft({ entry, text: "" });
          setParams({}, { state: { directoryTerm: "" } });
        }}>조건 초기화</Button>}
      </div>
    </div>
    {!teacher && checked.size>0 && <div className={styles.directoryStatus} role="group" aria-label="선택한 학생 작업">
      <strong>{checked.size}명 선택</strong>
      <Button size="sm" intent="primary" onClick={()=>{assign.reset();setTarget(group);setAssigning(true);}}>반 배정</Button>
      <Button size="sm" loading={exportFile.isPending} onClick={()=>exportFile.mutate()}>엑셀 다운로드</Button>
      <Button size="sm" intent="ghost" onClick={()=>setChecked(new Map())}>선택 해제</Button>
    </div>}
    {exportFile.isError && <p role="alert">엑셀을 내려받지 못했습니다. 다시 시도해 주세요.</p>}
    {notice && <p role="status">{notice}</p>}
    {assigning && <AdminModal open onClose={()=>setAssigning(false)} closeDisabled={assign.isPending} trapFocus noMinimize width={MODAL_WIDTH.md}>
      <ModalHeader title="선택한 학생 반 배정" description={checked.size+"명 선택"}/>
      <ModalBody><label>배정할 반 <select className="ds-select" value={target} disabled={assign.isPending} onChange={e=>setTarget(e.target.value)}>
        <option value="">반 선택</option>{groups.data?.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
      </select></label>
      <p>{selectedStudents.map(row=>row.name).join(", ")}</p>
      {target && <p>신규 배정 {eligible}명 · 이미 소속 {checked.size-eligible}명</p>}
      {assign.isError && <p role="alert">{getApiErrorMessage(assign.error,"배정하지 못했습니다. 다시 시도해 주세요.")}</p>}
      <Button intent="primary" disabled={!target || !eligible} loading={assign.isPending} onClick={()=>assign.mutate()}>배정 저장</Button>
      </ModalBody></AdminModal>}
    {groups.isError && <p role="alert">반 목록을 불러오지 못했습니다. <Button onClick={() => void groups.refetch()}>반 목록 다시 시도</Button></p>}
    <div className={styles.split}>
      <section ref={list} className={styles.directoryList} aria-label="학생 조회 결과" aria-busy={busy}>
        {people.isError ? <p role="alert">학생 명단을 불러오지 못했습니다. <Button onClick={() => void people.refetch()}>다시 시도</Button></p> :
          <DomainTable scrollLabel="학생 명단" tableClassName="ds-table--flat">
            <thead><tr><th scope="col">{!teacher && <input type="checkbox" aria-label="현재 페이지 학생 전체 선택" checked={!!currentRows.length && currentRows.every(row=>checked.has(row.id))}
              onChange={e=>check(currentRows,e.target.checked)} />} 학생 이름</th><th scope="col">학교</th><th scope="col">학년</th><th scope="col">소속 반</th><th scope="col">학부모 전화</th><th scope="col">학생 전화</th></tr></thead>
            <tbody>{people.data?.results.map(student => <tr key={student.id}>
              <th scope="row">{!teacher && <input type="checkbox" aria-label={student.name+" 선택"} checked={checked.has(student.id)}
                onChange={e=>check([student],e.target.checked)} />} <Link aria-label={student.name} aria-haspopup="dialog" data-student-id={student.id} to={detailUrl(student.id)} state={{ directoryTerm: search, studentListEntry: true }} preventScrollReset
                aria-current={String(student.id) === selected ? "true" : undefined}>
                <StudentNameWithLectureChip name={student.name} avatarSize={22} density="compact" />
              </Link></th>
              <td>{student.school || "미입력"}</td><td>{student.grade ? student.grade + "학년" : "미입력"}</td>
              <td>{student.groups.map(item => item.name).join(", ") || "미편성"}</td>
              <td>{formatPhone(student.parent_phone)}</td><td>{formatStudentPhoneDisplay(student.phone)}</td>
            </tr>)}
              {people.isPending && <tr><td colSpan={6}>학생 명단을 불러오는 중…</td></tr>}
              {people.data && !people.data.results.length && <tr><td colSpan={6}>{page > 1 ? "이 페이지에 학생이 없습니다." : hasFilters ? "조건에 맞는 학생이 없습니다." : teacher ? "담당 반에 배정된 학생이 없습니다." : "등록된 학생이 없습니다."}</td></tr>}
            </tbody>
          </DomainTable>}
        {people.data && (pages > 1 || page > 1) && <nav aria-label="학생 목록 페이지" className={styles.paging}>
          <Button size="sm" disabled={page <= 1} onClick={() => update("page", String(Math.min(pages, page - 1)))}>이전</Button>
          <span>{page} / {pages}</span><Button size="sm" disabled={page >= pages} onClick={() => update("page", String(page + 1))}>다음</Button>
        </nav>}
      </section>
    </div>
    {selected && <StudentProfileOverlay id={selected} role={role} onClose={closeStudent} directorySearch={params.toString()} search={search}/>}
  </DomainLayout>;
}

export function StudentProfileOverlay({id:selected, role, onClose, directorySearch, search=""}: {
  id:string; role:"teacher"|"admin"; onClose:()=>void; directorySearch:string; search?:string;
}) {
  const person = useQuery({
    queryKey: dawonQueryKeys.studentDetail(role, selected),
    enabled: !!selected,
    queryFn: async ({ signal }) => (await api.get<Page>(endpoint, {
      params: { view: "students", id: selected }, signal,
    })).data.results[0] ?? null,
  });
  const row = person.data;
  return <AdminModal open type="inspect" width={MODAL_WIDTH.wide} noMinimize trapFocus onClose={onClose}>
      <ModalHeader type="inspect" title={row?.name || "학생 상세"} description={row ? [row.school, row.grade && row.grade + "학년"].filter(Boolean).join(" · ") : undefined}/>
      <ModalBody>{person.isPending ? <p role="status">학생 상세 조회 중…</p> :
        person.isError ? <p role="alert">상세 조회에 실패했습니다. <Button onClick={() => void person.refetch()}>다시 시도</Button></p> :
        row ? <StudentProfile key={row.id} row={row} role={role} directorySearch={directorySearch} search={search}/> :
        <p>조회할 수 없는 학생입니다.</p>}
      </ModalBody>
    </AdminModal>;
}

function StudentProfile({row, role, directorySearch, search}: {row:Student; role:"teacher"|"admin"; directorySearch:string; search:string}) {
  const courses = row.courses ?? [];
  const [selectedCourse, selectCourse] = useState(courses[0]?.id);
  const course = courses.find(item => item.id === selectedCourse) ?? courses[0];
  return <div className={styles.studentProfile}>
    <dl className={styles.fields}>
      <dt>소속 반</dt><dd>{row.groups.length ? row.groups.map(item => <Link key={item.id} to={"/workspace/students/class-groups?class=" + item.id}>{item.name}</Link>) : "미편성"}</dd>
      <dt>학부모 전화</dt><dd>{formatPhone(row.parent_phone)}</dd>
      <dt>학생 전화</dt><dd>{formatStudentPhoneDisplay(row.phone)}</dd>
    </dl>
    {course ? <section aria-label="강의별 학습 기록">
      <div className={styles.performanceHeading}><h3>강의별 성적</h3>
        {courses.length > 1 ? <select aria-label="성적 조회 강의" className="ds-select" value={course.id}
          onChange={e=>selectCourse(Number(e.target.value))}>{courses.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select> :
          <strong>{course.title}</strong>}
      </div>
      <DirectoryPerformance student={row.id} course={course.id} role={role}/>
      <nav className={styles.profileLinks} aria-label="관련 기록">
        <Link to={"/workspace/lectures/" + course.id + "?group=" + course.group}>강의 열기</Link>
        {role === "admin" && <Link state={{directorySearch, directoryTerm:search}} to={"/workspace/results?" + new URLSearchParams({
          panel:"student", origin:"directory", course:String(course.id), group:String(course.group), student:String(row.id),
        })}>과제·상담·클리닉 기록</Link>}
      </nav>
    </section> : <p>반에 연결된 수강 강의가 없습니다.</p>}
  </div>;
}
