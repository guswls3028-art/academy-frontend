import { surveyQueryKeys } from "@/shared/api/surveyQueryKeys";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import { fetchMyProfile } from "@student/domains/profile/public/profile.api";
import { studentQueryKeys } from "@student/shared/api/queryKeys";
import { fetchMyInventory, uploadMyFile, type InventoryFile } from "@student/domains/inventory/public/inventory.api";
import SubmitScorePage from "@student/domains/submit/public/SubmitScorePage";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { surveyError, surveysApi, SURVEY_KIND_LABEL, type Survey, type SurveyAnswers, type SurveyAttachment, type SurveyResponse, type SurveyResponseInput } from "@/shared/api/surveys";
import SurveyResponseContent from "@/shared/ui/surveys/SurveyResponseContent";
import { surveyDate } from "@/shared/api/surveys";
import useAuth from "@/auth/hooks/useAuth";
import { useDurableDraft } from "@/shared/hooks/useDurableDraft";
import { getTenantUserLocalKey } from "@/shared/utils/safeLocalStorage";
import styles from "@/shared/ui/surveys/Surveys.module.css";

function Failure({ error, retry }: { error: unknown; retry: () => void }) { return <div role="alert" className={styles.error}>{surveyError(error)}<button type="button" className={styles.button} onClick={retry}>다시 시도</button></div>; }
function attachment(file: InventoryFile): SurveyAttachment { return { id: Number(file.id), name: file.displayName || file.name, size_bytes: file.sizeBytes, content_type: file.contentType, r2_key: file.r2Key }; }

export default function StudentSurveysPage() {
  const profile = useQuery({ queryKey: studentQueryKeys.me, queryFn: fetchMyProfile });
  const [offset, setOffset] = useState(0); const studentId = profile.data?.id;
  const query = useQuery({ queryKey: surveyQueryKeys.studentList(studentId, offset), queryFn: () => surveysApi.myList(studentId!, offset), enabled: Boolean(studentId) });
  return <StudentPageShell title="설문과 성적 취합" description="선생님이 요청한 내용을 확인하고 답해주세요." descriptionMode="help" onBack={() => window.history.back()}><main className={`${styles.page} ${styles.student}`}>
    {profile.isError ? <Failure error={profile.error} retry={() => { void profile.refetch(); }} /> : query.isPending ? <p role="status">설문을 불러오는 중…</p> : query.isError ? <Failure error={query.error} retry={() => { void query.refetch(); }} /> : !query.data.results.length ? <div className={styles.empty}><h2>아직 도착한 설문이 없습니다</h2><p className={styles.muted}>새 설문이 배포되면 이곳에서 확인할 수 있어요.</p><Link to="/student/submit" className={styles.linkButton}>제출 화면으로</Link></div> : <div className={styles.list}>{query.data.results.map((survey) => <Link className={styles.row} to={`/student/surveys/${survey.id}`} key={survey.id}><div><strong className={styles.rowTitle}>{survey.title}</strong><div className={styles.rowMeta}><span>{SURVEY_KIND_LABEL[survey.kind]}</span><span>{surveyDate(survey.closes_at)}</span></div></div><span>{survey.answered ? "응답 확인" : survey.can_respond ? "답하기" : survey.status === "closed" ? "마감" : "확인"}</span></Link>)}</div>}
    {query.data && query.data.count > 30 && <div className={styles.pagination}><button type="button" className={styles.button} disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 30))}>이전</button><span>{offset + 1}–{Math.min(offset + 30, query.data.count)}</span><button type="button" className={styles.button} disabled={offset + 30 >= query.data.count} onClick={() => setOffset(offset + 30)}>다음</button></div>}
  </main></StudentPageShell>;
}

