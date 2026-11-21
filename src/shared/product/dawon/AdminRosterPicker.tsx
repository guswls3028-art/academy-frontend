import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { Button } from "@/shared/ui/ds";
import "@/app_admin/domains/lectures/components/LectureEnrollStudentModal.css";
import { dawonQueryKeys } from "./queryKeys";
import type { RosterStudent } from "./ClassRosterModal";

import { digits, filterRoster } from "./adminRosterSelection";
import { useSchoolLevelMode } from "@/shared/hooks/useSchoolLevelMode";

const size = 50;
export function AdminRosterPicker({ candidateUrl, roster, selected, busy, onChange }: {
  candidateUrl?: string;
  roster?: RosterStudent[];
  selected: Map<number, RosterStudent>;
  busy: boolean;
  onChange: (rows: RosterStudent[], remove: boolean) => void;
}) {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("");
  const [offset, setOffset] = useState(0);
  const levels = useSchoolLevelMode();
  const grades = [...new Set(levels.schoolTypes.flatMap(type => levels.gradeRange(type)))].sort((a,b) => a-b);
  const field = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(input.trim()); setOffset(0); }, 180);
    return () => clearTimeout(timer);
  }, [input]);
  useEffect(() => { if (list.current) list.current.scrollTop = 0; }, [search, grade, offset]);

  const query = useQuery({
    queryKey: [...dawonQueryKeys.candidates(candidateUrl, search, offset), "admin-page", grade],
    enabled: Boolean(candidateUrl),
    queryFn: async ({ signal }) => (await api.get<{results: RosterStudent[]; count: number}>(candidateUrl!, {
      params: { search, grade: grade || undefined, offset, limit: size, page_info: 1 }, signal,
    })).data,
  });
  const local = candidateUrl ? [] : filterRoster(roster ?? [], search, grade);
  const rows = candidateUrl ? query.data?.results ?? [] : local.slice(offset, offset + size);
  const count = candidateUrl ? query.data?.count ?? 0 : local.length;
  const pending = input.trim() !== search || Boolean(candidateUrl && query.isPending);
  const error = Boolean(candidateUrl && query.isError);
  const locked = busy || pending || error;
  const all = rows.length > 0 && rows.every(student => selected.has(student.id));
  const clear = () => { setInput(""); field.current?.focus(); };

  return <div className="lecture-enroll-picker__body">
    <div className="lecture-enroll-picker__search">
      <input className="ds-input" ref={field} autoFocus type="search" autoComplete="off" enterKeyHint="search"
        aria-label="학생 검색" placeholder="이름·학교·전화번호 또는 끝자리" value={input} disabled={busy}
        onChange={event => setInput(event.target.value)} />
      {input && <Button intent="ghost" disabled={busy} aria-label="검색어 지우기" onClick={clear}>지우기</Button>}
    </div>
    <div className="lecture-enroll-picker__filters">
      <select className="ds-select" aria-label="학년" value={grade} disabled={busy}
        onChange={event => { setGrade(event.target.value); setOffset(0); }}>
        <option value="">전체 학년</option>{grades.map(n => <option key={n} value={n}>{n}학년</option>)}
      </select>
    </div>
    <div className="lecture-enroll-picker__toolbar">
      <span role="status">{pending ? "학생 명단 검색 중…" : error ? "명단 확인 필요" : `학생 ${count}명`}</span>
      <Button size="sm" disabled={locked || !rows.length} onClick={() => onChange(rows, all)}>
        {all ? "현재 페이지 선택 해제" : "현재 페이지 전체 선택"}
      </Button>
    </div>
    <div ref={list} className="lecture-enroll-picker__list" role="region" aria-label="학생 명단" aria-busy={pending}>
      {error ? <p role="alert">학생을 불러오지 못했습니다. <Button onClick={() => void query.refetch()}>다시 시도</Button></p>
        : !pending && !rows.length ? <p>{search || grade ? "검색 결과가 없습니다. 검색어나 학년을 바꿔 주세요." : "선택할 수 있는 학생이 없습니다."}</p>
        : rows.map(student => <label key={student.id} className="lecture-enroll-picker__row" data-selected={selected.has(student.id)}>
          <input type="checkbox" checked={selected.has(student.id)} disabled={locked}
            onChange={() => onChange([student], selected.has(student.id))}/>
          <span className="lecture-enroll-picker__identity"><strong>{student.name}</strong>
            <span>{student.school || "학교 미등록"}{student.grade ? ` · ${student.grade}학년` : ""}</span></span>
          <span className="lecture-enroll-picker__contact">
            {student.phone && <span>학생 끝자리 {digits(student.phone).slice(-4)}</span>}
            {student.parent_phone && <span>보호자 끝자리 {digits(student.parent_phone).slice(-4)}</span>}
          </span>
        </label>)}
    </div>
    {(count > size || offset > 0) && <nav className="lecture-enroll-picker__pagination" aria-label="학생 명단 페이지">
      <Button size="sm" disabled={busy || !offset} onClick={() => setOffset(offset - size)}>이전</Button>
      <span>{1 + offset / size} / {Math.max(1, Math.ceil(count / size))}</span>
      <Button size="sm" disabled={locked || offset + size >= count} onClick={() => setOffset(offset + size)}>다음</Button>
    </nav>}
  </div>;
}
