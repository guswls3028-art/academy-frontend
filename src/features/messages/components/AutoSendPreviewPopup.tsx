// PATH: src/features/messages/components/AutoSendPreviewPopup.tsx
// 자동발송 미리보기 팝업 — 카카오톡 알림톡 카드 스타일
// SendMessageModal의 카카오 미리보기와 동일한 CSS 클래스 사용

import { useRef, useEffect } from "react";
import { X } from "lucide-react";
import { AUTO_SEND_TRIGGER_LABELS } from "../api/messages.api";
import "../styles/templateEditor.css";

type Props = {
  open: boolean;
  onClose: () => void;
  trigger: string;
  subject: string;
  body: string;
  /** 변수 치환용 컨텍스트. key=변수명(#{...} 안), value=치환값 */
  previewContext?: Record<string, string>;
  /** 팝업 위치 기준 anchor (없으면 화면 중앙) */
  anchorRef?: React.RefObject<HTMLElement | null>;
};

/** #{변수명} 패턴을 previewContext 값으로 치환 */
function substituteVariables(
  text: string,
  ctx: Record<string, string>,
): string {
  return text.replace(/#\{([^}]+)\}/g, (match, varName: string) => {
    return ctx[varName] ?? match;
  });
}

/** 변수 치환 후 #{미치환변수}를 샘플 뱃지로 렌더링 */
function renderBody(text: string) {
  const parts = text.split(/(#\{[^}]+\})/g);
  return parts.map((part, i) => {
    const m = part.match(/^#\{([^}]+)\}$/);
    if (m) {
      return (
        <span
          key={i}
          style={{
            display: "inline-block",
            background: "#fee500",
            color: "#333",
            borderRadius: 4,
            padding: "1px 5px",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {m[1]}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function AutoSendPreviewPopup({
  open,
  onClose,
  trigger,
  subject,
  body,
  previewContext = {},
  anchorRef,
}: Props) {
  const popupRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        (!anchorRef?.current || !anchorRef.current.contains(e.target as Node))
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose, anchorRef]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const resolvedSubject = subject
    ? substituteVariables(subject, previewContext)
    : "";
  const resolvedBody = body
    ? substituteVariables(body, previewContext)
    : "템플릿이 아직 설정되지 않았습니다.";

  const triggerLabel =
    AUTO_SEND_TRIGGER_LABELS[trigger] ?? trigger;

  return (
    <div
      ref={popupRef}
      role="dialog"
      aria-label={`${triggerLabel} 미리보기`}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1050,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.25)",
        backdropFilter: "blur(2px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 340,
          maxHeight: "80vh",
          overflow: "auto",
          borderRadius: 16,
          background: "var(--color-bg-surface, #fff)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px 8px",
            borderBottom: "1px solid var(--color-border-divider, #eee)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--color-text-primary)",
              }}
            >
              {triggerLabel}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-muted)",
                marginTop: 2,
              }}
            >
              알림톡 미리보기
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              color: "var(--color-text-muted)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Kakao card preview */}
        <div style={{ padding: 16 }}>
          <div className="template-preview-kakao" style={{ maxWidth: "100%" }}>
            <div className="template-preview-kakao__card">
              {resolvedSubject && (
                <div
                  className="template-preview-kakao__title"
                  style={{ lineHeight: 1.7 }}
                >
                  {resolvedSubject}
                </div>
              )}
              <div
                className="template-preview-kakao__body"
                style={{ lineHeight: 1.7 }}
              >
                {body ? renderBody(resolvedBody) : (
                  <span
                    style={{
                      color: "var(--color-text-muted)",
                      fontStyle: "italic",
                    }}
                  >
                    템플릿이 아직 설정되지 않았습니다.
                  </span>
                )}
              </div>
            </div>
          </div>
          <p
            style={{
              marginTop: 8,
              fontSize: 10,
              color: "var(--color-text-muted)",
              textAlign: "center",
            }}
          >
            카카오톡 알림톡 예시 (치환 변수는 샘플 값)
          </p>
        </div>
      </div>
    </div>
  );
}
