/**
 * ExamResultPage — 시험 결과 상세
 * 대표 Result + ResultItem(문항별) 렌더링
 * 서버 권한 기반 정답 노출 (answer_visibility)
 */
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import EmptyState from "@student/layout/EmptyState";
import { useMyExamResult } from "@student/domains/exams/hooks/useMyExamResult";
import { useMyExamResultItems } from "@student/domains/exams/hooks/useMyExamResultItems";
import type { ExamResultAnalysis, MyExamResultItem } from "@student/domains/exams/api/results";
import GradeBadge from "@student/domains/grades/components/GradeBadge";
import styles from "./ExamResultPage.module.css";

export default function ExamResultPage() {
  const { examId } = useParams();
  const safeId = Number(examId);

  const resultQ = useMyExamResult(Number.isFinite(safeId) ? safeId : undefined);
  const itemsQ = useMyExamResultItems(Number.isFinite(safeId) ? safeId : undefined);

  if (!Number.isFinite(safeId)) {
    return (
      <StudentPageShell title="시험 결과" description="잘못된 접근입니다.">
        <EmptyState title="잘못된 주소입니다." />
      </StudentPageShell>
    );
  }

  if (resultQ.isLoading) {
    return (
      <StudentPageShell title="시험 결과">
        <div className={styles.loadingStack}>
          <div className={`stu-skel ${styles.loadingScore}`} />
          <div className={`stu-skel ${styles.loadingMeta}`} />
        </div>
      </StudentPageShell>
    );
  }

  if (resultQ.isError || !resultQ.data) {
    return (
      <StudentPageShell title="시험 결과">
        <EmptyState
          title="결과를 불러오지 못했어요."
          description="아직 채점 전이거나, 시험에 응시하지 않았을 수 있어요."
          onRetry={() => resultQ.refetch()}
        />
      </StudentPageShell>
    );
  }

  const r = resultQ.data;
  const items = itemsQ.data ?? [];
  const pct = r.max_score > 0 ? clampPercent(Math.round((r.total_score / r.max_score) * 100)) : 0;
  // 최종 합격 여부: 1차 합격(is_pass) OR 클리닉 재시험 통과(remediated)
  const finalPass = r.final_pass ?? r.is_pass;
  const achievement = r.meta_status === "NOT_SUBMITTED"
    ? "NOT_SUBMITTED"
    : r.remediated
      ? "REMEDIATED"
      : undefined;
  const analysis = r.analysis ?? buildAnalysisFromItems(items);
  const correctCount = analysis.correct_count;
  const wrongCount = analysis.wrong_count;
  const hasQuestionAnalysis = analysis.total_questions > 0 && achievement !== "NOT_SUBMITTED";

  return (
    <StudentPageShell
      title="시험 결과"
      actions={
        <div className={styles.headerActions}>
          <Link to="/student/grades" className="stu-cta-link">
            성적
          </Link>
          <Link
            to={`/student/exams/${safeId}`}
            className={styles.backLink}
          >
            시험으로
          </Link>
        </div>
      }
    >
      <div className={styles.resultStack}>
        {/* ── 상태 배너: 미응시 > 임시 채점 (우선순위 1개만 노출) ── */}
        {achievement === "NOT_SUBMITTED" ? (
          <div className={styles.statusBanner} role="status">
            이 시험은 응시하지 않았습니다.
          </div>
        ) : r.is_provisional ? (
          <div className={`${styles.statusBanner} ${styles.statusBannerDashed}`} role="status">
            채점이 확정되기 전 임시 점수입니다. 정답 공개는 확정 후에 이뤄집니다.
          </div>
        ) : null}

        {/* ── Score Gauge ── */}
        <div className={styles.scorePanel}>
          <ScoreGauge pct={pct} passed={finalPass} />
          <div className={styles.scoreText}>
            {r.total_score} / {r.max_score}점
          </div>
          <GradeBadge
            passed={finalPass}
            achievement={achievement}
            showNotSubmitted={r.total_score == null}
          />
          {/* 클리닉 재시험 통과 정보 (드리프트 해소 UX) */}
          {r.remediated && r.clinic_retake && (
            <div className={styles.remediatedPill}>
              클리닉 재시험 통과
              {typeof r.clinic_retake.score === "number" && (
                <> · {r.clinic_retake.score}점</>
              )}
              {typeof r.clinic_retake.pass_score === "number" && (
                <> / 기준 {r.clinic_retake.pass_score}점</>
              )}
            </div>
          )}
          {r.submitted_at && (
            <div className={`stu-muted ${styles.submittedDate}`}>
              {new Date(r.submitted_at).toLocaleDateString("ko-KR")} 제출
            </div>
          )}
        </div>

        {hasQuestionAnalysis && (
          <AnalysisOverviewCard
            analysis={analysis}
            cohortAvg={r.cohort_avg ?? null}
            myScore={r.total_score}
            maxScore={r.max_score}
          />
        )}

        {/* ── Clinic CTA (불합격 + 미해소 클리닉 대상) ── */}
        {r.clinic_required && finalPass === false && r.meta_status !== "NOT_SUBMITTED" && (
          <ClinicRequiredCard />
        )}

        {/* ── Rank & Comparison ── */}
        {r.rank != null && r.cohort_size != null && r.cohort_size > 1 && r.meta_status !== "NOT_SUBMITTED" && (
          <RankComparisonCard
            rank={r.rank}
            cohortSize={r.cohort_size}
            cohortAvg={r.cohort_avg ?? null}
            myScore={r.total_score}
            maxScore={r.max_score}
          />
        )}

        {/* ── Correct/Wrong Bar ── */}
        {hasQuestionAnalysis && (
          <CorrectBar correct={correctCount} wrong={wrongCount} />
        )}

        {/* ── Per-question results (OMR Grid) — 미응시는 숨김 ── */}
        {achievement !== "NOT_SUBMITTED" && (
          <div>
            <div className={styles.sectionTitle}>
              문항별 결과
            </div>

            {itemsQ.isLoading && (
              <div className={`stu-muted ${styles.mutedSmall}`}>
                불러오는 중...
              </div>
            )}
            {itemsQ.isError && (
              <div className={styles.dangerSmall}>
                문항별 결과를 불러오지 못했어요.
              </div>
            )}

            {!r.answers_visible && items.length > 0 && (
              <div className={`stu-muted ${styles.answersNote}`}>
                정답 내용은 비공개입니다. 틀린 번호와 내 답만 확인할 수 있습니다.
                {r.answer_visibility === "after_closed" && " 시험 마감 후 공개됩니다."}
              </div>
            )}

            {items.length > 0 && (
              <QuestionGrid
                items={items}
                showAnswer={!!r.answers_visible}
                answersVisible={!!r.answers_visible}
              />
            )}

            {items.length === 0 && !itemsQ.isLoading && !itemsQ.isError && (
              <div className={`stu-muted ${styles.mutedSmall}`}>
                문항별 결과가 아직 없어요.
              </div>
            )}
          </div>
        )}
      </div>
    </StudentPageShell>
  );
}