export function StudentSurveyDetailPage() {
  const id = Number(useParams().surveyId);
  const { user } = useAuth();
  const profile = useQuery({ queryKey: studentQueryKeys.me, queryFn: fetchMyProfile });
  const studentId = profile.data?.id;
  const query = useQuery({ queryKey: surveyQueryKeys.studentDetail(studentId, id), queryFn: () => surveysApi.myDetail(id, studentId!), enabled: Boolean(studentId && id > 0), refetchOnWindowFocus: false });
  const data = query.data;
  return <StudentPageShell title={data?.survey.title || "설문"} description={data?.survey.description || "선생님이 요청한 내용에 답해주세요."} onBack={() => window.history.back()}><main className={`${styles.page} ${styles.student}`}>
    <Link className={styles.muted} to="/student/surveys">설문 목록</Link>
    {profile.isError ? <Failure error={profile.error} retry={() => { void profile.refetch(); }} /> : query.isPending ? <p role="status">설문을 불러오는 중…</p> : query.isError ? <Failure error={query.error} retry={() => { void query.refetch(); }} /> : data && profile.data && user && <ResponseForm key={`${getTenantCodeForApiRequest()}:${user.id}:${studentId}:${id}`} actorId={user.id} survey={data.survey} existing={data.response} studentId={studentId!} studentPs={profile.data.ps_number || ""} studentName={profile.data.name || ""} />}
  </main></StudentPageShell>;
}

type SavedDraft = { input: SurveyResponseInput; attachments: SurveyAttachment[] };
function validDraft(value: unknown): value is SavedDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as SavedDraft;
  return Boolean(draft.input && draft.input.answers && typeof draft.input.answers === "object" && !Array.isArray(draft.input.answers)
    && Number.isInteger(draft.input.expected_version) && draft.input.expected_version >= 0
    && Array.isArray(draft.input.attachment_ids) && draft.input.attachment_ids.every((id) => Number.isInteger(id) && id > 0)
    && Array.isArray(draft.input.score_submission_ids) && draft.input.score_submission_ids.every((id) => Number.isInteger(id) && id > 0)
    && Array.isArray(draft.attachments) && draft.attachments.every((file) => file && Number.isInteger(file.id) && typeof file.name === "string" && typeof file.r2_key === "string"));
}

