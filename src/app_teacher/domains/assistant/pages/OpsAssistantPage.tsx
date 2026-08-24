import { useEffect, useRef, useState } from "react";
import { Badge } from "@teacher/shared/ui/Badge";
import { AlertCircle, Camera, CheckCircle, Sparkles } from "@teacher/shared/ui/Icons";
import { ICON } from "@/shared/ui/ds";
import { analyzeTeacherOps, confirmTeacherOps, fetchTeacherOpsExecution, type AnalyzeResult, type ExecutionResult, type OpsPreviewRow } from "../api";
import styles from "./OpsAssistantPage.module.css";

const getError = (error: unknown) => String((error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "요청을 처리하지 못했습니다. 입력을 확인해 주세요.");

export default function OpsAssistantPage() {
  const [files, setFiles] = useState<File[]>([]); const [message, setMessage] = useState("");
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null); const [rows, setRows] = useState<OpsPreviewRow[]>([]);
  const [result, setResult] = useState<ExecutionResult | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const previous = useRef("");
  useEffect(() => {
    if (!result?.execution_id || !result.rows?.some((row) => ["queued", "processing"].includes(row.account_notice.state))) return;
    const timer = window.setInterval(() => void fetchTeacherOpsExecution(result.execution_id).then(setResult).catch(() => undefined), 3000);
    return () => window.clearInterval(timer);
  }, [result]);
  const update = (id: string, patch: Partial<OpsPreviewRow>) => setRows((current) => current.map((row) => row.row_id === id ? { ...row, ...patch } : row));
  const analyze = async () => { setBusy(true); setError(""); try { const next = await analyzeTeacherOps(files, message, previous.current || undefined); previous.current = next.proposal_token; setAnalysis(next); setRows(next.rows); } catch (e) { setError(getError(e)); } finally { setBusy(false); } };
  const confirm = async () => { if (!analysis) return; setBusy(true); setError(""); try { setResult(await confirmTeacherOps(analysis.proposal_token, rows)); setAnalysis(null); setRows([]); setFiles([]); setMessage(""); } catch (e) { setError(getError(e)); } finally { setBusy(false); } };
  return <div className={styles.page}>
    <header className={styles.hero}><span className={styles.heroIcon}><Sparkles size={ICON.md}/></span><div><span className={styles.title}><h1>학생 업무 도우미</h1><Badge tone="primary" pill size="xs">BETA</Badge></span><p>사진과 요청을 읽고, 기존 학생부터 확인한 안전한 실행표를 만듭니다.</p></div></header>
    {!result && <section className={styles.panel}>
      <b className={styles.step}>1 · 사진 첨부</b><label className={styles.upload}><Camera size={ICON.sm}/> 사진 선택<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))}/></label><small>{files.length}/5장 · 원본 사진은 저장하지 않습니다.</small>
      <b className={styles.step}>2 · 요청사항</b><textarea value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)} placeholder="예: 숙명에 등록하고 1회차 영상 열어줘. 초기 안내도 가야 해"/>
      <button className={styles.primary} disabled={!files.length || !message.trim() || busy} onClick={() => void analyze()}>{busy ? "사진 읽는 중…" : "실행표 만들기"}</button>
    </section>}
    {rows.length > 0 && <section className={styles.panel}><div className={styles.reviewTitle}><div><b className={styles.step}>3 · 실행 전 확인</b><h2>{rows.length}명 처리 예정</h2></div><Badge tone={rows.every(canSubmit) ? "success" : "danger"} pill>{rows.every(canSubmit) ? "확인 가능" : "보완 필요"}</Badge></div>
      {rows.map((row, i) => <article className={styles.receipt} key={row.row_id}><div className={styles.receiptHead}><span>{String(i + 1).padStart(2, "0")}</span><div><strong>{row.name || "이름 확인 필요"}</strong><small>{row.student_match.status === "existing" ? `기존 학생 · ${row.student_match.basis.join(" + ")}` : "신규 학생 후보 · 기존 일치 없음"}</small></div></div>
        <div className={styles.fields}><Field label="학생 이름" value={row.name} onChange={(value) => update(row.row_id, { name: value })}/><Field label="학교" value={row.school} onChange={(value) => update(row.row_id, { school: value })}/><Field label="학생 전화" value={row.student_phone} onChange={(value) => update(row.row_id, { student_phone: value })}/><Field label="학부모 전화" value={row.parent_phone} onChange={(value) => update(row.row_id, { parent_phone: value })}/><label>강의<select value={row.selected_lecture_id ?? ""} onChange={(e) => update(row.row_id, { selected_lecture_id: e.target.value ? Number(e.target.value) : null })}><option value="">강의 선택</option>{analysis?.lecture_options.map((lecture) => <option key={lecture.id} value={lecture.id}>{lecture.title}</option>)}</select></label><Field label="회차" type="number" value={String(row.session_order ?? "")} onChange={(value) => update(row.row_id, { session_order: value ? Number(value) : null })}/></div>
        <div className={styles.evidence}><span>계정<strong>{row.student_match.status === "existing" ? "기존 연결" : "신규 생성"}</strong></span><span>영상 출결<strong>{row.actions.open_video ? "ONLINE · 모니터링" : "요청 없음"}</strong></span><span>알림톡<strong>{row.actions.send_account_notice ? "공급사 접수 확인" : "요청 없음"}</strong></span></div>
        {row.actions.correct_enrollment && <label className={styles.correction}>교정할 잘못된 수강<select value={row.remove_enrollment_id ?? ""} onChange={(e) => update(row.row_id, { remove_enrollment_id: e.target.value ? Number(e.target.value) : null })}><option value="">선택 필요</option>{row.correction_options.map((option) => <option key={option.enrollment_id} value={option.enrollment_id} disabled={!option.impact.can_remove}>{option.lecture_title} · 차시 {option.impact.session_enrollments} / 출결 {option.impact.removable_unset_attendances}{option.impact.can_remove ? "" : " · 자동 교정 불가"}</option>)}</select></label>}
        {row.issues.map((issue) => <p className={issue.blocking ? styles.issue : styles.note} key={issue.code}><AlertCircle size={14}/>{issue.message}</p>)}</article>)}
      <button className={styles.primary} disabled={rows.some((row) => !canSubmit(row)) || busy} onClick={() => void confirm()}>{busy ? "다시 잠그고 확인 중…" : `${rows.length}명 확정하고 실행`}</button><small>검토 후 상태가 바뀌었으면 전체를 실행하지 않습니다.</small>
    </section>}
    {result?.rows && <section className={styles.panel}><div className={styles.done}><CheckCircle size={ICON.lg}/><div><h2>요청을 실행했습니다</h2><small>단계별 증거를 분리해 확인했습니다.</small></div></div>{result.rows.map((row, i) => <article className={styles.result} key={row.row_id}><strong>학생 {i + 1}</strong><Line label="학생·계정" value={row.account_creation === "created" ? "신규 계정 생성" : row.profile_link.state === "updated" ? "기존 연결 복구" : "기존 계정 유지"}/><Line label="수강" value={`올바른 활성 ${row.enrollment.correct_active_count} · 잘못된 수강 ${row.enrollment.wrong_active_removed ? "교정됨" : "없음"}`}/><Line label="영상 수업" value={row.attendance ? "ONLINE · PROCTORED_CLASS · monitoring=true" : "요청 없음"}/><Line label="초기 안내" value={notice(row.account_notice)}/><Line label="실제 재생" value={playbackCanary(row.real_playback_canary)}/></article>)}<p className={styles.note}>{result.provider_receipt_note}</p><button className={styles.secondary} onClick={() => setResult(null)}>새 요청 작성</button></section>}
    {error && <div className={styles.error}><AlertCircle size={ICON.sm}/>{error}</div>}
  </div>;
}
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) { return <label>{label}<input type={type} value={value} onChange={(e) => onChange(e.target.value)}/></label>; }
function Line({ label, value }: { label: string; value: string }) { return <div className={styles.line}><span>{label}</span><strong>{value}</strong></div>; }
function notice(value: { state: string; provider_evidence?: { accepted_count: number; expected_count: number } }) { if (value.state === "provider_received" && value.provider_evidence) return `알림톡 공급사 접수 ${value.provider_evidence.accepted_count}/${value.provider_evidence.expected_count}`; if (["queued", "processing"].includes(value.state)) return "공급사 접수 확인 중"; if (value.state === "failed") return "접수 실패 · 확인 필요"; if (value.state === "unavailable_without_pending_credentials") return "자격증명 유지 · 발송 안 함"; return "요청 없음"; }
function playbackCanary(value: { state: string } | undefined) { return value?.state === "verified" ? "안전 검증 완료" : "이번 실행에서 미검증"; }
function canSubmit(row: OpsPreviewRow) { const editable = new Set(["student_name_missing", "student_phone_invalid", "parent_phone_invalid", "identity_evidence_missing", "new_student_phone_required", "lecture_required", "session_required", "correction_selection_required"]); return Boolean(row.name.trim() && row.parent_phone.trim() && (!row.actions.register_student || row.student_phone.trim()) && (!(row.actions.enroll_lecture || row.actions.open_video) || row.selected_lecture_id) && (!row.actions.open_video || row.session_order) && (!row.actions.correct_enrollment || row.remove_enrollment_id) && !row.issues.some((issue) => issue.blocking && !editable.has(issue.code))); }
