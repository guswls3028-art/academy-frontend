// PATH: src/features/messages/components/TemplateEditModal.tsx
// 템플릿 추가/수정 모달 — 좌: 미리보기+블록 / 우: 본문(게시판형), 뷰 모드(잠금) 지원

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "antd";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button, Tabs } from "@/shared/ui/ds";
import {
  getBlocksForCategory,
  renderPreviewText,
  TEMPLATE_CATEGORY_LABELS,
  type TemplateCategory,
} from "../constants/templateBlocks";
import type { MessageTemplateItem, MessageTemplatePayload } from "../api/messages.api";

const CATEGORIES: TemplateCategory[] = [
  "default",
  "signup",
  "attendance",
  "lecture",
  "exam",
  "assignment",
  "grades",
  "clinic",
  "payment",
  "notice",
];
import "../styles/templateEditor.css";

export type TemplateEditModalProps = {
  open: boolean;
  onClose: () => void;
  category: TemplateCategory;
  initial?: MessageTemplateItem | null;
  /** true면 기존 템플릿을 잠금(읽기 전용) 상태로 연다. 더블클릭 시 사용 */
  defaultLocked?: boolean;
  onSubmit: (payload: MessageTemplatePayload) => void;
  isPending?: boolean;
  /** 다른 모달 위에 띄울 때 더 높은 z-index (예: 학생 등록 모달 안에서 열 때) */
  zIndex?: number;
};

type EditorTab = "message" | "alimtalk";

