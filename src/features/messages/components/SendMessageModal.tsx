// PATH: src/features/messages/components/SendMessageModal.tsx
// 공용 메시지 발송 모달 — 직접 입력 또는 기존 템플릿 불러와서 발송

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
import { TEMPLATE_CATEGORY_LABELS } from "../constants/templateBlocks";
import type { MessageTemplateCategory } from "../api/messages.api";

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
  const [sendTo, setSendTo] = useState<SendToType>("parent");
  const [messageMode, setMessageMode] = useState<MessageMode>("sms");
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<MessageTemplateItem[]>([]);

  const studentIds = initialStudentIds;
  const hasRecipients = studentIds.length > 0;
  const canSend = hasRecipients && body.trim().length > 0;

  useEffect(() => {
    if (open) {
      setSubject("");
      setBody("");
      setSelectedTemplateId(null);
      setContentMode("free");
      setSendTo("parent");
      setMessageMode("sms");
    }
  }, [open]);

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
      // 항상 현재 입력(직접 입력 또는 템플릿 불러온 뒤 수정한 내용)으로 발송
      const payload: Parameters<typeof sendMessage>[0] = {
        student_ids: studentIds,
        send_to: sendTo,
        message_mode: messageMode,
        raw_body: body.trim(),
      };
      if (subject.trim()) payload.raw_subject = subject.trim();
      const res = await sendMessage(payload);
      feedback.success(res.detail || `${res.enqueued}건 발송 예정입니다.`);
      if (res.skipped_no_phone > 0) {
        feedback.info(`전화번호 없음으로 ${res.skipped_no_phone}명 제외되었습니다.`);
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
    <AdminModal open={open} onClose={onClose} width={640}>
      <ModalHeader title="메시지 발송" />
      <ModalBody>
        <div className="flex flex-col gap-4">
          {/* 수신자 */}
          <section>
            <div className="text-sm font-medium text-[var(--color-text-primary)] mb-1">수신자</div>
            {hasRecipients ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                {label} · 발송 대상:{" "}
                <label className="inline-flex items-center gap-2 mr-4">
                  <input
                    type="radio"
                    name="sendTo"
                    checked={sendTo === "parent"}
                    onChange={() => setSendTo("parent")}
                  />
                  학부모
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="sendTo"
                    checked={sendTo === "student"}
                    onChange={() => setSendTo("student")}
                  />
                  학생
                </label>
              </p>
            ) : (
              <p className="text-sm text-[var(--color-status-warning)]">
                학생·강의·출결 페이지에서 수신자를 선택한 뒤 메시지 발송 버튼을 눌러 주세요.
              </p>
            )}
          </section>

          {/* 발송 유형: SMS만 / 알림톡만 / 알림톡→SMS 폴백 */}
          <section>
            <div className="text-sm font-medium text-[var(--color-text-primary)] mb-2">발송 유형</div>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="messageMode"
                  checked={messageMode === "sms"}
                  onChange={() => setMessageMode("sms")}
                />
                <span>SMS만</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="messageMode"
                  checked={messageMode === "alimtalk"}
                  onChange={() => setMessageMode("alimtalk")}
                />
                <span>알림톡만</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="messageMode"
                  checked={messageMode === "both"}
                  onChange={() => setMessageMode("both")}
                />
                <span>알림톡→SMS 폴백</span>
              </label>
            </div>
            {messageMode !== "sms" && (
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                알림톡/폴백은 검수 승인된 템플릿이 필요합니다. 아래에서 템플릿을 선택하세요.
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
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">본문</label>
              <Input.TextArea
                placeholder="내용을 입력하거나 위에서 템플릿을 선택하세요. #{student_name_2}, #{student_name_3}, #{site_link} 등 변수는 발송 시 자동 치환됩니다."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                disabled={sending}
                className="w-full"
                style={{ resize: "vertical" }}
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
