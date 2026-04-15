// PATH: src/shared/ui/feedback/BugReportButton.tsx
// 문제 신고 모달 — 프로필 드롭다운 경유, 현재 컨텍스트 자동 수집 + Sentry User Feedback 전송

import { useState, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Modal, Input, Typography } from "antd";
import { SendOutlined } from "@ant-design/icons";
import * as Sentry from "@sentry/react";
import { feedback } from "./feedback";

const { TextArea } = Input;
const { Text } = Typography;

/**
 * 현재 브라우저 환경 정보 수집 (자동 첨부용)
 */
function collectContext(pathname: string) {
  return {
    url: window.location.href,
    route: pathname,
    userAgent: navigator.userAgent,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    timestamp: new Date().toISOString(),
    // localStorage에서 유저 힌트 (JWT 디코딩 없이)
    hasAccessToken: !!localStorage.getItem("access"),
  };
}

/**
 * 문제 신고 모달 (플로팅 버튼 없음)
 * 외부에서 `ui:bugreport:open` 커스텀 이벤트로 열기
 */
export default function BugReportButton() {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const location = useLocation();

  // 외부 이벤트로 모달 열기 (프로필 드롭다운 등에서 호출)
  useEffect(() => {
    const handler = () => setOpen(true);
    document.addEventListener("ui:bugreport:open", handler);
    return () => document.removeEventListener("ui:bugreport:open", handler);
  }, []);

  const handleSubmit = useCallback(async () => {
    const text = description.trim();
    if (!text) {
      feedback.warning("증상을 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const ctx = collectContext(location.pathname);

      // Sentry 이벤트 생성 + User Feedback 연결
      const eventId = Sentry.captureMessage("사용자 문제 신고", {
        level: "info",
        tags: {
          "report.type": "user_bug_report",
          "report.route": ctx.route,
        },
        contexts: {
          bugReport: {
            description: text,
            ...ctx,
          },
        },
      });

      // Sentry User Feedback API
      Sentry.captureFeedback({
        associatedEventId: eventId,
        message: text,
      });

      feedback.success("문제가 접수되었습니다. 확인 후 처리하겠습니다.");
      setDescription("");
      setOpen(false);
    } catch {
      feedback.error("접수 중 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }, [description, location.pathname]);

  return (
    <Modal
      title="문제 신고"
      open={open}
      onCancel={() => { setOpen(false); setDescription(""); }}
      okText="접수"
      okButtonProps={{
        icon: <SendOutlined />,
        loading: submitting,
        disabled: !description.trim(),
      }}
      onOk={handleSubmit}
      destroyOnClose
      width={480}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          어떤 문제가 있는지 알려주세요. 현재 화면·브라우저 정보가 자동 첨부됩니다.
        </Text>
        <TextArea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="예: 학생 목록에서 검색이 안 돼요 / 버튼을 눌러도 반응이 없어요"
          autoSize={{ minRows: 3, maxRows: 6 }}
          maxLength={1000}
          autoFocus
        />
        <Text
          type="secondary"
          style={{ fontSize: 12, textAlign: "right", marginTop: -4 }}
        >
          {description.length} / 1,000
        </Text>
      </div>
    </Modal>
  );
}
