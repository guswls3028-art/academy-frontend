// PATH: src/landing/admin/LandingConsultInboxPage.tsx
// 학원장 상담 수신함 — 외부 학부모가 홈페이지 form으로 보낸 상담 요청 관리.
/* eslint-disable no-restricted-syntax */

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router";
import { isAxiosError } from "axios";
import api, { createAuthSessionBoundConfig } from "@/shared/api/axios";
import { readAuthTokenEnvelopeSafely } from "@/shared/auth/tokenSession";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import RoleGuard from "@teacher/shared/ui/RoleGuard";
import { Button } from "@/shared/ui/ds";

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
  pagination?: { page: number; page_size: number; pages: number; count: number; has_next: boolean; has_previous: boolean };
};

export default function LandingConsultInboxPage() {
  return (
    <RoleGuard allow={["owner", "admin"]}>
      <LandingConsultInboxContent />
    </RoleGuard>
  );
}

function errorDetail(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

function LandingConsultInboxContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = Number(searchParams.get("page") || 1);
  const requestedPage = Number.isSafeInteger(requested) && requested > 0 && requested <= 1_000_000 ? requested : 1;
  const filter = searchParams.get("filter") === "unread" ? "unread" : "all";
  const requestSequence = useRef(0);
  const [items, setItems] = useState<ConsultItem[]>([]);
  const [pagination, setPagination] = useState<NonNullable<ListResp["pagination"]> | null>(null);
  const [summary, setSummary] = useState<{ total: number; unread: number }>({ total: 0, unread: 0 });
  const [readError, setReadError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSuccessfulLoad, setHasSuccessfulLoad] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ id: number; memo: string; original: string } | null>(null);
  const [conflictingMemo, setConflictingMemo] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setIsLoading(true);
    setHasSuccessfulLoad(false);
    setReadError(null);
    setItems([]);
    setPagination(null);
    setSummary({ total: 0, unread: 0 });
    setEditing(null);
    setConflictingMemo(null);
    try {
      const session = readAuthTokenEnvelopeSafely();
      const tenant = getTenantCodeForApiRequest();
      if (!session || !tenant) throw new Error("Missing inbox authentication context");
      const config = createAuthSessionBoundConfig(session.generation, undefined, tenant);
      const r = await api.get<ListResp>("/core/landing/admin/consult/", { ...config, params: { page: requestedPage, page_size: 50, filter } });
      if (sequence !== requestSequence.current) return;
      if (!Array.isArray(r.data?.items) || !Number.isSafeInteger(r.data.summary?.total)
        || !Number.isSafeInteger(r.data.summary?.unread) || r.data.summary.total < 0
        || r.data.summary.unread < 0 || r.data.summary.unread > r.data.summary.total) throw new Error("Invalid inbox response");
      // Old servers returned complete small lists without pagination metadata.
      if (!r.data.pagination && r.data.items.length !== r.data.summary.total) throw new Error("Incomplete inbox response");
      const paging = r.data.pagination ?? { page: 1, page_size: r.data.items.length, pages: 1,
        count: r.data.items.length, has_next: false, has_previous: false };
      if (!Number.isSafeInteger(paging.page) || !Number.isSafeInteger(paging.pages)
        || paging.page < 1 || paging.pages < paging.page) throw new Error("Invalid inbox page");
      setItems(r.data.items);
      setSummary(r.data.summary);
      setPagination(paging);
      setHasSuccessfulLoad(true);
      if (paging.page !== requestedPage) setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        next.set("page", String(paging.page));
        return next;
      }, { replace: true });
    } catch (e) {
      if (sequence === requestSequence.current) setReadError(errorDetail(e, "상담 요청을 불러오지 못했습니다."));
    } finally {
      if (sequence === requestSequence.current) setIsLoading(false);
    }
  }, [requestedPage, filter, setSearchParams]);
  const latestLoad = useRef(load);
  latestLoad.current = load;

  useEffect(() => {
    void load();
    return () => { requestSequence.current += 1; };
  }, [load]);

  const readReady = hasSuccessfulLoad && !isLoading && readError == null;

  const markRead = async (id: number) => {
    if (!readReady || pendingId != null || editing != null) return;
    setMutationError(null);
    setPendingId(id);
    try {
      await api.patch(`/core/landing/admin/consult/${id}/`, { mark_read: true });
    } catch (e) {
      setMutationError(errorDetail(e, "읽음 상태를 저장하지 못했습니다."));
      setPendingId(null);
      return;
    }
    await latestLoad.current();
    setPendingId(null);
  };

  const saveMemo = async (id: number, memo: string) => {
    if (!readReady || pendingId != null) return;
    setMutationError(null);
    setPendingId(id);
    try {
      await api.patch(`/core/landing/admin/consult/${id}/`, { admin_memo: memo, expected_admin_memo: editing?.original });
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 409 && typeof e.response.data?.admin_memo === "string") {
        setConflictingMemo(e.response.data.admin_memo);
      }
      setMutationError(errorDetail(e, "메모를 저장하지 못했습니다."));
      setPendingId(null);
      return;
    }
    setEditing(null);
    await latestLoad.current();
    setPendingId(null);
  };

  const filtered = readReady ? items.filter((it) => filter === "all" || !it.read_at) : [];
  const changePage = (page: number, nextFilter = filter) => {
    if (!readReady || pendingId != null || editing != null) return;
    setMutationError(null);
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("page", String(page));
      if (nextFilter === "unread") next.set("filter", nextFilter);
      else next.delete("filter");
      return next;
    });
  };
  const navigationDisabled = pendingId != null || editing != null;
  const pager = (position: string) => readReady && pagination && pagination.pages > 1 ? (
    <nav aria-label={`상담 목록 페이지 ${position}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, margin: "16px 0" }}>
      <Button intent="secondary" style={{ height: 44 }} disabled={navigationDisabled || !pagination.has_previous} onClick={() => changePage(pagination.page - 1)} aria-label="이전 페이지">이전</Button>
      <span aria-live="polite" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{pagination.page} / {pagination.pages} 페이지</span>
      <Button intent="secondary" style={{ height: 44 }} disabled={navigationDisabled || !pagination.has_next} onClick={() => changePage(pagination.page + 1)} aria-label="다음 페이지">다음</Button>
    </nav>
  ) : null;

  return (
    <div style={{ padding: "24px clamp(12px, 2vw, 28px)", maxWidth: 1100, margin: "0 auto", overflowWrap: "anywhere" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "var(--color-text-primary, #0f172a)", letterSpacing: "-0.02em" }}>
            상담 수신함
            {readReady && summary.unread > 0 && (
              <span style={{ marginLeft: 10, padding: "3px 10px", borderRadius: 99, background: "#dc2626", color: "#fff", fontSize: 12, fontWeight: 700, verticalAlign: "middle" }}>
                새 {summary.unread}
              </span>
            )}
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary, #64748b)", margin: "4px 0 0" }}>
            홈페이지에서 학부모가 보낸 상담 요청. 미확인 항목은 위에 빨간 표시.
          </p>
        </div>
        {readReady && (
          <div style={{ display: "flex", gap: 6, padding: 4, background: "rgba(15,23,42,0.04)", borderRadius: 10 }}>
            <FilterTab active={filter === "all"} disabled={navigationDisabled} onClick={() => changePage(1, "all")}>전체 {summary.total}</FilterTab>
            <FilterTab active={filter === "unread"} disabled={navigationDisabled} onClick={() => changePage(1, "unread")}>미확인 {summary.unread}</FilterTab>
          </div>
        )}
      </div>

      {editing && <p role="status" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>메모를 저장하거나 취소한 뒤 목록을 이동할 수 있습니다.</p>}
      {pager("상단")}

      {readError && (
        <div role="alert" style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#b91c1c", fontSize: 13, marginBottom: 16 }}>
          {readError}
          <button type="button" onClick={() => void load()} disabled={isLoading} style={{ marginLeft: 12, minHeight: 44, padding: "6px 12px", borderRadius: 7, border: "1px solid currentColor", background: "transparent", color: "inherit", fontWeight: 700, cursor: isLoading ? "wait" : "pointer" }}>
            다시 시도
          </button>
        </div>
      )}

      {mutationError && (
        <div role="alert" style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#b91c1c", fontSize: 13, marginBottom: 16 }}>
          {mutationError}
        </div>
      )}

      {isLoading ? (
        <p style={{ fontSize: 14, color: "var(--color-text-muted, #94a3b8)", textAlign: "center", padding: 60 }}>불러오는 중…</p>
      ) : readError ? null : filtered.length === 0 ? (
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
            <article key={it.id} aria-label={`상담 요청 ${it.name}`} style={{
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
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {conflictingMemo !== null && (
                    <div role="region" aria-label="다른 담당자의 최신 메모" style={{ width: "100%", whiteSpace: "pre-wrap" }}>
                      <p>최신 메모: {conflictingMemo || "(비어 있음)"}</p>
                      <p>아래 버튼은 현재 초안을 최신 메모로 바꿉니다. 확인 후 다시 수정해 주세요.</p>
                      <Button intent="secondary" onClick={() => {
                        setEditing({ id: it.id, memo: conflictingMemo, original: conflictingMemo });
                        setConflictingMemo(null);
                        setMutationError(null);
                      }}>최신 메모로 다시 작성</Button>
                    </div>
                  )}
                  <textarea rows={3} maxLength={2000} value={editing.memo} onChange={(e) => setEditing({ ...editing, memo: e.target.value })} placeholder="처리 메모" aria-label="처리 메모" disabled={pendingId != null}
                    style={{ flex: "1 1 100%", width: "100%", minWidth: 0, minHeight: 80, resize: "vertical", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.12)", fontSize: 13, fontFamily: "inherit" }} />
                  <button disabled={pendingId != null} onClick={() => void saveMemo(it.id, editing.memo)} style={{ minHeight: 44, padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--color-brand-primary, #2563EB)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: pendingId != null ? "wait" : "pointer" }}>저장</button>
                  <button disabled={pendingId != null} onClick={() => { setEditing(null); setConflictingMemo(null); setMutationError(null); void load(); }} style={{ minHeight: 44, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", color: "#64748b", fontSize: 13, cursor: "pointer" }}>취소</button>
                </div>
              ) : it.admin_memo ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--color-text-muted, #94a3b8)", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>메모</span>
                  <span style={{ minWidth: 0, whiteSpace: "pre-wrap", fontSize: 13, color: "var(--color-text-secondary, #475569)" }}>{it.admin_memo}</span>
                  <button disabled={navigationDisabled} onClick={() => setEditing({ id: it.id, memo: it.admin_memo, original: it.admin_memo })} style={{ marginLeft: "auto", minHeight: 44, flexShrink: 0, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(15,23,42,0.1)", background: "transparent", fontSize: 12, color: "#64748b", cursor: "pointer" }}>수정</button>
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 8 }}>
                {!it.read_at && (
                  <button disabled={navigationDisabled} onClick={() => void markRead(it.id)} style={{
                    minHeight: 44, padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.1)",
                    background: "var(--color-bg-surface, #fff)", color: "var(--color-text-primary, #1e293b)",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>읽음으로 표시</button>
                )}
                {!editing && !it.admin_memo && (
                  <button disabled={navigationDisabled} onClick={() => setEditing({ id: it.id, memo: "", original: "" })} style={{
                    minHeight: 44, padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.1)",
                    background: "transparent", color: "var(--color-text-secondary, #64748b)",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>+ 메모 추가</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {pager("하단")}
    </div>
  );
}

function FilterTab({ active, children, onClick, disabled }: { active: boolean; children: React.ReactNode; onClick: () => void; disabled: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      minHeight: 44, padding: "6px 14px", borderRadius: 7, border: "none",
      background: active ? "var(--color-bg-surface, #fff)" : "transparent",
      color: active ? "var(--color-text-primary, #0f172a)" : "var(--color-text-secondary, #64748b)",
      fontSize: 12, fontWeight: 700, cursor: "pointer",
      boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
    }}>{children}</button>
  );
}
