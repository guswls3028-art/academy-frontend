// PATH: src/shared/ui/feedback/FeedbackBridge.tsx
// App 내부에서 antd message + notification 인스턴스를 feedback 에 주입 — Static API 경고 제거
// notification 은 feedback.successWithAction (CTA 토스트) 에서 사용.

import { useEffect } from "react";
import { App } from "antd";
import { setMessageApi, setNotificationApi } from "./feedback";

export default function FeedbackBridge() {
  const { message, notification } = App.useApp();

  useEffect(() => {
    setMessageApi(message);
    setNotificationApi(notification);
    return () => {
      setMessageApi(null);
      setNotificationApi(null);
    };
  }, [message, notification]);

  return null;
}
