// PATH: src/features/messages/components/SendMessageModal.tsx
// 공용 메시지 발송 모달 — 직접 입력 또는 기존 템플릿 불러와서 발송
// 수신자(학부모/학생), 발송 유형(SMS/알림톡) 다중 선택 가능. 템플릿 수정 모달과 비슷한 큰 레이아웃.

import { useState, useEffect } from "react";
import { Input } from "antd";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  fetchMessageTemplates,
  sendMessage,
  type MessageTemplateItem,
  type MessageMode,
  type SendToType,
} from "../api/messages.api";
import { useMessagingInfo } from "../hooks/useMessagingInfo";
import { TEMPLATE_CATEGORY_LABELS } from "../constants/templateBlocks";
import type { MessageTemplateCategory } from "../api/messages.api";
import "../styles/templateEditor.css";

export type SendMessageModalOpenOptions = {
  studentIds: number[];
  recipientLabel?: string;
};

export type SendMessageModalProps = {
  open: boolean;
  onClose: () => void;
  /** 호출한 화면에서 넘긴 수신자(학생 ID). 비어 있으면 발송 불가 안내 */
  initialStudentIds?: number[];
  /** 수신자 설명 (예: "선택한 학생 3명") */
  recipientLabel?: string;
};

type ContentMode = "free" | "template";

