// PATH: src/app_dev/shared/components/CommandPalette.tsx
// 글로벌 Cmd+K 검색 팔레트 — 테넌트 + 사용자 검색.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/shared/api/axios";
import { useImpersonate } from "@dev/domains/tenants/hooks/useTenants";
import { useDevToast } from "@dev/shared/components/DevToast";
import { beginImpersonation, abortImpersonation } from "@dev/shared/components/ImpersonationBanner";

type SearchResult = {
  tenants: Array<{
    id: number; code: string; name: string; primary_domain: string | null; is_active: boolean;
  }>;
  users: Array<{
    id: number; username: string; name: string; phone: string;
    tenant_id: number; tenant_code: string; tenant_name: string;
    role: string; is_active: boolean;
  }>;
};

const STAFF_ROLES = new Set(["owner", "admin", "staff", "teacher"]);

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [data, setData] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const impersonate = useImpersonate();
  const { toast } = useDevToast();

  // 포커스 + 리셋
  useEffect(() => {
    if (open) {
      setQ("");
      setData(null);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // 디바운스 검색
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (!term) {
      setData(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<SearchResult>("/core/dev/search/", {
          params: { q: term, limit: 8 },
          signal: ctrl.signal,
        });
        setData(res.data);
      } catch (e: unknown) {
        const isCanceled = (e as { name?: string })?.name === "CanceledError";
        if (!isCanceled) setError("검색 실패");
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [q, open]);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const items = useMemo(() => {
    if (!data) return [] as Array<{ kind: "tenant" | "user"; key: string; render: () => React.ReactNode; onSelect: () => void }>;
    const arr: Array<{ kind: "tenant" | "user"; key: string; render: () => React.ReactNode; onSelect: () => void }> = [];
    for (const t of data.tenants) {
      arr.push({
        kind: "tenant",
        key: `t-${t.id}`,
        render: () => (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Pill text="TENANT" color="#3b82f6" />
            <span style={{ fontWeight: 600 }}>{t.name}</span>
            <span style={{ color: "#94a3b8", fontSize: 12 }}>· {t.code}</span>
            {t.primary_domain && <span style={{ color: "#94a3b8", fontSize: 12 }}>· {t.primary_domain}</span>}
            {!t.is_active && <Pill text="INACTIVE" color="#ef4444" />}
          </div>
        ),
        onSelect: () => {
          navigate(`/dev/tenants/${t.id}`);
          onClose();
        },
      });
    }
    for (const u of data.users) {
      const canImpersonate = STAFF_ROLES.has((u.role || "").toLowerCase());
      arr.push({
        kind: "user",
        key: `u-${u.id}`,
        render: () => (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Pill text="USER" color="#10b981" />
            <span style={{ fontWeight: 600 }}>{u.username}</span>
            {u.name && <span style={{ color: "#475569" }}>({u.name})</span>}
            {u.phone && <span style={{ color: "#94a3b8", fontSize: 12 }}>· {u.phone}</span>}
            <span style={{ color: "#94a3b8", fontSize: 12 }}>@ {u.tenant_code}</span>
            {u.role && <Pill text={u.role.toUpperCase()} color="#475569" />}
            {!u.is_active && <Pill text="INACTIVE" color="#ef4444" />}
            {canImpersonate && (
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  const ok = window.confirm(
                    `[임퍼소네이션] ${u.tenant_code}의 ${u.username}으로 로그인합니다.\n` +
                    `현재 dev 토큰은 보존되며, 상단 배너에서 언제든 복귀할 수 있습니다.`,
                  );
                  if (!ok) return;
                  try {
                    beginImpersonation(`${u.tenant_code} / ${u.username}`);
                    const r = await impersonate.mutateAsync({ tenantId: u.tenant_id, userId: u.id });
                    localStorage.setItem("access", r.access);
                    localStorage.setItem("refresh", r.refresh);
                    onClose();
                    navigate("/admin", { replace: true });
                    window.location.reload();
                  } catch (err: unknown) {
                    abortImpersonation();
                    const e2 = err as { response?: { data?: { detail?: string } } };
                    toast("임퍼소네이션 실패: " + (e2.response?.data?.detail || String(err)), "error");
                  }
                }}
                style={{
                  marginLeft: "auto", padding: "2px 8px", fontSize: 11, fontWeight: 600,
                  background: "#3b82f6", color: "#fff", border: "none", borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                로그인
              </button>
            )}
          </div>
        ),
        onSelect: () => {
          navigate(`/dev/tenants/${u.tenant_id}`);
          onClose();
        },
      });
    }
    return arr;
  }, [data, navigate, onClose, impersonate, toast]);

  // 키보드 내비게이션
  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => { setActiveIdx(0); }, [data]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(items.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        const item = items[activeIdx];
        if (item) {
          e.preventDefault();
          item.onSelect();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items, activeIdx]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)",
        zIndex: 200, display: "flex", justifyContent: "center", paddingTop: "12vh",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 92vw)", maxHeight: "70vh", display: "flex", flexDirection: "column",
          background: "#fff", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid #e2e8f0" }}>
          <span style={{ fontSize: 14, color: "#94a3b8" }}>🔍</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="테넌트 코드/이름/도메인 또는 사용자 ID/이름/전화…"
            style={{
              flex: 1, fontSize: 14, border: "none", outline: "none", padding: "4px 0",
            }}
          />
          <span style={{ fontSize: 11, color: "#94a3b8" }}>ESC</span>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {!q.trim() ? (
            <div style={{ padding: 24, fontSize: 13, color: "#94a3b8" }}>
              테넌트 또는 사용자를 입력하세요. (↑↓ 이동, Enter 선택)
            </div>
          ) : loading ? (
            <div style={{ padding: 24, fontSize: 13, color: "#94a3b8" }}>검색 중…</div>
          ) : error ? (
            <div style={{ padding: 24, fontSize: 13, color: "#ef4444" }}>{error}</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 24, fontSize: 13, color: "#94a3b8" }}>결과 없음</div>
          ) : (
            items.map((item, idx) => (
              <div
                key={item.key}
                onClick={item.onSelect}
                onMouseEnter={() => setActiveIdx(idx)}
                style={{
                  padding: "10px 16px", fontSize: 13, cursor: "pointer",
                  background: idx === activeIdx ? "#eff6ff" : "transparent",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                {item.render()}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-block", padding: "1px 6px", borderRadius: 4,
        fontSize: 9, fontWeight: 700, letterSpacing: "0.5px",
        background: `${color}1a`, color,
      }}
    >
      {text}
    </span>
  );
}

/** 글로벌 Cmd+K 핫키 훅. DevLayout에서 사용. */
export function useCommandPaletteHotkey(setOpen: (v: boolean) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
}
