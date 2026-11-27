// 강의 > 순위 · 명예의 전당
// 여러 차시(주차)를 묶은 종합/시험/과제 순위와 상위 N명 게시용 출력.
import { Fragment, startTransition, useMemo, useOptimistic, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { useQueries, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { ChevronDown, Trophy } from "lucide-react";
import api from "@/shared/api/axios";
import { fetchSessionScores, type SessionScoresResponse } from "@/shared/api/contracts/sessionScores";
import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";
import { Badge, Button, EmptyState, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { formatSessionBlockLabel } from "@/shared/ui/session-block";
import { fetchSessions, sortSessionsByDisplayOrder, type Session } from "../../api/sessions";
import { adminLectureQueryKeys } from "../../queryKeys";
import HallOfFamePrintModal from "./HallOfFamePrintModal";
import RankingExamFilter, { type ExamGroup } from "./RankingExamFilter";
import { rankingCohorts } from "./rankingCohorts";
import {
  buildPeriodRanking,
  formatRankingScore,
  RANKING_SCOPE_LABEL,
  type RankingScope,
} from "./periodRanking";
import styles from "./LectureRankingsPage.module.css";

const MAX_SESSIONS = 20;
const SCOPES: RankingScope[] = ["all", "exam", "homework"];

function parseScope(value: string | null): RankingScope {
  return value === "exam" || value === "homework" ? value : "all";
}

function defaultSessionIndex(sessions: Session[]): number {
  const today = new Date().toISOString().slice(0, 10);
  let index = sessions.length - 1;
  for (let i = sessions.length - 1; i >= 0; i -= 1) {
    const date = sessions[i].date ? String(sessions[i].date).slice(0, 10) : null;
    if (!date || date <= today) {
      index = i;
      break;
    }
  }
  return Math.max(0, index);
}

// 모듈 수준 함수로 두어 TanStack이 결과를 메모하도록 한다.
function combineSessionScores(results: UseQueryResult<SessionScoresResponse>[]) {
  return {
    responses: results.flatMap((result) => (result.data ? [result.data] : [])),
    loadedCount: results.filter((result) => result.data).length,
    failed: results.some((result) => result.isError),
    retryFailed: () => results.forEach((result) => { if (result.isError) void result.refetch(); }),
  };
}

export default function LectureRankingsPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const lectureIdNum = Number(lectureId);
  const [searchParams, setSearchParams] = useSearchParams();
  const [examParam, setOptimisticExams] = useOptimistic(searchParams.get("exams"));
  const [printOpen, setPrintOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const lectureQ = useQuery({
    queryKey: adminLectureQueryKeys.lecture(Number.isFinite(lectureIdNum) ? lectureIdNum : null),
    queryFn: async () => (await api.get(`/lectures/lectures/${lectureIdNum}/`)).data,
    enabled: Number.isFinite(lectureIdNum),
  });
  const sessionsQ = useQuery<Session[]>({
    queryKey: adminLectureQueryKeys.lectureSessionsForLecture(lectureIdNum),
    queryFn: () => fetchSessions(lectureIdNum),
    enabled: Number.isFinite(lectureIdNum),
  });
  const sessions = useMemo(() => sortSessionsByDisplayOrder(sessionsQ.data ?? []), [sessionsQ.data]);

  const scope = parseScope(searchParams.get("scope"));
  const fallbackIndex = defaultSessionIndex(sessions);
  const indexOf = (raw: string | null) => {
    const id = Number(raw);
    const found = Number.isFinite(id) ? sessions.findIndex((session) => session.id === id) : -1;
    return found >= 0 ? found : fallbackIndex;
  };
  const rawFrom = indexOf(searchParams.get("from"));
  const rawTo = indexOf(searchParams.get("to"));
  const fromIndex = Math.min(rawFrom, rawTo);
  const toIndex = Math.max(rawFrom, rawTo);
  const selectedSessions = useMemo(() => sessions.slice(fromIndex, toIndex + 1), [sessions, fromIndex, toIndex]);
  const tooMany = selectedSessions.length > MAX_SESSIONS;
  const cohortKey = searchParams.get("class") || "";
  const cohorts = useMemo(() => rankingCohorts(selectedSessions), [selectedSessions]);
  const cohort = cohorts.get(cohortKey);
  const scopedSessions = useMemo(() => cohortKey
    ? selectedSessions.filter((session) => cohort?.sessions.has(session.id))
    : selectedSessions, [selectedSessions, cohort, cohortKey]);

  const updateParams = (patch: Record<string, string | null>) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(patch)) {
        if (value == null) next.delete(key);
        else next.set(key, value);
      }
      return next;
    }, { replace: true });
  };

  const scores = useQueries({
    queries: (tooMany ? [] : scopedSessions).map((session) => ({
      queryKey: scoresQueryKeys.sessionScoresScope(session.id, cohort?.sessions.get(session.id)),
      queryFn: () => fetchSessionScores(session.id, cohort?.sessions.get(session.id)),
      staleTime: 30_000,
    })),
    combine: combineSessionScores,
  });
  const { responses, loadedCount, failed } = scores;
  const loading = !tooMany && loadedCount < scopedSessions.length && !failed;
  const rawExams = scope === "exam" ? examParam : null;
  const updateExams = (keys: ReadonlySet<string> | null) => {
    const value = keys === null ? null : [...keys].join(",");
    startTransition(() => {
      setOptimisticExams(value);
      updateParams({ exams: value });
    });
  };
  const groups = useMemo<ExamGroup[]>(() => {
    if (scope !== "exam" || loading || failed || tooMany) return [];
    return scopedSessions.map((session, index) => {
      const meta = responses[index].meta;
      const configured = meta.total_config && new Set(meta.total_config.exam_ids);
      return {
        sessionId: session.id,
        label: formatSessionBlockLabel(session),
        exams: meta.exams.map((exam) => ({
          id: exam.exam_id, key: `${session.id}.${exam.exam_id}`, title: exam.title || "제목 없는 시험",
          included: configured?.has(exam.exam_id) ?? true,
        })),
      };
    });
  }, [scope, loading, failed, tooMany, scopedSessions, responses]);
  const selection = useMemo(() => {
    const requested = rawExams === null ? null : new Set(rawExams.split(","));
    const chosen = groups.map((group) => group.exams.filter((exam) => requested ? requested.has(exam.key) : exam.included));
    const checked = new Set(chosen.flat().map((exam) => exam.key));
    const names = [...new Set(chosen.flat().map((exam) => exam.title))];
    return { checked, examIds: chosen.map((exams) => new Set(exams.map((exam) => exam.id))), names };
  }, [rawExams, groups]);
  const custom = rawExams !== null;
  const noSelection = custom && selection.checked.size === 0;
  const missingScores = custom && responses.some((response, index) =>
    response.rows.some((row) => row.exams.some((exam) =>
      selection.examIds[index]?.has(exam.exam_id) && exam.ranking_score === undefined)));
  const scopeLabel = custom
    ? [`선택 시험 ${selection.checked.size}개`, selection.names.length > 2
      ? `${selection.names.slice(0, 2).join(", ")} 외 ${selection.names.length - 2}종`
      : selection.names.join(", ")].filter(Boolean).join(" · ")
    : RANKING_SCOPE_LABEL[scope];
  const ranking = useMemo(
    () => (loading || failed || tooMany || noSelection || missingScores
      ? [] : buildPeriodRanking(responses, scope, custom ? selection.examIds : undefined)),
    [responses, scope, loading, failed, tooMany, noSelection, missingScores, custom, selection],
  );
  const rankedCount = ranking.filter((entry) => entry.rank != null).length;
  const breakdown = useMemo(() => {
    if (detailId == null || !ranking.some((entry) => entry.enrollmentId === detailId)) return [];
    return responses.flatMap((response, index) => {
      const row = response.rows.find((item) => item.enrollment_id === detailId);
      if (!row) return [];
      const [total] = buildPeriodRanking([{ meta: response.meta, rows: [row] }], scope,
        custom ? [selection.examIds[index]] : undefined);
      return total ? [{ session: scopedSessions[index], total }] : [];
    });
  }, [detailId, ranking, responses, scope, scopedSessions, custom, selection]);

  const periodLabel = selectedSessions.length === 0
    ? ""
    : selectedSessions.length === 1
      ? formatSessionBlockLabel(selectedSessions[0])
      : `${formatSessionBlockLabel(selectedSessions[0])} ~ ${formatSessionBlockLabel(selectedSessions[selectedSessions.length - 1])}`;
  const lectureTitle = String(lectureQ.data?.title ?? "");
  const displayScope = [cohort?.label, scopeLabel].filter(Boolean).join(" · ");

  if (sessionsQ.isLoading) {
    return <EmptyState scope="panel" tone="loading" title="차시를 불러오는 중…" />;
  }
  if (sessionsQ.isError) {
    return (
      <EmptyState
        scope="panel"
        tone="error"
        title="차시 목록을 불러오지 못했습니다"
        actions={<Button intent="secondary" onClick={() => void sessionsQ.refetch()}>다시 시도</Button>}
      />
    );
  }
  if (sessions.length === 0) {
    return <EmptyState scope="panel" title="차시가 없습니다" description="차시를 만들고 성적을 입력하면 순위를 볼 수 있습니다." />;
  }

  return (
    <section className={styles.page} aria-labelledby="lecture-rankings-title">
      <div className={styles.heading}>
        <h2 id="lecture-rankings-title" className={styles.title}>순위 · 명예의 전당</h2>
        <Button
          intent="primary"
          size="sm"
          onClick={() => setPrintOpen(true)}
          disabled={loading || failed || tooMany || rankedCount === 0}
          leftIcon={<Trophy size={ICON_FOR_BUTTON.sm} aria-hidden />}
        >
          명예의 전당 출력
        </Button>
      </div>

      <div className={styles.workspace}>
        <aside className={styles.filterPanel} aria-label="순위 조건">
          <h3 className={styles.panelTitle}>순위 조건</h3>
          <div className={styles.controls}>
            <label className={styles.field}>
              <span>시작 차시</span>
              <select
                value={selectedSessions[0]?.id ?? ""}
                onChange={(event) => updateParams({ from: event.target.value, to: String(sessions[toIndex]?.id ?? event.target.value) })}
              >
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>{formatSessionBlockLabel(session)}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>끝 차시</span>
              <select
                value={selectedSessions[selectedSessions.length - 1]?.id ?? ""}
                onChange={(event) => updateParams({ from: String(sessions[fromIndex]?.id ?? event.target.value), to: event.target.value })}
              >
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>{formatSessionBlockLabel(session)}</option>
                ))}
              </select>
            </label>
            {(cohorts.size > 0 || cohortKey) && (
              <label className={styles.field}>
                <span>수업반</span>
                <select value={cohortKey} onChange={(event) => updateParams({ class: event.target.value || null })}>
                  <option value="">전체 반</option>
                  {cohortKey && !cohort && <option value={cohortKey}>기간에 없는 반</option>}
                  {[...cohorts].map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                </select>
              </label>
            )}
            <div className={styles.field}>
              <span>기준</span>
              <div className={styles.segment} role="group" aria-label="순위 기준">
                {SCOPES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={styles.segmentButton}
                    aria-pressed={scope === value}
                    onClick={() => updateParams({ scope: value })}
                  >
                    {RANKING_SCOPE_LABEL[value]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {scope === "exam" && scopedSessions.length > 0 && !tooMany && !failed && !loading && (
            <RankingExamFilter groups={groups} checked={selection.checked} custom={custom} onChange={updateExams} />
          )}
        </aside>
        <div className={styles.results} aria-label="순위 결과">
          {tooMany ? (
            <EmptyState
              scope="panel"
              title={`한 번에 최대 ${MAX_SESSIONS}개 차시까지 묶을 수 있습니다`}
              description="시작·끝 차시를 좁혀 주세요."
            />
          ) : cohortKey && !cohort ? (
            <EmptyState scope="panel" title="이 기간에 선택한 반의 수업이 없습니다"
              actions={<Button intent="secondary" onClick={() => updateParams({ class: null })}>전체 반 보기</Button>} />
          ) : failed ? (
            <EmptyState
              scope="panel"
              tone="error"
              title="일부 차시 성적을 불러오지 못했습니다"
              actions={(
                <Button
                  intent="secondary"
                  onClick={scores.retryFailed}
                >
                  다시 시도
                </Button>
              )}
            />
          ) : loading ? (
            <EmptyState
              scope="panel"
              tone="loading"
              title={`성적을 불러오는 중… (${loadedCount}/${scopedSessions.length}차시)`}
            />
          ) : noSelection ? (
            <EmptyState scope="panel" title="선택한 시험이 없습니다"
              description="시험 직접 선택에서 이 기간에 반영할 시험을 체크하세요."
              actions={<Button intent="secondary" onClick={() => updateExams(null)}>차시 기본값 복원</Button>} />
          ) : missingScores ? (
            <EmptyState scope="panel" tone="error" title="선택한 시험의 확정 점수를 불러오지 못했습니다"
              actions={<Button intent="secondary" onClick={() => void Promise.all(scopedSessions.map((session) =>
                queryClient.invalidateQueries({ queryKey: scoresQueryKeys.sessionScoresScope(session.id, cohort?.sessions.get(session.id)), exact: true })))}>다시 시도</Button>} />
          ) : rankedCount === 0 ? (
            <EmptyState
              scope="panel"
              title="확정된 점수가 없습니다"
              description={custom ? "선택한 시험에 확정 점수가 생기면 순위가 표시됩니다." : `${periodLabel} ${RANKING_SCOPE_LABEL[scope]} 점수가 확정되면 순위가 표시됩니다. 차시 성적의 합산 설정에 포함된 평가만 반영됩니다.`}
            />
          ) : (
            <div className={styles.tableWrap}>
              <div className={styles.summary} aria-live="polite">
                <strong>학생 순위 <span>{rankedCount}명</span></strong>
                <span>{periodLabel} · {displayScope}</span>
              </div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">등수</th>
                    <th scope="col">학생</th>
                    <th scope="col" className={styles.numeric}>합산 점수</th>
                    <th scope="col" className={styles.numeric}>반영 평가</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((entry) => (
                    <Fragment key={entry.enrollmentId}>
                      <tr data-top={entry.rank != null && entry.rank <= 3 ? entry.rank : undefined}>
                        <td className={styles.rankCell}>
                          {entry.rank != null ? `${entry.tied ? "공동 " : ""}${entry.rank}등` : "-"}
                        </td>
                        <td className={styles.nameCell}>
                          <button className={styles.studentDetailButton} type="button"
                            aria-label={`${entry.studentName} 점수 상세`}
                            aria-expanded={detailId === entry.enrollmentId}
                            onClick={() => setDetailId(detailId === entry.enrollmentId ? null : entry.enrollmentId)}>
                            {entry.studentName}<ChevronDown size={ICON.sm} aria-hidden />
                          </button>
                          {entry.lectureChipLabel && (
                            <Badge tone="neutral" size="xs" variant="soft">{entry.lectureChipLabel}</Badge>
                          )}
                        </td>
                        <td className={styles.numeric}>
                          <strong>{entry.scoredCount ? formatRankingScore(entry.score) : "—"}</strong>
                          <span className={styles.muted}> / {formatRankingScore(entry.maxScore)}</span>
                        </td>
                        <td className={styles.numeric}>
                          {entry.scoredCount}/{entry.selectedCount}
                          {entry.scoredCount < entry.selectedCount && (
                            <span className={styles.muted}> (미반영 {entry.selectedCount - entry.scoredCount})</span>
                          )}
                        </td>
                      </tr>
                      {detailId === entry.enrollmentId && (
                        <tr className={styles.detailRow}>
                          <td colSpan={4}>
                            <dl className={styles.breakdown} aria-label={`${entry.studentName} 차시별 점수`}>
                              {breakdown.map(({ session, total }) => (
                                <div key={session.id}>
                                  <dt>{formatSessionBlockLabel(session)}</dt>
                                  <dd>
                                    <strong>{total.scoredCount ? `${formatRankingScore(total.score)} / ${formatRankingScore(total.maxScore)}점` : "확정 점수 없음"}</strong>
                                    <small>반영 {total.scoredCount}/{total.selectedCount}</small>
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <HallOfFamePrintModal
        open={printOpen && rankedCount > 0}
        onClose={() => setPrintOpen(false)}
        entries={ranking}
        lectureTitle={lectureTitle}
        periodLabel={periodLabel}
        scopeLabel={displayScope}
      />
    </section>
  );
}
