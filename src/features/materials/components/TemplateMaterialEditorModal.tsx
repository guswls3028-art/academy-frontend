// PATH: src/features/materials/components/TemplateMaterialEditorModal.tsx
// WHY:
// 템플릿 시험의 OMR 자산 편집을 단일 진입점에서 완결하기 위한 공용 모달.
// assets 도메인(PDF/meta)을 소비만 하며, 시험/채점 책임을 넘지 않는다.
// 이 모달 하나로 운영자가 “생성 → 확인 → 안내” 흐름을 끝낸다.

import { useState } from "react";
import { createPortal } from "react-dom";
import { AssetsTab } from "./TemplateMaterialEditorModal.AssetsTab";
import { MetaPreviewTab } from "./TemplateMaterialEditorModal.MetaPreviewTab";

type TabKey = "assets" | "meta" | "guide";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function TemplateMaterialEditorModal({ open, onClose }: Props) {
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
          {tab === "assets" && <AssetsTab />}
          {tab === "meta" && <MetaPreviewTab />}
          {tab === "guide" && (
            <div className="space-y-2 text-sm">
              <p>이 시험지는 템플릿 단일진실 기반 OMR 답안지입니다.</p>
              <p>스캔/촬영 인식 안정성을 위해 레이아웃 수정은 허용되지 않습니다.</p>
              <p>정답, 채점, 결과는 다른 도메인의 책임입니다.</p>
            </div>
          )}
        </section>
      </div>
    </div>,
    document.body
  );
}
