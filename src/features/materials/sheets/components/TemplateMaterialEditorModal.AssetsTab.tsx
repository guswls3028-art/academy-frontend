// PATH: src/features/materials/components/TemplateMaterialEditorModal.tsx
// SSOT ALIGN:
// - OMR/자산 생성은 exams 도메인(/exams/*) 기준으로 동작한다.
// - meta preview는 assets meta endpoint를 그대로 보여준다(가공 금지).

import { useState } from "react";
import { createPortal } from "react-dom";
import { AssetsTab } from "./TemplateMaterialEditorModal.AssetsTab";
import { MetaPreviewTab } from "./TemplateMaterialEditorModal.MetaPreviewTab";

type TabKey = "assets" | "meta" | "guide";

interface Props {
  open: boolean;
  onClose: () => void;
  templateExamId?: number; // ✅ optional (기존 호출부 안전)
}

export function TemplateMaterialEditorModal({ open, onClose, templateExamId }: Props) {
  const [tab, setTab] = useState<TabKey>("assets");

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white w-[920px] max-h-[90vh] rounded shadow flex flex-col">
        <header className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">OMR 템플릿 자산</h2>
          <button onClick={onClose} className="text-sm text-gray-500">
            닫기
          </button>
        </header>

        <nav className="px-6 pt-3 flex gap-4 text-sm">
          <button onClick={() => setTab("assets")} className={tab === "assets" ? "font-semibold" : ""}>
            자산
          </button>
          <button onClick={() => setTab("meta")} className={tab === "meta" ? "font-semibold" : ""}>
            구조 정보
          </button>
          <button onClick={() => setTab("guide")} className={tab === "guide" ? "font-semibold" : ""}>
            안내
          </button>
        </nav>

        <section className="px-6 py-4 overflow-auto flex-1">
          {tab === "assets" && <AssetsTab templateExamId={templateExamId} />}
          {tab === "meta" && <MetaPreviewTab />}
          {tab === "guide" && (
            <div className="space-y-2 text-sm">
              <p>이 시험지는 템플릿 단일진실 기반 OMR 답안지입니다.</p>
              <p>운영 시험(regular)에서는 템플릿 구조(문항/정답/자산)를 직접 수정할 수 없습니다.</p>
              <p>정답, 채점, 결과는 다른 도메인의 책임입니다.</p>
            </div>
          )}
        </section>
      </div>
    </div>,
    document.body
  );
}
