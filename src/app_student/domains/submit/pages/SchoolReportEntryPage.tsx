import { resolveTenantCodeString } from "@/shared/tenant";
import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useSearchParams } from "react-router";
import useAuth from "@/auth/hooks/useAuth";
import {
  fetchOwnSchoolReport, saveOwnSchoolReport, schoolReportKeys,
  type SchoolReportPeriod, type SchoolReportSubject, type SchoolReportScore,
} from "@/shared/api/contracts/schoolReports";
import { isStudentSupportWindow } from "@/shared/auth/supportPreviewSession";
import SchoolReportPeriodPicker from "@/shared/product/schoolReports/SchoolReportPeriodPicker";
import { currentSchoolReportPeriod, parseSchoolReportPeriod, schoolReportParams, schoolReportPeriodLabel } from "@/shared/product/schoolReports/period";
import SchoolReportScoreList from "@/shared/product/schoolReports/SchoolReportScoreList";
import { useConfirm } from "@/shared/ui/confirm";
import { extractApiError } from "@/shared/utils/extractApiError";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import EmptyState from "@student/layout/EmptyState";
import DawonSchoolYearReport, { type SchoolReportEdit } from "./DawonSchoolYearReport";
import styles from "./SchoolReportEntryPage.module.css";

type DraftRow = { id: number; subject: string; score: string; max: string };
const MAX_SUBJECTS = 20;
const DECIMAL_SCORE = /^\d+(?:\.\d{1,2})?$/;

function emptyRow(id: number): DraftRow {
  return { id, subject: "", score: "", max: "100" };
}

export default function SchoolReportEntryPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const period = parseSchoolReportPeriod(Object.fromEntries(searchParams)) ?? currentSchoolReportPeriod();
  const [editing, setEditing] = useState<SchoolReportEdit | null>(null);
  const [notice, setNotice] = useState("");
  const selectedYear = Number(searchParams.get("academic_year"));
  const year = Number.isInteger(selectedYear) && selectedYear >= 2000 && selectedYear <= 2100 ? selectedYear : period.academic_year;
  const day = searchParams.get("date") || "";
  const calendar = new URLSearchParams({view:"day",date:day,period:searchParams.get("period")==="month"?"month":"week"});
  const origin = searchParams.get("originDate");
  if (origin && /^\d{4}-\d{2}-\d{2}$/.test(origin)) calendar.set("originDate", origin);
  const fromDay = searchParams.get("from")==="day" && /^\d{4}-\d{2}-\d{2}$/.test(day);
  const backPath = fromDay ? "/learn/grades?" + calendar : "/student";
  if (user?.tenantRole === "parent") return <Navigate to="/student/submit" replace />;
  if (window.location.hostname === "demo.hakwonplus.com" && resolveTenantCodeString() === "dawon") {
    return <StudentPageShell title="학교 성적" actions={<a className="stu-btn stu-btn--secondary" href="/student">학습 홈</a>}>
      {notice && <p className={styles.success} role="status">{notice}</p>}
      {editing
        ? <SchoolReportEntry period={editing.period} initialEdit={editing.scores} finishEdit={saved => {
          setEditing(null);
          if (saved) setNotice(schoolReportPeriodLabel(editing.period) + " 성적을 저장했습니다.");
        }}/>
        : <DawonSchoolYearReport year={year} readOnly={isStudentSupportWindow()} onEdit={entry => {
          setNotice("");
          setEditing(entry);
        }} onYear={next => {
          setNotice("");
          setSearchParams({ from: "terms", academic_year: String(next) });
        }}/>}
    </StudentPageShell>;
  }
  return (
    <StudentPageShell
      title={resolveTenantCodeString() === "dawon" ? "학교 성적" : "학교 성적표 제출"}
      actions={resolveTenantCodeString() === "dawon" ? <a className="stu-btn stu-btn--secondary" href={backPath}>{fromDay ? "날짜별 학교 성적" : "학습 홈"}</a> : <Link className="stu-btn stu-btn--secondary" to="/student/submit/score">파일로 제출</Link>}
    >
      <SchoolReportEntry
        key={`${period.academic_year}-${period.semester}-${period.exam_round}`}
        period={period}
        onPeriodChange={(next) => setSearchParams(previous => { const query = new URLSearchParams(previous); for (const [key,value] of Object.entries(schoolReportParams(next))) query.set(key,value); return query; }, { replace: true })}
      />
    </StudentPageShell>
  );
}

