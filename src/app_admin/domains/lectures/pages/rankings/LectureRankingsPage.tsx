// 강의 > 순위 · 명예의 전당
// 여러 차시(주차)를 묶은 종합/시험/과제 순위와 상위 N명 게시용 출력.
import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { useQueries, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import api from "@/shared/api/axios";
import { fetchSessionScores, type SessionScoresResponse } from "@/shared/api/contracts/sessionScores";
import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";
import { Badge, Button, EmptyState, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { formatSessionBlockLabel } from "@/shared/ui/session-block";
import { fetchSessions, sortSessionsByDisplayOrder, type Session } from "../../api/sessions";
import { adminLectureQueryKeys } from "../../queryKeys";
import HallOfFamePrintModal from "./HallOfFamePrintModal";
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
  const [printOpen, setPrintOpen] = useState(false);

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
  const selectedSessions = sessions.slice(fromIndex, toIndex + 1);
  const tooMany = selectedSessions.length > MAX_SESSIONS;

  const updateParams = (patch: Record<string, string>) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(patch)) next.set(key, value);
      return next;
    }, { replace: true });
  };

  const scores = useQueries({
    queries: (tooMany ? [] : selectedSessions).map((session) => ({
      queryKey: scoresQueryKeys.sessionScores(session.id),
      queryFn: () => fetchSessionScores(session.id),
      staleTime: 30_000,
    })),
    combine: combineSessionScores,
  });
  const { responses, loadedCount, failed } = scores;
  const loading = !tooMany && selectedSessions.length > 0 && loadedCount < selectedSessions.length && !failed;
  const ranking = useMemo(
    () => (loading || failed || tooMany ? [] : buildPeriodRanking(responses, scope)),
    [responses, scope, loading, failed, tooMany],
  );
  const rankedCount = ranking.filter((entry) => entry.rank != null).length;

  const periodLabel = selectedSessions.length === 0
    ? ""
    : selectedSessions.length === 1
      ? formatSessionBlockLabel(selectedSessions[0])
      : `${formatSessionBlockLabel(selectedSessions[0])} ~ ${formatSessionBlockLabel(selectedSessions[selectedSessions.length - 1])}`;
  const lectureTitle = String(lectureQ.data?.title ?? "");

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
        <div>
          <h2 id="lecture-rankings-title" className={styles.title}>순위 · 명예의 전당</h2>
          <p className={styles.description}>
            차시를 묶어 종합·시험·과제 순위를 확인하고 상위 학생을 게시용으로 출력합니다.
            점수가 확정된 평가만 합산하며, 미응시·채점 대기는 0점으로 세지 않습니다.
          </p>
        </div>
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

      <div className={styles.controls}>
        <label className={styles.field}>
          <span>시작 차시</span>
          <select
            value={selectedSessions[0]?.id ?? ""}
            onChange={(event) => updateParams({ from: event.target.value, to: String(sessions[toIndex]?.id ?? event.target.value) })}
          >
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>{formatSessionBlockLabel(session)}{session.title ? ` · ${session.title}` : ""}</option>
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
              <option key={session.id} value={session.id}>{formatSessionBlockLabel(session)}{session.title ? ` · ${session.title}` : ""}</option>
            ))}
          </select>
        </label>
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

      {tooMany ? (
        <EmptyState
          scope="panel"
          title={`한 번에 최대 ${MAX_SESSIONS}개 차시까지 묶을 수 있습니다`}
          description="시작·끝 차시를 좁혀 주세요."
        />
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
          title={`성적을 불러오는 중… (${loadedCount}/${selectedSessions.length}차시)`}
        />
      ) : rankedCount === 0 ? (
        <EmptyState
          scope="panel"
          title="확정된 점수가 없습니다"
          description={`${periodLabel} ${RANKING_SCOPE_LABEL[scope]} 점수가 확정되면 순위가 표시됩니다. 차시 성적의 합산 설정에 포함된 평가만 반영됩니다.`}
        />
      ) : (
        <div className={styles.tableWrap}>
          <p className={styles.summary}>
            {periodLabel} · {RANKING_SCOPE_LABEL[scope]} · {rankedCount}명
          </p>
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
                <tr key={entry.enrollmentId} data-top={entry.rank != null && entry.rank <= 3 ? entry.rank : undefined}>
                  <td className={styles.rankCell}>
                    {entry.rank != null ? `${entry.rank}등` : "-"}
                  </td>
                  <td className={styles.nameCell}>
                    <span>{entry.studentName}</span>
                    {entry.lectureChipLabel && (
                      <Badge tone="neutral" size="xs" variant="soft">{entry.lectureChipLabel}</Badge>
                    )}
                  </td>
                  <td className={styles.numeric}>
                    <strong>{formatRankingScore(entry.score)}</strong>
                    <span className={styles.muted}> / {formatRankingScore(entry.maxScore)}</span>
                  </td>
                  <td className={styles.numeric}>
                    {entry.scoredCount}/{entry.selectedCount}
                    {entry.scoredCount < entry.selectedCount && (
                      <span className={styles.muted}> (미반영 {entry.selectedCount - entry.scoredCount})</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <HallOfFamePrintModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        entries={ranking}
        lectureTitle={lectureTitle}
        periodLabel={periodLabel}
        scopeLabel={RANKING_SCOPE_LABEL[scope]}
      />
    </section>
  );
}
