// PATH: src/app_dev/shared/components/CommandPalette.tsx
// 글로벌 Cmd+K 검색 팔레트 — 테넌트 + 사용자 검색.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import api from "@/shared/api/axios";
import { useImpersonate } from "@dev/domains/tenants/hooks/useTenants";
import { useDevToast } from "@dev/shared/components/DevToast";
import { beginImpersonation, abortImpersonation } from "@dev/shared/components/ImpersonationBanner";
import styles from "./CommandPalette.module.css";

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
type CommandItem = { kind: "tenant" | "user"; key: string; render: () => ReactNode; onSelect: () => void };
type PillTone = "tenant" | "user" | "role" | "inactive";

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
    if (!data) return [] as CommandItem[];
    const arr: CommandItem[] = [];
    for (const t of data.tenants) {
      arr.push({
        kind: "tenant",
        key: `t-${t.id}`,
        render: () => (
          <div className={styles.resultLine}>
            <Pill text="TENANT" tone="tenant" />
            <span className={styles.resultTitle}>{t.name}</span>
            <span className={styles.resultMuted}>· {t.code}</span>
            {t.primary_domain && <span className={styles.resultMuted}>· {t.primary_domain}</span>}
            {!t.is_active && <Pill text="INACTIVE" tone="inactive" />}
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
          <div className={`${styles.resultLine} ${styles.resultLineWrap}`}>
            <Pill text="USER" tone="user" />
            <span className={styles.resultTitle}>{u.username}</span>
            {u.name && <span className={styles.resultSecondary}>({u.name})</span>}
            {u.phone && <span className={styles.resultMuted}>· {u.phone}</span>}
            <span className={styles.resultMuted}>@ {u.tenant_code}</span>
            {u.role && <Pill text={u.role.toUpperCase()} tone="role" />}
            {!u.is_active && <Pill text="INACTIVE" tone="inactive" />}
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
                className={styles.impersonateButton}
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
    <div onClick={onClose} className={styles.overlay}>
      <div onClick={(e) => e.stopPropagation()} className={styles.panel}>
        <div className={styles.searchRow}>
          <Search className={styles.searchIcon} size={14} strokeWidth={1.8} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="테넌트 코드/이름/도메인 또는 사용자 ID/이름/전화…"
            className={styles.searchInput}
          />
          <span className={styles.shortcut}>ESC</span>
        </div>

        <div className={styles.results}>
          {!q.trim() ? (
            <div className={styles.stateMessage}>
              테넌트 또는 사용자를 입력하세요. (↑↓ 이동, Enter 선택)
            </div>
          ) : loading ? (
            <div className={styles.stateMessage}>검색 중…</div>
          ) : error ? (
            <div className={`${styles.stateMessage} ${styles.stateMessageError}`}>{error}</div>
          ) : items.length === 0 ? (
            <div className={styles.stateMessage}>결과 없음</div>
          ) : (
            items.map((item, idx) => (
              <div
                key={item.key}
                onClick={item.onSelect}
                onMouseEnter={() => setActiveIdx(idx)}
                className={styles.resultItem}
                data-active={idx === activeIdx ? "true" : undefined}
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

function Pill({ text, tone }: { text: string; tone: PillTone }) {
  return (
    <span className={styles.pill} data-tone={tone}>
      {text}
    </span>
  );
}
