// PATH: src/app_admin/domains/tools/omr/pages/OmrGeneratorPage.tsx
// OMR 답안지 생성 도구 — 시험 탭과 동일한 OmrSheetBuilder SSOT 사용

import OmrSheetBuilder from "@admin/domains/exams/components/omr/OmrSheetBuilder";

export default function OmrGeneratorPage() {
  return (
    <OmrSheetBuilder
      target={{ type: "tool" }}
      initialExamTitle="제1회 단원평가"
      initialLectureName="수학"
      initialSessionName="1차시"
      initialMcCount={20}
      initialEssayCount={5}
      countsEditable
      layout="page"
    />
  );
}
