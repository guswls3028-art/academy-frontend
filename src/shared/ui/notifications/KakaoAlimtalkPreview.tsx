import type { ReactNode } from "react";
import "./KakaoAlimtalkPreview.css";

type Props = {
  children: ReactNode;
  channelLabel?: string;
  senderLabel?: string;
  subject?: string;
  className?: string;
};

export default function KakaoAlimtalkPreview({
  children,
  channelLabel = "알림톡",
  senderLabel = "학원 알림톡",
  subject,
  className,
}: Props) {
  return (
    <div
      className={["kakao-alimtalk-preview", className].filter(Boolean).join(" ")}
      aria-label="카카오톡 실제 발송 미리보기"
    >
      <div className="kakao-alimtalk-preview__appbar">
        <span aria-hidden="true">‹</span>
        <strong>{senderLabel}</strong>
        <span className="kakao-alimtalk-preview__appbar-menu" aria-hidden="true">⋮</span>
      </div>
      <div className="kakao-alimtalk-preview__chat">
        <span className="kakao-alimtalk-preview__date">카카오톡 화면 예시</span>
        <div className="kakao-alimtalk-preview__message-row">
          <div className="kakao-alimtalk-preview__profile" aria-hidden="true">H+</div>
          <div className="kakao-alimtalk-preview__message">
            <span className="kakao-alimtalk-preview__sender">{senderLabel}</span>
            <div className="kakao-alimtalk-preview__bubble">
              <div className="kakao-alimtalk-preview__notice-head">
                <span className="kakao-alimtalk-preview__notice-icon" aria-hidden="true">!</span>
                <strong>알림톡 도착</strong>
                <span>{channelLabel}</span>
              </div>
              {subject && <div className="kakao-alimtalk-preview__subject">{subject}</div>}
              <div className="kakao-alimtalk-preview__body">{children}</div>
            </div>
            <span className="kakao-alimtalk-preview__time">지금</span>
          </div>
        </div>
      </div>
    </div>
  );
}
