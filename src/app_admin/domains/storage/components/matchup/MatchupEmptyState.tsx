// PATH: src/app_admin/domains/storage/components/matchup/MatchupEmptyState.tsx

import { FileSearch } from "lucide-react";
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
        문제 PDF를 업로드하면 AI가 문제를 분석하고
        <br />
        유사한 문제를 자동으로 찾아줍니다.
      </p>
      <div className={css.placeholderAction}>
        <Button size="md" onClick={onUpload}>
          문서 업로드
        </Button>
      </div>
      <div className={css.placeholderSteps}>
        <div className={css.placeholderStep}>
          <span className={css.placeholderStepNum}>1</span>
          <span>PDF/이미지 업로드</span>
        </div>
        <div className={css.placeholderStep}>
          <span className={css.placeholderStepNum}>2</span>
          <span>AI가 문제 추출</span>
        </div>
        <div className={css.placeholderStep}>
          <span className={css.placeholderStepNum}>3</span>
          <span>유사 문제 추천</span>
        </div>
      </div>
    </div>
  );
}