/* ── Clinic Required CTA ── */

function ClinicRequiredCard() {
  return (
    <Link
      to="/student/clinic"
      className={styles.clinicCard}
    >
      <div className={styles.clinicText}>
        <div className={styles.clinicTitle}>
          보강 클리닉 대상
        </div>
        <div className={`stu-muted ${styles.clinicDesc}`}>
          클리닉 페이지에서 일정을 예약하세요.
        </div>
      </div>
      <div className={styles.clinicAction}>
        예약하기 →
      </div>
    </Link>
  );
}

/* ── Analysis overview ── */

function AnalysisOverviewCard({
  analysis,
  cohortAvg,
  myScore,
  maxScore,
}: {
  analysis: ExamResultAnalysis;
  cohortAvg: number | null;
  myScore: number;
  maxScore: number;
}) {
  const diff = cohortAvg != null ? Math.round((myScore - cohortAvg) * 10) / 10 : null;
  const scoreRate = maxScore > 0 ? clampPercent(Math.round((myScore / maxScore) * 100)) : null;

  return (
    <div className={`${styles.cardPanel} ${styles.analysisPanel}`} data-testid="score-analysis-card">
      <div className={styles.analysisHeader}>
        <div className={styles.sectionTitle}>
          핵심 분석
        </div>
        {scoreRate != null && (
          <span className={styles.analysisRate}>
            득점률 {scoreRate}%
          </span>
        )}
      </div>

      <div className={styles.analysisGrid}>
        <div className={styles.analysisCell}>
          <span className={styles.analysisLabel}>정답률</span>
          <strong>{analysis.accuracy_rate ?? 0}%</strong>
          <span className="stu-muted">
            {analysis.correct_count}/{analysis.total_questions}문항
          </span>
        </div>
        <div className={styles.analysisCell} data-danger={analysis.wrong_count > 0}>
          <span className={styles.analysisLabel}>오답</span>
          <strong>{analysis.wrong_count}문항</strong>
          <span className="stu-muted">
            {analysis.wrong_count > 0 ? "다시 볼 번호" : "틀린 번호 없음"}
          </span>
        </div>
        <div className={styles.analysisCell} data-positive={diff != null && diff >= 0}>
          <span className={styles.analysisLabel}>평균 대비</span>
          <strong>{diff == null ? "-" : diff >= 0 ? `+${diff}` : diff}</strong>
          <span className="stu-muted">{cohortAvg != null ? `평균 ${cohortAvg}점` : "비교 인원 부족"}</span>
        </div>
      </div>

      <div className={styles.wrongNumberBlock}>
        <span className={styles.wrongNumberLabel}>틀린 번호</span>
        <div className={styles.wrongNumberList}>
          {analysis.wrong_question_numbers.length > 0 ? (
            analysis.wrong_question_numbers.map((num) => (
              <span key={num} className={styles.wrongNumberChip} data-testid="wrong-number-chip">{num}</span>
            ))
          ) : (
            <span className={styles.noWrongChip}>없음</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Score Gauge (SVG) ── */

function ScoreGauge({ pct, passed }: { pct: number; passed: boolean | null }) {
  const R = 44;
  const C = 2 * Math.PI * R;
  const safePct = clampPercent(pct);
  const offset = C - (safePct / 100) * C;
  const color = passed === null ? "var(--stu-primary)" : passed ? "var(--stu-success)" : "var(--stu-danger)";

  return (
    <svg width={108} height={108} viewBox="0 0 108 108">
      <circle
        cx={54}
        cy={54}
        r={R}
        fill="none"
        stroke="var(--stu-surface-soft)"
        strokeWidth={10}
      />
      <circle
        cx={54}
        cy={54}
        r={R}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={offset}
        transform="rotate(-90 54 54)"
        className={styles.gaugeProgress}
      />
      <text
        x={54}
        y={54}
        textAnchor="middle"
        dominantBaseline="central"
        className={styles.gaugeValue}
      >
        {safePct}
      </text>
      <text
        x={54}
        y={72}
        textAnchor="middle"
        dominantBaseline="central"
        className={styles.gaugeUnit}
      >
        %
      </text>
    </svg>
  );
}

/* ── Rank Comparison Card ── */

function RankComparisonCard({
  rank,
  cohortSize,
  cohortAvg,
  myScore,
  maxScore,
}: {
  rank: number;
  cohortSize: number;
  cohortAvg: number | null;
  myScore: number;
  maxScore: number;
}) {
  const topPct = cohortSize > 1
    ? Math.round(rank / cohortSize * 100)
    : 100;
  const diff = cohortAvg != null ? Math.round((myScore - cohortAvg) * 10) / 10 : null;
  const avgBarPct = cohortAvg != null && maxScore > 0
    ? clampPercent(Math.round((cohortAvg / maxScore) * 100))
    : 0;
  const myBarPct = maxScore > 0 ? clampPercent(Math.round((myScore / maxScore) * 100)) : 0;

  return (
    <div className={styles.cardPanel}>
      <div className={styles.sectionTitle}>
        내 등수
      </div>

      {/* Rank badge */}
      <div className={styles.rankRow}>
        <span className={styles.rankValue}>
          {rank}등
        </span>
        <span className={`stu-muted ${styles.rankTotal}`}>
          / {cohortSize}명
        </span>
        {topPct > 0 && (
          <span
            className={styles.rankBadge}
            data-elite={topPct <= 30}
          >
            상위 {topPct}%
          </span>
        )}
      </div>

      {/* Average comparison bar */}
      {cohortAvg != null && (
        <div>
          <div className={styles.comparisonHeader}>
            <span className="stu-muted">전체 평균 {cohortAvg}점</span>
            <span className={styles.diffValue} data-positive={diff != null && diff >= 0}>
              {diff != null ? (diff >= 0 ? `+${diff}점` : `${diff}점`) : ""}
            </span>
          </div>
          <svg
            className={styles.comparisonChart}
            viewBox="0 0 100 8"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <rect width="100" height="8" fill="var(--stu-border)" rx="4" />
            <rect
              className={styles.comparisonFill}
              width={myBarPct}
              height="8"
              fill={myBarPct >= avgBarPct ? "var(--stu-success)" : "var(--stu-danger)"}
              rx="4"
            />
            <rect x={avgBarPct} width="2" height="8" fill="var(--stu-text-muted)" />
          </svg>
          <div className={styles.axisRow}>
            <span className="stu-muted">0</span>
            <span className="stu-muted">{maxScore}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Correct/Wrong ratio bar ── */

function CorrectBar({ correct, wrong }: { correct: number; wrong: number }) {
  const total = correct + wrong;
  if (total === 0) return null;
  const cPct = clampPercent((correct / total) * 100);

  return (
    <div className={styles.cardPanel}>
      <div className={styles.ratioHeader}>
        <span className={styles.correctText}>
          정답 {correct}문항
        </span>
        <span className={styles.wrongText}>
          오답 {wrong}문항
        </span>
      </div>
      <svg
        className={styles.comparisonChart}
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <rect width="100" height="8" fill="var(--stu-danger)" rx="4" />
        <rect className={styles.comparisonFill} width={cPct} height="8" fill="var(--stu-success)" rx="4" />
      </svg>
    </div>
  );
}

/* ── Question Grid (OMR style) ── */

type QuestionItemData = {
  question_id: number;
  question_number: number;
  student_answer: string | null;
  correct_answer: string | null;
  score: number;
  max_score: number;
  is_correct: boolean;
};

function QuestionGrid({
  items,
  showAnswer,
  answersVisible,
}: {
  items: QuestionItemData[];
  showAnswer: boolean;
  answersVisible: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const selectedItem = items.find((it) => it.question_number === selected);

  return (
    <div>
      {/* Grid — 한 줄에 5개 */}
      <div className={styles.questionGrid}>
        {items.map((it) => {
          const isSelected = selected === it.question_number;

          return (
            <button
              key={`${it.question_id}-${it.question_number}`}
              type="button"
              onClick={() =>
                setSelected(isSelected ? null : it.question_number)
              }
              aria-pressed={isSelected}
              aria-label={`${it.question_number}번 ${it.is_correct ? "정답" : "오답"}`}
              className={styles.questionButton}
              data-answers-visible={answersVisible}
              data-correct={it.is_correct}
              data-selected={isSelected}
            >
              {it.question_number}
            </button>
          );
        })}
      </div>

      {/* Expanded Detail */}
      {selectedItem && (
        <div
          className={styles.questionDetail}
          data-correct={selectedItem.is_correct}
        >
          <div className={styles.questionDetailHeader}>
            <span className={styles.questionNumber}>
              {selectedItem.question_number}번
            </span>
            <GradeBadge
              passed={selectedItem.is_correct}
              label={{ pass: "정답", fail: "오답" }}
            />
            <span className={`stu-muted ${styles.questionScore}`}>
              {selectedItem.score}/{selectedItem.max_score}점
            </span>
          </div>
          <div className={`stu-muted ${styles.answerLine}`}>
            내 답: {selectedItem.student_answer ?? "-"}
            {showAnswer && selectedItem.correct_answer != null
              ? ` \u00B7 정답: ${selectedItem.correct_answer}`
              : ""}
          </div>
        </div>
      )}
    </div>
  );
}

function buildAnalysisFromItems(items: MyExamResultItem[]): ExamResultAnalysis {
  const total = items.length;
  const correct = items.filter((it) => it.is_correct).length;
  const wrongQuestionNumbers = items
    .filter((it) => !it.is_correct)
    .map((it) => Number(it.question_number))
    .filter((num) => Number.isFinite(num))
    .sort((a, b) => a - b);

  return {
    total_questions: total,
    correct_count: correct,
    wrong_count: Math.max(total - correct, 0),
    accuracy_rate: total > 0 ? Math.round((correct / total) * 1000) / 10 : null,
    wrong_question_numbers: wrongQuestionNumbers,
  };
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}