function draftRows(scores: SchoolReportScore[]): DraftRow[] {
  return scores.length ? scores.map((item, index) => ({
    id: index + 1, subject: item.subject, score: String(item.score), max: String(item.max_score),
  })) : [emptyRow(1)];
}

function SchoolReportEntry({ period, onPeriodChange, initialEdit, finishEdit }: {
  period: SchoolReportPeriod;
  onPeriodChange?: (period: SchoolReportPeriod) => void;
  initialEdit?: SchoolReportScore[];
  finishEdit?: (saved: boolean) => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const readOnly = isStudentSupportWindow();
  const nextId = useRef(Math.max(1, initialEdit?.length ?? 0) + 1);
  const [rows, setRows] = useState<DraftRow[] | null>(() => initialEdit ? draftRows(initialEdit) : null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const report = useQuery({
    queryKey: schoolReportKeys.own(period),
    queryFn: ({ signal }) => fetchOwnSchoolReport(period, signal),
  });
  const save = useMutation({
    mutationFn: (subjects: SchoolReportSubject[]) => saveOwnSchoolReport(period, subjects),
    onSuccess: (result) => {
      qc.setQueryData(schoolReportKeys.own(period), result);
      setRows(null);
      setDirty(false);
      setError("");
      setSaved(true);
      finishEdit?.(true);
    },
    onError: (failure) => setError(extractApiError(failure, "성적표를 저장하지 못했습니다. 다시 시도해 주세요.")),
  });

  async function changePeriod(next: SchoolReportPeriod) {
    if (
      next.academic_year === period.academic_year &&
      next.semester === period.semester &&
      next.exam_round === period.exam_round
    ) return;
    if (dirty && !await confirm({
      title: "시험 구분을 바꿀까요?",
      message: "입력 중인 점수는 아직 제출되지 않았습니다.",
      confirmText: "시험 구분 바꾸기",
    })) return;
    onPeriodChange?.(next);
  }

  function startEditing() {
    const currentRows = draftRows(report.data?.direct_scores ?? []);
    nextId.current = currentRows.length + 1;
    setRows(currentRows);
    setDirty(false);
    setSaved(false);
  }

  function updateRow(id: number, key: "subject" | "score" | "max", value: string) {
    setRows((previous) => previous?.map((row) => row.id === id ? { ...row, [key]: value } : row) ?? null);
    setDirty(true);
    setError("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!rows || save.isPending || readOnly) return;
    const subjects: SchoolReportSubject[] = [];
    const seen = new Set<string>();
    for (const [index, row] of rows.entries()) {
      const subject = row.subject.trim().replace(/\s+/g, " ");
      const score = Number(row.score);
      const max = Number(row.max);
      if (!subject || !DECIMAL_SCORE.test(row.score) || !DECIMAL_SCORE.test(row.max) || max <= 0 || score > max || max > 99_999.99) {
        setError(`${index + 1}번째 과목명과 점수를 확인해 주세요. 받은 점수는 0점부터 만점까지 입력할 수 있어요.`);
        return;
      }
      const subjectKey = subject.normalize("NFKC").toLowerCase();
      if (seen.has(subjectKey)) {
        setError(`'${subject}' 과목이 두 번 입력됐어요.`);
        return;
      }
      seen.add(subjectKey);
      subjects.push({ subject, score, max_score: max });
    }
    setError("");
    save.mutate(subjects);
  }

  return (
    <div className={styles.page}>
      {onPeriodChange && <SchoolReportPeriodPicker period={period} disabled={save.isPending} onChange={(next) => void changePeriod(next)} />}
      {onPeriodChange && report.data?.submitted_periods && <section className={styles.history} aria-label="내 학교 성적 누적 기록">
        <h2>내 중간·기말 기록</h2>
        {report.data.submitted_periods.length ? <div>{report.data.submitted_periods.map(term => {
          const active = term.academic_year === period.academic_year && term.semester === period.semester && term.exam_round === period.exam_round;
          return <button type="button" key={term.academic_year+"-"+term.semester+"-"+term.exam_round}
            className="stu-btn stu-btn--secondary" aria-pressed={active} disabled={save.isPending}
            onClick={() => void changePeriod(term)}>{term.academic_year}년 {schoolReportPeriodLabel(term)}</button>;
        })}</div> : <p>제출한 학교 성적이 없습니다.</p>}
      </section>}
      {report.isPending ? <p role="status" className={styles.muted}>성적표를 불러오는 중…</p>
        : report.isError ? (
          <EmptyState title="성적표를 불러오지 못했습니다" onRetry={() => void report.refetch()} />
        ) : (
          <section className={`stu-panel ${styles.panel}`} aria-labelledby="school-report-form-title">
            <header className={styles.panelHeading}>
              <h2 id="school-report-form-title">{schoolReportPeriodLabel(period)} 성적표</h2>
              <span className={styles.status} data-submitted={report.data.status === "submitted"}>
                {report.data.status === "submitted" ? "제출 완료" : "미제출"}
              </span>
            </header>
            {saved && <p className={styles.success} role="status">성적표를 제출했습니다.</p>}
            {rows ? (
              <form className={styles.form} onSubmit={submit} noValidate>
                <fieldset className={styles.fieldset} disabled={save.isPending}>
                  <legend className={styles.muted}>학교 성적표에 나온 과목명과 점수를 입력하세요.</legend>
                  {rows.map((row, index) => (
                    <div key={row.id} className={styles.row}>
                      <label className={styles.subject}>
                        과목
                        <input
                          aria-label={`과목 ${index + 1}`}
                          maxLength={50}
                          value={row.subject}
                          placeholder="예: 수학"
                          onChange={(event) => updateRow(row.id, "subject", event.target.value)}
                        />
                      </label>
                      <label>
                        받은 점수
                        <input
                          aria-label={`받은 점수 ${index + 1}`}
                          inputMode="decimal"
                          maxLength={8}
                          value={row.score}
                          onChange={(event) => updateRow(row.id, "score", event.target.value)}
                        />
                      </label>
                      <label>
                        만점
                        <input
                          aria-label={`만점 ${index + 1}`}
                          inputMode="decimal"
                          maxLength={8}
                          value={row.max}
                          onChange={(event) => updateRow(row.id, "max", event.target.value)}
                        />
                      </label>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          className={`stu-btn stu-btn--secondary ${styles.remove}`}
                          aria-label={`과목 ${index + 1} 삭제`}
                          onClick={() => {
                            setRows(rows.filter((item) => item.id !== row.id));
                            setDirty(true);
                            setError("");
                          }}
                        >삭제</button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="stu-btn stu-btn--secondary"
                    disabled={rows.length >= MAX_SUBJECTS}
                    onClick={() => {
                      setRows([...rows, emptyRow(nextId.current++)]);
                      setDirty(true);
                    }}
                  >+ 과목 추가</button>
                </fieldset>
                {error && <p className={styles.error} role="alert">{error}</p>}
                <div className={styles.actions}>
                  <button type="button" className="stu-btn stu-btn--secondary" disabled={save.isPending} onClick={() => {
                    finishEdit?.(false);
                    setRows(null);
                    setDirty(false);
                    setError("");
                  }}>취소</button>
                  <button className="stu-btn stu-btn--primary" type="submit" disabled={save.isPending}>
                    {save.isPending ? "제출 중…" : "성적표 제출"}
                  </button>
                </div>
              </form>
            ) : (
              <>
                {report.data.scores.length > 0
                  ? <SchoolReportScoreList scores={report.data.scores} />
                  : <p className={styles.muted}>학교 시험 점수를 입력해 선생님께 제출할 수 있어요.</p>}
                {!readOnly && (
                  <button type="button" className="stu-btn stu-btn--primary" onClick={startEditing}>
                    {report.data.direct_scores.length > 0 ? "입력한 점수 수정" : "점수 직접 입력"}
                  </button>
                )}
              </>
            )}
          </section>
        )}
    </div>
  );
}
