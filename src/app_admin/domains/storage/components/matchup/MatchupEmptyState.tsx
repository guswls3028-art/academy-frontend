// PATH: src/app_admin/domains/storage/components/matchup/MatchupEmptyState.tsx

import { FileSearch, MessageCircle, BookOpen, ClipboardList, FolderOpen, Info } from "lucide-react";
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
      <p className={css.placeholderDesc} style={{ maxWidth: 480 }}>
        <strong>교재·기출(참고 자료)</strong>을 먼저 등록한 뒤, 학생이 본 <strong>시험지</strong>를 올리면<br />
        AI가 자료에서 유사 문제를 찾아드립니다.
      </p>

      {/* 두 가지 진입점 — 사용자 의도 가시화 (시스템 동작은 동일) */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "var(--space-3)", maxWidth: 540, width: "100%", marginTop: "var(--space-2)",
      }}>
        <button
          type="button"
          onClick={onUpload}
          data-testid="matchup-empty-reference-btn"
          style={{
            display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8,
            padding: "var(--space-4)",
            borderRadius: "var(--radius-md)",
            background: "color-mix(in srgb, var(--color-brand-primary) 6%, transparent)",
            border: "1px solid color-mix(in srgb, var(--color-brand-primary) 35%, transparent)",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--color-brand-primary)" }}>
            <BookOpen size={18} />
            <span style={{ fontSize: 14, fontWeight: 700 }}>참고 자료 업로드</span>
          </div>
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            교재·기출 PDF를 등록해 두면 학생 시험지와 비교할 풀이 만들어집니다.
          </span>
        </button>

        <button
          type="button"
          onClick={onUpload}
          data-testid="matchup-empty-test-btn"
          style={{
            display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8,
            padding: "var(--space-4)",
            borderRadius: "var(--radius-md)",
            background: "var(--color-bg-surface-soft)",
            border: "1px solid var(--color-border-divider)",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--color-text-primary)" }}>
            <ClipboardList size={18} />
            <span style={{ fontSize: 14, fontWeight: 700 }}>학생 시험지 업로드</span>
          </div>
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            분석할 시험지를 올리면 등록된 자료에서 유사 문제를 찾아 추천합니다.
          </span>
        </button>
      </div>

      <Button
        size="sm"
        intent="ghost"
        onClick={() => navigate("/admin/storage/files")}
        data-testid="matchup-empty-storage-link"
        leftIcon={<FolderOpen size={14} />}
        style={{ marginTop: "var(--space-2)" }}
      >
        저장소에서 가져오기
      </Button>

      <div style={{
        marginTop: "var(--space-4)",
        padding: "8px var(--space-3)",
        borderRadius: "var(--radius-sm)",
        background: "var(--color-bg-surface-soft)",
        display: "flex", alignItems: "flex-start", gap: 8,
        maxWidth: 540, fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.5,
      }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>두 종류 모두 같은 매치업 풀에 등록되며 서로 자동 비교됩니다. 진행 후에도 자료/시험지를 자유롭게 추가할 수 있습니다.</span>
      </div>
      <div className={css.placeholderSteps}>
        <div className={css.placeholderStep}>
          <span className={css.placeholderStepNum}>1</span>
          <span>참고 자료 등록 (교재/기출)</span>
        </div>
        <div className={css.placeholderStep}>
          <span className={css.placeholderStepNum}>2</span>
          <span>학생 시험지 업로드</span>
        </div>
        <div className={css.placeholderStep}>
          <span className={css.placeholderStepNum}>3</span>
          <span>AI 유사 문제 추천</span>
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