function ResponseForm({ actorId, survey, existing, studentId, studentPs, studentName }: { actorId: string | number; survey: Survey; existing: SurveyResponse | null; studentId: number; studentPs: string; studentName: string }) {
  const qc = useQueryClient();
  const [storageKey] = useState(() => getTenantUserLocalKey(`survey-response-v1:student:${studentId}:survey:${survey.id}`, actorId));
  const [answers, setAnswers] = useState<SurveyAnswers>(existing?.answers ?? {});
  const [files, setFiles] = useState<SurveyAttachment[]>(existing?.attachments ?? []);
  const [scoreIds, setScoreIds] = useState<number[]>(existing?.score_submissions.map((score) => score.id) ?? []);
  const [version, setVersion] = useState(existing?.version ?? 0);
  const [response, setResponse] = useState(existing); const [dirty, setDirty] = useState(false); const [editing, setEditing] = useState(!existing);
  const [error, setError] = useState(""); const [uploading, setUploading] = useState(false); const [showScoreForm, setShowScoreForm] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState(survey.response_unavailable_reason);
  const draft = useDurableDraft<SavedDraft>({
    storageKey, ttlMs: 86400000, isValid: validDraft, isEmpty: () => !dirty,
    value: { input: { answers, attachment_ids: files.map((file) => file.id), score_submission_ids: scoreIds, expected_version: version }, attachments: files },
    onRestore: (saved) => { setAnswers(saved.input.answers); setFiles(saved.attachments); setScoreIds(saved.input.score_submission_ids); setVersion(saved.input.expected_version); setDirty(true); setEditing(true); },
  });
  const inventory = useQuery({ queryKey: studentQueryKeys.inventory(studentPs, studentId), queryFn: () => fetchMyInventory(studentPs, studentId), enabled: survey.kind === "school_score" && Boolean(studentPs), refetchOnWindowFocus: false });
  const scoreFiles = (inventory.data?.files ?? []).filter((file) => {
    const scores = file.scoreSubmissions?.length ? file.scoreSubmissions : file.scoreSubmission ? [file.scoreSubmission] : [];
    return scores.some((score) => ["pending", "verified"].includes(score.status) && Object.entries(survey.score_defaults).every(([key, value]) => score[key as keyof typeof score] === value));
  }).slice(0, 20);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty || uploading) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty, uploading]);
  const save = useMutation({
    mutationFn: () => surveysApi.respond(survey.id, studentId, { answers, attachment_ids: files.map((file) => file.id), score_submission_ids: scoreIds, expected_version: version }),
    onSuccess: (value) => { draft.markSubmitted(); setResponse(value); setVersion(value.version); setAnswers(value.answers); setFiles(value.attachments); setScoreIds(value.score_submissions.map((score) => score.id)); setDirty(false); setEditing(false); setError(""); void qc.invalidateQueries({ queryKey: surveyQueryKeys.studentRoot(studentId) }); void qc.invalidateQueries({ queryKey: surveyQueryKeys.studentDetail(studentId, survey.id) }); },
    onError: (value) => setError(surveyError(value)),
  });
  const chooseScore = (file: InventoryFile) => { const scores = (file.scoreSubmissions?.length ? file.scoreSubmissions : file.scoreSubmission ? [file.scoreSubmission] : []).filter((score) => ["pending", "verified"].includes(score.status) && Object.entries(survey.score_defaults).every(([key, value]) => score[key as keyof typeof score] === value)); setFiles([attachment(file)]); setScoreIds(scores.map((score) => score.id)); setDirty(true); setShowScoreForm(false); };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []); event.target.value = ""; setError("");
    if (files.length + selected.length > 10) { setError("사진·PDF는 최대 10개까지 첨부할 수 있어요."); return; }
    if (selected.some((file) => file.size > 20 * 1024 * 1024 || !["image/jpeg", "image/png", "application/pdf"].includes(file.type))) { setError("20MB 이하의 JPG·PNG·PDF를 선택해 주세요."); return; }
    setUploading(true);
    for (const file of selected) {
      try { const result = await uploadMyFile(studentPs, file, { selectedStudentId: studentId, description: `설문 첨부: ${survey.title}` }); setFiles((current) => [...current, attachment(result)]); setDirty(true); }
      catch (value) { setError(`${file.name}을 올리지 못했습니다. 이미 올라간 파일은 유지됩니다. 실패한 파일을 다시 선택해 주세요. ${surveyError(value)}`); break; }
    }
    setUploading(false);
  };
  const refresh = async () => {
    try { const latest = await surveysApi.myDetail(survey.id, studentId); setUnavailableReason(latest.survey.response_unavailable_reason); if (latest.response && window.confirm("입력 중인 내용 대신 저장된 최신 응답을 불러올까요?")) { draft.clearDraft(); setResponse(latest.response); setAnswers(latest.response.answers); setFiles(latest.response.attachments); setScoreIds(latest.response.score_submissions.map((score) => score.id)); setVersion(latest.response.version); setDirty(false); setEditing(false); setError(""); } } catch (value) { setError(surveyError(value)); }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); setError(""); if (survey.kind === "school_score" && !scoreIds.length) { setError("성적표를 등록하거나 이전에 제출한 성적표를 선택해 주세요."); return; } save.mutate(); };
  const recovery = <>
    {draft.pendingDraft && <div className={styles.notice}>아직 제출하지 않은 초안이 있습니다.<div className={styles.actions}><button type="button" className={styles.button} onClick={draft.restorePendingDraft}>작성하던 응답 이어쓰기</button><button type="button" className={styles.button} onClick={draft.discardPendingDraft}>초안 버리기</button></div></div>}
    {draft.newerDraft && <div className={styles.notice}>다른 탭에서 작성한 새 초안이 있습니다.<div className={styles.actions}><button type="button" className={styles.button} onClick={draft.acceptNewerDraft}>새 초안 불러오기</button><button type="button" className={styles.button} onClick={draft.keepCurrentDraft}>현재 입력 유지</button></div></div>}
    {draft.errorMessage && <div role="alert" className={styles.error}>{draft.errorMessage}<button type="button" className={styles.button} onClick={draft.retrySave}>초안 저장 재시도</button></div>}
  </>;
  if (response && !editing) return <>{recovery}<div className={styles.success} role="status"><strong>응답을 제출했습니다.</strong><div>{studentName} 학생의 기록에 저장되었습니다.</div></div><SurveyResponseContent response={response} studentId={studentId} />{!unavailableReason ? <button type="button" className={styles.button} onClick={() => setEditing(true)}>응답 수정</button> : <p className={styles.notice}>{unavailableReason} 제출한 내용은 계속 확인할 수 있습니다.</p>}</>;
  return <form onSubmit={submit} className={styles.form}>
    <div className={styles.rowMeta}><span>{studentName} 학생의 응답</span><span>{surveyDate(survey.closes_at)}</span></div>
    {unavailableReason && <div className={styles.notice} role="status">{unavailableReason}<button type="button" className={styles.button} onClick={() => { void refresh(); }}>상태 다시 확인</button></div>}
    {recovery}
    {draft.status === "restored" && <p className={styles.notice}>작성하던 응답을 불러왔습니다. 아직 제출되지 않은 내용입니다.</p>}
    {survey.questions.map((question, index) => {
      const value = answers[question.id];
      const selected = Array.isArray(value) ? value : [];
      const changeAnswer = (next: string | string[]) => {
        setAnswers((current) => ({ ...current, [question.id]: next }));
        setDirty(true);
      };
      return <fieldset className={styles.question} key={question.id}>
        <legend>{index + 1}. {question.label}{question.required && <span className={styles.required}>필수</span>}</legend>
        {question.type === "textarea" ?
          <textarea aria-label={question.label} required={question.required} maxLength={5000} rows={4} value={String(value ?? "")} onChange={(event) => changeAnswer(event.target.value)} /> :
          question.type === "single_choice" || question.type === "multiple_choice" ?
            <div className={styles.optionList}>{question.options.map((option) => <label className={styles.check} key={option}>
              <input type={question.type === "single_choice" ? "radio" : "checkbox"} name={question.id}
                required={question.type === "single_choice" && question.required}
                checked={question.type === "single_choice" ? value === option : selected.includes(option)}
                onChange={(event) => changeAnswer(question.type === "single_choice" ? option : event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} />
              {option}
            </label>)}</div> :
            <input aria-label={question.label} type={question.type === "date" ? "date" : "text"} inputMode={question.type === "number" ? "decimal" : undefined}
              required={question.required} maxLength={question.type === "text" ? 500 : 40} value={String(value ?? "")}
              onChange={(event) => changeAnswer(event.target.value)} />}
      </fieldset>;
    })}
    {survey.kind === "school_score" && <section className={styles.section}><h2>성적표와 점수</h2><p className={styles.muted}>성적표 한 장에 여러 과목을 함께 입력할 수 있어요. 선생님이 원본을 확인한 뒤 성적 추이에 반영됩니다.</p>{files.length > 0 && scoreIds.length > 0 && <div className={styles.success} role="status">{files[0].name}을 선택했습니다. {scoreIds.length}과목이 이 설문과 연결됩니다.</div>}
      {inventory.isError && <Failure error={inventory.error} retry={() => { void inventory.refetch(); }} />}
      {scoreFiles.length > 0 && <details className={styles.advanced}><summary>이전에 제출한 성적표 선택</summary>{scoreFiles.map((file) => <div key={file.id} className={styles.fileRow}><span>{file.displayName || file.name}</span><button type="button" className={styles.button} onClick={() => chooseScore(file)}>이 성적표 선택</button></div>)}</details>}
      <button type="button" className={styles.button} onClick={() => setShowScoreForm(!showScoreForm)}>{showScoreForm ? "성적표 입력 접기" : "성적표 새로 등록"}</button>
      {showScoreForm && <SubmitScorePage embedded defaults={survey.score_defaults} onSubmitted={chooseScore} onBusyChange={setUploading} />}
    </section>}
    {survey.allow_attachments && survey.kind !== "school_score" && <section className={styles.section}><h2>사진·PDF 첨부</h2><p className={styles.muted}>파일당 20MB 이하, 최대 10개까지 올릴 수 있어요.</p><input type="file" accept="image/png,image/jpeg,application/pdf" multiple aria-label="설문 첨부파일" disabled={uploading || save.isPending} onChange={(event) => { void upload(event); }} />{uploading && <p role="status">파일을 올리는 중…</p>}{files.map((file) => <div className={styles.fileRow} key={file.id}><span>{file.name}</span><button type="button" className={styles.button} disabled={save.isPending} onClick={() => { setFiles(files.filter((item) => item.id !== file.id)); setDirty(true); }}>첨부 빼기</button></div>)}</section>}
    {error && <div role="alert" className={styles.error}>{error}<button type="button" className={styles.button} onClick={() => { void refresh(); }}>저장된 응답 확인</button></div>}
    <footer className={styles.footer}><span className={styles.muted}>{dirty ? "작성 중인 내용입니다. 제출 버튼으로 마무리해 주세요." : "제출한 응답은 기간 내 다시 수정할 수 있어요."}</span><button type="submit" className={`${styles.button} ${styles.primary}`} disabled={save.isPending || uploading || Boolean(unavailableReason)}>{save.isPending ? "응답 저장 중…" : response ? "수정한 응답 저장" : "응답 제출"}</button></footer>
  </form>;
}
