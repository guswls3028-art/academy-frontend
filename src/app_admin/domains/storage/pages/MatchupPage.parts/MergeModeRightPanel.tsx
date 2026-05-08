// PATH: src/app_admin/domains/storage/pages/MatchupPage.parts/MergeModeRightPanel.tsx
// 합치기 모드 우측 패널 — 학원장이 "왜 추천이 안 보이지?" 혼란하지 않도록
// 현재 모드 컨텍스트와 다음 행동을 친절하게 가이드.
//
// 인라인 스타일은 합치기 모드 시각 고립(좌측 매치업 그리드 동시 노출, 우측에서
// 색·구조로 분기 안내)을 위해 동적 색상/조건부 border 가 많아 의도적 사용.
/* eslint-disable no-restricted-syntax */

import { Layers } from "lucide-react";
import { Button, ICON } from "@/shared/ui/ds";

export default function MergeModeRightPanel({
  selectedCount,
  onConfirm,
  onClear,
  onExit,
}: {
  selectedCount: number;
  onConfirm: () => void;
  onClear: () => void;
  onExit: () => void;
}) {
  return (
    <div
      data-testid="matchup-merge-mode-right-panel"
      style={{
        display: "flex", flexDirection: "column", gap: "var(--space-3)",
        padding: "var(--space-4)",
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 12px",
        background: "color-mix(in srgb, var(--color-brand-primary) 8%, var(--color-bg-surface))",
        border: "1px solid color-mix(in srgb, var(--color-brand-primary) 35%, transparent)",
        borderRadius: "var(--radius-md)",
      }}>
        <Layers size={ICON.md} style={{ color: "var(--color-brand-primary)", flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-brand-primary)" }}>
            합치기 모드
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>
            한 문항이 여러 칸으로 쪼개진 경우 묶어서 1개로 만듭니다.
          </div>
        </div>
      </div>

      <ol
        style={{
          margin: 0,
          paddingLeft: 18,
          fontSize: 12,
          lineHeight: 1.7,
          color: "var(--color-text-secondary)",
        }}
      >
        <li>좌측에서 합치고 싶은 문항을 <strong>위→아래 순서대로</strong> 클릭하세요.</li>
        <li>2개 이상 선택되면 아래 <strong>합치기</strong> 버튼이 활성화됩니다.</li>
        <li>합쳐진 결과는 즉시 그리드에 1개 카드로 반영됩니다.</li>
      </ol>

      <div
        style={{
          padding: "12px 14px",
          borderRadius: "var(--radius-md)",
          background: selectedCount >= 2
            ? "color-mix(in srgb, var(--color-brand-primary) 8%, transparent)"
            : "var(--color-bg-surface-soft)",
          border: selectedCount >= 2
            ? "1px solid color-mix(in srgb, var(--color-brand-primary) 35%, transparent)"
            : "1px dashed var(--color-border-divider)",
          display: "flex", alignItems: "center", gap: 10,
        }}
      >
        <strong style={{
          fontSize: 22, fontWeight: 800,
          color: selectedCount >= 2 ? "var(--color-brand-primary)" : "var(--color-text-muted)",
          minWidth: 28,
        }}>{selectedCount}</strong>
        <span style={{ fontSize: 12, color: "var(--color-text-secondary)", flex: 1 }}>
          {selectedCount === 0
            ? "아직 선택된 문항이 없습니다."
            : selectedCount === 1
              ? "1개 더 선택하면 합칠 수 있어요."
              : `${selectedCount}개 → 1개로 합칠 준비 완료.`}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
        <Button
          size="sm"
          intent="primary"
          disabled={selectedCount < 2}
          onClick={onConfirm}
          data-testid="matchup-merge-right-panel-confirm"
          leftIcon={<Layers size={ICON.sm} />}
        >
          {selectedCount < 2 ? "2개 이상 선택해 주세요" : `${selectedCount}개를 1개로 합치기`}
        </Button>
        {selectedCount > 0 && (
          <Button size="sm" intent="ghost" onClick={onClear}>
            선택 해제
          </Button>
        )}
        <Button size="sm" intent="ghost" onClick={onExit}>
          합치기 모드 종료
        </Button>
      </div>
    </div>
  );
}
