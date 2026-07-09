// PATH: src/app_admin/domains/messages/components/AutoSendPreviewPopup.tsx
// 자동발송 미리보기 팝업 — 카카오톡 알림톡 카드 스타일
// SendMessageModal의 카카오 미리보기와 동일한 CSS 클래스 사용

import { useRef, useEffect } from "react";
import { X } from "lucide-react";
import { AUTO_SEND_TRIGGER_LABELS } from "../api/messages.api";
import {
  getAlimtalkTemplateLabel,
  getAlimtalkTemplateType,
  renderAlimtalkFullPreview,
} from "./AlimtalkTemplateInfoPanel";
import "../styles/templateEditor.css";
import styles from "./AutoSendPreviewPopup.module.css";

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
          className={styles.variableBadge}
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
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
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
    : "보낼 내용이 아직 없습니다.";
  const alimtalkType = getAlimtalkTemplateType(trigger);
  const previewBody = alimtalkType
    ? renderAlimtalkFullPreview(alimtalkType, resolvedBody)
    : resolvedBody;

  const triggerLabel =
    AUTO_SEND_TRIGGER_LABELS[trigger] ?? trigger;
  const channelLabel = getAlimtalkTemplateLabel(alimtalkType);

  return (
    <div
      role="dialog"
      aria-label={`${triggerLabel} 미리보기`}
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={styles.panel}
      >
        {/* Header */}
        <div className={styles.header}>
          <div>
            <div className={styles.triggerLabel}>
              {triggerLabel}
            </div>
            <div className={styles.subtitle}>
              알림톡 미리보기
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className={styles.closeButton}
          >
            <X size={18} />
          </button>
        </div>

        {/* Kakao card preview */}
        <div className={styles.content}>
          <div className={`template-preview-kakao ${styles.kakaoPreview}`}>
            <div className="template-preview-kakao__card">
              <div className="template-preview-kakao__header">
                <span className="template-preview-kakao__header-label">알림톡 도착</span>
                <span className="template-preview-kakao__header-channel">{channelLabel}</span>
              </div>
              {resolvedSubject && (
                <div
                  className={`template-preview-kakao__title ${styles.previewText}`}
                >
                  {resolvedSubject}
                </div>
              )}
              <div
                className={`template-preview-kakao__body ${styles.previewText}`}
              >
                {body ? renderBody(previewBody) : (
                  <span className={styles.emptyText}>
                    보낼 내용이 아직 없습니다.
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className={styles.footerNote}>
            카카오톡 알림톡 예시입니다.
          </p>
        </div>
      </div>
    </div>
  );
}
