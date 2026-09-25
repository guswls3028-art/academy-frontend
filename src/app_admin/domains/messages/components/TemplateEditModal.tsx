// PATH: src/app_admin/domains/messages/components/TemplateEditModal.tsx
// 템플릿 생성/수정 모달 — 좌: 미리보기+카테고리 / 우: 본문+삽입 블록

/* eslint-disable no-restricted-syntax -- 템플릿 미리보기 patch 다수, baseline shift fix (2026-05-14) */

import { useState, useEffect, useRef, useCallback, useId } from "react";
import { Input } from "antd";
import { FiAlertCircle } from "react-icons/fi";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import KakaoAlimtalkPreview from "@/shared/ui/notifications/KakaoAlimtalkPreview";
import {
  getBlocksForCategory,
  getBlockColor,
  renderPlainMessagePreview,
  TEMPLATE_CATEGORY_LABELS,
  type TemplateCategory,
} from "../constants/templateBlocks";
import {
  hideInternalAlimtalkMemoToken,
  stripInternalAlimtalkMemoToken,
} from "../constants/alimtalkEnvelope";
import GradesBlockPanel from "./GradesBlockPanel";
import MessageBodyEditor, { type MessageBodyEditorHandle } from "./MessageBodyEditor";
import { useMessageAcademyName } from "../hooks/useMessageAcademyName";
import AlimtalkTemplateInfoPanel, {
  getAlimtalkTemplateType,
  getAlimtalkTemplateTypeFromCategory,
  getAutoFillBlockIds,
  isAlimtalkTemplateBodyEditable,
  renderAlimtalkFullPreview,
} from "./AlimtalkTemplateInfoPanel";
import type { MessageTemplateItem, MessageTemplatePayload } from "../api/messages.api";

import "../styles/templateEditor.css";

export type TemplateEditModalProps = {
  open: boolean;
  onClose: () => void;
  category: TemplateCategory;
  initial?: MessageTemplateItem | null;
  onSubmit: (payload: MessageTemplatePayload) => void;
  isPending?: boolean;
  zIndex?: number;
  /** 삭제 콜백. 주어지면 수정 모드에서 삭제 버튼 표시 */
  onDelete?: (id: number) => void;
  onDuplicate?: (template: MessageTemplateItem) => void;
  isDeleting?: boolean;
  /** 자동발송 트리거명 (통합 알림톡 템플릿 타입 판별용) */
  trigger?: string;
};

