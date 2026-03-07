// PATH: src/shared/ui/feedback/FeedbackBridge.tsx
// App 내부에서 antd message 인스턴스를 feedback에 주입 — Static message 경고 제거

import { useEffect } from "react";
import { App } from "antd";
import { setMessageApi } from "./feedback";

export default function FeedbackBridge() {
  const { message } = App.useApp();

  useEffect(() => {
    message.config({ duration: 2, maxCount: 3 });
    setMessageApi(message);
    return () => setMessageApi(null);
  }, [message]);

  return null;
}
