// PATH: src/features/messages/components/TemplateEditModal.tsx
// 템플릿 생성/수정 모달 — 좌: 미리보기+카테고리 / 우: 본문+삽입 블록

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "antd";
import { FiAlertCircle } from "react-icons/fi";
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
  /** @deprecated view 모드 제거됨. 항상 수정 모드로 열림 */
  defaultLocked?: boolean;
  onSubmit: (payload: MessageTemplatePayload) => void;
  isPending?: boolean;
  zIndex?: number;
  /** SMS/메시지 발송 연동 여부. false이면 메시지 탭에 연동 안내 표시 */
  smsConnected?: boolean;
};

type EditorTab = "message" | "alimtalk";

export default function TemplateEditModal({
  open,
  onClose,
  category,
  initial = null,
  onSubmit,
  isPending = false,
  zIndex,
  smsConnected = true,
}: TemplateEditModalProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [activeTab, setActiveTab] = useState<EditorTab>("message");
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>(category);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const blocks = getBlocksForCategory(selectedCategory);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setSubject(initial?.subject ?? "");
      setBody(initial?.body ?? "");
      setActiveTab("message");
      setSelectedCategory(initial?.category ?? category);
    }
  }, [open, initial?.id, initial?.name, initial?.subject, initial?.body, initial?.category, category]);

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
  const showSubject = activeTab === "alimtalk";

  const editorTabItems = [
    { key: "message", label: "메시지" },
    { key: "alimtalk", label: "알림톡" },
  ] as const;

  if (!open) return null;

  const title = initial ? "템플릿 수정" : "템플릿 추가";

  return (
    <AdminModal open={open} onClose={onClose} width={1000} zIndex={zIndex} onEnterConfirm={!isPending ? handleSubmit : undefined}>
      <ModalHeader title={title} />
      <ModalBody>
        <div className="template-editor flex gap-5" style={{ minHeight: 420 }}>
          {/* 좌측: 카테고리 + 미리보기 */}
          <div
            className="template-editor__left shrink-0 flex flex-col gap-4 p-4 overflow-hidden"
            style={{ width: 300 }}
          >
            {/* 카테고리 선택 */}
            <section>
              <div className="template-editor__blocks-title mb-2">카테고리</div>
              <div className="modal-tabs-elevated">
                <div className="ds-tabs">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`ds-tab ${selectedCategory === cat ? "is-active" : ""}`}
                      onClick={() => !isPending && setSelectedCategory(cat)}
                      disabled={isPending}
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

          {/* 우측: 편집 영역 */}
          <div className="template-editor__right flex-1 min-w-0 flex flex-col gap-2 p-4" style={{ position: "relative" }}>
            {/* 메시지/알림톡 탭 */}
            <div className="modal-tabs-elevated template-editor__tabs template-editor__tabs--top">
              <Tabs
                value={activeTab}
                onChange={(k) => setActiveTab(k as EditorTab)}
                items={editorTabItems}
              />
            </div>

            {/* SMS 연동 안내 오버레이 */}
            {activeTab === "message" && !smsConnected && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  top: 48,
                  zIndex: 10,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 16,
                  background: "color-mix(in srgb, var(--color-bg-surface) 92%, transparent)",
                  backdropFilter: "blur(2px)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <FiAlertCircle size={32} style={{ color: "var(--color-status-warning, #d97706)" }} />
                <p style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", textAlign: "center" }}>
                  문자(SMS) 발송을 위해 연동이 필요합니다
                </p>
                <p style={{ fontSize: 13, color: "var(--color-text-muted)", textAlign: "center", maxWidth: 320 }}>
                  발신번호 등록 및 메시지 연동 설정을 완료해야 SMS 템플릿을 사용할 수 있습니다.
                </p>
                <Button
                  intent="primary"
                  size="sm"
                  onClick={() => {
                    onClose();
                    navigate("/admin/message/settings");
                  }}
                >
                  메시지 설정으로 이동
                </Button>
              </div>
            )}

            <div>
              <label className="template-editor__editor-title block mb-1">템플릿 이름</label>
              <Input
                placeholder="예: 출석 안내, 시험 일정 공지"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                className="template-editor__textarea message-domain-input"
              />
            </div>

            {/* 제목 영역 고정 높이 */}
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
                    disabled={isPending}
                    className="template-editor__textarea message-domain-input"
                  />
                </>
              ) : (
                <div className="template-editor__subject-placeholder" aria-hidden />
              )}
            </div>

            {/* 본문 — 2패널: 입력 | 삽입 블록 */}
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
                  disabled={isPending}
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
                      disabled={isPending}
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
        }
      />
    </AdminModal>
  );
}
