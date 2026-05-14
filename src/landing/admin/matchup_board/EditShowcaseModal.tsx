// PATH: src/landing/admin/matchup_board/EditShowcaseModal.tsx
// LandingMatchupBoardAdminPage 의 게시물 수정 모달 분리 (P1 audit step 2026-05-14).
//
// 책임: 게시물 수정 (title/description/공개 기간/status). 스냅샷 PDF는 변경 X.
// state: editForm + submitting — 자체 보유 (main page state pollution 회피).
/* eslint-disable no-restricted-syntax */

import { useEffect, useState } from "react";
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  updateMatchupShowcase,
  type MatchupShowcaseCard,
  type MatchupShowcaseStatus,
} from "../../api/matchupShowcase";
import { inputDatetimeLocalToISO, isoToInputDatetimeLocal } from "./helpers";

interface Props {
  card: MatchupShowcaseCard;
  onClose: () => void;
  onSaved: () => void;  // 성공 시 main page 가 reload
}

export default function EditShowcaseModal({ card, onClose, onSaved }: Props) {
  const [editForm, setEditForm] = useState({
    title: card.title,
    description: card.description,
    published_at: isoToInputDatetimeLocal(card.published_at),
    published_until: isoToInputDatetimeLocal(card.published_until),
    status: card.status as MatchupShowcaseStatus,
  });
  const [submitting, setSubmitting] = useState(false);

  // card prop이 변경되면 state 동기화 (다른 row 수정 → 같은 modal 재사용 시)
  useEffect(() => {
    setEditForm({
      title: card.title,
      description: card.description,
      published_at: isoToInputDatetimeLocal(card.published_at),
      published_until: isoToInputDatetimeLocal(card.published_until),
      status: card.status,
    });
  }, [card]);

  const submit = async () => {
    setSubmitting(true);
    try {
      await updateMatchupShowcase(card.id, {
        title: editForm.title.trim() || undefined,
        description: editForm.description,
        published_at: inputDatetimeLocalToISO(editForm.published_at),
        published_until: inputDatetimeLocalToISO(editForm.published_until),
        status: editForm.status,
      });
      feedback.success("저장되었습니다.");
      onSaved();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      feedback.error(typeof detail === "string" ? detail : "저장 실패");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={() => !submitting && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(8,12,22,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, 100%)", maxHeight: "90vh", background: "#fff", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>게시물 수정</h3>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="닫기"
            style={{ width: 30, height: 30, borderRadius: 6, background: "transparent", border: "1px solid #cbd5e1", cursor: "pointer", color: "#475569", fontSize: 16, lineHeight: 1 }}
          >×</button>
        </div>
        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
          <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 12px", lineHeight: 1.5 }}>
            스냅샷 PDF는 변경 안 됨 (게시 시점 그대로). 제목/코멘트/공개 기간/상태만 수정.
          </p>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>제목</label>
          <input type="text" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", marginBottom: 12, fontSize: 14, fontFamily: "inherit" }}
          />
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>코멘트</label>
          <textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", marginBottom: 12, fontSize: 14, fontFamily: "inherit", resize: "vertical" }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>공개 시작</label>
              <input type="datetime-local" value={editForm.published_at} onChange={(e) => setEditForm((f) => ({ ...f, published_at: e.target.value }))}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>공개 종료</label>
              <input type="datetime-local" value={editForm.published_until} onChange={(e) => setEditForm((f) => ({ ...f, published_until: e.target.value }))}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
              />
            </div>
          </div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>상태</label>
          <select value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as MatchupShowcaseStatus }))}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, fontFamily: "inherit", background: "#fff" }}
          >
            <option value="published">공개</option>
            <option value="hidden">비공개</option>
            <option value="draft">초안</option>
          </select>
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onClose} disabled={submitting}
            style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >취소</button>
          <button type="button" onClick={submit} disabled={submitting}
            style={{
              padding: "10px 18px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg, #D4A04C 0%, #B8862F 100%)",
              color: "#0A0E1A", fontSize: 13, fontWeight: 700,
              cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.6 : 1,
            }}
          >{submitting ? "저장 중…" : "저장"}</button>
        </div>
      </div>
    </div>
  );
}
