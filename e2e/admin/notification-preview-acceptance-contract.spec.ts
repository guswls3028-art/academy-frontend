import fs from "node:fs";

import { expect, test } from "../fixtures/strictTest";

test("공용 알림 미리보기는 큐 접수를 전달 완료라고 표시하지 않는다", () => {
  const source = fs.readFileSync(
    "src/shared/ui/notifications/NotificationPreviewModal.tsx",
    "utf8",
  );

  expect(source).toContain("발송 요청 접수");
  expect(source).toContain("실제 전달 결과는 발송 내역에서 확인");
  expect(source).toContain('/workspace/message/log');
  expect(source).not.toContain("건 발송 완료");
});
