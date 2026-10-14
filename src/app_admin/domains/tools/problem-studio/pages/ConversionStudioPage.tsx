import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { Check, FileText, History, Plus, Settings2, Upload, X } from "lucide-react";
import { Badge, Button, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import useAuth from "@/auth/hooks/useAuth";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { getLocalItem, requireSetLocalItem } from "@/shared/utils/safeLocalStorage";
import { downloadPresignedUrl } from "@/shared/utils/safeDownload";
import { actOnConversion, conversionActive, createConversion, getConversion, listConversions, saveConversion, type Conversion, type ConversionOptions, type QuestionContent } from "../api/conversions.api";
import ConversionQuestionEditor from "./ConversionQuestionEditor";
import styles from "./ConversionStudioPage.module.css";

const defaults: ConversionOptions = { level: "explanations", grouping: "separate", redraw: false, require_review: false, external_ai_confirmed: false, subject: "" };
const levels = [
  { value: "questions", label: "문제지만", description: "문항·보기·수식을 원본대로 옮깁니다." },
  { value: "explanations", label: "해설까지", description: "정답과 해설을 함께 준비합니다." },
  { value: "thorough", label: "꼼꼼하게", description: "복잡한 조건과 풀이를 더 깊게 검토합니다." },
] as const;
const stages = [{ key: "source", label: "원본 확인" }, { key: "transcribe", label: "글·그림 옮기기" }, { key: "review", label: "검사·검수" }, { key: "document", label: "한글 문서 만들기" }, { key: "finish", label: "마무리" }];
const statusText = (row: Conversion) => conversionActive(row) ? "변환 중" : row.status === "FAILED" ? "중단됨" : row.review_count ? `확인할 문항 ${row.review_count}개` : "확인 완료";
function message(error: unknown) {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (typeof data === "object" && data && "detail" in data && typeof data.detail === "string") return data.detail;
  if (Array.isArray(data) && typeof data[0] === "string") return data[0];
  return "연결을 확인한 뒤 다시 시도해 주세요. 입력한 내용은 유지됩니다.";
}
function optionDefaults(key: string | null): ConversionOptions {
  try {
    const saved = key ? JSON.parse(getLocalItem(key) || "null") : null;
    return { ...defaults, level: levels.some(level => level.value === saved?.level) ? saved.level : defaults.level, redraw: saved?.redraw === true, require_review: saved?.require_review === true };
  } catch { return defaults; }
}

export default function ConversionStudioPage() {
  const { user } = useAuth();
  const tenant = getTenantCodeForApiRequest();
  const storageKey = tenant && user?.id ? `problem-studio:conversion-options:v1:${tenant}:${user.id}` : null;
  const [search, setSearch] = useSearchParams();
  const selectedId = search.get("conversion");
  const view = selectedId ? "result" : search.get("view") || "new";
  const [rows, setRows] = useState<Conversion[]>([]);
  const [row, setRow] = useState<Conversion | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState<ConversionOptions>(() => optionDefaults(storageKey));
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [filter, setFilter] = useState("all");
  const [dragging, setDragging] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [conflict, setConflict] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const requestNumber = useRef(0);
  const listRequest = useRef(0);
  const mutationLock = useRef(false);
  const currentId = useRef(selectedId);
  currentId.current = selectedId;

  const refreshList = useCallback(async () => {
    const request = ++listRequest.current;
    setListLoading(true);
    try { const result = await listConversions(); if (request === listRequest.current) { setRows(result.conversions); setNextOffset(result.next_offset ?? null); setListError(""); } }
    catch (cause) { if (request === listRequest.current) setListError(message(cause)); }
    finally { if (request === listRequest.current) setListLoading(false); }
  }, []);
  async function loadMore() {
    if (nextOffset === null || listLoading) return;
    const request = ++listRequest.current;
    setListLoading(true);
    try {
      const result = await listConversions(nextOffset);
      if (request === listRequest.current) {
        setRows(previous => [...previous, ...result.conversions.filter(value => !previous.some(item => item.id === value.id))]);
        setNextOffset(result.next_offset ?? null); setListError("");
      }
    } catch (cause) { if (request === listRequest.current) setListError(message(cause)); }
    finally { if (request === listRequest.current) setListLoading(false); }
  }
  useEffect(() => { setRows([]); void refreshList(); }, [refreshList, storageKey]);
  useEffect(() => { setOptions(optionDefaults(storageKey)); setFiles([]); setTitle(""); setConflict(false); }, [storageKey]);
  useEffect(() => { setSettingsSaved(false); }, [options]);
  useEffect(() => {
    const request = ++requestNumber.current;
    setRow(null); setQuestionId(null); setDirty(false); setError("");
    if (!selectedId) { setLoading(false); return; }
    setLoading(true);
    void getConversion(selectedId).then(value => { if (requestNumber.current === request) setRow(value); }).catch(cause => { if (requestNumber.current === request) setError(message(cause)); }).finally(() => { if (requestNumber.current === request) setLoading(false); });
  }, [selectedId, storageKey]);
  const active = row ? conversionActive(row) : false;
  useEffect(() => {
    if (!selectedId || !active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const value = await getConversion(selectedId);
        if (cancelled) return;
        setRow(value); setError("");
        if (!conversionActive(value)) { void refreshList(); return; }
      } catch (cause) { if (!cancelled) setError(message(cause)); }
      if (!cancelled) timer = setTimeout(poll, 3000);
    };
    timer = setTimeout(poll, 1500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [selectedId, active, refreshList]);

  function navigate(next: Record<string, string>) {
    if (dirty && !window.confirm("저장하지 못한 변경이 있습니다. 현재 입력을 버리고 이동할까요?")) return;
    setDirty(false); setQuestionId(null); setSearch(next);
  }
  function openQuestion(id: string | null) {
    if (dirty && !window.confirm("저장하지 못한 변경이 있습니다. 현재 입력을 버리고 이동할까요?")) return;
    setDirty(false); setQuestionId(id);
  }
  function addFiles(incoming: File[]) {
    const next = [...files, ...incoming];
    if (next.length > 40 || next.some(file => file.size > 120 * 1024 * 1024) || next.reduce((sum, file) => sum + file.size, 0) > 512 * 1024 * 1024) { setError("최대 40개, 파일당 120MB, 전체 512MB까지 올릴 수 있습니다."); return; }
    if (incoming.some(file => !/\.(pdf|png|jpe?g|webp)$/i.test(file.name))) { setError("PDF 또는 PNG·JPG·WebP 이미지를 선택해 주세요."); return; }
    setFiles(next); setError("");
    if (!title && incoming[0]) setTitle(incoming[0].name.replace(/\.[^.]+$/, ""));
  }
  function drop(event: DragEvent) { event.preventDefault(); setDragging(false); if (!busy) addFiles(Array.from(event.dataTransfer.files)); }
  async function start() {
    if (mutationLock.current || !files.length || !options.external_ai_confirmed) return;
    mutationLock.current = true; setBusy(true); setError("");
    const pdfs = files.filter(file => /\.pdf$/i.test(file.name));
    const images = files.filter(file => !/\.pdf$/i.test(file.name));
    const groups = options.grouping === "separate" && pdfs.length > 1 ? [...pdfs.map(file => [file]), ...(images.length ? [images] : [])] : [files];
    let first: Conversion | null = null;
    const submitted = new Set<File>();
    try {
      for (const group of groups) {
        const created = await createConversion(groups.length > 1 ? group[0].name.replace(/\.[^.]+$/, "") : title, options, group);
        first ??= created;
        group.forEach(file => submitted.add(file));
      }
      setFiles([]); setOptions(value => ({ ...value, external_ai_confirmed: false }));
      await refreshList();
      if (first) navigate({ conversion: first.id });
    } catch (cause) {
      setFiles(value => value.filter(file => !submitted.has(file)));
      setError(`${submitted.size ? `${submitted.size}개 파일은 시작했습니다. 남은 파일만 다시 시도하세요. ` : ""}${message(cause)}`);
      void refreshList();
    } finally { mutationLock.current = false; setBusy(false); }
  }
  async function mutate(operation: () => Promise<Conversion>, resetEditor = false) {
    if (mutationLock.current) return false;
    const id = selectedId;
    mutationLock.current = true; setBusy(true); setError("");
    try {
      const value = await operation();
      if (currentId.current === id) { setRow(value); if (resetEditor) setEditorRevision(value => value + 1); }
      void refreshList();
      return true;
    } catch (cause) {
      setError(message(cause));
      setConflict((cause as { response?: { status?: number } })?.response?.status === 409);
      return false;
    }
    finally { mutationLock.current = false; setBusy(false); }
  }
  async function download(kind: "manuscript" | "arranged" | "a3" | "source") {
    if (!row) return;
    try {
      const current = await getConversion(row.id);
      const asset = kind === "source" ? current.source_archive : current.artifacts?.[kind];
      if (!asset) throw new Error("missing artifact");
      downloadPresignedUrl(asset.url, `${current.title}_${asset.filename}`);
      setRow(current);
    } catch (cause) { setError(message(cause)); }
  }
  function saveDefaults() {
    if (!storageKey) { setError("계정 정보를 확인한 뒤 다시 시도해 주세요."); return; }
    try {
      requireSetLocalItem(storageKey, JSON.stringify({ level: options.level, redraw: options.redraw, require_review: options.require_review }));
      setError(""); setSettingsSaved(true);
    } catch { setError("이 브라우저에 설정을 저장하지 못했습니다."); setSettingsSaved(false); }
  }
  const questions = row?.document?.questions ?? [];
  const question = questions.find(value => value.id === questionId);
  const questionIndex = question ? questions.indexOf(question) : -1;
  const shownRows = rows.filter(value => filter === "all" || (filter === "active" ? conversionActive(value) || value.status === "FAILED" : !conversionActive(value) && value.status !== "FAILED"));
  const canExport = row && row.artifact_version === row.version && !dirty;
  const stageIndex = stages.findIndex(stage => stage.key === row?.stage);

  return <div className={styles.workbench}>
    <aside className={styles.sidebar} aria-label="시험지 변환 메뉴">
      <div className={styles.brand}><FileText size={ICON.lg} /><strong>시험지 변환</strong></div>
      <Button intent="primary" leftIcon={<Plus size={ICON_FOR_BUTTON.md} />} onClick={() => navigate({})}>새 변환</Button>
      <div className={styles.recent}><p>최근 작업</p>{rows.slice(0, 8).map(item => <button key={item.id} type="button" className={styles.recentItem} aria-current={selectedId === item.id ? "page" : undefined} onClick={() => navigate({ conversion: item.id })}><span className={styles.statusDot} data-active={conversionActive(item)} /><span>{item.title}</span></button>)}</div>
      <nav className={styles.sideNav}><button type="button" aria-current={view === "history" ? "page" : undefined} onClick={() => navigate({ view: "history" })}><History size={ICON.md} />완료 목록 · 진행 중</button><button type="button" aria-current={view === "settings" ? "page" : undefined} onClick={() => navigate({ view: "settings" })}><Settings2 size={ICON.md} />설정</button></nav>
    </aside>
    <main className={styles.main}>
      {view === "history" && listLoading && <p role="status">목록을 불러오는 중…</p>}
      {view === "history" && nextOffset !== null && <Button loading={listLoading} onClick={loadMore}>이전 작업 더 불러오기</Button>}
      {conflict && row && <div className={styles.notice}><p>다른 화면의 저장 내용과 비교할 수 있습니다. 현재 입력은 그대로 보관합니다.</p><Button onClick={async () => { try { const latest = await getConversion(row.id); setRow(latest); setConflict(false); } catch (cause) { setError(message(cause)); } }}>최신 내용과 비교</Button></div>}
      {view === "settings" && settingsSaved && <p role="status" className={styles.notice}>기본값을 저장했습니다.</p>}
      {error && <div className={styles.error} role="alert"><p>{error}</p><Button size="sm" onClick={() => setError("")}>닫기</Button></div>}
      {listError && <div className={styles.error} role="alert"><p>작업 목록을 불러오지 못했습니다. {listError}</p><Button size="sm" onClick={refreshList}>다시 불러오기</Button></div>}
      {view === "new" && <>
        <header className={styles.pageHeading}><h2>시험지를 올리고,<br />바로 편집하는 한글 문서로.</h2><p>글·수식·그림을 옮기고, 확인할 문항만 모아 검수하세요.</p></header>
        <section className={styles.newConversion} aria-label="새 변환">
          <input ref={fileInput} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" className={styles.hiddenInput} aria-label="시험지 파일 선택" onChange={(event: ChangeEvent<HTMLInputElement>) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
          <button type="button" className={styles.dropZone} data-dragging={dragging} onClick={() => fileInput.current?.click()} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop} disabled={busy}><Upload size={ICON.xl} /><strong>시험지 PDF나 이미지를 놓아 주세요</strong><span>또는 눌러서 파일 선택 · PDF, PNG, JPG, WebP</span><small>정답·해설지는 같은 PDF 뒤쪽에 넣어 주세요.</small></button>
          {files.length > 0 && <ul className={styles.fileList}>{files.map((file, index) => <li key={`${file.name}:${index}`}><FileText size={ICON.md} /><span>{file.name}<small>{(file.size / 1024 / 1024).toFixed(1)}MB</small></span><Button iconOnly aria-label={`${file.name} 제거`} disabled={busy} onClick={() => setFiles(value => value.filter((_, i) => i !== index))} leftIcon={<X size={ICON_FOR_BUTTON.md} />} /></li>)}</ul>}
          <div className={styles.metadata}><label>변환 이름<input maxLength={160} value={title} placeholder="예: 중산고 2학년 1학기 중간고사" onChange={event => setTitle(event.target.value)} /></label><label>과목<select value={options.subject} onChange={event => setOptions(value => ({ ...value, subject: event.target.value }))}><option value="">선택 안 함</option>{["국어", "수학", "영어", "과학탐구"].map(subject => <option key={subject}>{subject}</option>)}</select></label></div>
          {files.filter(file => /\.pdf$/i.test(file.name)).length > 1 && <fieldset className={styles.grouping}><legend>여러 PDF는 어떤 자료인가요?</legend>{[{ value: "separate", label: "서로 다른 시험지", detail: "파일마다 따로 변환" }, { value: "copies", label: "같은 시험지의 여러 사본", detail: "문항 번호를 기준으로 합침" }].map(item => <label key={item.value}><input type="radio" name="grouping" checked={options.grouping === item.value} onChange={() => setOptions(value => ({ ...value, grouping: item.value as ConversionOptions["grouping"] }))} /><span>{item.label}<small>{item.detail}</small></span></label>)}</fieldset>}
          <fieldset className={styles.levels}><legend>어디까지 만들까요?</legend><div>{levels.map(level => <label key={level.value} data-selected={options.level === level.value}><input type="radio" name="level" value={level.value} checked={options.level === level.value} onChange={() => setOptions(value => ({ ...value, level: level.value }))} /><strong>{level.label}{level.value === "explanations" && <span>권장</span>}</strong><p>{level.description}</p></label>)}</div></fieldset>
          <label className={styles.toggle}><input type="checkbox" checked={options.redraw} onChange={event => setOptions(value => ({ ...value, redraw: event.target.checked }))} /><span><strong>그림 다시 그리기</strong><small>선 그림으로 다시 구성합니다. 시간·AI 사용량이 늘어나며 원본 대조가 필요합니다.</small></span></label>
          <div className={styles.consent}><label><input type="checkbox" checked={options.external_ai_confirmed} onChange={event => setOptions(value => ({ ...value, external_ai_confirmed: event.target.checked }))} /><span>원본을 외부 AI로 처리하는 데 동의합니다.</span></label><p>개인정보를 가린 뒤 올려 주세요. 설정된 AI 제공자(Amazon Bedrock 또는 OpenAI)가 원본을 처리하며, Bedrock의 글로벌 경로는 국외에서 처리될 수 있습니다. <Link to="/privacy" target="_blank" rel="noreferrer">개인정보 처리방침</Link></p></div>
          <div className={styles.startRow}><p>완료까지 화면을 열어 둘 필요가 없습니다.<br />중단되면 저장된 단계부터 이어서 할 수 있어요.</p><Button intent="primary" size="lg" loading={busy} disabled={!files.length || !options.external_ai_confirmed} onClick={start}>변환 시작</Button></div>
        </section>
      </>}
      {view === "history" && <><header className={styles.pageHeading}><h2>변환 목록</h2><p>진행 중인 작업과 완료된 시험지를 다시 열 수 있습니다.</p></header><div className={styles.filters}>{[{ key: "all", label: "전체" }, { key: "active", label: "진행 중·중단됨" }, { key: "complete", label: "완료" }].map(item => <Button key={item.key} intent={filter === item.key ? "primary" : "secondary"} onClick={() => setFilter(item.key)}>{item.label}</Button>)}</div><div className={styles.history}>{shownRows.map(item => <button type="button" key={item.id} onClick={() => navigate({ conversion: item.id })}><FileText size={ICON.lg} /><span><strong>{item.title}</strong><small>{new Date(item.updated_at).toLocaleString("ko-KR")} · {item.question_count}문항</small></span><Badge tone={item.status === "FAILED" ? "danger" : "neutral"}>{statusText(item)}</Badge></button>)}{!shownRows.length && !listError && !listLoading && <p className={styles.empty}>아직 변환한 시험지가 없습니다. 새 변환에서 첫 파일을 올려 주세요.</p>}</div></>}
      {view === "settings" && <><header className={styles.pageHeading}><h2>변환 설정</h2><p>이 계정의 브라우저에서 새 변환에 사용할 기본값입니다.</p></header><section className={styles.settings}><h3>기본 변환 수준</h3><select aria-label="기본 변환 수준" value={options.level} onChange={event => setOptions(value => ({ ...value, level: event.target.value as ConversionOptions["level"] }))}>{levels.map(level => <option value={level.value} key={level.value}>{level.label}</option>)}</select><label className={styles.toggle}><input type="checkbox" checked={options.require_review} onChange={event => setOptions(value => ({ ...value, require_review: event.target.checked }))} /><span><strong>2차 검수 후 문서 만들기</strong><small>모든 문항의 원본 대조를 완료한 뒤 한글 문서를 만듭니다.</small></span></label><label className={styles.toggle}><input type="checkbox" checked={options.redraw} onChange={event => setOptions(value => ({ ...value, redraw: event.target.checked }))} /><span>그림 다시 그리기를 기본으로 사용</span></label><Button intent="primary" onClick={saveDefaults}>기본값 저장</Button><hr /><h3>사용할 AI</h3><p>Academy에 연결된 AI를 사용합니다. 개인 API 키를 브라우저에 저장하지 않습니다.</p><h3>문서 글꼴·이전 작업</h3><p>기존 도구의 개인 글꼴과 문서 스타일을 그대로 사용합니다. 이전 초안과 작업도 보관돼 있습니다.</p><Link to="/workspace/tools/problem-studio/legacy">이전 도구 및 문서 스타일 열기</Link></section></>}
      {view === "result" && loading && <p className={styles.empty} role="status">변환 결과를 불러오는 중…</p>}
      {view === "result" && !loading && !row && <Button onClick={() => { if (selectedId) void getConversion(selectedId).then(setRow).catch(cause => setError(message(cause))); }}>결과 다시 불러오기</Button>}
      {view === "result" && row && <>
        <header className={styles.resultHeading}><div><h2>{row.title}</h2><p>{row.source_files.map(file => file.name).join(" · ")}</p>{row.source_archive && <Button size="sm" onClick={() => download("source")}>원본 내려받기</Button>}</div><Badge tone={active ? "primary" : row.status === "FAILED" ? "danger" : row.review_count ? "warning" : "success"}>{statusText(row)}</Badge></header>
        {active && <section className={styles.progress} aria-label="변환 진행 상황" role="status"><h3>{stages[stageIndex]?.label || "변환 준비 중"}</h3><p>완료된 단계는 보관됩니다. 다른 화면으로 이동해도 계속 진행합니다.</p><ol>{stages.map((stage, index) => <li key={stage.key} data-state={index < stageIndex ? "done" : index === stageIndex ? "current" : "pending"}><span>{index < stageIndex ? <Check size={ICON.sm} /> : index + 1}</span>{stage.label}</li>)}</ol></section>}
        {row.status === "FAILED" && <section className={styles.failure}><h3>잠시 멈췄습니다</h3><p>{row.error}</p><Button intent="primary" loading={busy} onClick={() => mutate(() => actOnConversion(row.id, row.version, { action: "resume" }))}>이어서 하기</Button></section>}
        {questions.length > 0 && !question && <>
          <section className={styles.resultFiles}><div className={styles.paneHeading}><h3>변환 결과 <span>{questions.length}문항</span></h3><Button loading={busy} disabled={active} onClick={() => mutate(() => actOnConversion(row.id, row.version, { action: "rebuild" }))}>한글 문서 다시작성</Button></div><div className={styles.downloads}>{[{ key: "manuscript", title: "원고본", }, { key: "arranged", title: "배열본", }, { key: "a3", title: "평가원 A3", }].map(item => <Button key={item.key} intent={item.key === "manuscript" ? "primary" : "secondary"} disabled={!canExport || !row.artifacts?.[item.key as "manuscript"]} onClick={() => download(item.key as "manuscript" | "arranged" | "a3")}><span>{item.title}</span></Button>)}</div>{!canExport && <p className={styles.notice}>{row.options.require_review && row.review_count ? "2차 검수 설정이 켜져 있습니다. 모든 문항을 확인한 뒤 다시작성해 주세요." : "수정 내용을 반영하려면 한글 문서 다시작성을 눌러 주세요."}</p>}<p className={styles.muted}>편집 가능한 HWPX 파일입니다. 내려받은 파일을 한글에서 열어 사용하세요.</p></section>
          <section className={styles.reviewSummary}><div><h3>확인할 문항 {row.review_count}개</h3><p>원본과 대조하고, 필요한 부분만 고쳐 주세요.</p></div><Button disabled={busy || active || !row.review_count} onClick={() => { if (window.confirm("모든 문항을 원본과 확인했나요? 확인 완료로 표시합니다.")) void mutate(() => saveConversion(row.id, row.version, { action: "accept_all" })); }}>모두 그대로 둠</Button></section>
          {row.document?.warnings.length ? <details className={styles.warnings}><summary>변환 안내 {row.document.warnings.length}개</summary>{row.document.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</details> : null}
          <section className={styles.questions} aria-label="문항 목록"><div className={styles.paneHeading}><h3>문항</h3><span>문항을 누르면 원본과 나란히 편집할 수 있습니다.</span></div>{questions.map(item => <button type="button" key={item.id} onClick={() => openQuestion(item.id)}><strong>{item.number}번</strong><span>{item.prompt}</span>{!item.reviewed && <Badge tone="warning">확인 필요</Badge>}<span className={styles.editLabel}>편집 ›</span></button>)}</section>
        </>}
        {question && <ConversionQuestionEditor key={`${row.id}:${question.id}:${editorRevision}`} conversion={row} question={question} busy={busy || active} onSave={(value: QuestionContent) => mutate(() => saveConversion(row.id, row.version, { question_id: question.id, question: value }))} onAction={(action, instruction) => { void mutate(() => actOnConversion(row.id, row.version, { action, instruction, question_id: question.id })); }} onReview={action => { void mutate(() => saveConversion(row.id, row.version, { action, question_id: question.id }), true); }} onClose={() => openQuestion(null)} onMove={delta => openQuestion(questions[questionIndex + delta].id)} canPrevious={questionIndex > 0} canNext={questionIndex < questions.length - 1} onDirty={setDirty} />}
      </>}
    </main>
  </div>;
}