export default function TemplateEditModal({
  open,
  onClose,
  category,
  initial = null,
  defaultLocked = false,
  onSubmit,
  isPending = false,
  zIndex,
}: TemplateEditModalProps) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [activeTab, setActiveTab] = useState<EditorTab>("message");
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>(category);
  const [isLocked, setIsLocked] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const blocks = getBlocksForCategory(selectedCategory);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setSubject(initial?.subject ?? "");
      setBody(initial?.body ?? "");
      setActiveTab("message");
      setSelectedCategory(initial?.category ?? category);
      setIsLocked(Boolean(initial && defaultLocked));
    }
  }, [open, initial?.id, initial?.name, initial?.subject, initial?.body, initial?.category, category, defaultLocked]);

  const insertBlock = useCallback(
    (insertText: string) => {
      const ta = bodyRef.current;
      if (!ta) {
        setBody((prev) => prev + insertText);
        return;
      }
      const start = ta.selectionStart;
      const end = ta.selectionEnd ?? start;
      const before = body.slice(0, start);
      const after = body.slice(end);
      setBody(before + insertText + after);
      setTimeout(() => {
        ta.focus();
        const newPos = start + insertText.length;
        ta.setSelectionRange(newPos, newPos);
      }, 0);
    },
    [body]
  );

  const handleSubmit = () => {
    const n = name.trim();
    const b = body.trim();
    if (!n || !b) return;
    onSubmit({
      category: selectedCategory,
      name: n,
      subject: subject.trim(),
      body: b,
    });
  };

  const previewBody = renderPreviewText(body);
  const previewSubject = renderPreviewText(subject);
  const locked = isLocked || isPending;
  const showSubject = activeTab === "alimtalk";

  const editorTabItems = [
    { key: "message", label: "메시지" },
    { key: "alimtalk", label: "알림톡" },
  ] as const;

  if (!open) return null;

  const title = initial
    ? isLocked
      ? "템플릿 보기"
      : "템플릿 수정"
    : "템플릿 추가";

  return (
    <AdminModal open={open} onClose={onClose} width={1000} zIndex={zIndex} onEnterConfirm={!isPending ? handleSubmit : undefined}>
      <ModalHeader title={title} />
      <ModalBody>
        <div className="template-editor flex gap-5" style={{ minHeight: 420 }}>
          {/* 좌측: 카테고리 + 미리보기만 (삽입 블록은 우측 본문 옆으로 이동) */}
          <div
            className="template-editor__left shrink-0 flex flex-col gap-4 p-4 overflow-hidden"
            style={{ width: 300 }}
          >
            {/* 카테고리: 기본 | 강의 | 클리닉 (모달 내 입체탭) */}
            <section>
              <div className="template-editor__blocks-title mb-2">카테고리</div>
              <div className="modal-tabs-elevated">
                <div className="ds-tabs">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`ds-tab ${selectedCategory === cat ? "is-active" : ""}`}
                      onClick={() => !locked && setSelectedCategory(cat)}
                      disabled={locked}
                    >
                      {TEMPLATE_CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section>
              <div className="template-editor__preview-title mb-2">
                실제 수신자에게 이렇게 보입니다
              </div>
              {activeTab === "message" ? (
                <div className="template-preview-phone" aria-label="아이폰 메시지 미리보기">
                  <div className="template-preview-phone__screen">
                    <div className="template-preview-phone__bubble">
                      {previewBody || (
                        <span className="template-editor__preview-placeholder">본문을 입력하면 미리보기가 표시됩니다.</span>
                      )}
                    </div>
                    <div className="template-preview-phone__time">오전 9:00</div>
                  </div>
                </div>
              ) : (
                <div className="template-preview-kakao" aria-label="카카오톡 알림톡 미리보기">
                  <div className="template-preview-kakao__card">
                    {previewSubject && (
                      <div className="template-preview-kakao__title">{previewSubject}</div>
                    )}
                    <div className="template-preview-kakao__body">
                      {previewBody || (
                        <span className="template-editor__preview-placeholder">본문을 입력하면 미리보기가 표시됩니다.</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <p className="mt-2 text-[10px] text-[var(--color-text-muted)]">
                {activeTab === "message" ? "아이폰 메시지 예시" : "카카오톡 알림톡 예시"} (치환 변수는 샘플 값)
              </p>
            </section>
          </div>

          {/* 우측: 메시지|알림톡 탭 상단 → 이름·제목 → 본문 2패널(입력 | 삽입 블록) */}
          <div className="template-editor__right flex-1 min-w-0 flex flex-col gap-2 p-4">
            {/* 메시지/알림톡 탭 — 상단 배치 */}
            <div className="modal-tabs-elevated template-editor__tabs template-editor__tabs--top">
              <Tabs
                value={activeTab}
                onChange={(k) => setActiveTab(k as EditorTab)}
                items={editorTabItems}
              />
            </div>

            <div>
              <label className="template-editor__editor-title block mb-1">템플릿 이름</label>
              <Input
                placeholder="예: 출석 안내, 시험 일정 공지"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={locked}
                className="template-editor__textarea message-domain-input"
              />
            </div>

            {/* 제목 영역 고정 높이 — 메시지↔알림톡 전환 시 레이아웃 흔들림 방지 */}
            <div className={`template-editor__subject-slot ${showSubject ? "template-editor__subject-slot--has-subject" : ""}`}>
              {showSubject ? (
                <>
                  <label className="template-editor__editor-title block mb-1">
                    제목 (알림톡)
                  </label>
                  <Input
                    placeholder="알림톡 제목"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={locked}
                    className="template-editor__textarea message-domain-input"
                  />
                </>
              ) : (
                <div className="template-editor__subject-placeholder" aria-hidden />
              )}
            </div>

            {/* 본문 영역 — 2패널: 좌측 입력 | 우측 삽입 블록 */}
            <div className="template-editor__body-row flex-1 min-h-0 flex gap-4">
              <div className="template-editor__body-input flex-1 min-w-0 flex flex-col">
                <label className="template-editor__editor-title block mb-1">
                  본문 (직접 입력 또는 오른쪽 블록 클릭하여 삽입)
                </label>
                <Input.TextArea
                  ref={bodyRef}
                  placeholder="내용을 입력하세요. 오른쪽 블록을 클릭하면 치환 변수가 삽입됩니다."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={14}
                  disabled={locked}
                  className="template-editor__textarea message-domain-input w-full p-3"
                  style={{ resize: "vertical", fontFamily: "inherit", minHeight: 280 }}
                />
              </div>
              <div className="template-editor__body-blocks shrink-0 flex flex-col" style={{ width: 220 }}>
                <div className="template-editor__blocks-title mb-2">삽입 블록</div>
                <div className="template-editor__block-list flex flex-wrap gap-2 content-start overflow-auto p-1">
                  {blocks.map((block, idx) => (
                    <button
                      key={block.id}
                      type="button"
                      onClick={() => insertBlock(block.insertText)}
                      disabled={locked}
                      className={`template-editor__block-tag template-editor__block-tag--${selectedCategory} template-editor__block-tag--n${idx % 3}`}
                    >
                      {block.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <>
            {isLocked ? (
              <>
                <Button intent="secondary" onClick={onClose}>
                  닫기
                </Button>
                <Button intent="primary" onClick={() => setIsLocked(false)}>
                  수정하기
                </Button>
              </>
            ) : (
              <>
                <Button intent="secondary" onClick={onClose} disabled={isPending}>
                  취소
                </Button>
                <Button
                  intent="primary"
                  onClick={handleSubmit}
                  disabled={!name.trim() || !body.trim() || isPending}
                >
                  {isPending ? "저장 중…" : initial ? "수정" : "저장"}
                </Button>
              </>
            )}
          </>
        }
      />
    </AdminModal>
  );
}

