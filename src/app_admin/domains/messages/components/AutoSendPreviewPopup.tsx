// PATH: src/app_admin/domains/messages/components/AutoSendPreviewPopup.tsx
// 자동발송 미리보기 팝업 — 카카오톡 알림톡 카드 스타일
// SendMessageModal의 카카오 미리보기와 동일한 CSS 클래스 사용

import { AdminModal, ModalBody, ModalHeader } from "@/shared/ui/modal";
import { useMessageAcademyName } from "../hooks/useMessageAcademyName";
import { hideInternalAlimtalkMemoToken } from "../constants/alimtalkEnvelope";
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
}: Props) {
  const { data: academyName = "" } = useMessageAcademyName(open);

  if (!open) return null;

  const resolvedSubject = subject
    ? substituteVariables(subject, previewContext)
    : "";
  const resolvedBody = body
    ? substituteVariables(hideInternalAlimtalkMemoToken(body, ""), previewContext)
    : "";
  const alimtalkType = getAlimtalkTemplateType(trigger);
  const fixedAccount = ["registration_approved_student", "registration_approved_parent",
    "password_find_otp", "password_reset_student", "password_reset_parent"].includes(trigger);
  const previewBody = alimtalkType
    ? renderAlimtalkFullPreview(alimtalkType, resolvedBody, undefined, { 학원명: academyName })
    : resolvedBody;

  const triggerLabel =
    AUTO_SEND_TRIGGER_LABELS[trigger] ?? trigger;
  const channelLabel = getAlimtalkTemplateLabel(alimtalkType);

  return (
    <AdminModal open={open} onClose={onClose} width={420} zIndex={1050} type="inspect" noMinimize trapFocus>
      <ModalHeader title={`${triggerLabel} 미리보기`} type="inspect" />
      <ModalBody>
          <div className={`template-preview-kakao ${styles.kakaoPreview}`}>
            <div className="template-preview-kakao__card">
              <div className="template-preview-kakao__header">
                <span className="template-preview-kakao__header-label">알림톡 도착</span>
                <span className="template-preview-kakao__header-channel">{channelLabel}</span>
              </div>
              {!alimtalkType && !fixedAccount && resolvedSubject && (
                <div
                  className={`template-preview-kakao__title ${styles.previewText}`}
                >
                  {resolvedSubject}
                </div>
              )}
              <div
                className={`template-preview-kakao__body ${styles.previewText}`}
              >
                {fixedAccount ? <p role="note">
                  계정 안내는 발송 시점의 아이디·계정 정보와 승인된 양식으로 작성합니다.
                  보관함에 남아 있는 예전 본문은 이 안내의 미리보기로 사용하지 않습니다.
                </p> : body || alimtalkType ? renderBody(previewBody) : (
                  <span className={styles.emptyText}>
                    보낼 내용이 아직 없습니다.
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className={styles.footerNote}>
            문구 배치 예시입니다. 이름·일정은 발송할 때 채워집니다.
          </p>
      </ModalBody>
    </AdminModal>
  );
}
