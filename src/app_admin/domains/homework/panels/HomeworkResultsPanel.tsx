import { useMemo, useState } from "react";
import { useAdminHomework } from "../hooks/useAdminHomework";
import { EmptyState, Badge, Button } from "@/shared/ui/ds";
import { fetchSessionScores, type SessionScoreHomeworkEntry } from "@/shared/api/contracts/sessionScores";
import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import StudentDetailLink from "@admin/domains/students/public/StudentDetailLink";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { useQuery } from "@tanstack/react-query";
import { getHomeworkStatus, homeworkStatusLabel, type HomeworkStatus, type HomeworkMetaStatus } from "@/shared/scoring/homeworkStatus";
import { useTenantLabels } from "@/shared/hooks/useTenantLabels";
import HomeworkQuestionLedger from "./HomeworkQuestionLedger";
import { compareKoreanText, compareNullableNumbers } from "@/shared/utils/dataOrdering";

type HomeworkResultRow = {
  enrollment_id: number;
  student_id?: number | null;
  student_name: string;
  status: HomeworkStatus;
  score: number | null;
  max_score: number | null;
  passed: boolean | null;
  clinic_required: boolean;
  is_locked: boolean;
  lock_reason?: string | null;
  // 학생 SSOT 표시용
  profile_photo_url?: string | null;
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  name_highlight_clinic_target?: boolean;
};

type HomeworkResultSort = "student_name" | "score_desc" | "score_asc" | "status";
type HomeworkResultFilter = "all" | HomeworkStatus;

const HOMEWORK_STATUS_ORDER: Record<HomeworkStatus, number> = {
  NOT_SUBMITTED: 0,
  VIDEO_MAKEUP: 1,
  UNSET: 1,
  ZERO: 2,
  SCORED: 3,
};

function statusLabel(status: HomeworkStatus, completion: boolean) {
  return completion && status === "ZERO" ? "미통과" : completion && status === "SCORED" ? "통과" : homeworkStatusLabel(status);
}

function resultValue(row: HomeworkResultRow, completion: boolean) {
  if (row.status === "NOT_SUBMITTED") return "미제출";
  if (row.score == null) return "미입력";
  return completion ? (row.score >= 1 ? "O" : "X") : `${row.score}${row.max_score != null ? ` / ${row.max_score}` : ""}`;
}

function StatusBadge({ status, completion = false }: { status: HomeworkStatus; completion?: boolean }) {
  const tone =
    status === "NOT_SUBMITTED"
      ? "danger"
      : completion && status === "ZERO" ? "danger" : status === "SCORED" || status === "ZERO"
      ? "success"
      : "neutral";
  return (
    <Badge variant="solid" tone={tone}>
      {statusLabel(status, completion)}
    </Badge>
  );
}

