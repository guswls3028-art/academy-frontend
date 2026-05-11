// PATH: src/landing/admin/LandingConsultInboxPage.tsx
// 학원장 상담 수신함 — 외부 학부모가 홈페이지 form으로 보낸 상담 요청 관리.
/* eslint-disable no-restricted-syntax */

import { useEffect, useState, useCallback } from "react";
import api from "@/shared/api/axios";

type ConsultItem = {
  id: number;
  name: string;
  phone: string;
  interest: string;
  message: string;
  source: string;
  read_at: string | null;
  admin_memo: string;
  created_at: string;
};

type ListResp = {
  items: ConsultItem[];
  summary: { total: number; unread: number };
};

export default function LandingConsultInboxPage() {
  const [items, setItems] = useState<ConsultItem[] | null>(null);
  const [summary, setSummary] = useState<{ total: number; unread: number }>({ total: 0, unread: 0 });
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [editing, setEditing] = useState<{ id: number; memo: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.get<ListResp>("/core/landing/admin/consult/");
      setItems(r.data.items || []);
      setSummary(r.data.summary || { total: 0, unread: 0 });
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "상담 요청을 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const markRead = async (id: number) => {
    try {
      await api.patch(`/core/landing/admin/consult/${id}/`, { mark_read: true });
      await load();
    } catch { /* ignore */ }
  };

  const saveMemo = async (id: number, memo: string) => {
    try {
      await api.patch(`/core/landing/admin/consult/${id}/`, { admin_memo: memo });
      setEditing(null);
      await load();
    } catch { /* ignore */ }
  };

  const filtered = (items || []).filter((it) => filter === "all" || !it.read_at);

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "var(--color-text-primary, #0f172a)", letterSpacing: "-0.02em" }}>
            상담 수신함
            {summary.unread > 0 && (
              <span style={{ marginLeft: 10, padding: "3px 10px", borderRadius: 99, background: "#dc2626", color: "#fff", fontSize: 12, fontWeight: 700, verticalAlign: "middle" }}>
                새 {summary.unread}
              </span>
            )}
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary, #64748b)", margin: "4px 0 0" }}>
            홈페이지에서 학부모가 보낸 상담 요청. 미확인 항목은 위에 빨간 표시.
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, padding: 4, background: "rgba(15,23,42,0.04)", borderRadius: 10 }}>
          <FilterTab active={filter === "all"} onClick={() => setFilter("all")}>전체 {summary.total}</FilterTab>
          <FilterTab active={filter === "unread"} onClick={() => setFilter("unread")}>미확인 {summary.unread}</FilterTab>
        </div>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#b91c1c", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {items === null ? (
        <p style={{ fontSize: 14, color: "var(--color-text-muted, #94a3b8)", textAlign: "center", padding: 60 }}>불러오는 중…</p>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--color-text-muted, #94a3b8)", fontSize: 14, lineHeight: 1.7 }}>
          <p style={{ fontSize: 32, margin: "0 0 12px" }}>📭</p>
          <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px", color: "var(--color-text-primary, #1e293b)" }}>
            {filter === "unread" ? "미확인 상담 요청이 없습니다" : "받은 상담 요청이 없습니다"}
          </p>
          <p style={{ fontSize: 13 }}>홈페이지 contact 섹션의 form으로 들어옵니다.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((it) => (
            <div key={it.id} style={{
              padding: "18px 20px", borderRadius: 12,
              background: it.read_at ? "var(--color-bg-surface, #fff)" : "rgba(220,38,38,0.04)",
              border: `1px solid ${it.read_at ? "rgba(15,23,42,0.08)" : "rgba(220,38,38,0.25)"}`,
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {!it.read_at && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc2626", flexShrink: 0 }} />}
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary, #0f172a)", letterSpacing: "-0.01em" }}>
                  {it.name}
                </span>
                <a href={`tel:${it.phone.replace(/-/g, "")}`} style={{ fontSize: 14, color: "var(--color-brand-primary, #2563EB)", textDecoration: "none", fontWeight: 600 }}>
                  {it.phone}
                </a>
                {it.interest && (
                  <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, background: "rgba(37,99,235,0.08)", color: "var(--color-brand-primary, #2563EB)", fontWeight: 600 }}>
                    {it.interest}
                  </span>
                )}
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-text-muted, #94a3b8)" }}>
                  {new Date(it.created_at).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              {it.message && (
                <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(15,23,42,0.03)", fontSize: 13.5, lineHeight: 1.65, color: "var(--color-text-secondary, #475569)", whiteSpace: "pre-line" }}>
                  {it.message}
                </div>
              )}
              {editing?.id === it.id ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="text" value={editing.memo} onChange={(e) => setEditing({ id: it.id, memo: e.target.value })} placeholder="처리 메모"
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.12)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                  <button onClick={() => void saveMemo(it.id, editing.memo)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--color-brand-primary, #2563EB)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>저장</button>
                  <button onClick={() => setEditing(null)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", color: "#64748b", fontSize: 13, cursor: "pointer" }}>취소</button>
                </div>
              ) : it.admin_memo ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--color-text-muted, #94a3b8)", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>메모</span>
                  <span style={{ fontSize: 13, color: "var(--color-text-secondary, #475569)" }}>{it.admin_memo}</span>
                  <button onClick={() => setEditing({ id: it.id, memo: it.admin_memo })} style={{ marginLeft: "auto", padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(15,23,42,0.1)", background: "transparent", fontSize: 12, color: "#64748b", cursor: "pointer" }}>수정</button>
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 8 }}>
                {!it.read_at && (
                  <button onClick={() => void markRead(it.id)} style={{
                    padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.1)",
                    background: "var(--color-bg-surface, #fff)", color: "var(--color-text-primary, #1e293b)",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>읽음으로 표시</button>
                )}
                {!editing && !it.admin_memo && (
                  <button onClick={() => setEditing({ id: it.id, memo: "" })} style={{
                    padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.1)",
                    background: "transparent", color: "var(--color-text-secondary, #64748b)",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>+ 메모 추가</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterTab({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: 7, border: "none",
      background: active ? "var(--color-bg-surface, #fff)" : "transparent",
      color: active ? "var(--color-text-primary, #0f172a)" : "var(--color-text-secondary, #64748b)",
      fontSize: 12, fontWeight: 700, cursor: "pointer",
      boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
    }}>{children}</button>
  );
}
