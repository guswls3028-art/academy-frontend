// PATH: src/app_teacher/domains/comms/components/SendMessageSheet.tsx
// 메시지 발송 바텀시트 — SMS/알림톡 선택 + 템플릿 + 미리보기 + 발송
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchMessageTemplates, sendMessage } from "../api";
import type { MessageTemplate } from "../api";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";

interface Recipient {
  id: number;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  recipients: Recipient[];
  sendTo?: "student" | "parent";
}

type Mode = "sms" | "alimtalk";
type Step = "compose" | "preview";

export default function SendMessageSheet({ open, onClose, recipients, sendTo = "parent" }: Props) {
  const [mode, setMode] = useState<Mode>("sms");
  const [step, setStep] = useState<Step>("compose");
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<"student" | "parent">(sendTo);

  const { data: templates } = useQuery({
    queryKey: ["message-templates"],
    queryFn: fetchMessageTemplates,
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () =>
      sendMessage({
        student_ids: recipients.map((r) => r.id),
        send_to: target,
        message_mode: mode,
        raw_body: body,
        template_id: selectedTemplate?.id,
      }),
    onSuccess: () => {
      const modeLabel = mode === "sms" ? "SMS" : "알림톡";
      teacherToast.success(`${modeLabel}가 ${recipientLabel}에게 발송되었습니다.`);
      handleClose();
    },
    onError: (e) => teacherToast.error(extractApiError(e, "메시지를 발송하지 못했습니다.")),
  });

  function handleClose() {
    setStep("compose");
    setBody("");
    setSelectedTemplate(null);
    onClose();
  }

  function selectTemplate(t: MessageTemplate) {
    setSelectedTemplate(t);
    setBody(t.body);
  }

  const recipientLabel =
    recipients.length === 1
      ? recipients[0].name
      : `${recipients[0]?.name} 외 ${recipients.length - 1}명`;

  return (
    <BottomSheet open={open} onClose={handleClose} title="메시지 발송">
      <div className="flex flex-col gap-3 pb-2">
        {/* 수신자 */}
        <InfoRow label="수신" value={`${recipientLabel} (${target === "parent" ? "학부모" : "학생"})`} />

        {/* 발송 대상 */}
        <div className="flex gap-2">
          {(["parent", "student"] as const).map((t) => (
            <ToggleBtn
              key={t}
              active={target === t}
              onClick={() => setTarget(t)}
              label={t === "parent" ? "학부모" : "학생"}
            />
          ))}
        </div>

        {/* 발송 유형 */}
        <div className="flex gap-2">
          {(["sms", "alimtalk"] as const).map((m) => (
            <ToggleBtn
              key={m}
              active={mode === m}
              onClick={() => setMode(m)}
              label={m === "sms" ? "SMS" : "알림톡"}
            />
          ))}
        </div>

        {step === "compose" ? (
          <>
            {/* 템플릿 선택 */}
            {templates && templates.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium" style={{ color: "var(--tc-text-muted)" }}>
                  템플릿
                </span>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => selectTemplate(t)}
                      className="shrink-0 text-xs cursor-pointer"
                      style={{
                        padding: "6px 10px",
                        borderRadius: "var(--tc-radius)",
                        border:
                          selectedTemplate?.id === t.id
                            ? "1px solid var(--tc-primary)"
                            : "1px solid var(--tc-border)",
                        background:
                          selectedTemplate?.id === t.id
                            ? "var(--tc-primary-bg)"
                            : "var(--tc-surface)",
                        color:
                          selectedTemplate?.id === t.id
                            ? "var(--tc-primary)"
                            : "var(--tc-text-secondary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 본문 입력 */}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="메시지를 입력하세요…"
              rows={4}
              className="w-full text-sm"
              style={{
                padding: "var(--tc-space-3)",
                borderRadius: "var(--tc-radius)",
                border: "1px solid var(--tc-border)",
                background: "var(--tc-surface-soft)",
                color: "var(--tc-text)",
                resize: "vertical",
                outline: "none",
              }}
            />

            <button
              onClick={() => setStep("preview")}
              disabled={!body.trim()}
              className="w-full text-sm font-bold cursor-pointer"
              style={{
                padding: "10px",
                borderRadius: "var(--tc-radius)",
                border: "none",
                background: body.trim() ? "var(--tc-primary)" : "var(--tc-border)",
                color: "#fff",
              }}
            >
              미리보기
            </button>
          </>
        ) : (
          <>
            {/* 미리보기 */}
            <div
              className="text-sm rounded-lg whitespace-pre-wrap"
              style={{
                padding: "var(--tc-space-3)",
                background: "var(--tc-surface-soft)",
                color: "var(--tc-text)",
                border: "1px solid var(--tc-border-subtle)",
              }}
            >
              {body}
            </div>

            {mutation.isError && (
              <div
                className="text-xs text-center rounded"
                style={{ padding: 8, background: "var(--tc-danger-bg)", color: "var(--tc-danger)" }}
              >
                발송 실패. 다시 시도해주세요.
              </div>
            )}

            {mutation.isSuccess && (
              <div
                className="text-xs text-center rounded"
                style={{ padding: 8, background: "var(--tc-success-bg)", color: "var(--tc-success)" }}
              >
                발송 완료!
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setStep("compose")}
                className="flex-1 text-sm font-semibold cursor-pointer"
                style={{
                  padding: "10px",
                  borderRadius: "var(--tc-radius)",
                  border: "1px solid var(--tc-border)",
                  background: "var(--tc-surface)",
                  color: "var(--tc-text-secondary)",
                }}
              >
                수정
              </button>
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="flex-1 text-sm font-bold cursor-pointer"
                style={{
                  padding: "10px",
                  borderRadius: "var(--tc-radius)",
                  border: "none",
                  background: "var(--tc-primary)",
                  color: "#fff",
                  opacity: mutation.isPending ? 0.6 : 1,
                }}
              >
                {mutation.isPending ? "발송 중…" : `${mode === "sms" ? "SMS" : "알림톡"} 발송`}
              </button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="shrink-0 font-medium" style={{ color: "var(--tc-text-muted)" }}>
        {label}
      </span>
      <span className="truncate" style={{ color: "var(--tc-text)" }}>
        {value}
      </span>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 text-sm font-semibold cursor-pointer"
      style={{
        padding: "8px",
        borderRadius: "var(--tc-radius)",
        border: active ? "1px solid var(--tc-primary)" : "1px solid var(--tc-border)",
        background: active ? "var(--tc-primary-bg)" : "var(--tc-surface)",
        color: active ? "var(--tc-primary)" : "var(--tc-text-secondary)",
      }}
    >
      {label}
    </button>
  );
}
