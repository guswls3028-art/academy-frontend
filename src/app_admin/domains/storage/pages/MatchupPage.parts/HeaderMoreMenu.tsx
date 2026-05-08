// PATH: src/app_admin/domains/storage/pages/MatchupPage.parts/HeaderMoreMenu.tsx
// 헤더 보조 액션 ⋮ 메뉴 — 원본보기/저장소/일괄삭제 등 자주 안 쓰는 액션을 묶어 노이즈 감소.
// 학원장이 메인 CTA(적중보고서/직접자르기)에 집중할 수 있도록 분리.
//
// 인라인 스타일은 popover absolute positioning + 동적 hover 색상 매핑 때문에
// 의도적 사용. 부모 MatchupPage.tsx 와 동일 정책.
/* eslint-disable no-restricted-syntax */

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Eye, FolderOpen, Trash2 } from "lucide-react";
import { Button, ICON } from "@/shared/ui/ds";

const moreMenuItemStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  width: "100%", padding: "8px 12px",
  background: "transparent", border: "none",
  borderRadius: "var(--radius-sm)",
  textAlign: "left", fontSize: 13, fontWeight: 500,
  color: "var(--color-text-primary)",
  cursor: "pointer", fontFamily: "inherit",
};

export default function HeaderMoreMenu({
  onPreview,
  onOpenStorage,
  onBulkDelete,
}: {
  onPreview: () => void;
  onOpenStorage: (() => void) | null;
  /** P2 헤더 정비 — 자주 안 쓰이는 "범위 일괄삭제"를 ⋮ 메뉴 안으로 이동 */
  onBulkDelete: (() => void) | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <Button
        size="sm"
        intent="ghost"
        onClick={() => setOpen((v) => !v)}
        title="더 보기"
        data-testid="matchup-doc-more-menu-trigger"
        leftIcon={<MoreHorizontal size={ICON.sm} />}
      >
        더 보기
      </Button>
      {open && (
        <div
          role="menu"
          data-testid="matchup-doc-more-menu"
          style={{
            position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 30,
            minWidth: 200, padding: 4,
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-divider)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            display: "flex", flexDirection: "column", gap: 1,
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onPreview(); }}
            data-testid="matchup-doc-preview-btn"
            style={moreMenuItemStyle}
          >
            <Eye size={ICON.sm} />
            <span>원본 PDF 보기</span>
          </button>
          {onOpenStorage && (
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onOpenStorage(); }}
              data-testid="matchup-doc-storage-link"
              style={moreMenuItemStyle}
            >
              <FolderOpen size={ICON.sm} />
              <span>저장소에서 보기</span>
            </button>
          )}
          {onBulkDelete && (
            <>
              <div style={{
                height: 1, background: "var(--color-border-divider)", margin: "2px 0",
              }} />
              <button
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); onBulkDelete(); }}
                data-testid="matchup-doc-bulk-delete-menu-item"
                style={{
                  ...moreMenuItemStyle,
                  color: "var(--color-danger)",
                }}
              >
                <Trash2 size={ICON.sm} />
                <span>자동분리 잔존 일괄삭제</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
