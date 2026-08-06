import { useEffect, useState } from "react";
import { Link } from "react-router";

import { fetchLandingPublic } from "../api";
import {
  fetchProblemReviewShowcaseList,
  type ProblemReviewShowcaseCard,
} from "../api/problemReviewShowcase";
import type { LandingPublicResponse } from "../types";
import { formatLandingYmdDateOrRaw as formatDate } from "../utils/dateFormat";
import {
  MatchupCenterSpin,
  MatchupCenterState,
  MatchupLandingShell,
} from "./LandingMatchupBoardShell";
import baseStyles from "./LandingProblemAnalysis.module.css";
import accentStyles from "./LandingProblemAnalysisListAccent.module.css";

const styles = { ...baseStyles, ...accentStyles };

export default function LandingProblemAnalysisPage() {
  const [config, setConfig] = useState<LandingPublicResponse | null>(null);
  const [items, setItems] = useState<ProblemReviewShowcaseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([fetchLandingPublic(), fetchProblemReviewShowcaseList({ skipAuth: true })])
      .then(([landing, reports]) => {
        if (!active) return;
        setConfig(landing);
        setItems(reports.results);
      })
      .catch(() => {
        if (active) setError("시험 분석 자료를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  if (loading) return <MatchupCenterSpin label="시험 분석 노트를 불러오는 중..." />;
  if (!config?.config) {
    return (
      <MatchupCenterState>
        <h1>시험 분석 자료를 불러오지 못했습니다</h1>
        <p>{error || "잠시 후 다시 확인해 주세요."}</p>
        <Link to="/landing">홈으로 이동</Link>
      </MatchupCenterState>
    );
  }

  return (
    <MatchupLandingShell cfg={config.config}>
      <header className={styles.listHero}>
        <div>
          <span className={styles.kicker}>박철T 시험 분석 노트</span>
          <h1>점수보다 먼저,<br />무너진 이유를 찾습니다</h1>
          <p>
            시험지를 문항별 근거로 다시 읽고, 점수가 갈린 구조와 학생이 멈춘 지점을 다음 수업의 처방으로 연결합니다.
          </p>
        </div>
        <div className={styles.methodNote}>
          <strong>분석 기준</strong>
          <span>출제 축 · 단원 분포 · 난도 · 핵심 문항 · 다음 학습</span>
        </div>
      </header>

      <main className={styles.listContent}>
        <div className={styles.listBar}>
          <div><strong>공개 분석</strong><span>{items.length}건</span></div>
          <Link to="/landing/matchup-board">시험 전 대비 자료도 보기</Link>
        </div>
        {error ? <div className={styles.notice} role="alert">{error}</div> : null}
        {!error && items.length === 0 ? (
          <div className={styles.notice}>첫 시험 분석 공개본을 준비하고 있습니다.</div>
        ) : (
          <div className={styles.analysisGrid}>
            {items.map((item, index) => <AnalysisCard item={item} index={index} key={item.id} />)}
          </div>
        )}
      </main>
    </MatchupLandingShell>
  );
}

function AnalysisCard({ item, index }: { item: ProblemReviewShowcaseCard; index: number }) {
  const distributions = item.difficulty?.distribution || [];
  const difficultyCount = distributions.reduce((sum, entry) => sum + entry.question_numbers.length, 0) || 1;
  return (
    <Link className={styles.analysisCard} to={`/landing/analysis/${item.id}`}>
      <div className={styles.cardIndex}>{String(index + 1).padStart(2, "0")}</div>
      <div className={styles.paperPreview} aria-hidden="true">
        <span>EVIDENCE REPORT</span>
        <strong>{item.metadata.school || "학교별 시험"}</strong>
        <small>{item.metadata.exam_name || item.metadata.subject || "문제 분석"}</small>
        <div className={styles.cardScoreMap}>
          <b>난도 지도</b>
          <div>
            {distributions.map((entry) => (
              /* eslint-disable-next-line no-restricted-syntax -- 공개 분석의 난도별 문항 비중을 미니맵 폭으로 반영한다. */
              <i data-level={entry.label} key={entry.label} style={{ flexGrow: entry.question_numbers.length / difficultyCount }} />
            ))}
          </div>
          <small>{distributions.map((entry) => `${entry.label} ${entry.question_numbers.length}`).join(" · ")}</small>
        </div>
      </div>
      <div className={styles.cardCopy}>
        <div className={styles.cardMeta}>
          <span>{formatDate(item.published_at)}</span>
          <span>조회 {item.view_count}</span>
        </div>
        <h2>{item.title}</h2>
        <p>{item.description || "문항별 출제 포인트와 다음 학습 방향을 정리했습니다."}</p>
        <div className={styles.metricRow}>
          <span><b>{item.summary.total_questions || "-"}</b>문항</span>
          {item.summary.total_points ? <span><b>{item.summary.total_points}</b>총점</span> : null}
          {distributions.slice(0, 3).map((entry) => (
            <span className={styles.difficultyChip} key={entry.label}>{entry.label}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}
