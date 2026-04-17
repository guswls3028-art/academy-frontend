// PATH: src/app_admin/domains/storage/components/matchup/MatchupEmptyState.tsx

import { FileSearch, MessageCircle } from "lucide-react";
import { Button } from "@/shared/ui/ds";
import css from "@/shared/ui/domain/PanelWithTreeLayout.module.css";

type Props = { onUpload: () => void };

export default function MatchupEmptyState({ onUpload }: Props) {
  return (
    <div className={css.placeholder}>
      <div className={css.placeholderIcon}>
        <FileSearch size={28} />
      </div>
      <h3 className={css.placeholderTitle}>AI 매치업</h3>
      <p className={css.placeholderDesc}>
        시험지나 문제 PDF를 업로드하면
        <br />
        AI가 각 문제를 분석하고, 유사한 문제를 자동으로 찾아줍니다.
      </p>
      <div className={css.placeholderAction}>
        <Button size="md" onClick={onUpload}>
          문서 업로드
        </Button>
      </div>
      <div className={css.placeholderSteps}>
        <div className={css.placeholderStep}>
          <span className={css.placeholderStepNum}>1</span>
          <span>시험지 PDF/이미지 업로드</span>
        </div>
        <div className={css.placeholderStep}>
          <span className={css.placeholderStepNum}>2</span>
          <span>AI가 문제별로 분석</span>
        </div>
        <div className={css.placeholderStep}>
          <span className={css.placeholderStepNum}>3</span>
          <span>유사 문제 자동 추천</span>
        </div>
      </div>

      {/* Q&A 연동 안내 */}
      <div style={{
        marginTop: "var(--space-5)",
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-md)",
        background: "var(--color-bg-surface-soft)",
        border: "1px solid color-mix(in srgb, var(--color-border-divider) 60%, transparent)",
        display: "flex", alignItems: "center", gap: "var(--space-3)",
        maxWidth: 400,
      }}>
        <MessageCircle size={16} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
          학생이 QnA에 문제 사진을 올리면, 매치업에 등록된 유사 문제를 자동으로 찾아 선생님 화면에 표시해 줍니다.
        </span>
      </div>
    </div>
  );
}
