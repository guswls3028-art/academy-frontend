import { Check, X } from "lucide-react";
import type { ProblemReviewDraft } from "../api/problemReview.api";
import styles from "./ProblemReviewPage.module.css";

type ProblemReviewPreviewProps = {
  draft: ProblemReviewDraft;
  version: number;
  dirty: boolean;
  open: boolean;
  onClose: () => void;
};

export function ProblemReviewPreview({ draft, version, dirty, open, onClose }: ProblemReviewPreviewProps) {
  return (
    <aside className={styles.previewPane} aria-label="리포트 미리보기" data-open={open}>
      <button type="button" className={styles.previewClose} onClick={onClose} aria-label="미리보기 닫기"><X size={19} /></button>
      <div className={styles.previewSticky}>
        <div className={styles.previewLabel}><span>LIVE PREVIEW</span><span>{dirty ? "저장 전 변경 있음" : `v${version}`}</span></div>
        <div className={styles.reportPage}>
          <div className={styles.reportRail} />
          <div className={styles.reportEyebrow}>OBSERVATION RECORD · EXAM SPECTRUM</div>
          <h2>{draft.metadata.title || `${draft.metadata.school} ${draft.metadata.exam_name}` || "문제 리뷰 리포트"}</h2>
          <p className={styles.reportMeta}>{[draft.metadata.school, draft.metadata.grade, draft.metadata.subject, draft.metadata.exam_date].filter(Boolean).join(" · ") || "시험 정보를 입력해 주세요."}</p>
          <div className={styles.reportMetrics}>
            <div><span>문항</span><strong>{draft.questions.length}</strong></div>
            <div><span>총점</span><strong>{draft.summary.total_points || "-"}</strong></div>
            <div><span>변별 문항</span><strong>{draft.key_items.length}</strong></div>
          </div>
          <section className={styles.reportLead}>
            <span>3-MINUTE SIGNAL</span>
            <h3>{draft.summary.one_line || "시험의 핵심 특징을 한 문장으로 정리해 주세요."}</h3>
            <p>{draft.summary.character || "시험 성격에 대한 설명이 이곳에 표시됩니다."}</p>
          </section>
          <section className={styles.spectrumPreview} aria-label="문항별 시험 스펙트럼">
            <div className={styles.spectrumLine} />
            {draft.questions.slice(0, 30).map((question) => (
              <span key={`spectrum-${question.source_number}-${question.number}`} data-action={question.thinking_action} data-level={question.difficulty} title={`${question.number}번 · ${question.thinking_action} · ${question.difficulty}`} />
            ))}
          </section>
          <section className={styles.reportSection}>
            <div className={styles.reportSectionTitle}><h3>평가 DNA</h3></div>
            <div className={styles.axisPreview}>
              {draft.assessment_axes.slice(0, 3).map((axis, index) => <div key={`preview-axis-${index}`}><strong>{axis.title || `기조 ${index + 1}`}</strong><p>{axis.description}</p></div>)}
            </div>
          </section>
          <section className={styles.reportSection}>
            <div className={styles.reportSectionTitle}><h3>증거 원장</h3></div>
            <div className={styles.questionPreview}>
              {draft.questions.slice(0, 5).map((question) => <div key={`preview-q-${question.number}`}><b>{question.number}</b><span>{question.unit || "단원 미입력"}</span><em data-level={question.difficulty}>{question.difficulty}</em><p>{question.key_point || "핵심 포인트를 입력해 주세요."}</p></div>)}
            </div>
          </section>
          {draft.key_items[0] && <section className={styles.killerPreview}><span>QUESTION X-RAY</span><h3>{draft.key_items[0].title}</h3><p>{draft.key_items[0].evidence || draft.key_items[0].reason}</p></section>}
          <section className={styles.reportConclusion}><Check size={18} /><div><span>NEXT SIGNAL</span><strong>{draft.conclusion.headline || draft.summary.one_line}</strong></div></section>
          <footer>검수본 v{version} · PDF/PPTX 동일 snapshot</footer>
        </div>
      </div>
    </aside>
  );
}
