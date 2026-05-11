// PATH: src/shared/ui/feedback/feedback.ts
// antd App context 사용 — Static message 대신 App.useApp() 인스턴스 사용으로 [antd: message] 경고 제거

/** App 내부에서 주입되는 message API (FeedbackBridge가 설정) */
const messageApiRef: { current: ReturnType<typeof import("antd")["App"]["useApp"]>["message"] | null } = {
  current: null,
};

/** App 내부에서 주입되는 notification API (action CTA 지원). */
const notificationApiRef: {
  current: ReturnType<typeof import("antd")["App"]["useApp"]>["notification"] | null;
} = { current: null };

export function setMessageApi(
  api: ReturnType<typeof import("antd")["App"]["useApp"]>["message"] | null
) {
  messageApiRef.current = api;
}

export function setNotificationApi(
  api: ReturnType<typeof import("antd")["App"]["useApp"]>["notification"] | null
) {
  notificationApiRef.current = api;
}

/** action CTA 포함 토스트 — submit → 학원 홈페이지 게시 흐름처럼
 *  "다음 단계 1클릭" 안내가 필요한 경우 사용. action 미지원 환경은 message 로 fallback. */
type ToastAction = { label: string; onClick: () => void };

export const feedback = {
  success(text: string) {
    messageApiRef.current?.success({ content: text, duration: 2 });
  },
  error(text: string) {
    messageApiRef.current?.error({ content: text, duration: 2 });
  },
  info(text: string) {
    messageApiRef.current?.info({ content: text, duration: 2 });
  },
  warning(text: string) {
    messageApiRef.current?.warning({ content: text, duration: 2 });
  },
  /** alias — console-style .warn() 호출 호환 */
  warn(text: string) {
    messageApiRef.current?.warning({ content: text, duration: 2 });
  },

  /** 강조 CTA 토스트 — 학원장 mental model "다음 단계로 1클릭".
   *  notification API 의 btn 슬롯 사용. 미주입 환경은 message fallback. */
  successWithAction(opts: {
    message: string;
    description?: string;
    action: ToastAction;
    duration?: number;
  }) {
    const noti = notificationApiRef.current;
    if (noti) {
      const key = `success-action-${Date.now()}`;
      // React.createElement 로 btn 노드 생성 — feedback 모듈에서 직접 import.
      // antd Button + 직접 onClick (학원장 결정 위임. 자동 navigate X).
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const React = require("react") as typeof import("react");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const antd = require("antd") as typeof import("antd");
      const btn = React.createElement(
        antd.Button,
        {
          type: "primary",
          size: "small",
          onClick: () => {
            try {
              opts.action.onClick();
            } finally {
              noti.destroy(key);
            }
          },
        },
        opts.action.label,
      );
      noti.success({
        message: opts.message,
        description: opts.description,
        duration: opts.duration ?? 8,
        key,
        btn,
      });
      return;
    }
    // notification API 미주입 → message fallback (CTA 자동 실행 X — 학원장 surprise 회피).
    messageApiRef.current?.success({
      content: `${opts.message} — ${opts.action.label} (다시 시도)`,
      duration: opts.duration ?? 5,
    });
  },
};