export default function SendMessageModal({
  open,
  onClose,
  initialStudentIds = [],
  recipientLabel,
}: SendMessageModalProps) {
  const [contentMode, setContentMode] = useState<ContentMode>("free");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  /** 수신자: 학부모·학생 둘 다 선택 가능 (최소 1개) */
  const [sendToParent, setSendToParent] = useState(true);
  const [sendToStudent, setSendToStudent] = useState(false);
  /** 발송 유형: SMS·알림톡 둘 다 선택 가능 (최소 1개). 선택한 각각에 대해 API 호출 */
  const [useSms, setUseSms] = useState(true);
  const [useAlimtalk, setUseAlimtalk] = useState(false);
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<MessageTemplateItem[]>([]);
  const { data: messagingInfo } = useMessagingInfo();
  const smsAllowed = messagingInfo?.sms_allowed ?? true;

  const studentIds = initialStudentIds;
  const hasRecipients = studentIds.length > 0;
  const sendToTargets: SendToType[] = [];
  if (sendToParent) sendToTargets.push("parent");
  if (sendToStudent) sendToTargets.push("student");
  const messageModes: MessageMode[] = [];
  if (useSms && smsAllowed) messageModes.push("sms");
  if (useAlimtalk) messageModes.push("alimtalk");
  const canSend =
    hasRecipients &&
    body.trim().length > 0 &&
    sendToTargets.length > 0 &&
    messageModes.length > 0;

  useEffect(() => {
    if (open) {
      setSubject("");
      setBody("");
      setSelectedTemplateId(null);
      setContentMode("free");
      setSendToParent(true);
      setSendToStudent(false);
      setUseSms(true);
      setUseAlimtalk(false);
    }
  }, [open]);

  useEffect(() => {
    if (open && !smsAllowed && useSms) {
      setUseSms(false);
      if (!useAlimtalk) setUseAlimtalk(true);
    }
  }, [open, smsAllowed, useSms, useAlimtalk]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchMessageTemplates()
      .then((list) => {
        if (!cancelled) setTemplates(list);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleLoadTemplate = (t: MessageTemplateItem) => {
    setSelectedTemplateId(t.id);
    setSubject(t.subject ?? "");
    setBody(t.body ?? "");
    setContentMode("template");
  };

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      let totalEnqueued = 0;
      let totalSkipped = 0;
      for (const sendTo of sendToTargets) {
        for (const messageMode of messageModes) {
          const payload: Parameters<typeof sendMessage>[0] = {
            student_ids: studentIds,
            send_to: sendTo,
            message_mode: messageMode,
            raw_body: body.trim(),
          };
          if (subject.trim()) payload.raw_subject = subject.trim();
          if (selectedTemplateId) payload.template_id = selectedTemplateId;
          const res = await sendMessage(payload);
          totalEnqueued += res.enqueued ?? 0;
          totalSkipped += res.skipped_no_phone ?? 0;
        }
      }
      const sendToLabel =
        sendToTargets.length === 2 ? "학부모·학생" : sendToTargets[0] === "parent" ? "학부모" : "학생";
      const modeLabel =
        messageModes.length === 2 ? "SMS·알림톡" : messageModes[0] === "sms" ? "SMS" : "알림톡";
      feedback.success(
        `${sendToLabel} ${modeLabel} 발송 예정 ${totalEnqueued}건입니다.`
      );
      if (totalSkipped > 0) {
        feedback.info(`전화번호 없음으로 ${totalSkipped}건 제외되었습니다.`);
      }
      onClose();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null;
      feedback.error(msg || "발송 요청에 실패했습니다.");
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const label =
    recipientLabel ?? (hasRecipients ? `선택한 학생 ${studentIds.length}명` : "수신자 없음");

  return (
    <AdminModal open={open} onClose={onClose} width={1000} onEnterConfirm={handleSend}>
      <ModalHeader title="메시지 발송" />
      <ModalBody>
        <div className="flex flex-col gap-5" style={{ minHeight: 420 }}>
          {/* 수신자: 학부모·학생 둘 다 선택 가능 */}
          <section>
            <div className="text-sm font-medium text-[var(--color-text-primary)] mb-2">수신자</div>
            {hasRecipients ? (
              <p className="text-sm text-[var(--color-text-muted)] mb-2">
                {label}
              </p>
            ) : null}
            {hasRecipients ? (
              <div className="flex flex-wrap items-center gap-6">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendToParent}
                    onChange={(e) => setSendToParent(e.target.checked)}
                  />
                  학부모
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendToStudent}
                    onChange={(e) => setSendToStudent(e.target.checked)}
                  />
                  학생
                </label>
                {sendToTargets.length === 0 && (
                  <span className="text-xs text-[var(--color-status-warning)]">
                    학부모 또는 학생 중 최소 1개를 선택하세요.
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-status-warning)]">
                학생·강의·출결 페이지에서 수신자를 선택한 뒤 메시지 발송 버튼을 눌러 주세요.
              </p>
            )}
          </section>

          {/* 발송 유형: SMS·알림톡 둘 다 선택 가능 */}
          <section>
            <div className="text-sm font-medium text-[var(--color-text-primary)] mb-2">발송 유형</div>
            <div className="flex flex-wrap items-center gap-6">
              <label
                className={
                  smsAllowed ? "inline-flex items-center gap-2 cursor-pointer" : "inline-flex items-center gap-2 cursor-not-allowed opacity-60"
                }
              >
                <input
                  type="checkbox"
                  checked={useSms}
                  onChange={(e) => setUseSms(e.target.checked)}
                  disabled={!smsAllowed}
                />
                <span>SMS 발송</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useAlimtalk}
                  onChange={(e) => setUseAlimtalk(e.target.checked)}
                />
                <span>알림톡 발송</span>
              </label>
              {messageModes.length === 0 && (
                <span className="text-xs text-[var(--color-status-warning)]">
                  SMS 또는 알림톡 중 최소 1개를 선택하세요.
                </span>
              )}
            </div>
            {!smsAllowed && (
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                문자(SMS)는 내 테넌트 전용 정책으로 이 학원에서는 사용할 수 없습니다.
              </p>
            )}
            {(useAlimtalk || useSms) && (
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                둘 다 선택하면 동일 내용을 SMS와 알림톡 각각 발송합니다. 알림톡은 검수 승인된 템플릿이 필요합니다.
              </p>
            )}
          </section>

          {/* 내용: 직접 입력 / 템플릿 불러오기 */}
          <section>
            <div className="text-sm font-medium text-[var(--color-text-primary)] mb-2">내용</div>
            <div className="flex gap-3 mb-3">
              <button
                type="button"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  contentMode === "free"
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--color-fill-secondary)] text-[var(--color-text-secondary)]"
                }`}
                onClick={() => {
                  setContentMode("free");
                  setSelectedTemplateId(null);
                }}
              >
                직접 입력
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  contentMode === "template"
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--color-fill-secondary)] text-[var(--color-text-secondary)]"
                }`}
                onClick={() => setContentMode("template")}
              >
                템플릿 불러오기
              </button>
            </div>

            {contentMode === "template" && templates.length > 0 && (
              <div className="mb-3 p-3 rounded-lg bg-[var(--color-fill-secondary)]">
                <div className="text-xs text-[var(--color-text-muted)] mb-2">저장된 템플릿 선택</div>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <Button
                      key={t.id}
                      intent={selectedTemplateId === t.id ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => handleLoadTemplate(t)}
                    >
                      {t.name}
                      {t.category !== "default" && (
                        <span className="ml-1 opacity-80">
                          ({TEMPLATE_CATEGORY_LABELS[t.category as MessageTemplateCategory]})
                        </span>
                      )}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-2">
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">제목 (선택)</label>
              <Input
                placeholder="알림톡 제목"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={sending}
                className="w-full"
              />
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">본문</label>
              <Input.TextArea
                placeholder="내용을 입력하거나 위에서 템플릿을 선택하세요. #{student_name_2}, #{student_name_3}, #{site_link} 등 변수는 발송 시 자동 치환됩니다."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={14}
                disabled={sending}
                className="template-editor__textarea w-full p-3"
                style={{ resize: "vertical", minHeight: 280 }}
              />
            </div>
          </section>
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={sending}>
              취소
            </Button>
            <Button
              intent="primary"
              onClick={handleSend}
              disabled={!canSend || sending}
            >
              {sending ? "발송 중…" : "발송하기"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
