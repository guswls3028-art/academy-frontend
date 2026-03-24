// PATH: src/features/messages/components/AutoSendToggle.tsx
// 자동발송 인라인 토글 + 미리보기 버튼 — 각 이벤트 발생 지점에서 사용하는 공용 컴포넌트
// 출결, 시험, 성적, 과제 등 이벤트 발생 화면에 삽입

import { useState, useRef } from "react";
import { Switch } from "antd";
import { Eye } from "lucide-react";
import { useAutoSendConfig } from "../hooks/useAutoSendConfig";
import AutoSendPreviewPopup from "./AutoSendPreviewPopup";
import { AUTO_SEND_TRIGGER_LABELS } from "../api/messages.api";

export type AutoSendToggleProps = {
  /** AutoSendConfig trigger key (예: "check_in_complete") */
  trigger: string;
  /** 표시 라벨 (생략 시 AUTO_SEND_TRIGGER_LABELS에서 자동 결정) */
  label?: string;
  /** 미리보기용 변수 치환 컨텍스트 (key = 변수명, value = 샘플값) */
  previewContext?: Record<string, string>;
  /** 컴팩트 모드: 라벨 숨기고 토글+미리보기만 */
  compact?: boolean;
};

/**
 * 자동발송 인라인 토글.
 *
 * - 현재 trigger의 enabled 상태를 표시하고 토글
 * - "미리보기" 버튼으로 알림톡 카드 미리보기 팝업 표시
 * - 내부에서 useAutoSendConfig 훅으로 API와 연동
 */
export default function AutoSendToggle({
  trigger,
  label,
  previewContext = {},
  compact = false,
}: AutoSendToggleProps) {
  const { getConfig, toggleEnabled, isToggling, isLoading } =
    useAutoSendConfig();
  const [showPreview, setShowPreview] = useState(false);
  const previewBtnRef = useRef<HTMLButtonElement>(null);

  const config = getConfig(trigger);

  // 설정이 아직 로딩 중이거나 해당 trigger가 없으면 표시하지 않음
  if (isLoading || !config) return null;

  const displayLabel =
    label ?? AUTO_SEND_TRIGGER_LABELS[trigger] ?? trigger;
  const isEnabled = config.enabled;

  return (
    <>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: compact ? 6 : 10,
          padding: compact ? "4px 8px" : "6px 12px",
          background: isEnabled
            ? "color-mix(in srgb, var(--color-status-success, #16a34a) 6%, var(--color-bg-surface, #fff))"
            : "var(--color-bg-surface-soft, #f9fafb)",
          border: `1px solid ${
            isEnabled
              ? "color-mix(in srgb, var(--color-status-success, #16a34a) 20%, var(--color-border-divider, #e5e7eb))"
              : "var(--color-border-divider, #e5e7eb)"
          }`,
          borderRadius: "var(--radius-md, 8px)",
          transition: "background 0.15s, border-color 0.15s",
          flexShrink: 0,
        }}
      >
        {/* 토글 */}
        <Switch
          checked={isEnabled}
          onChange={(checked) =>
            toggleEnabled({ trigger, enabled: checked })
          }
          disabled={isToggling}
          size="small"
        />

        {/* 라벨 */}
        {!compact && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: isEnabled
                ? "var(--color-status-success, #16a34a)"
                : "var(--color-text-muted, #9ca3af)",
              whiteSpace: "nowrap",
              userSelect: "none",
            }}
          >
            {displayLabel}
          </span>
        )}

        {/* 미리보기 버튼 */}
        {config.template_body && (
          <button
            ref={previewBtnRef}
            type="button"
            onClick={() => setShowPreview(true)}
            aria-label={`${displayLabel} 미리보기`}
            title="미리보기"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 6px",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-primary, #3b82f6)",
              background: "color-mix(in srgb, var(--color-primary, #3b82f6) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-primary, #3b82f6) 20%, transparent)",
              borderRadius: "var(--radius-sm, 4px)",
              cursor: "pointer",
              transition: "background 0.12s, border-color 0.12s",
              whiteSpace: "nowrap",
            }}
          >
            <Eye size={12} />
            미리보기
          </button>
        )}
      </div>

      {/* 미리보기 팝업 */}
      <AutoSendPreviewPopup
        open={showPreview}
        onClose={() => setShowPreview(false)}
        trigger={trigger}
        subject={config.template_subject ?? ""}
        body={config.template_body ?? ""}
        previewContext={previewContext}
        anchorRef={previewBtnRef}
      />
    </>
  );
}
