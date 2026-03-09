// PATH: src/features/settings/pages/MessagingSettingsPage.tsx
// 설정 > 메시지 — 발신번호 인라인 편집

import { useState, useEffect } from "react";
import { FiCheck, FiX, FiCheckCircle, FiAlertCircle } from "react-icons/fi";

import {
  useMessagingInfo,
  useUpdateMessagingInfo,
  useVerifySender,
} from "@/features/messages/hooks/useMessagingInfo";
import { Button } from "@/shared/ui/ds";

import s from "../components/SettingsSection.module.css";

export default function MessagingSettingsPage() {
  const { data: info } = useMessagingInfo();
  const { mutate: updateSender, isPending: isSaving } = useUpdateMessagingInfo();
  const { mutate: verify, isPending: isVerifying } = useVerifySender();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [verifyResult, setVerifyResult] = useState<{
    verified: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    setDraft(info?.messaging_sender ?? "");
  }, [info?.messaging_sender]);

  const handleVerify = () => {
    const value = draft.replace(/-/g, "").trim();
    if (!value) {
      setVerifyResult({ verified: false, message: "발신번호를 입력해 주세요." });
      return;
    }
    setVerifyResult(null);
    verify(value, {
      onSuccess: (data) =>
        setVerifyResult({ verified: data.verified, message: data.message }),
      onError: (err: {
        response?: { data?: { detail?: string; message?: string } };
        message?: string;
      }) => {
        const data = err?.response?.data;
        const msg =
          (typeof data?.detail === "string" ? data.detail : null) ||
          data?.message ||
          err?.message ||
          "인증 확인에 실패했습니다.";
        setVerifyResult({ verified: false, message: msg });
      },
    });
  };

  const handleSave = () => {
    updateSender(
      { messaging_sender: draft.replace(/-/g, "").trim() },
      {
        onSuccess: () => {
          setEditing(false);
          setVerifyResult(null);
        },
      }
    );
  };

  const handleCancel = () => {
    setDraft(info?.messaging_sender ?? "");
    setVerifyResult(null);
    setEditing(false);
  };

  const currentSender = info?.messaging_sender || "";

  return (
    <div className={s.page}>
      <div className={s.sectionHeader}>
        <h2 className={s.sectionTitle}>메시지</h2>
        <p className={s.sectionDescription}>
          SMS·알림톡 발송 시 표시되는 발신번호를 설정합니다. 솔라피에 등록된 번호만 사용할 수 있습니다.
        </p>
      </div>

      <section className={s.section}>
        <div className={s.rows}>
          {editing ? (
            <div className={s.rowEdit}>
              <div className={s.rowLabel} style={{ paddingTop: 4 }}>발신번호</div>
              <div className={s.rowEditRight}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <input
                    type="tel"
                    className="ds-input"
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      setVerifyResult(null);
                    }}
                    placeholder="예: 01031217466"
                    aria-label="발신번호"
                    disabled={isSaving || isVerifying}
                    style={{ maxWidth: 200 }}
                  />
                  <Button
                    type="button"
                    intent="secondary"
                    size="sm"
                    onClick={handleVerify}
                    disabled={!draft.trim() || isVerifying || isSaving}
                  >
                    {isVerifying ? "확인 중…" : "인증 확인"}
                  </Button>
                </div>

                {verifyResult && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      color: verifyResult.verified
                        ? "var(--color-success)"
                        : "var(--color-error)",
                    }}
                  >
                    {verifyResult.verified ? (
                      <FiCheckCircle size={13} aria-hidden />
                    ) : (
                      <FiAlertCircle size={13} aria-hidden />
                    )}
                    {verifyResult.message}
                  </div>
                )}

                <div className={s.rowEditActions}>
                  <Button
                    type="button"
                    intent="primary"
                    size="sm"
                    onClick={handleSave}
                    disabled={!draft.trim() || isSaving || isVerifying}
                    loading={isSaving}
                    leftIcon={isSaving ? undefined : <FiCheck size={13} />}
                  >
                    {isSaving ? "저장 중…" : "저장"}
                  </Button>
                  <Button
                    type="button"
                    intent="ghost"
                    size="sm"
                    onClick={handleCancel}
                    disabled={isSaving}
                    leftIcon={<FiX size={13} />}
                  >
                    취소
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className={s.row}>
              <span className={s.rowLabel}>발신번호</span>
              <span className={currentSender ? s.rowValue : s.rowValueMuted}
                style={{ fontFamily: currentSender ? "monospace" : undefined, fontSize: currentSender ? 15 : undefined, fontWeight: currentSender ? 600 : undefined }}
              >
                {currentSender || "미설정"}
              </span>
              <div className={s.rowActions}>
                <button className={s.editBtn} onClick={() => setEditing(true)} type="button">
                  수정
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info note */}
        <p style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-muted)", margin: "12px 0 0", lineHeight: 1.5 }}>
          솔라피(Solapi) 계정에 등록된 발신번호만 사용할 수 있습니다. 미등록 번호로 발송 시 실패할 수 있습니다.
        </p>
      </section>
    </div>
  );
}
