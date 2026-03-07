// PATH: src/shared/ui/feedback/feedback.ts
// antd App context 사용 — Static message 대신 App.useApp() 인스턴스 사용으로 [antd: message] 경고 제거

/** App 내부에서 주입되는 message API (FeedbackBridge가 설정) */
const messageApiRef: { current: ReturnType<typeof import("antd")["App"]["useApp"]>["message"] | null } = {
  current: null,
};

export function setMessageApi(
  api: ReturnType<typeof import("antd")["App"]["useApp"]>["message"] | null
) {
  messageApiRef.current = api;
}

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
};
