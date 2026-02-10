// PATH: src/shared/ui/feedback/feedback.ts
import { message } from "antd";

message.config({
  duration: 2,
  maxCount: 3,
});

export const feedback = {
  success(text: string) {
    message.success({ content: text });
  },
  error(text: string) {
    message.error({ content: text });
  },
  info(text: string) {
    message.info({ content: text });
  },
};
