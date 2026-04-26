// PATH: src/app_dev/domains/automation/pages/AutomationPage.tsx
// /dev 자동화 콘솔: 감사 로그 조회 + 크론 트리거.

import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuditLog, useCronList, useTriggerCron } from "@dev/domains/automation/hooks/useAutomation";
import { useDevToast } from "@dev/shared/components/DevToast";
import type { AuditFilters } from "@dev/domains/automation/api/automation.api";
import s from "@dev/layout/DevLayout.module.css";

type Tab = "audit" | "cron";

export default function AutomationPage() {
  const [tab, setTab] = useState<Tab>("audit");

  return (
    <>
      <header className={s.header}>
        <div className={s.headerLeft}>
          <Link to="/dev/dashboard" style={{ color: "inherit", textDecoration: "none" }}>대시보드</Link>
          <span className={s.breadcrumbSep}>/</span>
          <span className={s.breadcrumbCurrent}>자동화</span>
        </div>
      </header>

      <div className={s.content}>
        <div className={s.pageHeader}>
          <h1 className={s.pageTitle}>자동화</h1>
          <p className={s.pageSub}>감사 로그 조회 + 크론 수동 트리거</p>
        </div>

        <div className={s.tabs}>
          <button
            type="button"
            className={`${s.tab} ${tab === "audit" ? s.tabActive : ""}`}
            onClick={() => setTab("audit")}
          >
            감사 로그
          </button>
          <button
            type="button"
            className={`${s.tab} ${tab === "cron" ? s.tabActive : ""}`}
            onClick={() => setTab("cron")}
          >
            크론
          </button>
        </div>

        {tab === "audit" && <AuditTab />}
        {tab === "cron" && <CronTab />}
      </div>
    </>
  );
}

