// PATH: src/features/messages/pages/MessageTemplatesPage.tsx
// 템플릿 저장 — 저장소 도메인과 동일한 파일 탐색기형 UI

import TemplateExplorer from "../components/TemplateExplorer";

export type ModalOpenState = "create" | { template: import("../api/messages.api").MessageTemplateItem; mode: "view" | "edit" } | null;

export default function MessageTemplatesPage() {
  return <TemplateExplorer />;
}
