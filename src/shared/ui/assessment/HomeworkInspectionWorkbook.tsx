import { useEffect, useRef, useState } from "react";
import api from "@/shared/api/axios";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { readActiveAuthGenerationSafely } from "@/shared/auth/tokenSession";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { downloadBlob } from "@/shared/utils/safeDownload";
import "./HomeworkInspectionWorkbook.css";

type Props = {
  base: string;
  title: string;
  onApplied: () => Promise<unknown>;
  onBusy: (busy: boolean) => void;
  onDirty: (dirty: boolean) => void;
};
type Values = { solved: number | null; total: number | null; feedback: string };
type Change = Partial<Values> & { enrollment_id: number; version: number };
type PreviewRow = {
  line: number;
  name: string;
  before: Values & { version: number };
  change: Change;
  status: "변경" | "새 입력" | "동일";
};
type Preview = { rows: PreviewRow[]; errors: string[] };

function countLabel({ solved, total }: Values) {
  return solved == null || total == null ? "미입력" : `${solved} / ${total}문제`;
}

export default function HomeworkInspectionWorkbook(props: Props) {
  return <WorkbookEditor key={props.base} {...props} />;
}

function WorkbookEditor({ base, title, onApplied, onBusy, onDirty }: Props) {
  const [total, setTotal] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [shown, setShown] = useState(30);
  const fileInput = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const mounted = useRef(false);
  const [generation] = useState(readActiveAuthGenerationSafely);
  const [tenant] = useState(getTenantCodeForApiRequest);
  const active = () => mounted.current && generation === readActiveAuthGenerationSafely()
    && tenant === getTenantCodeForApiRequest();
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const totalValid = !total || (/^[0-9]+$/.test(total) && Number(total) >= 1 && Number(total) <= 100000);
  const changed = preview?.rows.filter(row => row.status !== "동일") ?? [];
  const start = () => {
    if (pending.current || !active()) return false;
    pending.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    return true;
  };
  const finish = () => {
    pending.current = false;
    if (mounted.current) { setBusy(false); onBusy(false); }
  };

  async function download() {
    if (!totalValid || !start()) return;
    try {
      const response = await api.get<Blob>(`${base}workbook/`, { responseType: "blob", params: total ? { total } : {} });
      if (active()) downloadBlob(response.data, `${title.replace(/[\\/:*?"<>|]/g, "_")}-과제검사.xlsx`);
    } catch (e) {
      if (active()) setError(getApiErrorMessage(e, "양식을 다운로드하지 못했습니다. 다시 시도해 주세요."));
    } finally { finish(); }
  }

  async function review(selected: File) {
    if (!start()) return;
    setFile(selected);
    setPreview(null);
    setNotice("파일을 확인하고 있습니다.");
    setShown(30);
    onDirty(true);
    try {
      const data = new FormData();
      data.append("file", selected);
      const response = await api.post<Preview>(`${base}workbook/`, data);
      if (!active()) return;
      setPreview(response.data);
      setNotice(response.data.rows.length || response.data.errors.length ? "" : "입력할 행이 없습니다. 풀이 수 또는 코멘트를 입력해 주세요.");
      onDirty(response.data.errors.length > 0 || response.data.rows.some(row => row.status !== "동일"));
    } catch (e) {
      if (active()) { setNotice(""); setError(getApiErrorMessage(e, "파일을 확인하지 못했습니다. 다시 시도해 주세요.")); }
    } finally { finish(); }
  }

  async function refresh() {
    const result = await onApplied();
    if (result && typeof result === "object" && "isError" in result && result.isError) {
      throw new Error("최신 명단을 불러오지 못했습니다.");
    }
    if (active()) setNeedsRefresh(false);
  }

  async function apply() {
    if (!preview || preview.errors.length || !changed.length || !start()) return;
    try {
      const response = await api.post<{ changed: number }>(base, { rows: changed.map(row => row.change) });
      if (!active()) return;
      setPreview(null);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      onDirty(false);
      setNotice(`${response.data.changed}명의 과제 검사 결과를 저장했습니다.`);
      setNeedsRefresh(true);
      try { await refresh(); }
      catch { if (active()) setError("저장은 완료되었습니다. 최신 명단을 다시 불러와 주세요."); }
    } catch (e) {
      if (!active()) return;
      setPreview(null);
      setError(getApiErrorMessage(e, "저장 결과를 확인할 수 없습니다. 최신 값으로 다시 미리보기 해 주세요."));
      setNotice("파일을 다시 미리보기 한 뒤 반영할 수 있습니다.");
      setNeedsRefresh(true);
      try { await refresh(); } catch { /* The refresh action remains available. */ }
    } finally { finish(); }
  }

  return (
    <section className="inspection-workbook" aria-label="과제 검사 엑셀 일괄 입력" aria-busy={busy}>
      <div className="inspection-workbook__tools">
        <label>공통 총 문제 수 (선택)
          <input type="number" min={1} max={100000} value={total} disabled={busy}
            aria-invalid={!totalValid} onChange={event => setTotal(event.target.value)} />
        </label>
        <button type="button" disabled={busy || !totalValid} onClick={() => void download()}>명단 양식 다운로드</button>
      </div>
      {!totalValid && <p role="alert">총 문제 수는 1부터 100,000까지의 정수로 입력해 주세요.</p>}
      <details>
        <summary>기존 엑셀을 사용하는 방법</summary>
        <p>첫 30행 안에 ‘이름’, ‘풀어 온 문제 수’, ‘총 문제 수’, ‘코멘트’ 열을 두세요. 명단의 이름으로 연결하며, 동명이인은 전용 양식의 수강번호로 구분합니다.</p>
        <p>풀이 수와 총 문제 수를 함께 입력하거나 코멘트만 적으세요. 빈칸은 기존 값을 유지하고 숫자 0은 풀이 0개로 저장합니다. ‘구분’이 ‘예시’인 행은 건너뜁니다.</p>
      </details>
      <label>작성한 엑셀 파일 (.xlsx)
        <input ref={fileInput} type="file" accept=".xlsx" disabled={busy}
          onChange={event => { const selected = event.target.files?.[0]; if (selected) void review(selected); }} />
      </label>
      {file && <button type="button" disabled={busy} onClick={() => void review(file)}>같은 파일 다시 미리보기</button>}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {needsRefresh && <button type="button" disabled={busy} onClick={async () => {
        if (!start()) return;
        try { await refresh(); } catch (e) { if (active()) setError(getApiErrorMessage(e, "최신 명단을 불러오지 못했습니다.")); }
        finally { finish(); }
      }}>최신 명단 다시 불러오기</button>}
      {preview && <>
        {preview.errors.length > 0 && <div role="alert">
          <strong>오류 {preview.errors.length}건을 수정한 뒤 파일을 다시 선택해 주세요.</strong>
          <ul>{preview.errors.map((message, i) => <li key={i}>{message}</li>)}</ul>
        </div>}
        <p role="status">미리보기 {preview.rows.length}명 · 반영 대상 {changed.length}명</p>
        <ul className="inspection-workbook__rows">
          {preview.rows.slice(0, shown).map(row => {
            const after = { ...row.before, ...row.change };
            return <li key={row.line}>
              <strong>{row.line}행 · {row.name}</strong> <span>{row.status}</span>
              <dl>
                {row.status === "변경" && <><dt>기존</dt><dd>{countLabel(row.before)} · {row.before.feedback || "코멘트 없음"}</dd></>}
                <dt>{row.status === "동일" ? "현재" : "반영 후"}</dt><dd>{countLabel(after)} · {after.feedback || "코멘트 없음"}</dd>
              </dl>
            </li>;
          })}
        </ul>
        {shown < preview.rows.length && <button type="button" onClick={() => setShown(n => n + 30)}>다음 30명 보기</button>}
        <p>반영하면 학생과 학부모가 검사 결과를 확인할 수 있습니다.</p>
        <button className="inspection-workbook__apply" type="button" disabled={busy || !changed.length || !!preview.errors.length}
          onClick={() => void apply()}>{changed.length}명 반영하기</button>
      </>}
    </section>
  );
}