export default function HomeworkResultsPanel({ homeworkId }: { homeworkId: number }) {
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<number | null>(null);
  const [hasOpenedLedger, setHasOpenedLedger] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [resultFilter, setResultFilter] = useState<HomeworkResultFilter>("all");
  const [resultSort, setResultSort] = useState<HomeworkResultSort>("student_name");
  const labels = useTenantLabels();
  const homeworkQ = useAdminHomework(homeworkId);
  const { data: homework, isLoading: hwLoading } = homeworkQ;
  const completion = homework?.grading_mode === "COMPLETION";
  const sessionId = useMemo(() => Number(homework?.session_id) || 0, [homework?.session_id]);

  const scoresQ = useQuery({
    queryKey: scoresQueryKeys.sessionScores(sessionId),
    queryFn: () => fetchSessionScores(sessionId),
    enabled: Number.isFinite(sessionId) && sessionId > 0,
  });
  const { data: scoresData, isLoading: scoresLoading } = scoresQ;

  const { rows, summary } = useMemo(() => {
    if (!scoresData?.rows || !homeworkId) return { rows: [] as HomeworkResultRow[], summary: { assigned: 0, unset: 0, notSubmitted: 0, graded: 0, passCount: 0, failCount: 0, clinic: 0 } };
    const rows: HomeworkResultRow[] = [];
    let notSubmitted = 0;
    let graded = 0;
    let passCount = 0;
    let failCount = 0;
    let clinic = 0;

    for (const row of scoresData.rows) {
      const hw = row.homeworks?.find((h: SessionScoreHomeworkEntry) => h.homework_id === homeworkId);
      if (!hw) continue;

      const status = getHomeworkStatus({
        score: hw.block?.score ?? null,
        metaStatus: (hw.block?.meta?.status ?? null) as HomeworkMetaStatus,
      });
      if (status === "NOT_SUBMITTED") notSubmitted++;
      if (status === "SCORED" || status === "ZERO") graded++;
      if (hw.block?.passed === true) passCount++;
      if (hw.block?.passed === false) failCount++;
      if (hw.block?.clinic_required) clinic++;

      rows.push({
        enrollment_id: row.enrollment_id,
        student_id: row.student_id,
        student_name: row.student_name ?? "-",
        status,
        score: hw.block?.score ?? null,
        max_score: hw.block?.max_score ?? null,
        passed: hw.block?.passed ?? null,
        clinic_required: hw.block?.clinic_required ?? false,
        is_locked: hw.block?.is_locked ?? false,
        lock_reason: hw.block?.lock_reason ?? null,
        // 학생 SSOT 표시용 pass-through
        profile_photo_url: row.profile_photo_url,
        lecture_title: row.lecture_title,
        lecture_color: row.lecture_color,
        lecture_chip_label: row.lecture_chip_label,
        name_highlight_clinic_target: row.name_highlight_clinic_target,
      });
    }

    return {
      rows,
      summary: {
        assigned: rows.length,
        unset: rows.filter(row => row.status === "UNSET").length,
        notSubmitted,
        graded,
        passCount,
        failCount,
        clinic,
      },
    };
  }, [scoresData?.rows, homeworkId]);

  const visibleRows = useMemo(() => {
    const keyword = studentSearch.trim().toLocaleLowerCase("ko-KR");
    return rows
      .filter((row) => !keyword || row.student_name.toLocaleLowerCase("ko-KR").includes(keyword))
      .filter((row) => resultFilter === "all" || row.status === resultFilter)
      .sort((left, right) => {
        let compared = 0;
        if (resultSort === "score_desc") {
          compared = compareNullableNumbers(left.score, right.score, "desc");
        } else if (resultSort === "score_asc") {
          compared = compareNullableNumbers(left.score, right.score, "asc");
        } else if (resultSort === "status") {
          compared = HOMEWORK_STATUS_ORDER[left.status] - HOMEWORK_STATUS_ORDER[right.status];
        } else {
          compared = compareKoreanText(left.student_name, right.student_name);
        }
        return compared
          || compareKoreanText(left.student_name, right.student_name)
          || left.enrollment_id - right.enrollment_id;
      });
  }, [resultFilter, resultSort, rows, studentSearch]);

  const selectedRow = useMemo(
    () => (selectedEnrollmentId != null ? visibleRows.find((r) => r.enrollment_id === selectedEnrollmentId) : null),
    [visibleRows, selectedEnrollmentId],
  );

  const scoresForHistogram = useMemo(
    () =>
      rows
        .map((r) => r.score != null && r.max_score != null && r.max_score > 0 ? (r.score / r.max_score) * 100 : null)
        .filter((s): s is number => typeof s === "number" && Number.isFinite(s)),
    [rows]
  );
  const histogram = useMemo(() => {
    const BUCKETS = [
      { label: "0-20", min: 0, max: 20 },
      { label: "20초과-40", min: 20, max: 40 },
      { label: "40초과-60", min: 40, max: 60 },
      { label: "60초과-80", min: 60, max: 80 },
      { label: "80초과-100", min: 80, max: 100 },
    ];
    return BUCKETS.map((b) => ({
      ...b,
      count: scoresForHistogram.filter((s) => (b.min === 0 ? s >= 0 : s > b.min) && s <= b.max).length,
    }));
  }, [scoresForHistogram]);
  const maxHist = Math.max(1, ...histogram.map((h) => h.count));

  if (!Number.isFinite(homeworkId) || homeworkId <= 0) {
    return <EmptyState scope="panel" tone="error" title="과제 ID가 올바르지 않습니다." />;
  }

  if (hwLoading) {
    return <EmptyState scope="panel" tone="loading" title="과제 정보 불러오는 중…" />;
  }

  if (homeworkQ.isError) {
    return <EmptyState scope="panel" tone="error" title="과제를 불러오지 못했습니다." actions={<button type="button" className="ds-button" onClick={() => void homeworkQ.refetch()}>다시 시도</button>} />;
  }

  if (!homework) {
    return <EmptyState scope="panel" tone="error" title="과제를 불러오지 못했습니다." />;
  }

  if (scoresLoading) {
    return <EmptyState scope="panel" tone="loading" title="성적 불러오는 중…" />;
  }

  if (scoresQ.isError) {
    return <EmptyState scope="panel" tone="error" title="과제 성적을 불러오지 못했습니다." description="일부 학생을 누락한 채 통계를 계산하지 않았습니다." actions={<button type="button" className="ds-button" onClick={() => void scoresQ.refetch()}>다시 시도</button>} />;
  }

  const cutlineMode = homework.effective_cutline_mode;
  const cutlineValue = homework.effective_cutline_value;
  const cutlineLabel = cutlineMode === "COUNT" ? `최소 ${cutlineValue}점` : `${cutlineValue}%`;
  const hasData = summary.assigned > 0;

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-5">
        <div>
          <h2 className="text-lg font-semibold">학생별 결과</h2>
          <div className="text-xs text-[var(--color-text-muted)]">점수 입력·미제출 처리·잠금은 세션 &gt; 성적 탭에서 진행하세요.</div>
        </div>

        {hasData && (
          <p className="text-sm text-[var(--color-text-secondary)]">
            대상 {summary.assigned}명 · {completion ? "판정 입력" : "채점완료"} {summary.graded}명 · 미제출 {summary.notSubmitted}명
          </p>
        )}

        {hasData && (
          <details className="rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)]">
            <summary className="min-h-11 cursor-pointer px-5 py-3 text-sm font-semibold">과제 통계</summary>
            <div className="space-y-4 px-5 pb-5 text-sm text-[var(--color-text-secondary)]">
              <p>미입력 {summary.unset}명 · 미제출 처리 {summary.notSubmitted}명 · {completion ? "판정 입력" : "채점 입력"} {summary.graded}명</p>
              <p>{labels.pass} {summary.passCount}명 · {labels.fail} {summary.failCount}명 · 클리닉 대상 {summary.clinic}명</p>
              <p>{completion ? "판정 방식: O 통과 · X 미통과" : `커트라인: ${cutlineLabel}`}</p>
              <p className="text-xs">실제 파일 제출 여부는 제출관리에서 확인하세요.</p>
              {!completion && scoresForHistogram.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-[var(--color-text-primary)]">점수 분포 (%)</div>
                  <div className="grid grid-cols-5 items-end gap-1 rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] p-3">
                    {histogram.map((h) => (
                      <div key={h.label} className="flex min-w-0 flex-col items-center gap-1" title={`${h.label}: ${h.count}명`}>
                        <div
                          className="w-full min-h-[4px] rounded-t"
                          // eslint-disable-next-line no-restricted-syntax
                          style={{
                            height: maxHist > 0 ? `${(h.count / maxHist) * 80}px` : 0,
                            background: "var(--color-primary)",
                          }}
                        />
                        <span className="flex h-8 flex-col justify-center text-center text-[10px] leading-4 text-[var(--color-text-muted)]">
                          <span className="whitespace-nowrap">{h.min} {h.min === 0 ? "이상" : "초과"}</span>
                          <span className="whitespace-nowrap">{h.max} 이하</span>
                        </span>
                        <span className="text-xs font-medium">{h.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        )}

        {homework.source_status === "ready" && (
          <details
            className="rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)]"
            onToggle={(event) => {
              if (event.currentTarget.open) setHasOpenedLedger(true);
            }}
          >
            <summary className="min-h-11 cursor-pointer px-5 py-3 text-sm font-semibold">워크북 문항 채점표</summary>
            <div className="min-w-0 px-5 pb-5">
              {hasOpenedLedger && <HomeworkQuestionLedger homeworkId={homeworkId} />}
            </div>
          </details>
        )}

        {rows.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(180px,1fr)_150px_160px]">
            <input
              type="search"
              className="ds-input h-9 min-w-0 text-sm"
              value={studentSearch}
              onChange={(event) => setStudentSearch(event.target.value)}
              placeholder="학생 이름 검색"
              aria-label="과제 결과 학생 검색"
            />
            <select
              className="ds-input h-9 min-w-0 text-sm"
              value={resultFilter}
              onChange={(event) => setResultFilter(event.target.value as HomeworkResultFilter)}
              aria-label="과제 결과 상태 필터"
            >
              <option value="all">상태 전체</option>
              <option value="NOT_SUBMITTED">미제출</option>
              <option value="UNSET">미입력</option>
              <option value="ZERO">{completion ? "미통과 (X)" : "0점"}</option>
              <option value="SCORED">{completion ? "통과 (O)" : "채점완료"}</option>
            </select>
            <select
              className="ds-input h-9 min-w-0 text-sm"
              value={resultSort}
              onChange={(event) => setResultSort(event.target.value as HomeworkResultSort)}
              aria-label="과제 결과 정렬"
            >
              <option value="student_name">이름 가나다순</option>
              <option value="score_desc">{completion ? "O 먼저" : "점수 높은순"}</option>
              <option value="score_asc">{completion ? "X 먼저" : "점수 낮은순"}</option>
              <option value="status">상태순</option>
            </select>
          </div>
        )}

        <div className="min-w-0">
          {rows.length === 0 ? (
            <div className="rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
              이 과제에 연결된 대상자가 없거나 성적 데이터가 없습니다.
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
              검색·필터 조건에 맞는 학생이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto rounded border border-[var(--color-border-divider)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)]">
                    <th className="px-2 py-2 sm:px-3 text-left font-medium text-[var(--color-text-secondary)]">이름</th>
                    <th className="px-2 py-2 sm:px-3 text-left font-medium text-[var(--color-text-secondary)]">상태</th>
                    <th className="px-2 py-2 sm:px-3 text-center font-medium text-[var(--color-text-secondary)]">{completion ? "O/X" : "점수"}</th>
                    <th aria-label="결과 상세" className="px-2 py-2 text-center font-medium text-[var(--color-text-secondary)]" />
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r, idx) => {
                    const isEven = idx % 2 === 1;
                    return (
                      <tr
                        key={r.enrollment_id}
                        className={`border-b border-[var(--color-border-divider)]${isEven ? " bg-[var(--color-bg-surface-soft)]/40" : ""}`}
                      >
                        <td className="px-2 py-2 sm:px-3 font-medium text-[var(--color-text-primary)]">
                          <StudentDetailLink studentId={r.student_id} studentName={r.student_name}>
                            <StudentNameWithLectureChip
                              name={r.student_name}
                              lectures={r.lecture_title ? [{ lectureName: r.lecture_title, color: r.lecture_color, chipLabel: r.lecture_chip_label }] : undefined}
                              profilePhotoUrl={r.profile_photo_url}
                              avatarSize={24}
                              density="compact"
                              maxLectureChips={1}
                              clinicHighlight={r.name_highlight_clinic_target}
                            />
                          </StudentDetailLink>
                        </td>
                        <td className="px-2 py-2 sm:px-3">
                          <StatusBadge status={r.status} completion={completion} />
                        </td>
                        <td className="px-2 py-2 sm:px-3 text-center text-[var(--color-text-primary)]">
                          {resultValue(r, completion)}
                        </td>
                        <td className="px-2 py-2 sm:px-3 text-center">
                          <Button
                            type="button"
                            intent="ghost"
                            size="sm"
                            className="min-h-11 whitespace-nowrap"
                            aria-label={`${r.student_name} 결과 상세`}
                            onClick={() => setSelectedEnrollmentId(r.enrollment_id)}
                          >
                            상세
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <AdminModal open={Boolean(selectedRow)} onClose={() => setSelectedEnrollmentId(null)} type="inspect" width={MODAL_WIDTH.sm} trapFocus>
        <ModalHeader type="inspect" title={`${selectedRow?.student_name ?? ""} 과제 결과`} />
        <ModalBody>
          {selectedRow && (
            <>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">상태</dt>
                  <dd className="mt-1">
                    <StatusBadge status={selectedRow.status} completion={completion} />
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{completion ? "O/X" : "점수"}</dt>
                  <dd className="mt-1 font-medium text-[var(--color-text-primary)]">
                    {resultValue(selectedRow, completion)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">합불</dt>
                  <dd className="mt-1">
                    {selectedRow.passed == null ? (
                      <span className="text-[var(--color-text-muted)]">—</span>
                    ) : (
                      <Badge variant="solid" tone={selectedRow.passed ? "success" : "danger"}>
                        {selectedRow.passed ? labels.pass : labels.fail}
                      </Badge>
                    )}
                  </dd>
                </div>
                {selectedRow.clinic_required && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">클리닉</dt>
                    <dd className="mt-1">
                      <Badge variant="solid" tone="warning">대상</Badge>
                    </dd>
                  </div>
                )}
                {selectedRow.is_locked && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">잠금</dt>
                    <dd className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                      <span aria-hidden>🔒</span>
                      <span>{selectedRow.lock_reason || "잠금됨"}</span>
                    </dd>
                  </div>
                )}
              </dl>
              <p className="mt-5 border-t border-[var(--color-border-divider)] pt-3 text-xs text-[var(--color-text-muted)]">
                상세 입력은 세션 &gt; 성적 탭에서 진행하세요.
              </p>
            </>
          )}
        </ModalBody>
        <ModalFooter
          right={<Button type="button" intent="secondary" size="xl" onClick={() => setSelectedEnrollmentId(null)}>닫기</Button>}
        />
      </AdminModal>
    </div>
  );
}
