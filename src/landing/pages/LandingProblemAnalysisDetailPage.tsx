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
  const analysis = buildAnalysis(snapshot);

  return (
    <MatchupLandingShell cfg={config.config}>
      <header className={styles.detailHero}>
        <div className={styles.detailHeroInner}>
          <Link to="/landing/analysis" className={styles.backLink}>← 시험 분석 노트</Link>
          <div className={styles.heroGrid}>
            <div>
              <div className={styles.detailTags}>
                {[snapshot.metadata.school, snapshot.metadata.grade, snapshot.metadata.subject, snapshot.metadata.exam_name]
                  .filter(Boolean)
                  .map((tag) => <span key={tag}>{tag}</span>)}
              </div>
              <span className={styles.heroEyebrow}>EXAM EVIDENCE REPORT · 박철T</span>
              <h1>{report.title}</h1>
              <p>{snapshot.summary.one_line || report.description}</p>
            </div>
            <aside className={styles.heroVerdict} aria-label="시험 분석 핵심 결론">
              <span>분석 결론</span>
              <strong>{snapshot.conclusion.headline || snapshot.summary.one_line}</strong>
              <small>문항 근거에서 다음 수업까지 연결한 교사 검수 리포트</small>
            </aside>
          </div>
          <div className={styles.detailMetrics}>
            <span><small>분석 문항</small><b>{snapshot.summary.total_questions || "-"}</b></span>
            <span><small>서답형</small><b>{analysis.subjectiveCount ? `${analysis.subjectiveCount}문항` : "확인 필요"}</b></span>
            <span><small>상·최상 배점</small><b>{analysis.hardPoints ? `${scoreText(analysis.hardPoints)}점` : "확인 필요"}</b></span>
            <span><small>핵심 변별 군</small><b>{snapshot.key_items.length}개</b></span>
          </div>
        </div>
      </header>

      <main className={styles.articleFrame}>
        <aside className={styles.articleRail} aria-label="리포트 목차">
          <span>REPORT INDEX</span>
          <a href="#overview"><b>01</b> 시험 총평</a>
          <a href="#score-map"><b>02</b> 점수 지도</a>
          <a href="#axes"><b>03</b> 시험의 본질</a>
          <a href="#key-items"><b>04</b> 변별 문항</a>
          <a href="#failure-patterns"><b>05</b> 무너지는 패턴</a>
          <a href="#question-map"><b>06</b> 전 문항</a>
          {pdfUrl ? <a className={styles.railPdf} href={pdfUrl} target="_blank" rel="noreferrer">PDF 전체본 ↗</a> : null}
        </aside>

        <div className={styles.article}>
          <section className={styles.leadSheet} id="overview">
            <div className={styles.sectionLabel}><span>01</span><small>OVERVIEW</small></div>
            <div className={styles.leadCopy}>
              <h2>이 시험은 무엇을<br />가려냈나</h2>
              <p>{snapshot.summary.character}</p>
              {snapshot.summary.student_burden ? <blockquote><b>학생 체감 난도</b>{snapshot.summary.student_burden}</blockquote> : null}
            </div>
            <aside className={styles.evidenceNote}>
              <strong>근거 범위</strong>
              <p>업로드된 시험지의 문항·배점·자료 구조를 기준으로 분석했습니다. 실제 정답률과 학교 성적 분포가 없는 항목은 추정값으로 확정하지 않습니다.</p>
            </aside>
          </section>

          <section className={styles.articleSection} id="score-map">
            <SectionHeading number="02" english="SCORE MAP" title="점수는 어디에서 갈렸나" />
            <div className={styles.structureGrid}>
              <div><span>선택형</span><strong>{analysis.objectiveCount}문항</strong><small>{analysis.objectivePoints ? `${scoreText(analysis.objectivePoints)}점` : "배점 확인 필요"}</small></div>
              <div><span>서답형</span><strong>{analysis.subjectiveCount}문항</strong><small>{analysis.subjectivePoints ? `${scoreText(analysis.subjectivePoints)}점` : "배점 확인 필요"}</small></div>
              <div className={styles.structureNarrative}><span>시험 구조</span><p>{snapshot.summary.student_burden || snapshot.summary.character}</p></div>
            </div>

            <div className={styles.questionSequence} aria-label="문항 순서별 난이도 지도">
              <div className={styles.mapTitle}><strong>문항 순서 지도</strong><span>색이 진할수록 높은 난도</span></div>
              <div className={styles.sequenceCells}>
                {snapshot.questions.map((question) => (
                  <div data-level={question.difficulty} key={`${question.number}-${question.unit}`} title={`${question.number}번 · ${question.unit} · ${question.difficulty}`}>
                    <b>{question.number}</b><small>{question.points || "-"}</small>
                  </div>
                ))}
              </div>
              <div className={styles.mapLegend}><i data-level="하" />하 <i data-level="중" />중 <i data-level="중상" />중상 <i data-level="상" />상 <i data-level="최상" />최상</div>
            </div>

            <div className={styles.analysisColumns}>
              <div className={styles.domainBars}>
                <h3>영역별 배점 밀도</h3>
                {snapshot.domains.map((domain) => {
                  const ratio = parsePercent(domain.ratio) || percent(parsePoints(domain.points), analysis.totalPoints);
                  return (
                    <article key={domain.name}>
                      <div><strong>{domain.name}</strong><b>{domain.ratio || domain.points}</b></div>
                      <span>
                        {/* eslint-disable-next-line no-restricted-syntax -- 공개 스냅샷의 실제 영역 비중을 막대 길이로 반영한다. */}
                        <i style={{ width: `${Math.max(4, ratio)}%` }} />
                      </span>
                      <p>{domain.insight}</p>
                      <small>{domain.question_numbers.join(" · ")}번</small>
                    </article>
                  );
                })}
              </div>
              <div className={styles.difficultyBars}>
                <h3>난도별 배점</h3>
                {analysis.difficultyStats.map((entry) => (
                  <article data-level={entry.label} key={entry.label}>
                    <div><strong>{entry.label}</strong><b>{entry.points ? `${scoreText(entry.points)}점` : `${entry.count}문항`}</b></div>
                    <span>
                      {/* eslint-disable-next-line no-restricted-syntax -- 문항별 실제 배점 또는 개수 비율을 막대 길이로 반영한다. */}
                      <i style={{ width: `${Math.max(4, percent(entry.points || entry.count, entry.points ? analysis.totalPoints : snapshot.questions.length))}%` }} />
                    </span>
                    <small>{entry.questionNumbers.join(" · ")}번</small>
                  </article>
                ))}
              </div>
            </div>
            {snapshot.difficulty.grade_estimate_note ? <p className={styles.gradeNote}><b>해석 주의</b>{snapshot.difficulty.grade_estimate_note}</p> : null}
          </section>

          <section className={styles.articleSection} id="axes">
            <SectionHeading number="03" english="CHARACTER OF THE TEST" title="시험의 본질 — 결정적 특징" />
            <div className={styles.axisGrid}>
              {snapshot.assessment_axes.map((axis, index) => (
                <article key={`${axis.title}-${index}`}><b>{String(index + 1).padStart(2, "0")}</b><div><h3>{axis.title}</h3><p>{axis.description}</p></div></article>
              ))}
            </div>
          </section>

          <section className={styles.articleSection} id="key-items">
            <SectionHeading number="04" english="DISCRIMINATION CLUSTERS" title="점수 차이를 만든 문항 군" />
            <div className={styles.keyItemList}>
              {snapshot.key_items.map((item) => (
                <article key={`${item.rank}-${item.title}`}>
                  <header><span>KILLER CLUSTER #{item.rank}</span><b>{item.question_numbers.join(" · ")}번</b></header>
                  <div className={styles.keyLead}><strong>{String(item.rank).padStart(2, "0")}</strong><div><h3>{item.title}</h3><p>{item.reason}</p></div></div>
                  <div className={styles.causalChain}><div><span>무너지는 지점</span><p>{item.collapse_point}</p></div><i>→</i><div><span>다음 수업 처방</span><p>{item.prescription}</p></div></div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.articleSection} id="failure-patterns">
            <SectionHeading number="05" english="FAILURE PATTERNS" title="학생이 무너지는 방식과 처방" />
            {snapshot.failure_patterns.length ? (
              <div className={styles.patternList}>
                {snapshot.failure_patterns.map((pattern, index) => (
                  <article key={`${pattern.title}-${index}`}>
                    <header><b>{String(index + 1).padStart(2, "0")}</b><h3>{pattern.title}</h3></header>
                    <div><span>보이는 증상</span><p>{pattern.symptom}</p></div>
                    <div><span>학습 원인</span><p>{pattern.cause}</p></div>
                    <div className={styles.patternPrescription}><span>수업 처방</span><p>{pattern.prescription}</p></div>
                  </article>
                ))}
              </div>
            ) : <p className={styles.emptyEvidence}>학생 오답 자료가 쌓이면 반복되는 실패 패턴을 이 구간에 연결합니다.</p>}
            {(snapshot.parent_guidance.recommended.length || snapshot.parent_guidance.avoid.length) ? (
              <div className={styles.parentGuide}>
                <div><span>결과만 말하면</span>{snapshot.parent_guidance.avoid.map((item) => <p key={item}>“{item}”</p>)}</div>
                <i>→</i>
                <div><span>이렇게 설명합니다</span>{snapshot.parent_guidance.recommended.map((item) => <p key={item}>{item}</p>)}</div>
              </div>
            ) : null}
          </section>

          <section className={styles.articleSection} id="question-map">
            <SectionHeading number="06" english="ITEM ANALYSIS" title="전 문항 근거표" />
            <p className={styles.tableIntro}>문항별로 ‘무엇을 물었는지’와 ‘어디서 오답이 생기는지’를 같은 행에서 확인합니다.</p>
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>문항</th><th>영역</th><th>배점</th><th>난도</th><th>핵심 포인트</th><th>오답 함정</th></tr></thead>
                <tbody>
                  {snapshot.questions.map((question) => (
                    <tr data-level={question.difficulty} key={`${question.number}-${question.unit}`}>
                      <td data-label="문항"><strong>{question.number}</strong></td>
                      <td data-label="영역">{question.unit}</td><td data-label="배점">{question.points || "-"}</td>
                      <td data-label="난도"><span className={styles.tableDifficulty}>{question.difficulty}</span></td>
                      <td data-label="핵심 포인트">{question.key_point}</td><td data-label="오답 함정">{question.trap}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.conclusionSection}>
            <span>FINAL LEARNING PRESCRIPTION · 박철T의 다음 수업</span>
            <h2>{snapshot.conclusion.headline}</h2>
            <div className={styles.actionGrid}>{snapshot.conclusion.actions.map((action, index) => <div key={action}><b>{String(index + 1).padStart(2, "0")}</b><p>{action}</p></div>)}</div>
            {pdfUrl ? <a className={styles.pdfLink} href={pdfUrl} target="_blank" rel="noreferrer">분석 PDF 전체본 열기 ↗</a> : null}
          </section>
        </div>
      </main>
    </MatchupLandingShell>
  );
}

function SectionHeading({ number, english, title }: { number: string; english: string; title: string }) {
  return <div className={styles.sectionHeading}><span>{number}</span><div><small>{english}</small><h2>{title}</h2></div></div>;
}

type Snapshot = NonNullable<ProblemReviewShowcaseCard["snapshot"]>;

function parsePoints(value?: string): number {
  const match = String(value || "").replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function parsePercent(value?: string): number {
  return String(value || "").includes("%") ? parsePoints(value) : 0;
}

function percent(value: number, total: number): number {
  return total > 0 ? Math.min(100, (value / total) * 100) : 0;
}

function scoreText(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function buildAnalysis(snapshot: Snapshot) {
  const subjective = snapshot.questions.filter((question) => /서답|서술|주관/.test(question.unit));
  const objective = snapshot.questions.filter((question) => !subjective.includes(question));
  const totalPoints = snapshot.questions.reduce((sum, question) => sum + parsePoints(question.points), 0);
  const labels = ["하", "중", "중상", "상", "최상", "검수 필요"];
  const difficultyStats = labels.map((label) => {
    const questions = snapshot.questions.filter((question) => question.difficulty === label);
    const fallback = snapshot.difficulty.distribution.find((entry) => entry.label === label);
    return {
      label,
      count: questions.length || fallback?.question_numbers.length || 0,
      points: questions.reduce((sum, question) => sum + parsePoints(question.points), 0) || parsePoints(fallback?.points),
      questionNumbers: questions.length ? questions.map((question) => String(question.number)) : fallback?.question_numbers || [],
    };
  }).filter((entry) => entry.count > 0);
  return {
    totalPoints,
    objectiveCount: objective.length,
    objectivePoints: objective.reduce((sum, question) => sum + parsePoints(question.points), 0),
    subjectiveCount: subjective.length,
    subjectivePoints: subjective.reduce((sum, question) => sum + parsePoints(question.points), 0),
    hardPoints: snapshot.questions.filter((question) => ["상", "최상"].includes(question.difficulty)).reduce((sum, question) => sum + parsePoints(question.points), 0),
    difficultyStats,
  };
}
