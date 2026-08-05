import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import { fetchLandingPublic } from "../api";
import {
  fetchProblemReviewShowcaseDetail,
  type ProblemReviewShowcaseCard,
} from "../api/problemReviewShowcase";
import type { LandingPublicResponse } from "../types";
import { resolvePublicReportUrl } from "../utils/publicReportUrl";
import { setLandingMeta as setMeta } from "../utils/seoMeta";
import {
  MatchupCenterSpin,
  MatchupCenterState,
  MatchupLandingShell,
} from "./LandingMatchupBoardShell";
import styles from "./LandingProblemAnalysis.module.css";

export default function LandingProblemAnalysisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [config, setConfig] = useState<LandingPublicResponse | null>(null);
  const [report, setReport] = useState<ProblemReviewShowcaseCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const numericId = Number(id);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      setError("잘못된 시험 분석 번호입니다.");
      setLoading(false);
      return () => { active = false; };
    }
    Promise.all([fetchLandingPublic(), fetchProblemReviewShowcaseDetail(numericId, { skipAuth: true })])
      .then(([landing, detail]) => {
        if (!active) return;
        setConfig(landing);
        setReport(detail);
      })
      .catch((requestError) => {
        if (!active) return;
        const status = (requestError as { response?: { status?: number } }).response?.status;
        setError(status === 404 ? "공개된 시험 분석을 찾을 수 없습니다." : "시험 분석을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!report || !config?.config) return;
    document.title = `${report.title} — ${config.config.brand_name}`;
    setMeta("og:title", report.title);
    setMeta("og:description", report.description);
    setMeta("description", report.description);
  }, [config, report]);

  if (loading) return <MatchupCenterSpin label="분석 리포트를 펼치는 중..." />;
  if (error || !config?.config || !report?.snapshot) {
    return (
      <MatchupCenterState>
        <h1>{error || "시험 분석을 표시할 수 없습니다."}</h1>
        <p>공개가 끝났거나 잠시 내려둔 자료일 수 있습니다.</p>
        <Link to="/landing/analysis">시험 분석 목록</Link>
      </MatchupCenterState>
    );
  }

  const snapshot = report.snapshot;
  const pdfUrl = report.pdf_url ? resolvePublicReportUrl(report.pdf_url) : null;

  return (
    <MatchupLandingShell cfg={config.config}>
      <header className={styles.detailHero}>
        <div className={styles.detailHeroInner}>
          <Link to="/landing/analysis" className={styles.backLink}>← 시험 분석 노트</Link>
          <div className={styles.detailTags}>
            {[snapshot.metadata.school, snapshot.metadata.grade, snapshot.metadata.subject, snapshot.metadata.exam_name]
              .filter(Boolean)
              .map((tag) => <span key={tag}>{tag}</span>)}
          </div>
          <h1>{report.title}</h1>
          <p>{snapshot.summary.one_line || report.description}</p>
          <div className={styles.detailMetrics}>
            <span><b>{snapshot.summary.total_questions || "-"}</b> 분석 문항</span>
            <span><b>{snapshot.summary.total_points || "-"}</b> 총점</span>
            <span><b>{snapshot.assessment_axes.length}</b> 출제 축</span>
          </div>
        </div>
      </header>

      <main className={styles.article}>
        <section className={styles.leadSheet}>
          <div>
            <span className={styles.sectionNumber}>01</span>
            <h2>시험 총평</h2>
          </div>
          <div className={styles.leadCopy}>
            <p>{snapshot.summary.character}</p>
            {snapshot.summary.student_burden ? <blockquote>{snapshot.summary.student_burden}</blockquote> : null}
          </div>
        </section>

        <section className={styles.articleSection}>
          <div className={styles.sectionHeading}><span>02</span><div><small>ASSESSMENT AXES</small><h2>이번 시험이 확인한 힘</h2></div></div>
          <div className={styles.axisGrid}>
            {snapshot.assessment_axes.map((axis, index) => (
              <article key={`${axis.title}-${index}`}><b>{String(index + 1).padStart(2, "0")}</b><h3>{axis.title}</h3><p>{axis.description}</p></article>
            ))}
          </div>
        </section>

        <section className={styles.articleSection}>
          <div className={styles.sectionHeading}><span>03</span><div><small>DOMAIN &amp; DIFFICULTY</small><h2>단원과 난도 분포</h2></div></div>
          <div className={styles.domainGrid}>
            {snapshot.domains.map((domain) => (
              <article key={domain.name}>
                <div><h3>{domain.name}</h3><strong>{domain.ratio || domain.points}</strong></div>
                <p>{domain.insight}</p>
                <span>{domain.question_numbers.join(", ")}번</span>
              </article>
            ))}
          </div>
          <div className={styles.difficultyBand}>
            {snapshot.difficulty.distribution.map((entry) => (
              <div key={entry.label}><strong>{entry.label}</strong><span>{entry.question_numbers.join(", ") || "-"}번</span><small>{entry.note}</small></div>
            ))}
          </div>
          {snapshot.difficulty.grade_estimate_note ? <p className={styles.gradeNote}>{snapshot.difficulty.grade_estimate_note}</p> : null}
        </section>

        <section className={styles.articleSection}>
          <div className={styles.sectionHeading}><span>04</span><div><small>KEY ITEMS</small><h2>변별을 만든 핵심 문항</h2></div></div>
          <div className={styles.keyItemList}>
            {snapshot.key_items.map((item) => (
              <article key={`${item.rank}-${item.title}`}>
                <div className={styles.keyRank}>{String(item.rank).padStart(2, "0")}</div>
                <div><span>{item.question_numbers.join(", ")}번</span><h3>{item.title}</h3><p>{item.reason}</p></div>
                <dl><dt>막히는 지점</dt><dd>{item.collapse_point}</dd><dt>다음 처방</dt><dd>{item.prescription}</dd></dl>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.articleSection}>
          <div className={styles.sectionHeading}><span>05</span><div><small>QUESTION MAP</small><h2>문항별 분석표</h2></div></div>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>문항</th><th>단원</th><th>배점</th><th>난도</th><th>핵심 포인트</th><th>주의할 함정</th></tr></thead>
              <tbody>
                {snapshot.questions.map((question) => (
                  <tr key={question.number}>
                    <td><strong>{question.number}</strong></td><td>{question.unit}</td><td>{question.points || "-"}</td>
                    <td><span className={styles.tableDifficulty}>{question.difficulty}</span></td><td>{question.key_point}</td><td>{question.trap}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.conclusionSection}>
          <span>박철T의 다음 수업</span>
          <h2>{snapshot.conclusion.headline}</h2>
          <ol>{snapshot.conclusion.actions.map((action) => <li key={action}>{action}</li>)}</ol>
          {pdfUrl ? <a className={styles.pdfLink} href={pdfUrl} target="_blank" rel="noreferrer">PDF 리포트로 보기 ↗</a> : null}
        </section>
      </main>
    </MatchupLandingShell>
  );
}