export default function TemplateEditModal({
  open,
  onClose,
  category,
  initial = null,
  onSubmit,
  isPending = false,
  zIndex,
  onDelete,
  onDuplicate,
  isDeleting = false,
  trigger,
}: TemplateEditModalProps) {
  const { data: academyName = "", isError: isAcademyError, refetch: refetchAcademy } = useMessageAcademyName(open);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>(category);
  const alimtalkType = getAlimtalkTemplateType(trigger) ?? getAlimtalkTemplateTypeFromCategory(selectedCategory, name);
  const bodyEditableInEnvelope = isAlimtalkTemplateBodyEditable(alimtalkType);
  const bodyEditorRef = useRef<MessageBodyEditorHandle>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [individualExpanded, setIndividualExpanded] = useState(false);
  const individualRegionId = useId();
  const blocks = getBlocksForCategory(selectedCategory);
  const isSystem = !!initial?.is_system;

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setSubject(initial?.subject ?? "");
      setBody(stripInternalAlimtalkMemoToken(initial?.body ?? ""));
      setSelectedCategory(initial?.category ?? category);
      setConfirmDelete(false);
      setIndividualExpanded((initial?.category ?? category) === "grades");
    }
  }, [open, initial?.id, initial?.name, initial?.subject, initial?.body, initial?.category, category]);

  const insertBlock = useCallback(
    (insertText: string) => {
      bodyEditorRef.current?.insert(insertText);
    },
    []
  );

  const handleSubmit = () => {
    const n = name.trim();
    const b = stripInternalAlimtalkMemoToken(body);
    if (!n || !b) return;
    onSubmit({
      category: selectedCategory as import("../api/messages.api").MessageTemplateCategory,
      name: n,
      subject: subject.trim(),
      body: b,
    });
  };

  const showSubject = !alimtalkType;

  if (!open) return null;

  const title = isSystem ? "기본 문구 보기" : initial ? "문구 수정" : "문구 추가";
  const fieldsDisabled = isPending || isSystem;

  return (
    <AdminModal open={open} onClose={onClose} width={1160} className="message-template-edit-modal" zIndex={zIndex} onEnterConfirm={!isPending && !isSystem ? handleSubmit : undefined}>
      <ModalHeader title={title} />
      <ModalBody>
        <div className="template-editor flex gap-5">
          {/* 좌측: 카테고리 + 미리보기 */}
          <div
            className="template-editor__left shrink-0 flex flex-col gap-4 p-4 overflow-hidden"
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
                문구 배치 예시
              </div>
              {alimtalkType && <p className="message-template-preview-help">
                {isAcademyError ? <span role="alert">발송 학원명을 불러오지 못했습니다. <Button intent="ghost" size="sm" onClick={() => void refetchAcademy()}>다시 확인</Button></span>
                  : "이 화면의 이름·날짜 등은 예시입니다. 수신자별 문구는 발송 화면에서 확인하세요."}
              </p>}
              <KakaoAlimtalkPreview channelLabel={TEMPLATE_CATEGORY_LABELS[selectedCategory]} subject={alimtalkType ? undefined : subject}>
                {body
                  ? renderPlainMessagePreview(
                    alimtalkType
                      ? renderAlimtalkFullPreview(alimtalkType, hideInternalAlimtalkMemoToken(body, ""), undefined, { 학원명: academyName })
                      : hideInternalAlimtalkMemoToken(body),
                    { 학원명: academyName, 학원이름: academyName },
                  )
                  : "본문을 입력하면 미리보기가 표시됩니다."}
              </KakaoAlimtalkPreview>
              <p className="message-template-preview-help">
                저장한 문구는 발송 전 서버 확인을 거쳐 학생별 전체 문구로 표시됩니다.
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
                제공 문구는 원본을 유지합니다. 복제하면 내 문구로 수정할 수 있습니다.
              </div>
            )}
            <div className="message-template-edit-heading">
              <span>안내문 작성</span>
              <span className="message-template-channel">알림톡</span>
            </div>

            <div>
              <label className="template-editor__editor-title block mb-1">문구 이름</label>
              <Input
                placeholder="예: 출석 안내, 시험 일정 공지"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={fieldsDisabled}
                className="template-editor__textarea message-domain-input"
              />
            </div>

            {showSubject && (
              <div>
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
              </div>
            )}

            {/* 본문 — 2패널: 입력 | 삽입 블록 */}
            <div className="template-editor__body-row flex-1 min-h-0 flex gap-4">
              <div className="template-editor__body-input flex-1 min-w-0 flex flex-col">
                <label className="template-editor__editor-title block mb-1">
                  {alimtalkType
                    ? bodyEditableInEnvelope
                      ? "안내 문구"
                      : "메모 (이 알림톡에는 표시되지 않음)"
                    : "본문"}
                </label>
                <MessageBodyEditor
                  key={`${open}:${initial?.id ?? "new"}`}
                  ref={bodyEditorRef}
                  placeholder={
                    alimtalkType && !bodyEditableInEnvelope
                      ? "이 알림톡은 정해진 안내문으로 발송됩니다."
                      : "안내문을 작성하고 필요한 정보를 블록으로 넣으세요."
                  }
                  value={body}
                  onChange={setBody}
                  disabled={fieldsDisabled}
                />
              </div>
              <div className="template-editor__body-blocks shrink-0 flex flex-col">
                <div className="template-editor__blocks-title mb-2">정보 넣기</div>
                <div className="template-editor__block-list flex flex-col content-start overflow-auto p-1">
                  {alimtalkType ? (
                    <>
                      {(() => {
                        const autoIds = getAutoFillBlockIds(alimtalkType);
                        const bodyBlocks = bodyEditableInEnvelope
                          ? blocks.filter((b) => !autoIds.has(b.id) && b.id !== "site_link")
                          : [];
                        if (!bodyBlocks.length) return null;
                        const individual = (id: string) => /^(exam|hw)_\d+(?:_|$)/.test(id);
                        const individualBlocks = bodyBlocks.filter((block) => individual(block.id));
                        const renderBlocks = (items: typeof bodyBlocks) => (
                          <div className="flex flex-wrap gap-2">
                              {items.map((block) => {
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
                        );
                        return (
                          <div className="message-template-insert-options">
                            {renderBlocks(bodyBlocks.filter((block) => !individual(block.id)))}
                            {individualBlocks.length > 0 && (
                              <div className="message-template-individual-blocks">
                                <button type="button"
                                  className="message-template-individual-toggle"
                                  aria-label="시험·과제별 정보 더 보기"
                                  aria-expanded={individualExpanded} aria-controls={individualRegionId}
                                  onClick={() => setIndividualExpanded((expanded) => !expanded)}>
                                  시험·과제별 정보 더 보기
                                </button>
                                <div id={individualRegionId} hidden={!individualExpanded}>
                                  {renderBlocks(individualBlocks)}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <AlimtalkTemplateInfoPanel templateType={alimtalkType} disabled={fieldsDisabled} />
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
            {isSystem && initial && onDuplicate && (
              <Button intent="primary" onClick={() => onDuplicate(initial)} disabled={isPending}>
                {isPending ? "복제 중…" : "복제해서 수정"}
              </Button>
            )}
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
