// PATH: src/features/profile/account/components/SenderNumberCard.tsx
// 설정 > 내 정보 — 학원 발신번호 입력 + 솔라피 인증

import { useState, useEffect } from "react";
import { FiPhone } from "react-icons/fi";
import { Input, Button } from "@/shared/ui/ds";
import {
  useMessagingInfo,
  useUpdateMessagingInfo,
  useVerifySender,
} from "@/features/messages/hooks/useMessagingInfo";

const MUTED_COLOR = "var(--color-text-muted)";
const VALUE_FONT = "15px";

export default function SenderNumberCard() {
  const { data: info } = useMessagingInfo();
  const { mutate: updateSender, isPending: isSaving } = useUpdateMessagingInfo();
  const { mutate: verify, isPending: isVerifying } = useVerifySender();

  const [sender, setSender] = useState("");
  const [verifyResult, setVerifyResult] = useState<{
    verified: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    setSender(info?.messaging_sender ?? "");
  }, [info?.messaging_sender]);

  const handleVerify = () => {
    const value = sender.replace(/-/g, "").trim();
    if (!value) {
      setVerifyResult({ verified: false, message: "발신번호를 입력해 주세요." });
      return;
    }
    setVerifyResult(null);
    verify(value, {
      onSuccess: (data) => setVerifyResult({ verified: data.verified, message: data.message }),
      onError: (err: { response?: { data?: { message?: string } } }) => {
        const msg =
          err?.response?.data?.message ||
          (err as { message?: string })?.message ||
          "인증 확인에 실패했습니다.";
        setVerifyResult({ verified: false, message: msg });
      },
    });
  };

  const handleSave = () => {
    updateSender({ messaging_sender: sender.replace(/-/g, "").trim() });
    setVerifyResult(null);
  };

  return (
    <div className="ds-card-modal ds-card-modal--narrow">
      <header className="ds-card-modal__header">
        <div aria-hidden className="ds-card-modal__accent" />
        <div className="ds-card-modal__header-inner">
          <div
            className="ds-card-modal__header-icon"
            style={{ color: "var(--color-brand-primary)" }}
            aria-hidden
          >
            <FiPhone size={16} strokeWidth={2} />
          </div>
          <div className="ds-card-modal__header-text">
            <div className="ds-card-modal__header-title">발신번호</div>
            <div className="ds-card-modal__header-description">
              SMS·알림톡 발송 시 표시되는 번호입니다. 솔라피에 등록된 번호만 사용할 수 있습니다.
            </div>
          </div>
        </div>
      </header>

      <div className="ds-card-modal__body">
        <div
          className="flex flex-wrap items-center gap-3"
          style={{ padding: 0 }}
          role="group"
          aria-label="발신번호"
        >
          <Input
            placeholder="예: 01031217466"
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            disabled={isSaving || isVerifying}
            style={{ maxWidth: 200, fontSize: VALUE_FONT }}
            aria-label="발신번호"
          />
          <Button
            type="button"
            intent="secondary"
            size="md"
            onClick={handleVerify}
            disabled={!sender.trim() || isVerifying || isSaving}
          >
            {isVerifying ? "확인 중…" : "인증"}
          </Button>
          <Button
            type="button"
            intent="primary"
            size="md"
            onClick={handleSave}
            disabled={!sender.trim() || isSaving || isVerifying}
          >
            {isSaving ? "저장 중…" : "저장"}
          </Button>
        </div>
        {verifyResult && (
          <p
            className="mt-3 text-sm"
            style={{
              color: verifyResult.verified
                ? "var(--color-success)"
                : "var(--color-error)",
            }}
          >
            {verifyResult.message}
          </p>
        )}
      </div>
    </div>
  );
}
