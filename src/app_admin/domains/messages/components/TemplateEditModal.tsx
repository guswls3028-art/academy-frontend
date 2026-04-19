// PATH: src/app_admin/domains/messages/components/TemplateEditModal.tsx
// 템플릿 생성/수정 모달 — 좌: 미리보기+카테고리 / 우: 본문+삽입 블록

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "antd";
import { FiAlertCircle } from "react-icons/fi";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button, Tabs } from "@/shared/ui/ds";
import {
  getBlocksForCategory,
  getBlockColor,
  renderPreviewBadges,
  TEMPLATE_CATEGORY_LABELS,
  type TemplateCategory,
} from "../constants/templateBlocks";
import GradesBlockPanel from "./GradesBlockPanel";
import AlimtalkTemplateInfoPanel, { getAlimtalkTemplateType, getAlimtalkTemplateTypeFromCategory, getAutoFillBlockIds, renderAlimtalkFullPreview } from "./AlimtalkTemplateInfoPanel";
import type { MessageTemplateItem, MessageTemplatePayload } from "../api/messages.api";

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
  /** 삭제 콜백. 주어지면 수정 모드에서 삭제 버튼 표시 */
  onDelete?: (id: number) => void;
  isDeleting?: boolean;
  /** 자동발송 트리거명 (통합 알림톡 템플릿 타입 판별용) */
  trigger?: string;
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
  onDelete,
  isDeleting = false,
  trigger,
}: TemplateEditModalProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [activeTab, setActiveTab] = useState<EditorTab>("message");
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>(category);
  const alimtalkType = getAlimtalkTemplateType(trigger) ?? getAlimtalkTemplateTypeFromCategory(selectedCategory);
  // Ant Design Input.TextArea ref는 래퍼 객체 — native textarea를 직접 찾는다
  const bodyWrapRef = useRef<HTMLDivElement>(null);
  const getNativeTextarea = useCallback(
    () => bodyWrapRef.current?.querySelector("textarea") ?? null,
    []
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const blocks = getBlocksForCategory(selectedCategory);
  const isSystem = !!initial?.is_system;

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setSubject(initial?.subject ?? "");
      setBody(initial?.body ?? "");
      setActiveTab("message");
      setSelectedCategory(initial?.category ?? category);
      setConfirmDelete(false);
    }
  }, [open, initial?.id, initial?.name, initial?.subject, initial?.body, initial?.category, category]);

  const insertBlock = useCallback(
    (insertText: string) => {
      const ta = getNativeTextarea();
      if (!ta) {
        setBody((prev) => prev + insertText);
        return;
      }
      const start = ta.selectionStart ?? ta.value.length;
      const end = ta.selectionEnd ?? start;
      setBody((prev) => {
        const before = prev.slice(0, start);
        const after = prev.slice(end);
        return before + insertText + after;
      });
      const newPos = start + insertText.length;
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(newPos, newPos);
      });
    },
    [getNativeTextarea]
  );

  const handleSubmit = () => {
    const n = name.trim();
    const b = body.trim();
    if (!n || !b) return;
    onSubmit({
      category: selectedCategory as import("../api/messages.api").MessageTemplateCategory,
      name: n,
      subject: subject.trim(),
      body: b,
    });
  };

  const badgeBody = renderPreviewBadges(body);
  const badgeSubject = renderPreviewBadges(subject);
  const showSubject = activeTab === "alimtalk";

  // signup만 자체 Solapi 템플릿 → 알림톡 탭 불필요. 나머지 모든 카테고리는 통합 4종 사용 가능.
  const showAlimtalkTab = selectedCategory !== "signup";
  const editorTabItems: import("@/shared/ui/ds/Tabs").TabItem[] = [
    { key: "message", label: "메시지" },
    ...(showAlimtalkTab ? [{ key: "alimtalk", label: "알림톡" }] : []),
  ];

  if (!open) return null;

  const title = isSystem ? "기본 템플릿 보기" : initial ? "템플릿 수정" : "템플릿 추가";
  const fieldsDisabled = isPending || isSystem;

  return (
    <AdminModal open={open} onClose={onClose} width={1000} zIndex={zIndex} onEnterConfirm={!isPending && !isSystem ? handleSubmit : undefined}>
      <ModalHeader title={title} />
      <ModalBody>
        <div className="template-editor flex gap-5" style={{ minHeight: 0, flex: "1 1 auto" }}>
          {/* 좌측: 카테고리 + 미리보기 */}
          <div
            className="template-editor__left shrink-0 flex flex-col gap-4 p-4 overflow-hidden"
            style={{ width: 300 }}
          >
            {/* 카테고리 (읽기 전용) */}
            <section>
              <div className="template-editor__blocks-title mb-1">카테고리</div>
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 8,
                  background: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                  color: "var(--color-primary)",
                }}
              >
                {TEMPLATE_CATEGORY_LABELS[selectedCategory]}
              </span>
            </section>

            <section>
              <div className="template-editor__preview-title mb-2">
                실제 수신자에게 이렇게 보입니다
              </div>
              {activeTab === "message" ? (
                <div className="template-preview-phone" aria-label="아이폰 메시지 미리보기">
                  <div className="template-preview-phone__screen">
                    <div className="template-preview-phone__bubble" style={{ lineHeight: 1.7 }}>
                      {body ? badgeBody : (
                        <span className="template-editor__preview-placeholder">본문을 입력하면 미리보기가 표시됩니다.</span>
                      )}
                    </div>
                    <div className="template-preview-phone__time">오전 9:00</div>
                  </div>
                </div>
              ) : (
                <div className="template-preview-kakao" aria-label="카카오톡 알림톡 미리보기">
                  <div className="template-preview-kakao__card">
                    {alimtalkType ? (
                      /* 통합 알림톡 — 전체 템플릿 구조 미리보기 */
                      <>
                        <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginBottom: 4, fontStyle: "italic" }}>
                          예시 데이터로 표시됩니다. 실제 발송 시 학원/학생 정보가 자동으로 채워집니다.
                        </div>
                        <div className="template-preview-kakao__body" style={{ lineHeight: 1.7, whiteSpace: "pre-wrap", fontSize: 12 }}>
                          {renderAlimtalkFullPreview(alimtalkType, body, undefined, trigger)}
                        </div>
                      </>
                    ) : (
                      <>
                        {subject && (
                          <div className="template-preview-kakao__title" style={{ lineHeight: 1.7 }}>{badgeSubject}</div>
                        )}
                        <div className="template-preview-kakao__body" style={{ lineHeight: 1.7 }}>
                          {body ? badgeBody : (
                            <span className="template-editor__preview-placeholder">본문을 입력하면 미리보기가 표시됩니다.</span>
                          )}
                        </div>
                      </>
                    )}
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
            {/* 시스템 기본 템플릿 안내 */}
            {isSystem && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 14px", borderRadius: 8,
                background: "color-mix(in srgb, var(--color-status-info, #2563eb) 8%, transparent)",
                border: "1px solid color-mix(in srgb, var(--color-status-info, #2563eb) 25%, transparent)",
                fontSize: 13, color: "var(--color-status-info, #2563eb)", fontWeight: 600,
              }}>
                <FiAlertCircle size={14} style={{ flexShrink: 0 }} />
                기본 템플릿은 수정할 수 없습니다. 복제하여 사용해 주세요.
              </div>
            )}
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
                disabled={fieldsDisabled}
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
                    disabled={fieldsDisabled}
                    className="template-editor__textarea message-domain-input"
                  />
                </>
              ) : (
                <div className="template-editor__subject-placeholder" aria-hidden />
              )}
            </div>

            {/* 본문 — 2패널: 입력 | 삽입 블록 */}
            <div className="template-editor__body-row flex-1 min-h-0 flex gap-4">
              <div ref={bodyWrapRef} className="template-editor__body-input flex-1 min-w-0 flex flex-col">
                <label className="template-editor__editor-title block mb-1">
                  {alimtalkType && activeTab === "alimtalk"
                    ? "안내 문구 (알림톡 #{내용} 영역)"
                    : "본문 (직접 입력 또는 오른쪽 블록 클릭하여 삽입)"}
                </label>
                <Input.TextArea
                  placeholder="내용을 입력하세요. 오른쪽 블록을 클릭하면 치환 변수가 삽입됩니다."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={14}
                  disabled={fieldsDisabled}
                  className="template-editor__textarea message-domain-input w-full p-3"
                  style={{ resize: "vertical", fontFamily: "inherit", minHeight: 280 }}
                />
              </div>
              <div className="template-editor__body-blocks shrink-0 flex flex-col" style={{ width: 240 }}>
                <div className="template-editor__blocks-title mb-2">변수 삽입</div>
                <div className="template-editor__block-list flex flex-col content-start overflow-auto p-1">
                  {alimtalkType && activeTab === "alimtalk" ? (
                    <>
                      <AlimtalkTemplateInfoPanel templateType={alimtalkType} disabled={fieldsDisabled} />
                      {(() => {
                        const autoIds = getAutoFillBlockIds(alimtalkType);
                        const bodyBlocks = blocks.filter((b) => !autoIds.has(b.id) && b.id !== "site_link");
                        if (!bodyBlocks.length) return null;
                        return (
                          <div style={{ marginTop: 12 }}>
                            <div style={{
                              fontSize: 10, fontWeight: 700,
                              color: "var(--color-text-muted)",
                              letterSpacing: "0.3px",
                              marginBottom: 6,
                            }}>
                              본문에 삽입 가능한 변수
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {bodyBlocks.map((block) => {
                                const bc = getBlockColor(block.id);
                                return (
                                  <button
                                    key={block.id}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => insertBlock(block.insertText)}
                                    disabled={fieldsDisabled}
                                    className="template-editor__block-tag"
                                    style={{ background: bc.bg, color: bc.color, borderColor: bc.border }}
                                    title={block.description}
                                  >
                                    {block.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  ) : selectedCategory === "grades" ? (
                    <GradesBlockPanel blocks={blocks} onInsert={insertBlock} disabled={fieldsDisabled} currentBody={body} />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {blocks.map((block) => {
                        const bc = getBlockColor(block.id);
                        return (
                          <button
                            key={block.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => insertBlock(block.insertText)}
                            disabled={fieldsDisabled}
                            className="template-editor__block-tag"
                            style={{ background: bc.bg, color: bc.color, borderColor: bc.border }}
                          >
                            {block.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter
        left={
          initial && onDelete && !initial.is_system ? (
            confirmDelete ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "var(--color-status-danger, #dc2626)" }}>
                  정말 삭제할까요?
                </span>
                <Button
                  intent="danger"
                  size="sm"
                  onClick={() => onDelete(initial.id)}
                  disabled={isDeleting}
                >
                  {isDeleting ? "삭제 중…" : "삭제"}
                </Button>
                <Button
                  intent="secondary"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  disabled={isDeleting}
                >
                  취소
                </Button>
              </div>
            ) : (
              <Button
                intent="secondary"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                disabled={isPending || isDeleting}
                style={{ color: "var(--color-status-danger, #dc2626)" }}
              >
                삭제
              </Button>
            )
          ) : undefined
        }
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={isPending || isDeleting}>
              {isSystem ? "닫기" : "취소"}
            </Button>
            {!isSystem && (
              <Button
                intent="primary"
                onClick={handleSubmit}
                disabled={!name.trim() || !body.trim() || isPending || isDeleting}
              >
                {isPending ? "저장 중…" : initial ? "수정" : "저장"}
              </Button>
            )}
          </>
        }
      />
    </AdminModal>
  );
}