/* ===== 감사 로그 ===== */
function AuditTab() {
  const [filters, setFilters] = useState<AuditFilters>({ limit: 200 });
  const [draft, setDraft] = useState<AuditFilters>({ limit: 200 });
  const { data, isLoading, refetch } = useAuditLog(filters);

  return (
    <>
      <div className={s.card} style={{ marginBottom: 16 }}>
        <div className={s.cardHeader}>
          <h3 className={s.cardTitle}>필터</h3>
          <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`} onClick={() => refetch()}>새로고침</button>
        </div>
        <div className={s.cardBody}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <Field label="액션 (예: tenant.create)">
              <input className={s.input} value={draft.action || ""} onChange={(e) => setDraft({ ...draft, action: e.target.value })} />
            </Field>
            <Field label="실행자">
              <input className={s.input} value={draft.actor || ""} onChange={(e) => setDraft({ ...draft, actor: e.target.value })} />
            </Field>
            <Field label="테넌트 코드">
              <input className={s.input} value={draft.tenant_code || ""} onChange={(e) => setDraft({ ...draft, tenant_code: e.target.value })} />
            </Field>
            <Field label="결과">
              <select className={s.input} value={draft.result || ""} onChange={(e) => setDraft({ ...draft, result: e.target.value as AuditFilters["result"] })}>
                <option value="">전체</option>
                <option value="success">success</option>
                <option value="failed">failed</option>
              </select>
            </Field>
            <Field label="이후 (ISO8601)">
              <input className={s.input} placeholder="2026-04-25T00:00:00" value={draft.since || ""} onChange={(e) => setDraft({ ...draft, since: e.target.value })} />
            </Field>
            <Field label="이전 (ISO8601)">
              <input className={s.input} value={draft.until || ""} onChange={(e) => setDraft({ ...draft, until: e.target.value })} />
            </Field>
            <Field label="최대 건수 (≤500)">
              <input className={s.input} type="number" min={1} max={500} value={draft.limit || 200} onChange={(e) => setDraft({ ...draft, limit: parseInt(e.target.value || "100", 10) })} />
            </Field>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`} onClick={() => setFilters(draft)}>적용</button>
            <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`} onClick={() => { const reset = { limit: 200 } as AuditFilters; setDraft(reset); setFilters(reset); }}>초기화</button>
          </div>
        </div>
      </div>

      <div className={s.card}>
        <div className={s.cardHeader}>
          <h3 className={s.cardTitle}>감사 로그</h3>
          <span style={{ fontSize: 13, color: "var(--dev-text-muted)" }}>
            {data ? `${data.count}건` : ""}
          </span>
        </div>
        {isLoading ? (
          <div className={s.cardBody}>
            <div className={s.skeleton} style={{ height: 200 }} />
          </div>
        ) : !data || data.results.length === 0 ? (
          <div className={s.empty}><div className={s.emptyText}>매칭된 감사 로그 없음</div></div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th style={{ width: 150 }}>시각</th>
                  <th style={{ width: 110 }}>실행자</th>
                  <th style={{ width: 160 }}>액션</th>
                  <th style={{ width: 100 }}>테넌트</th>
                  <th>요약</th>
                  <th style={{ width: 60 }}>결과</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontSize: 12, color: "var(--dev-text-muted)", whiteSpace: "nowrap" }}>
                      {r.created_at ? new Date(r.created_at).toLocaleString("ko-KR") : "—"}
                    </td>
                    <td style={{ fontSize: 12 }}>{r.actor}</td>
                    <td><span className={s.code}>{r.action}</span></td>
                    <td style={{ fontSize: 12 }}>
                      {r.tenant_code ? (
                        <span className={s.code}>{r.tenant_code}</span>
                      ) : (
                        <span style={{ color: "var(--dev-text-muted)" }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {r.summary || "—"}
                      {r.error && <div style={{ fontSize: 11, color: "var(--dev-danger)", marginTop: 2 }}>{r.error}</div>}
                    </td>
                    <td>
                      <span style={{
                        display: "inline-block", padding: "2px 6px", borderRadius: 4,
                        fontSize: 10, fontWeight: 700,
                        background: r.result === "failed" ? "var(--dev-danger-subtle)" : "var(--dev-success-subtle)",
                        color: r.result === "failed" ? "var(--dev-danger)" : "var(--dev-success)",
                      }}>
                        {r.result === "failed" ? "FAIL" : "OK"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--dev-text-muted)" }}>{label}</span>
      {children}
    </label>
  );
}

/* ===== 크론 ===== */
function CronTab() {
  const { data, isLoading, refetch } = useCronList();
  const trigger = useTriggerCron();
  const { toast } = useDevToast();
  const [argsDraft, setArgsDraft] = useState<Record<string, string>>({});

  async function handleRun(command: string, defaultArgs: string[]) {
    const raw = argsDraft[command];
    const args = raw !== undefined ? raw.trim().split(/\s+/).filter(Boolean) : defaultArgs;
    const ok = window.confirm(
      `[${command}] 실행하시겠습니까?\n인자: ${args.join(" ") || "(없음)"}\n` +
      `백그라운드 스레드로 실행되며, 완료 시 감사 로그에 기록됩니다.`,
    );
    if (!ok) return;
    try {
      await trigger.mutateAsync({ command, args });
      toast(`${command} 시작됨`);
      refetch();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      toast(`실행 실패: ${err.response?.data?.detail || String(e)}`, "error");
    }
  }

  if (isLoading) return <div className={s.skeleton} style={{ height: 200 }} />;
  if (!data) return <div className={s.empty}><div className={s.emptyText}>크론 정보 없음</div></div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {data.results.map((c) => (
        <div key={c.command} className={s.card}>
          <div className={s.cardHeader}>
            <div>
              <h3 className={s.cardTitle}>{c.label}</h3>
              <div style={{ fontSize: 12, color: "var(--dev-text-muted)", marginTop: 2 }}>
                <span className={s.code}>{c.command}</span> · {c.description}
              </div>
            </div>
            {c.last_run_at ? (
              <span style={{ fontSize: 11, color: "var(--dev-text-muted)" }}>
                최근 {new Date(c.last_run_at).toLocaleString("ko-KR")}
                {c.last_run_result && (
                  <span style={{
                    marginLeft: 6, fontWeight: 700,
                    color: c.last_run_result === "failed" ? "var(--dev-danger)" : "var(--dev-success)",
                  }}>
                    {c.last_run_result === "failed" ? "FAIL" : "OK"}
                  </span>
                )}
              </span>
            ) : (
              <span style={{ fontSize: 11, color: "var(--dev-text-muted)" }}>실행 기록 없음</span>
            )}
          </div>
          <div className={s.cardBody}>
            <Field label="인자 (공백 구분)">
              <input
                className={s.input}
                placeholder={c.default_args.join(" ") || "(없음)"}
                value={argsDraft[c.command] ?? c.default_args.join(" ")}
                onChange={(e) => setArgsDraft({ ...argsDraft, [c.command]: e.target.value })}
              />
            </Field>
            {c.last_run_summary && (
              <div style={{ fontSize: 12, color: "var(--dev-text-secondary)", marginTop: 8 }}>
                {c.last_run_summary}
              </div>
            )}
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button
                type="button"
                className={`${s.btn} ${c.danger ? s.btnDanger : s.btnPrimary} ${s.btnSm}`}
                onClick={() => handleRun(c.command, c.default_args)}
                disabled={trigger.isPending}
              >
                실행
              </button>
              <button
                type="button"
                className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                onClick={() => setArgsDraft({ ...argsDraft, [c.command]: c.default_args.join(" ") })}
              >
                기본 인자로 리셋
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
