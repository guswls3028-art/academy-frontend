import { dawonQueryKeys } from "./queryKeys";
import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { useSchoolLevelMode } from "@/shared/hooks/useSchoolLevelMode";
import { downloadStudentExcelTemplate, parseStudentExcel } from "@/shared/product/students/studentExcel";
import { Button } from "@/shared/ui/ds";
import ExcelUploadZone from "@/shared/ui/excel/ExcelUploadZone";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import styles from "./ClassGroupsPage.module.css";

export type RosterStudent = {
  id: number;
  name: string;
  school: string;
  parent_phone?: string;
  phone?: string;
  eligible?: boolean;
};

const PAGE_SIZE = 50;
const digits = (value: string | undefined) => (value ?? "").replace(/\D/g, "");
const normalized = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

export default function ClassRosterModal({
  title, description, candidateUrl, roster, submitLabel, onSave, onClose,
}: {
  title: string;
  description: string;
  candidateUrl?: string;
  roster?: RosterStudent[];
  submitLabel: string;
  onSave: (ids: number[]) => Promise<void>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"search" | "excel">("search");
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Map<number, RosterStudent>>(new Map());
  const [fileIssues, setFileIssues] = useState<string[]>([]);
  const levels = useSchoolLevelMode();
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(input.trim());
      setOffset(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [input]);

  const candidates = useQuery({
    queryKey: dawonQueryKeys.candidates(candidateUrl, search, offset),
    enabled: Boolean(candidateUrl),
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => (await api.get<RosterStudent[]>(candidateUrl!, { params: { search, offset }, signal })).data,
  });
  const name = normalized(search);
  const filteredRoster = roster?.filter((student) => normalized(student.name).includes(name) || normalized(student.school).includes(name));
  const rows = candidateUrl ? candidates.data : filteredRoster?.slice(offset, offset + PAGE_SIZE);
  const toggle = (student: RosterStudent) => setSelected((current) => {
    const next = new Map(current);
    if (!next.delete(student.id)) next.set(student.id, student);
    return next;
  });
  const save = useMutation({ mutationFn: () => onSave([...selected.keys()]) });
  const importExcel = useMutation({
    mutationFn: async (file: File) => {
      const parsed = await parseStudentExcel(file, false);
      if (parsed.rows.length > 200) throw new Error("엑셀 한 파일에 학생을 최대 200명까지 담아 주세요.");
      const students: RosterStudent[] = [];
      const issues = (parsed.issues ?? []).map(({ row, name: studentName, reason }) => `${row}행 ${studentName} · ${reason}`);
      for (let start = 0; start < parsed.rows.length; start += 8) {
        const batch = await Promise.all(parsed.rows.slice(start, start + 8).map(async (row) => {
          const { data } = await api.get<RosterStudent[]>(candidateUrl!, {
            params: { search: row.name, exact: true, parent_phone: row.parentPhone, phone: row.studentPhone },
          });
          const matches = data.filter((student) => normalized(student.name) === normalized(row.name)
            && (!digits(row.parentPhone) || digits(row.parentPhone) === digits(student.parent_phone))
            && (!digits(row.studentPhone) || digits(row.studentPhone) === digits(student.phone)));
          return { name: row.name, matches };
        }));
        for (const { name: studentName, matches } of batch) {
          if (matches.length === 1) students.push(matches[0]);
          else issues.push(`${studentName} · ${matches.length ? "동명이인입니다. 전화번호를 확인해 주세요." : "배정 가능한 학생 명단에 없습니다."}`);
        }
      }
      return { students, issues };
    },
    onMutate: () => setFileIssues([]),
    onSuccess: ({ students, issues }) => {
      setFileIssues(issues);
      setSelected((current) => new Map([...current, ...students.map((student) => [student.id, student] as const)]));
    },
  });
  const template = useMutation({ mutationFn: () => downloadStudentExcelTemplate(levels.mode) });
  const busy = save.isPending || importExcel.isPending;
  const error = save.error ?? importExcel.error ?? template.error;

  return (
    <AdminModal open onClose={onClose} width={MODAL_WIDTH.wide} noMinimize trapFocus closeDisabled={busy}>
      <ModalHeader title={title} description={description} />
      <ModalBody>
        <div className={styles.rosterEditor}>
          {candidateUrl && <div className={styles.rosterTabs} aria-label="학생 선택 방식">
            <Button aria-pressed={tab === "search"} intent={tab === "search" ? "primary" : "secondary"} onClick={() => setTab("search")}>직접 검색</Button>
            <Button aria-pressed={tab === "excel"} intent={tab === "excel" ? "primary" : "secondary"} onClick={() => setTab("excel")}>엑셀로 선택</Button>
          </div>}
          {tab === "search" ? <div className={styles.rosterSearch}>
            <input type="search" value={input} onChange={(event) => setInput(event.target.value)} aria-label="학생 검색" placeholder="이름 또는 학교로 검색" />
            {candidateUrl && candidates.isPending && <p role="status">학생 명단을 불러오는 중입니다.</p>}
            {candidateUrl && candidates.isError && <p role="alert">학생을 불러오지 못했습니다. <Button onClick={() => void candidates.refetch()}>다시 시도</Button></p>}
            {rows?.length === 0 && <p>선택할 수 있는 학생이 없습니다.</p>}
            <div className={styles.rosterColumns} aria-hidden="true"><span>학생 이름</span><span>학교 · 연락처 끝자리</span></div>
            <ul className={styles.rosterRows}>
              {rows?.map((student) => <li key={student.id} data-selected={selected.has(student.id)}>
                <label className={styles.pick}>
                  <input type="checkbox" checked={selected.has(student.id)} disabled={busy || candidates.isPlaceholderData || input.trim() !== search} onChange={() => toggle(student)} />
                  <strong>{student.name}</strong>
                </label>
                <span>{[student.school, digits(student.parent_phone || student.phone).slice(-4)].filter(Boolean).join(" · ")}</span>
              </li>)}
            </ul>
            {(offset > 0 || (rows?.length ?? 0) >= PAGE_SIZE) && <div className={styles.rosterTabs}>
              <Button disabled={!offset || busy || candidates.isFetching} onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}>이전</Button>
              <Button disabled={(rows?.length ?? 0) < PAGE_SIZE || busy || candidates.isFetching} onClick={() => setOffset((value) => value + PAGE_SIZE)}>다음</Button>
            </div>}
          </div> : <>
            <p>엑셀의 이름·전화번호를 기존 학생과 대조해 선택합니다. 명단을 검토하고 저장하세요.</p>
            <div className={styles.rosterTabs}><Button loading={template.isPending} onClick={() => template.mutate()}>엑셀 양식 다운로드</Button></div>
            <ExcelUploadZone onFileSelect={(file) => void importExcel.mutate(file)} disabled={busy} />
            {fileIssues.length > 0 && <div role="status" className={styles.error}>
              <strong>{fileIssues.length}개 행 확인 필요</strong>
              <ul>{fileIssues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>
            </div>}
          </>}
          <section className={styles.chosen} aria-label="선택 명단">
            <strong>선택한 학생 {selected.size}명</strong>
            {!selected.size && <p>학생을 선택하면 여기에 표시됩니다.</p>}
            <ul>{[...selected.values()].map((student) => <li key={student.id}>
              {student.name} <Button disabled={busy} aria-label={`${student.name} 선택 취소`} onClick={() => toggle(student)}>빼기</Button>
            </li>)}</ul>
          </section>
          {error && <p role="alert" className={styles.error}>{getApiErrorMessage(error, error instanceof Error ? error.message : "선택을 저장하지 못했습니다. 다시 시도해 주세요.")}</p>}
        </div>
      </ModalBody>
      <ModalFooter right={<>
        <Button onClick={onClose} disabled={busy}>취소</Button>
        <Button intent="primary" onClick={() => save.mutate()} disabled={!selected.size || selected.size > 200 || busy} loading={save.isPending}>{submitLabel} ({selected.size}명)</Button>
      </>} />
    </AdminModal>
  );
}
