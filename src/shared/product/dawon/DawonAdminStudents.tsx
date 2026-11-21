import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import api from "@/shared/api/axios";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import LectureChipLabel from "@/shared/ui/chips/LectureChipLabel";
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

export default function DawonAdminStudents() {
  const role = dawonStaffPreviewRole();
  return role ? <StudentDirectory key={role} role={role} /> : null;
}

function StudentDirectory({ role }: { role: "admin" | "teacher" }) {
  const [params, setParams] = useSearchParams();
  const { key, state } = useLocation();
  const teacher = role === "teacher";
  const savedSearch = typeof state?.directoryTerm === "string" ? state.directoryTerm : "";
  // Replacing this history entry after a debounce must not interrupt a newer keystroke.
  const entry = state?.directorySearchEntry ?? key;
  const [draft, setDraft] = useState<{ entry: string; text: string } | null>(null);
  const [composing, setComposing] = useState(false);
  const search = draft?.entry === entry ? draft.text : savedSearch;
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
  const person = useQuery({
    queryKey: dawonQueryKeys.studentDetail(role, selected),
    enabled: !!selected,
    queryFn: async ({ signal }) => (await api.get<Page>(endpoint, {
      params: { view: "students", id: selected }, signal,
    })).data.results[0] ?? null,
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

  const hasFilters = Boolean(search || grade || kind || group);
  const row = person.data;
  const pages = Math.max(1, Math.ceil((people.data?.count ?? 0) / pageSize));
  const busy = people.isFetching || search.trim() !== savedSearch.trim();
  const countLabel = busy ? "조회 중…" : people.isError ? "조회 실패" : `학생 ${people.data?.count ?? 0}명`;

  return <DomainLayout title="학생 명단" breadcrumbs={[]} density="compact">
    <div className={styles.studentFilters} role="group" aria-label="학생 조회 조건" data-detail-open={selected ? "true" : undefined}>
      <input type="search" className="ds-input" aria-label="학생 검색" placeholder="이름 · 학교 · 전화번호 검색"
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
        <span role="status">{countLabel}</span>
        {hasFilters && <Button size="sm" intent="ghost" onClick={() => {
          setDraft({ entry, text: "" });
          setParams({}, { state: { directoryTerm: "" } });
        }}>조건 초기화</Button>}
      </div>
    </div>
    {groups.isError && <p role="alert">반 목록을 불러오지 못했습니다. <Button onClick={() => void groups.refetch()}>반 목록 다시 시도</Button></p>}
    <div className={styles.split} data-open={selected ? "true" : undefined}>
      <section className={styles.list} aria-label="학생 조회 결과" aria-busy={busy}>
        {people.isError ? <p role="alert">학생 명단을 불러오지 못했습니다. <Button onClick={() => void people.refetch()}>다시 시도</Button></p> :
          <DomainTable scrollLabel="학생 명단" tableClassName="ds-table--flat">
            <thead><tr><th scope="col">학생 이름</th><th scope="col">학교</th><th scope="col">학년</th><th scope="col">소속 반</th></tr></thead>
            <tbody>{people.data?.results.map(student => <tr key={student.id}>
              <th scope="row"><Link aria-label={student.name} to={detailUrl(student.id)} state={{ directoryTerm: search }} preventScrollReset
                aria-current={String(student.id) === selected ? "true" : undefined}>
                <StudentNameWithLectureChip name={student.name} avatarSize={22} density="compact" />
              </Link></th>
              <td>{student.school || "미입력"}</td><td>{student.grade ? student.grade + "학년" : "미입력"}</td>
              <td>{student.groups.map(item => item.name).join(", ") || "미편성"}</td>
            </tr>)}
              {people.isPending && <tr><td colSpan={4}>학생 명단을 불러오는 중…</td></tr>}
              {people.data && !people.data.results.length && <tr><td colSpan={4}>{page > 1 ? "이 페이지에 학생이 없습니다." : hasFilters ? "조건에 맞는 학생이 없습니다." : teacher ? "담당 반에 배정된 학생이 없습니다." : "등록된 학생이 없습니다."}</td></tr>}
            </tbody>
          </DomainTable>}
        {people.data && (pages > 1 || page > 1) && <nav aria-label="학생 목록 페이지" className={styles.paging}>
          <Button size="sm" disabled={page <= 1} onClick={() => update("page", String(Math.min(pages, page - 1)))}>이전</Button>
          <span>{page} / {pages}</span><Button size="sm" disabled={page >= pages} onClick={() => update("page", String(page + 1))}>다음</Button>
        </nav>}
      </section>
      {selected && <section className={styles.inspector} aria-label="학생 상세">
        {state?.courseReturn ? <Link to={state.courseReturn}>강의 수강 명단으로</Link> :
          <Link to={detailUrl()} state={{ directoryTerm: search }} preventScrollReset>학생 목록</Link>}
        {person.isPending ? <p role="status">학생 상세 조회 중…</p> : person.isError ? <p role="alert">상세 조회에 실패했습니다. <Button onClick={() => void person.refetch()}>다시 시도</Button></p> :
          row ? <><h2>{row.name}</h2><dl className={styles.fields}>
            <dt>학교 · 학년</dt><dd>{row.school || "학교 미입력"} · {row.grade ? row.grade + "학년" : "학년 미입력"}</dd>
            <dt>학생 연락처</dt><dd>{row.phone || "미입력"}</dd><dt>학부모 연락처</dt><dd>{row.parent_phone || "미입력"}</dd>
            <dt>소속 반</dt><dd>{row.groups.length ? row.groups.map(item => <Link key={item.id} to={"/workspace/students/class-groups?class=" + item.id}>{item.name}</Link>) : "미편성"}</dd>
          </dl>
            <h3>수강 중인 강의</h3>{row.courses?.length ? <DomainTable scrollLabel="학생 수강 강의" tableClassName="ds-table--flat">
              <thead><tr><th>강의</th>{!teacher && <th>학습 기록</th>}</tr></thead>
              <tbody>{row.courses.map(course => <tr key={course.id}>
                <td><Link to={"/workspace/lectures/" + course.id + "?group=" + course.group} aria-label={course.title}>
                  <LectureChipLabel lectureName={course.title} color={course.color} chipLabel={course.chip_label} /></Link></td>
                {!teacher && <td><Link state={{ directorySearch: params.toString(), directoryTerm: search }} to={"/workspace/results?" + new URLSearchParams({
                  panel: "student", origin: "directory", course: String(course.id), group: String(course.group), student: String(row.id),
                })}>기록 보기</Link></td>}
              </tr>)}</tbody>
            </DomainTable> : <p>반에 연결된 수강 강의가 없습니다.</p>}</> : <p>조회할 수 없는 학생입니다.</p>}
      </section>}
    </div>
  </DomainLayout>;
}
