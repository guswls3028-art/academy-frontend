import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { parseStudentExcel } from "@/shared/product/students/studentExcel";
import { Button, EmptyState } from "@/shared/ui/ds";
import { DomainTable } from "@/shared/ui/domain";
import { AdminModal, ModalBody, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";

const endpoint = "/students/demo-roster/";
const cacheKey = ["dawon", "demo-roster"] as const;
const schoolTypes = { ELEMENTARY: "초등학교", MIDDLE: "중학교", HIGH: "고등학교" };
type SchoolType = keyof typeof schoolTypes;
type Profile = {
  name: string; gender: "M" | "F" | null; school_type: SchoolType; school: string; grade: number | null;
  high_school_class: string; major: string; memo: string; tag_ids: number[];
};
type Student = Profile & { id: number; deleted: boolean };
type Tag = { id: number; name: string };
const emptyProfile: Profile = {
  name: "", gender: null, school_type: "HIGH", school: "", grade: null, high_school_class: "",
  major: "", memo: "", tag_ids: [],
};
const columns = ["이름", "학교유형", "학교", "학년", "반", "성별", "계열", "메모"];
type View = "list" | "profile" | "upload" | "credential";
type Change = { kind: "create"; students: Profile[] } | { kind: "edit"; id: number; profile: Profile }
  | { kind: "delete" | "restore"; id: number };

function rosterError(error: unknown, fallback: string) {
  return getApiErrorMessage(error, fallback);
}

export default function DawonRosterUtilities({ onChanged }: { onChanged?: () => void } = {}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("list");
  const [deleted, setDeleted] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Profile[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Student | null>(null);
  const [notice, setNotice] = useState("");
  const [secret, setSecret] = useState("");
  const [savingCredential, setSavingCredential] = useState(false);
  const [credentialError, setCredentialError] = useState("");
  async function credential(action: "set" | "check") {
    if (!student || savingCredential) return;
    setSavingCredential(true);
    setCredentialError("");
    setNotice("");
    try {
      const {data} = await api.post<{matches?: boolean}>(endpoint + student.id + "/credential/", { action, password: secret });
      setNotice(action === "set" ? "체험 비밀번호를 변경했습니다." : data.matches ? "입력한 비밀번호가 일치합니다." : "비밀번호가 일치하지 않습니다.");
      setSecret("");
    } catch (error) {
      setCredentialError(getApiErrorMessage(error, "비밀번호를 처리하지 못했습니다. 다시 시도하세요."));
    } finally {
      setSavingCredential(false);
    }
  }
  const fileVersion = useRef(0);
  const batch = useRef<{ key: string; id: string } | null>(null);
  const roster = useQuery({
    queryKey: [...cacheKey, deleted],
    enabled: open,
    queryFn: async ({ signal }) =>
      (await api.get<{ rows: Student[]; tags: Tag[] }>(endpoint, { params: { deleted }, signal })).data,
  });
  const change = useMutation({
    mutationFn: async (action: Change) => {
      if (action.kind === "create") {
        const key = JSON.stringify(action.students);
        const attempt = batch.current?.key === key ? batch.current : { key, id: crypto.randomUUID() };
        batch.current = attempt;
        await api.post(endpoint, { request_id: attempt.id, students: action.students });
      } else if (action.kind === "edit") {
        await api.patch(endpoint + action.id + "/", action.profile);
      } else if (action.kind === "delete") {
        await api.delete(endpoint + action.id + "/");
      } else {
        await api.post(endpoint + action.id + "/");
      }
    },
    onSuccess: async (_, action) => {
      batch.current = null;
      setNotice(action.kind === "delete" ? "학생을 삭제했습니다." : action.kind === "restore" ? "학생을 복원했습니다." : "학생 정보를 저장했습니다.");
      setConfirmDelete(null);
      setView("list");
      setDeleted(action.kind === "delete");
      await client.invalidateQueries({ queryKey: cacheKey });
      onChanged?.();
    },
  });
  const template = useMutation({
    mutationFn: async () => {
      const { downloadArrayWorksheet } = await import("@/shared/utils/excelWorkbook");
      await downloadArrayWorksheet({
        filename: "다원_데모_학생_등록.xlsx", sheetName: "데모 학생",
        rows: [columns],
      });
    },
  });

  function go(next: View, row: Student | null = null) {
    change.reset();
    setNotice("");
    setStudent(row);
    setSecret("");
    setCredentialError("");
    setProfile(row ? {
      name: row.name, gender: row.gender, school_type: row.school_type, school: row.school,
      grade: row.grade, high_school_class: row.high_school_class, major: row.major, memo: row.memo, tag_ids: row.tag_ids,
    } : emptyProfile);
    ++fileVersion.current;
    setReading(false);
    setFileName("");
    setPreview([]);
    setWarnings([]);
    setConfirmDelete(null);
    setView(next);
  }
  async function read(file: File | undefined) {
    const version = ++fileVersion.current;
    setPreview([]);
    setWarnings([]);
    setFileName(file?.name ?? "");
    if (!file || file.size > 5 * 1024 * 1024) {
      setReading(false);
      if (file) setWarnings(["5MB 이하의 엑셀을 선택하세요."]);
      return;
    }
    setReading(true);
    try {
      const parsed = await parseStudentExcel(file, true, { requireContacts: false });
      if (fileVersion.current !== version) return;
      const issues = (parsed.issues ?? []).map((item) => item.row + "행 · " + item.reason);
      if (issues.length) setWarnings(issues);
      else if (!parsed.rows.length || parsed.rows.length > 100) setWarnings(["한 번에 1~100명까지 등록할 수 있습니다."]);
      else setPreview(parsed.rows.map((row) => ({
        ...emptyProfile, name: row.name, gender: row.gender === "M" || row.gender === "F" ? row.gender : null,
        school_type: row.schoolType, school: row.school, grade: row.grade ? Number(row.grade) : null,
        high_school_class: row.schoolClass, major: row.major, memo: row.memo,
      })));
    } catch (error) {
      if (fileVersion.current === version) setWarnings([error instanceof Error ? error.message : "엑셀을 읽지 못했습니다."]);
    } finally {
      if (fileVersion.current === version) setReading(false);
    }
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (change.isPending || !profile.name.trim()) return;
    change.mutate(student ? { kind: "edit", id: student.id, profile } : { kind: "create", students: [profile] });
  }

  return <>
    <Button intent="primary" onClick={() => { go("profile"); setDeleted(false); setOpen(true); }}>학생 등록</Button>
    {open && <AdminModal open noMinimize trapFocus width={MODAL_WIDTH.wide} onClose={() => {
      if (!change.isPending && !savingCredential) { ++fileVersion.current; setSecret(""); setOpen(false); }
    }} closeDisabled={change.isPending || savingCredential}>
      <ModalHeader title={view === "credential" ? "체험 비밀번호" : view === "upload" ? "엑셀로 학생 등록" : view === "profile" ? student ? "학생 수정" : "학생 등록" : "데모 학생 관리"}/>
      <ModalBody>
        <p>예시 학생만 등록하세요. 데모에서 등록한 학생은 연락처와 로그인 계정을 사용하지 않습니다.</p>
        {view !== "list" && <div className="flex flex-wrap gap-2 py-2">
          <Button onClick={() => go("list")} disabled={change.isPending || savingCredential}>등록 명단으로</Button>
          {view === "profile" && !student && <Button onClick={() => go("upload")} disabled={change.isPending}>엑셀 일괄 등록</Button>}
        </div>}
        {notice && <p role="status">{notice}</p>}
        {change.isError && <p role="alert">{rosterError(change.error, "학생 정보를 처리하지 못했습니다.")}</p>}
        {view === "credential" && student && <form className="grid gap-3 py-3" onSubmit={event => {event.preventDefault(); void credential("set");}}>
          <p>{student.name} 학생의 데모용 비밀번호를 설정하거나 확인하세요.</p>
          <label>체험 비밀번호<input type="password" className="ds-input" autoComplete="new-password" required minLength={8} maxLength={128} value={secret} onChange={e => setSecret(e.target.value)}/></label>
          {credentialError && <p role="alert">{credentialError}</p>}
          <div className="flex gap-2"><Button type="submit" intent="primary" disabled={secret.length < 8 || savingCredential}>비밀번호 변경</Button>
          <Button type="button" disabled={!secret || savingCredential} onClick={() => void credential("check")}>일치 확인</Button></div>
        </form>}
        {view === "list" && <>
          <div className="flex flex-wrap gap-2 py-3">
            <Button onClick={() => go("profile")}>학생 등록</Button>
            <Button onClick={() => go("upload")}>엑셀 일괄 등록</Button>
            <Button aria-pressed={deleted} onClick={() => { setDeleted(!deleted); setNotice(""); setConfirmDelete(null); }}>
              {deleted ? "등록 학생 보기" : "삭제 학생 보기"}
            </Button>
          </div>
          {roster.isPending ? <p role="status">학생 목록을 불러오는 중입니다.</p> : roster.isError ?
            <p role="alert">{rosterError(roster.error, "학생 목록을 불러오지 못했습니다.")} <Button onClick={() => void roster.refetch()}>다시 시도</Button></p> :
            roster.data.rows.length ? <DomainTable scrollLabel={deleted ? "삭제 학생" : "등록 학생"}><thead><tr>
              <th>이름</th><th>학교</th><th>학년</th><th>관리</th>
            </tr></thead><tbody>{roster.data.rows.map((row) => <tr key={row.id}>
              <th scope="row">{row.name}</th><td>{row.school || "—"}</td><td>{row.grade ?? "—"}</td><td>
                {deleted ? <Button size="sm" disabled={change.isPending} onClick={() => change.mutate({ kind: "restore", id: row.id })}>복원</Button> :
                  <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => go("profile",row)}>수정</Button>
                    <Button size="sm" onClick={() => go("credential",row)}>비밀번호</Button>
                    <Button size="sm" intent="danger" onClick={() => { change.reset(); setConfirmDelete(row); }}>삭제</Button></div>}
              </td></tr>)}</tbody></DomainTable> : <EmptyState scope="panel" title={deleted ? "삭제된 데모 학생이 없습니다" : "등록된 데모 학생이 없습니다"}/>}
          {confirmDelete && <section aria-label="학생 삭제 확인" className="py-3">
            <p>{confirmDelete.name} 학생을 삭제할까요? 삭제 학생 목록에서 복원할 수 있습니다.</p>
            <Button onClick={() => setConfirmDelete(null)} disabled={change.isPending}>취소</Button>
            <Button intent="danger" loading={change.isPending} onClick={() => change.mutate({ kind: "delete", id: confirmDelete.id })}>삭제 확인</Button>
          </section>}
        </>}
        {view === "profile" && <form onSubmit={save} className="grid gap-3 py-3 sm:grid-cols-2">
          <label>학생 이름<input className="ds-input" required maxLength={50} value={profile.name} onChange={(event) => setProfile({...profile, name:event.target.value})}/></label>
          <label>학교 구분<select className="ds-select" value={profile.school_type} onChange={(event) => setProfile({...profile, school_type:event.target.value as SchoolType, grade:null})}>
            {Object.entries(schoolTypes).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label>학교<input className="ds-input" value={profile.school} maxLength={100} onChange={(event) => setProfile({...profile, school:event.target.value})}/></label>
          <label>학년<select className="ds-select" value={profile.grade ?? ""} onChange={(event) => setProfile({...profile, grade:Number(event.target.value) || null})}>
            <option value="">미입력</option>{Array.from({ length: profile.school_type === "ELEMENTARY" ? 6 : 3 }, (_, index) => index + 1).map((grade) => <option key={grade} value={grade}>{grade}학년</option>)}
          </select></label>
          <label>학교 반<input className="ds-input" value={profile.high_school_class} maxLength={100} onChange={(event) => setProfile({...profile, high_school_class:event.target.value})}/></label>
          <label>계열<input className="ds-input" value={profile.major} maxLength={50} onChange={(event) => setProfile({...profile, major:event.target.value})}/></label>
          <label>성별<select className="ds-select" value={profile.gender ?? ""} onChange={(event) => setProfile({...profile, gender:event.target.value==="M" || event.target.value==="F" ? event.target.value : null})}>
            <option value="">미입력</option><option value="M">남</option><option value="F">여</option>
          </select></label>
          <label>메모<textarea className="ds-textarea" maxLength={2000} value={profile.memo} onChange={(event) => setProfile({...profile, memo:event.target.value})}/></label>
          {Boolean(roster.data?.tags.length) && <fieldset className="sm:col-span-2"><legend>태그</legend>
            <div className="flex flex-wrap gap-3">{roster.data?.tags.map((tag) => <label key={tag.id}><input type="checkbox"
              checked={profile.tag_ids.includes(tag.id)} onChange={(event) => setProfile({...profile,tag_ids:event.target.checked ? [...profile.tag_ids,tag.id] : profile.tag_ids.filter((id) => id!==tag.id)})}/> {tag.name}</label>)}</div>
          </fieldset>}
          <Button type="submit" intent="primary" loading={change.isPending}>저장</Button>
        </form>}
        {view === "upload" && <section aria-label="엑셀 등록" className="grid gap-3 py-3">
          <Button onClick={() => template.mutate()} loading={template.isPending}>등록 양식 내려받기</Button>
          {template.isError && <p role="alert">등록 양식을 내려받지 못했습니다.</p>}
          <label>엑셀 파일<input type="file" accept=".xlsx,.xls" onChange={(event) => void read(event.target.files?.[0])} disabled={change.isPending}/></label>
          {reading && <p role="status">엑셀을 읽는 중입니다.</p>}
          {warnings.length>0 && <ul role="alert">{warnings.slice(0,8).map((warning,index) => <li key={index}>{warning}</li>)}</ul>}
          {preview.length>0 && <><p>{fileName} · 등록할 예시 학생 {preview.length}명</p>
            <ul>{preview.slice(0,8).map((row,index) => <li key={index}>{row.name} · {row.school || "학교 미입력"}{row.grade ? " " + row.grade + "학년" : ""}</li>)}</ul>
            <Button intent="primary" loading={change.isPending} onClick={() => change.mutate({ kind: "create", students: preview })}>학생 {preview.length}명 등록</Button></>}
        </section>}
      </ModalBody>
    </AdminModal>}
  </>;
}
