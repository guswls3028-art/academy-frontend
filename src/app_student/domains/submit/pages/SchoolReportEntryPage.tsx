import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useSearchParams } from "react-router";
import useAuth from "@/auth/hooks/useAuth";
import {
  fetchOwnSchoolReport, saveOwnSchoolReport, schoolReportKeys,
  type SchoolReportPeriod, type SchoolReportSubject,
} from "@/shared/api/contracts/schoolReports";
import { isStudentSupportWindow } from "@/shared/auth/supportPreviewSession";
import SchoolReportPeriodPicker from "@/shared/product/schoolReports/SchoolReportPeriodPicker";
import { currentSchoolReportPeriod, parseSchoolReportPeriod, schoolReportParams, schoolReportPeriodLabel } from "@/shared/product/schoolReports/period";
import SchoolReportScoreList from "@/shared/product/schoolReports/SchoolReportScoreList";
import { useConfirm } from "@/shared/ui/confirm";
import { extractApiError } from "@/shared/utils/extractApiError";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import EmptyState from "@student/layout/EmptyState";
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
  if (user?.tenantRole === "parent") return <Navigate to="/student/submit" replace />;
  return (
    <StudentPageShell
      title="학교 성적표 제출"
      actions={<Link className="stu-btn stu-btn--secondary" to="/student/submit/score">파일로 제출</Link>}
    >
      <SchoolReportEntry
        key={`${period.academic_year}-${period.semester}-${period.exam_round}`}
        period={period}
        onPeriodChange={(next) => setSearchParams(schoolReportParams(next), { replace: true })}
      />
    </StudentPageShell>
  );
}

function SchoolReportEntry({ period, onPeriodChange }: {
  period: SchoolReportPeriod;
  onPeriodChange: (period: SchoolReportPeriod) => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const readOnly = isStudentSupportWindow();
  const nextId = useRef(1);
  const [rows, setRows] = useState<DraftRow[] | null>(null);
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
    onPeriodChange(next);
  }

  function startEditing() {
    const currentRows = report.data?.direct_scores.map((item) => ({
      id: nextId.current++,
      subject: item.subject,
      score: String(item.score),
      max: String(item.max_score),
    })) ?? [];
    setRows(currentRows.length ? currentRows : [emptyRow(nextId.current++)]);
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
      <SchoolReportPeriodPicker period={period} disabled={save.isPending} onChange={(next) => void changePeriod(next)} />
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
