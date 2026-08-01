// PATH: src/shared/ui/feedback/BugReportDialog.tsx
// 문제 신고 모달 — 현재 컨텍스트 자동 수집 + Sentry User Feedback 전송

import { useCallback, useState } from "react";
import { useLocation } from "react-router";
import { Modal, Input, Typography } from "antd";
import { SendOutlined } from "@ant-design/icons";
import * as Sentry from "@sentry/react";
import { feedback } from "./feedback";
import { sanitizeObservabilityPath } from "@/shared/lib/sentryContext";
import { submitUserIncident } from "@/shared/lib/userIncidentReporter";

const { TextArea } = Input;
const { Text } = Typography;

type BugReportDialogProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * 현재 브라우저 환경 정보 수집 (자동 첨부용)
 */
function collectContext(pathname: string) {
  const route = sanitizeObservabilityPath(pathname);
  return {
    url: `${window.location.origin}${route}`,
    route,
    userAgent: navigator.userAgent,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    timestamp: new Date().toISOString(),
    // localStorage에서 유저 힌트 (JWT 디코딩 없이)
    hasAccessToken: !!localStorage.getItem("access"),
  };
}

export default function BugReportDialog({ open, onClose }: BugReportDialogProps) {
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const location = useLocation();

  const handleClose = useCallback(() => {
    setDescription("");
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    const text = description.trim();
    if (!text) {
      feedback.warning("증상을 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const ctx = collectContext(location.pathname);
      await submitUserIncident({
        source: "manual",
        message: text,
        route: ctx.route,
        screenSize: ctx.screenSize,
      });

      try {
        // Sentry는 상세 진단용 보조 경로이며, 운영 DB 접수 성공을 되돌리지 않는다.
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
        Sentry.captureFeedback({
          associatedEventId: eventId,
          message: text,
        });
      } catch {
        // 운영 DB 접수가 정본이므로 Sentry 장애는 사용자 재제출을 유도하지 않는다.
      }

      feedback.success("문제가 접수되었습니다. 확인 후 처리하겠습니다.");
      handleClose();
    } catch {
      feedback.error("접수 중 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }, [description, handleClose, location.pathname]);

  return (
    <Modal
      title="문제 신고"
      open={open}
      onCancel={handleClose}
      okText="접수"
      okButtonProps={{
        icon: <SendOutlined />,
        loading: submitting,
        disabled: !description.trim(),
      }}
      onOk={handleSubmit}
      destroyOnHidden
      width={480}
    >
      <div className="flex flex-col gap-2">
        <Text type="secondary" className="text-[13px]">
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
          className="-mt-1 text-right text-xs"
        >
          {description.length} / 1,000
        </Text>
      </div>
    </Modal>
  );
}
