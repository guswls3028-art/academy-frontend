// PATH: src/app_admin/domains/storage/components/matchup/MatchupEmptyState.tsx

import { FileSearch, MessageCircle, FolderOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui/ds";
import css from "@/shared/ui/domain/PanelWithTreeLayout.module.css";

type Props = { onUpload: () => void };

export default function MatchupEmptyState({ onUpload }: Props) {
  const navigate = useNavigate();
  return (
    <div className={css.placeholder}>
      <div className={css.placeholderIcon}>
        <FileSearch size={28} />
      </div>
      <h3 className={css.placeholderTitle}>AI 매치업</h3>
      <p className={css.placeholderDesc}>
        교재·기출 등 <strong>참고 자료를 먼저 등록</strong>하세요.
        <br />
        학생이 본 <strong>시험지를 올리면</strong> 등록된 자료에서 AI가 유사 문제를 찾아 추천합니다.
      </p>
      <div className={css.placeholderAction} style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", justifyContent: "center" }}>
        <Button size="md" onClick={onUpload} data-testid="matchup-empty-upload-btn">
          자료 업로드
        </Button>
        <Button size="md" intent="secondary" onClick={() => navigate("/admin/storage/files")} data-testid="matchup-empty-storage-link">
          <FolderOpen size={14} style={{ marginRight: 4 }} />
          저장소에서 가져오기
        </Button>
      </div>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: "var(--space-3)", maxWidth: 420, textAlign: "center" }}>
        저장소에 PDF가 이미 있다면, 파일 클릭 후 <strong>"매치업 자료로 등록"</strong>으로 바로 분석에 추가할 수 있습니다.
      </p>
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
