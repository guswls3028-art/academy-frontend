// PATH: src/app_admin/domains/community/components/QnaMatchupResults.tsx
// Q&A 상세에서 AI 매치업 결과 표시 — 선생님 전용

import { Sparkles } from "lucide-react";
import { ICON } from "@/shared/ui/ds";
import { cx } from "@/shared/utils/cx";

type MatchupResult = {
  problem_id: number;
  similarity: number;
  text: string;
  number: number;
  source_type: string;
  source_lecture_title: string;
  source_session_title: string;
  source_exam_title: string;
  document_id?: number;
  image_key?: string;
};

type Props = {
  results: MatchupResult[];
};

export default function QnaMatchupResults({ results }: Props) {
  if (!results || results.length === 0) return null;

  return (
    <div className="qna-matchup-results">
      <div className="qna-matchup-results__header">
        <Sparkles size={ICON.xs} className="qna-matchup-results__icon" />
        <span className="qna-matchup-results__title">
          AI 매치업 결과
        </span>
        <span className="qna-matchup-results__caption">
          학생 첨부 이미지에서 자동 분석
        </span>
      </div>

      <div className="qna-matchup-results__list">
        {results.map((r, i) => {
          const pct = Math.round(r.similarity * 100);
          const source = [
            r.source_lecture_title,
            r.source_session_title,
            r.source_exam_title,
          ].filter(Boolean).join(" > ");

          return (
            <div
              key={r.problem_id || i}
              className="qna-matchup-results__item"
            >
              {/* 유사도 */}
              <span
                className={cx(
                  "qna-matchup-results__score",
                  pct >= 80 && "qna-matchup-results__score--high"
                )}
              >
                {pct}%
              </span>

              <div className="qna-matchup-results__body">
                {/* 출처 */}
                {source ? (
                  <div className="qna-matchup-results__source">
                    Q{r.number} &middot; {source}
                  </div>
                ) : (
                  <div className="qna-matchup-results__source">
                    Q{r.number}
                  </div>
                )}

                {/* 텍스트 미리보기 */}
                {r.text && (
                  <div className="qna-matchup-results__preview">
                    {r.text}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
