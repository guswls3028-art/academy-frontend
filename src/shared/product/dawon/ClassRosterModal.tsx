import { dawonQueryKeys } from "./queryKeys";
import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { useSchoolLevelMode } from "@/shared/hooks/useSchoolLevelMode";
import { downloadStudentExcelTemplate, parseStudentExcel } from "@/shared/product/students/studentExcel";
import { DomainTable } from "@/shared/ui/domain";
import { Button } from "@/shared/ui/ds";
import ExcelUploadZone from "@/shared/ui/excel/ExcelUploadZone";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { dawonStaffPreviewRole } from "./staffPreview";
import { updateRosterSelection } from "./adminRosterSelection";
import { AdminRosterPicker } from "./AdminRosterPicker";
import styles from "./ClassGroupsPage.module.css";

export type RosterStudent = {
  selection_status?: "eligible" | "in_group" | "enrolled" | "previously_enrolled" | "needs_group";
  id: number;
  name: string;
  school: string;
  grade?: number | null;
  parent_phone?: string;
  phone?: string;
  eligible?: boolean;
  course_ids?: number[];
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
  const admin = dawonStaffPreviewRole() === "admin";
  const [discard, setDiscard] = useState(false);
  const [notice, setNotice] = useState("");
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
    enabled: !admin && Boolean(candidateUrl),
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
  const changeAdminSelection = (students: RosterStudent[], remove: boolean) => {
    const next = updateRosterSelection(selected, students, remove);
    if (!next) {
      setNotice("한 번에 최대 200명까지 선택할 수 있습니다. 선택 인원을 줄여 주세요.");
      return;
    }
    setNotice("");
    setSelected(next);
  };
  const close = () => {
    if (admin && selected.size) setDiscard(true);
    else onClose();
  };
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
      if (admin) return changeAdminSelection(students, false);
      setSelected((current) => new Map([...current, ...students.map((student) => [student.id, student] as const)]));
    },
  });
  const template = useMutation({ mutationFn: () => downloadStudentExcelTemplate(levels.mode) });
  const busy = save.isPending || importExcel.isPending || discard;
  const error = save.error ?? importExcel.error ?? template.error;

  return (
    <AdminModal open onClose={close} width={MODAL_WIDTH.wide} noMinimize trapFocus closeDisabled={busy}>
      <ModalHeader title={title} description={description} />
      <ModalBody>
        <div className={admin ? styles.adminRosterEditor : styles.rosterEditor}>
          {candidateUrl && <div className={styles.rosterTabs} aria-label="학생 선택 방식">
            <Button disabled={admin && busy} aria-pressed={tab === "search"} intent={tab === "search" ? "primary" : "secondary"} onClick={() => setTab("search")}>직접 검색</Button>
            <Button disabled={admin && busy} aria-pressed={tab === "excel"} intent={tab === "excel" ? "primary" : "secondary"} onClick={() => setTab("excel")}>엑셀로 선택</Button>
          </div>}
          {tab === "search" && admin ? <AdminRosterPicker candidateUrl={candidateUrl} roster={roster} selected={selected} busy={busy} onChange={changeAdminSelection} /> : tab === "search" ? <div className={styles.rosterSearch}>
            <input type="search" value={input} onChange={(event) => setInput(event.target.value)} aria-label="학생 검색" placeholder="이름 또는 학교로 검색" />
            {candidateUrl && candidates.isPending && <p role="status">학생 명단을 불러오는 중입니다.</p>}
            {candidateUrl && candidates.isError && <p role="alert">학생을 불러오지 못했습니다. <Button onClick={() => void candidates.refetch()}>다시 시도</Button></p>}
            {rows?.length === 0 && <p>선택할 수 있는 학생이 없습니다.</p>}
            <div className={styles.pickerViewport}>
              <DomainTable scrollLabel="배정할 학생 목록" tableClassName="ds-table--flat">
                <thead><tr><th scope="col">학생 이름</th><th scope="col">학교</th><th scope="col">연락처 끝자리</th></tr></thead>
                <tbody>{rows?.map((student) => <tr key={student.id} aria-selected={selected.has(student.id)}>
                  <td><label className={styles.pick}>
                    <input type="checkbox" checked={selected.has(student.id)} disabled={busy || candidates.isPlaceholderData || input.trim() !== search} onChange={() => toggle(student)} />
                    <strong>{student.name}</strong>
                  </label></td><td>{student.school || "—"}</td><td>{digits(student.parent_phone || student.phone).slice(-4) || "—"}</td>
                </tr>)}</tbody>
              </DomainTable>
            </div>
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
          {admin ? <section className="lecture-enroll-picker__selection" aria-label="선택 명단">
            <div className="lecture-enroll-picker__toolbar"><strong role="status">선택한 학생 {selected.size}명 / 최대 200명</strong>
              <Button size="sm" intent="ghost" disabled={busy || !selected.size} onClick={() => changeAdminSelection([...selected.values()], true)}>전체 해제</Button></div>
            {selected.size ? <div className="lecture-enroll-picker__chips">{[...selected.values()].map(student =>
              <button key={student.id} type="button" disabled={busy} aria-label={`${student.name} 선택 취소`}
                onClick={() => changeAdminSelection([student], true)}>{student.name} ×</button>)}</div>
              : <p>선택한 학생이 여기에 표시됩니다.</p>}
            {notice && <p role="status">{notice}</p>}
          </section> : <section className={styles.chosen} aria-label="선택 명단">
            <strong>선택한 학생 {selected.size}명</strong>
            {!selected.size && <p>학생을 선택하면 여기에 표시됩니다.</p>}
            <ul>{[...selected.values()].map((student) => <li key={student.id}>
              {student.name} <Button disabled={busy} aria-label={`${student.name} 선택 취소`} onClick={() => toggle(student)}>빼기</Button>
            </li>)}</ul>
          </section>}
          {discard && <p role="alert">선택한 {selected.size}명을 저장하지 않고 나갈까요?</p>}
          {error && <p role="alert" className={styles.error}>{getApiErrorMessage(error, error instanceof Error ? error.message : "선택을 저장하지 못했습니다. 다시 시도해 주세요.")}</p>}
        </div>
      </ModalBody>
      <ModalFooter right={discard ? <>
        <Button onClick={() => setDiscard(false)}>계속 선택</Button>
        <Button onClick={onClose}>선택 취소하고 나가기</Button>
      </> : <>
        <Button onClick={close} disabled={busy}>취소</Button>
        <Button intent="primary" onClick={() => save.mutate()} disabled={!selected.size || selected.size > 200 || busy} loading={save.isPending}>{submitLabel} ({selected.size}명)</Button>
      </>} />
    </AdminModal>
  );
}
