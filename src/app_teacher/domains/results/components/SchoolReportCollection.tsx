import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  fetchSchoolReportRoster, requestSchoolReports, schoolReportKeys,
  type SchoolReportPeriod, type SchoolReportRosterFilters, type SchoolReportStatus,
} from "@/shared/api/contracts/schoolReports";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import SchoolReportPeriodPicker from "@/shared/product/schoolReports/SchoolReportPeriodPicker";
import { currentSchoolReportPeriod, schoolReportParams, schoolReportPeriodLabel } from "@/shared/product/schoolReports/period";
import { Button, EmptyState } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { extractApiError } from "@/shared/utils/extractApiError";
import { fetchLectures } from "@teacher/domains/lectures/api";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { teacherResultsQueryKeys } from "../queryKeys";
import SchoolReportStudentPanel from "./SchoolReportStudentPanel";
import styles from "./SchoolReportCollection.module.css";

const NotificationPreviewModal = lazy(() => import("@/shared/ui/notifications/NotificationPreviewModal"));

const STATUS_FILTERS = [
  { key: "all", label: "전체" },
  { key: "missing", label: "미제출" },
  { key: "submitted", label: "제출 완료" },
] as const;
type Filter = "all" | SchoolReportStatus;

export default function SchoolReportCollection() {
  const [period, setPeriod] = useState(currentSchoolReportPeriod);
  const [search, setSearch] = useState("");
  const settledSearch = useDebouncedValue(search.trim());
  const [status, setStatus] = useState<Filter>("all");
  const [lectureId, setLectureId] = useState<number>();
  const lectures = useQuery({
    queryKey: teacherResultsQueryKeys.activeLectures,
    queryFn: () => fetchLectures(true),
  });
  const filters = { search: settledSearch, status: status === "all" ? undefined : status, lecture_id: lectureId };
  return (
    <div className={styles.page}>
      <SchoolReportPeriodPicker period={period} onChange={setPeriod} />
      <div className={styles.filters}>
        <input type="search" aria-label="학생 검색" value={search} placeholder="학생 이름 또는 학교 검색" maxLength={100}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select aria-label="강의" value={lectureId ?? ""}
          onChange={(event) => setLectureId(event.target.value ? Number(event.target.value) : undefined)}
          disabled={lectures.isPending || lectures.isError}
        >
          <option value="">전체 강의</option>
          {lectures.data?.map((lecture) => <option key={lecture.id} value={lecture.id}>{lecture.title}</option>)}
        </select>
        <div className={styles.statusFilters} role="group" aria-label="제출 상태">
          {STATUS_FILTERS.map((item) => (
            <button type="button" key={item.key} aria-pressed={status === item.key} onClick={() => setStatus(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {lectures.isError && (
        <Button intent="secondary" size="sm" onClick={() => void lectures.refetch()}>강의 목록 다시 불러오기</Button>
      )}
      <SchoolReportRoster
        key={JSON.stringify([period, filters])}
        period={period}
        filters={filters}
        searchPending={search.trim() !== settledSearch}
      />
    </div>
  );
}

function SchoolReportRoster({ period, filters, searchPending }: {
  period: SchoolReportPeriod;
  filters: Omit<SchoolReportRosterFilters, "page">;
  searchPending: boolean;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [alimtalkSelection, setAlimtalkSelection] = useState<number[]>([]);
  const [openStudent, setOpenStudent] = useState<{ id: number; name: string } | null>(null);
  const allCheckbox = useRef<HTMLInputElement>(null);
  const params = { ...filters, page };
  const roster = useQuery({
    queryKey: schoolReportKeys.roster(period, params),
    queryFn: ({ signal }) => fetchSchoolReportRoster(period, params, signal),
  });
  const reminder = useMutation({
    mutationFn: (studentIds: number[]) => requestSchoolReports(period, studentIds),
    onSuccess: ({ requested, skipped }) => {
      setSelected([]);
      teacherToast.success(
        requested > 0
          ? `${requested}명에게 앱 알림을 보냈습니다.${skipped ? ` ${skipped}명은 건너뛰었습니다.` : ""}`
          : "현재 요청할 수 있는 학생이 없습니다.",
      );
      void qc.invalidateQueries({ queryKey: schoolReportKeys.all });
    },
    onError: (failure) => teacherToast.error(extractApiError(failure, "제출 요청에 실패했습니다. 다시 시도해 주세요.")),
  });

  const students = roster.data?.results ?? [];
  const eligibleIds = students.filter((student) => student.can_request || student.can_request_alimtalk).map((student) => student.student_id);
  const selectedIds = selected.filter((id) => eligibleIds.includes(id));
  const appIds = students.filter((student) => student.can_request && selectedIds.includes(student.student_id)).map((student) => student.student_id);
  const alimtalkIds = students.filter((student) => student.can_request_alimtalk && selectedIds.includes(student.student_id)).map((student) => student.student_id);
  const allSelected = eligibleIds.length > 0 && selectedIds.length === eligibleIds.length;
  const busy = confirming || reminder.isPending || searchPending || alimtalkSelection.length > 0;
  const partiallySelected = selectedIds.length > 0 && !allSelected;
  useLayoutEffect(() => {
    if (allCheckbox.current) allCheckbox.current.indeterminate = partiallySelected;
  }, [partiallySelected, roster.isPending]);

  async function confirmRequest() {
    if (busy || appIds.length === 0) return;
    setConfirming(true);
    try {
      if (await confirm({
        title: "성적표 제출 요청",
        message: `${period.academic_year}학년도 ${schoolReportPeriodLabel(period)} 성적표가 미제출된 학생 ${appIds.length}명에게 학생 앱 알림을 보낼까요?`,
        confirmText: "앱 알림 보내기",
      })) reminder.mutate(appIds);
    } finally {
      setConfirming(false);
    }
  }

  if (roster.isPending) return <p role="status" className={styles.muted}>제출 현황을 불러오는 중…</p>;
  if (roster.isError) {
    return <EmptyState scope="panel" tone="error" title="제출 현황을 불러오지 못했습니다"
      actions={<Button intent="secondary" onClick={() => void roster.refetch()}>다시 시도</Button>}
    />;
  }

  const data = roster.data;
  return (
    <>
      <dl className={styles.summary} aria-label="제출 현황">
        <div><dt>대상 학생</dt><dd>{data.total_count}명</dd></div>
        <div><dt>제출 완료</dt><dd>{data.submitted_count}명</dd></div>
        <div><dt>미제출</dt><dd>{data.missing_count}명</dd></div>
      </dl>
      {data.results.length === 0 ? (
        <EmptyState scope="panel" tone="empty" title={data.total_count === 0 ? "등록된 학생이 없습니다" : "조건에 맞는 학생이 없습니다"} />
      ) : (
        <section className={styles.list} aria-label="학생별 제출 현황">
          <header className={styles.listToolbar}>
            <div className={styles.selection}>
              <label>
                <input ref={allCheckbox} type="checkbox" checked={allSelected}
                  disabled={busy || eligibleIds.length === 0}
                  onChange={() => setSelected(allSelected ? [] : eligibleIds)}
                />
                이 페이지 선택
              </label>
              <span className={styles.muted} aria-live="polite">{selectedIds.length}명 선택</span>
            </div>
            <div className={styles.requestAction}>
              <Button disabled={busy || appIds.length === 0} onClick={() => void confirmRequest()}>
                {reminder.isPending ? "요청 중…" : "앱으로 제출 요청"}
              </Button>
              {data.alimtalk_available ? (
                <Button intent="secondary" disabled={busy || alimtalkIds.length === 0}
                  onClick={() => setAlimtalkSelection(alimtalkIds)}
                >알림톡 미리보기</Button>
              ) : (
                <small className={styles.muted}>알림톡은 제출 요청 템플릿 승인 및 연결 후 사용할 수 있습니다.</small>
              )}
            </div>
          </header>
          <ul className={styles.roster}>
            {data.results.map((student) => (
              <li key={student.student_id} className={styles.student}>
                {student.can_request || student.can_request_alimtalk ? (
                  <input type="checkbox" aria-label={`${student.name} 선택`}
                    disabled={busy}
                    checked={selectedIds.includes(student.student_id)}
                    onChange={() => setSelected((previous) => previous.includes(student.student_id)
                      ? previous.filter((id) => id !== student.student_id)
                      : [...previous, student.student_id])}
                  />
                ) : <span aria-hidden="true" />}
                <div className={styles.identity}>
                  <button type="button" className={styles.studentName}
                    onClick={() => setOpenStudent({ id: student.student_id, name: student.name })}
                  >{student.name}<span className={styles.srOnly}> 성적표 보기</span></button>
                  <small>{[student.school, student.grade ? `${student.grade}학년` : null].filter(Boolean).join(" · ")}</small>
                </div>
                <span data-submitted={student.status === "submitted"} className={styles.badge}>
                  {student.status === "submitted" ? `제출 · ${student.score_count}과목` : student.requested_at ? "요청함" : "미제출"}
                </span>
                {student.status === "missing" && !student.can_request && !student.can_request_alimtalk && !student.requested_at && (
                  <small className={styles.account}>학생 계정 필요</small>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {(data.previous || data.next) && (
        <nav className={styles.pages} aria-label="학생 목록 페이지">
          <Button intent="secondary" size="sm" disabled={!data.previous || busy} onClick={() => {
            setSelected([]);
            setPage(page - 1);
          }}>이전</Button>
          <span>{page}페이지 · {data.count}명</span>
          <Button intent="secondary" size="sm" disabled={!data.next || busy} onClick={() => {
            setSelected([]);
            setPage(page + 1);
          }}>다음</Button>
        </nav>
      )}
      <BottomSheet open={openStudent != null} onClose={() => setOpenStudent(null)} title={openStudent?.name ?? "학생 성적표"}>
        {openStudent && (
          <div className={styles.sheet}>
            <SchoolReportStudentPanel studentId={openStudent.id} period={period} />
            <Link to={`/workspace/mobile/students/${openStudent.id}?${new URLSearchParams({ tab: "school-report", ...schoolReportParams(period) })}`}>
              학생 상세에서 보기
            </Link>
          </div>
        )}
      </BottomSheet>
      {alimtalkSelection.length > 0 && (
        <Suspense fallback={<p role="status">알림톡 미리보기를 여는 중…</p>}>
          <NotificationPreviewModal
            mode="manual"
            open
            label="학교 성적표 제출 요청"
            trigger="school_report_request"
            sendTo="student"
            contextSource={{ type: "school_report_request", ...period, student_ids: alimtalkSelection }}
            onClose={() => setAlimtalkSelection([])}
            onConfirmed={() => {
              setSelected([]);
              void qc.invalidateQueries({ queryKey: schoolReportKeys.all });
            }}
          />
        </Suspense>
      )}
    </>
  );
}
