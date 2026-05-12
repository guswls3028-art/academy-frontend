// PATH: src/landing/components/ReportButton.tsx
// 신고 버튼 + 모달 — 자유게시판/수강후기/댓글 공용.
// 비로그인 외부 학부모도 신고 가능 (TenantResolved). 동일 IP/유저 1시간 중복 차단.
/* eslint-disable no-restricted-syntax */

import { useState } from "react";
import { submitReport, type ReportReason, type ReportTargetKind } from "../api/publicCommunity";

interface Props {
  targetKind: ReportTargetKind;
  targetId: number;
  /** 텍스트 link 스타일이면 true, 버튼이면 false */
  asLink?: boolean;
  /** 색상 토큰 */
  color?: string;
}

const REASONS: { v: ReportReason; label: string }[] = [
  { v: "spam", label: "광고/스팸" },
  { v: "abuse", label: "욕설/비방" },
  { v: "false", label: "허위/조작" },
  { v: "copyright", label: "저작권 침해" },
  { v: "privacy", label: "개인정보 노출" },
  { v: "other", label: "기타" },
];

export default function ReportButton({ targetKind, targetId, asLink = false, color = "#9CA3AF" }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"none" | "ok" | "dup" | "fail">("none");

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await submitReport({ target_kind: targetKind, target_id: targetId, reason, description: description.trim() });
      setResult("ok");
    } catch (e: any) {
      if (e?.response?.status === 409) setResult("dup");
      else setResult("fail");
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    setOpen(false);
    setTimeout(() => {
      setReason("spam");
      setDescription("");
      setResult("none");
    }, 200);
  };

  const buttonEl = asLink ? (
    <button type="button" onClick={() => setOpen(true)} data-testid={`report-btn-${targetKind}-${targetId}`}
      style={{ background: "transparent", border: "none", padding: 0, color, fontSize: 12, fontWeight: 500, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
    >신고</button>
  ) : (
    <button type="button" onClick={() => setOpen(true)} data-testid={`report-btn-${targetKind}-${targetId}`}
      style={{ padding: "7px 14px", borderRadius: 999, border: `1px solid rgba(239,68,68,0.3)`, background: "transparent", color: "#ef4444", fontSize: 12.5, fontWeight: 600, cursor: "pointer", letterSpacing: "-0.01em" }}
    >🚩 신고</button>
  );

  return (
    <>
      {buttonEl}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div style={{
            width: "100%", maxWidth: 460, background: "#fff", borderRadius: 16,
            padding: "24px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif",
          }}>
            {result === "ok" ? (
              <ResultPanel emoji="✅" title="신고가 접수되었습니다" body="학원장이 곧 검토하고 처리합니다. 감사합니다." onClose={close} />
            ) : result === "dup" ? (
              <ResultPanel emoji="ℹ️" title="이미 신고된 글입니다" body="중복 신고는 1시간에 한 번만 가능합니다." onClose={close} />
            ) : result === "fail" ? (
              <ResultPanel emoji="⚠️" title="신고 접수 실패" body="잠시 후 다시 시도해주세요." onClose={close} />
            ) : (
              <>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>이 글을 신고합니다</h2>
                <p style={{ margin: "8px 0 18px", fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>
                  학원장이 검토 후 적절한 조치를 취합니다. 허위 신고는 제한될 수 있습니다.
                </p>

                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
                  사유
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, marginBottom: 16 }}>
                  {REASONS.map((r) => {
                    const on = r.v === reason;
                    return (
                      <button key={r.v} type="button" onClick={() => setReason(r.v)}
                        data-testid={`report-reason-${r.v}`}
                        style={{
                          padding: "10px 12px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                          border: `1px solid ${on ? "#ef4444" : "rgba(0,0,0,0.1)"}`,
                          background: on ? "rgba(239,68,68,0.08)" : "#fff",
                          color: on ? "#b91c1c" : "#0F172A",
                          fontSize: 13, fontWeight: on ? 700 : 600, letterSpacing: "-0.01em",
                        }}
                      >{r.label}</button>
                    );
                  })}
                </div>

                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
                  추가 설명 (선택)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  data-testid="report-description"
                  rows={3}
                  maxLength={2000}
                  placeholder="구체적인 사유를 적어주시면 처리에 도움이 됩니다."
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.1)", background: "#fafbfc",
                    color: "#0F172A", fontSize: 13, fontFamily: "inherit",
                    outline: "none", resize: "vertical", boxSizing: "border-box",
                  }}
                />

                <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button type="button" onClick={close}
                    style={{ padding: "10px 18px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.1)", background: "transparent", color: "#64748B", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                  >취소</button>
                  <button type="button" onClick={submit} disabled={submitting}
                    data-testid="report-submit"
                    style={{
                      padding: "10px 18px", borderRadius: 999, border: "none",
                      background: submitting ? "rgba(239,68,68,0.4)" : "#ef4444",
                      color: "#fff", fontSize: 13, fontWeight: 700, cursor: submitting ? "wait" : "pointer",
                      letterSpacing: "-0.01em",
                    }}
                  >{submitting ? "신고 중…" : "신고 접수"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ResultPanel({ emoji, title, body, onClose }: { emoji: string; title: string; body: string; onClose: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "12px 0" }}>
      <div style={{ fontSize: 42, marginBottom: 10 }}>{emoji}</div>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>{title}</h2>
      <p style={{ margin: "10px 0 22px", fontSize: 13.5, color: "#64748B", lineHeight: 1.6 }}>{body}</p>
      <button type="button" onClick={onClose}
        style={{ padding: "10px 24px", borderRadius: 999, border: "none", background: "#0F172A", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
      >확인</button>
    </div>
  );
}
