// PATH: src/app_admin/domains/storage/pages/ProposalReviewPage.tsx
//
// Stage 6.3A-FE — Proposal Review UI v1.
//
// 학원장/운영자가 자동분리 결과(ProblemSegmentationProposal)를 List/Approve/Reject 만 검수.
// 범위 외 (의도적 제외 — backend SSOT가 아직 미지원):
//   - bbox 수정 / 번호 수정 / merge / split / batch approve.
//
// 백엔드 sanitized 응답(`_serialize_proposal_user_v1`) 그대로 사용 — UI는 raw 필드(
// engine, model_version, paper_type, raw confidence, analysis_version_key, tenant_id,
// reviewed_by_id, raw_response)를 절대 표시하지 않는다. 신규 필드는 backend가
// 노출 결정을 끝낸 다음에 추가.
/* eslint-disable no-restricted-syntax */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { Badge, Button, ICON, ICON_FOR_BADGE } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  approveProposal,
  fetchProposals,
  rejectProposal,
  type ProposalListResponse,
  type ProposalReviewItem,
  type ProposalStatus,
} from "../api/matchup.api";
import { getPresignedUrl } from "../api/storage.api";

type StatusFilter = "" | ProposalStatus;

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "",             label: "상태: 전체" },
  { value: "pending",      label: "검수 대기" },
  { value: "needs_review", label: "검수 필수" },
  { value: "auto_passed",  label: "자동 통과" },
  { value: "approved",     label: "승인 완료" },
  { value: "rejected",     label: "거절" },
];

const CONFIDENCE_LABEL_KO: Record<string, { text: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  high:    { text: "신뢰도 높음", tone: "success" },
  medium:  { text: "신뢰도 보통", tone: "warning" },
  low:     { text: "신뢰도 낮음", tone: "danger" },
  unknown: { text: "신뢰도 미상", tone: "neutral" },
};

const PAGE_LIMIT = 50;

export default function ProposalReviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const confirm = useConfirm();

  const initialDocId = (() => {
    const raw = searchParams.get("docId");
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : undefined;
  })();
  const initialStatus = (() => {
    const raw = (searchParams.get("status") ?? "").trim();
    const valid = STATUS_FILTER_OPTIONS.map((o) => o.value);
    return valid.includes(raw as StatusFilter) ? (raw as StatusFilter) : "";
  })();

  const [docIdFilter, setDocIdFilter] = useState<number | undefined>(initialDocId);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [data, setData] = useState<ProposalListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 행별 액션 진행 상태 — 다중 클릭 차단 + spinner 노출.
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetchProposals({
        documentId: docIdFilter,
        status: (statusFilter || undefined) as ProposalStatus | undefined,
        limit: PAGE_LIMIT,
        offset: 0,
      });
      setData(resp);
    } catch (e) {
      console.error(e);
      setError(
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
          || "검수 큐 조회 실패",
      );
    } finally {
      setLoading(false);
    }
  }, [docIdFilter, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  // URL ↔ 필터 동기화 (공유 가능한 상태)
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (docIdFilter != null) next.set("docId", String(docIdFilter));
    else next.delete("docId");
    if (statusFilter) next.set("status", statusFilter);
    else next.delete("status");
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docIdFilter, statusFilter]);

  const proposals = useMemo(() => data?.proposals ?? [], [data]);

  // approve_proposal helper 가 status / promoted_problem_id 갱신 — 응답 그대로 row 교체.
  const replaceRow = useCallback((next: ProposalReviewItem) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        proposals: prev.proposals.map((p) => (p.id === next.id ? next : p)),
      };
    });
  }, []);

  const handleApprove = useCallback(async (proposal: ProposalReviewItem) => {
    if (!proposal.can_approve || busyId != null) return;
    const ok = await confirm({
      title: "이 분리 결과를 승인하시겠습니까?",
      message: `Q${proposal.detected_problem_number} (page ${proposal.page_number}) 가 매치업 문항으로 등록됩니다.`,
      confirmText: "승인",
    });
    if (!ok) return;
    setBusyId(proposal.id);
    try {
      const resp = await approveProposal(proposal.id);
      replaceRow(resp.proposal);
      feedback.success(`Q${proposal.detected_problem_number} 승인 완료`);
    } catch (e) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || "승인 실패 — 잠시 후 다시 시도해주세요.";
      feedback.error(msg);
    } finally {
      setBusyId(null);
    }
  }, [busyId, confirm, replaceRow]);

  const handleReject = useCallback(async (proposal: ProposalReviewItem) => {
    if (!proposal.can_reject || busyId != null) return;
    const reason = window.prompt(
      `Q${proposal.detected_problem_number} (page ${proposal.page_number}) 거절 사유를 적어주세요. (선택)`,
      "",
    );
    // 사용자가 ESC/Cancel 했을 때 prompt 가 null 반환 — 거절 취소로 해석.
    if (reason === null) return;
    setBusyId(proposal.id);
    try {
      const resp = await rejectProposal(proposal.id, { reason: reason.trim() });
      replaceRow(resp.proposal);
      feedback.success(`Q${proposal.detected_problem_number} 거절 처리됨`);
    } catch (e) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || "거절 실패 — 잠시 후 다시 시도해주세요.";
      feedback.error(msg);
    } finally {
      setBusyId(null);
    }
  }, [busyId, replaceRow]);

  return (
    <div
      data-testid="proposal-review-page"
      style={{
        maxWidth: 1200, margin: "0 auto", padding: "20px 24px",
        display: "flex", flexDirection: "column", gap: 16,
      }}
    >
      <header style={{
        display: "flex", alignItems: "center", gap: 12,
        paddingBottom: 12, borderBottom: "1px solid var(--color-border-divider)",
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--color-text-primary)" }}>
            자동 분리 검수
          </h1>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
            자동 분리된 문항 후보를 한 건씩 승인/거절합니다.
            {data && (
              <span>{"  ·  "}총 {data.total}건</span>
            )}
          </div>
        </div>
        <Button
          size="sm"
          intent="ghost"
          onClick={() => void load()}
          disabled={loading}
          leftIcon={<RefreshCw size={ICON.sm} />}
          data-testid="proposal-review-refresh"
        >
          새로고침
        </Button>
      </header>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          data-testid="proposal-review-status-filter"
          style={{
            fontSize: 12, padding: "5px 8px",
            border: "1px solid var(--color-border-divider)",
            borderRadius: 4,
            background: "var(--color-bg-canvas)",
            color: "var(--color-text-primary)",
          }}
        >
          {STATUS_FILTER_OPTIONS.map((o) => (
            <option key={o.value || "_all"} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          placeholder="문서 ID로 필터"
          value={docIdFilter ?? ""}
          onChange={(e) => {
            const n = Number(e.target.value);
            setDocIdFilter(Number.isFinite(n) && n > 0 ? n : undefined);
          }}
          data-testid="proposal-review-doc-filter"
          style={{
            fontSize: 12, padding: "5px 8px", width: 140,
            border: "1px solid var(--color-border-divider)",
            borderRadius: 4,
            background: "var(--color-bg-canvas)",
            color: "var(--color-text-primary)",
          }}
        />
      </div>

      <div>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary)" }}>
            불러오는 중...
          </div>
        ) : error ? (
          <div
            data-testid="proposal-review-error"
            style={{ padding: 40, textAlign: "center", color: "var(--color-status-error, #dc2626)" }}
          >
            {error}
            <div style={{ marginTop: 12 }}>
              <Button size="sm" intent="primary" onClick={() => void load()}>다시 시도</Button>
            </div>
          </div>
        ) : proposals.length === 0 ? (
          <div
            data-testid="proposal-review-empty"
            style={{
              padding: 40, textAlign: "center",
              color: "var(--color-text-secondary)", fontSize: 13, lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: "var(--color-text-primary)" }}>
              검수 대기 중인 분리 결과가 없습니다
            </div>
            <div style={{ fontSize: 12 }}>
              자동 분리가 끝난 문서가 있을 때만 후보가 나타납니다.
            </div>
          </div>
        ) : (
          <ul
            data-testid="proposal-review-list"
            style={{
              listStyle: "none", margin: 0, padding: 0,
              display: "flex", flexDirection: "column", gap: 10,
            }}
          >
            {proposals.map((p) => (
              <ProposalRow
                key={p.id}
                proposal={p}
                busy={busyId === p.id}
                onApprove={() => void handleApprove(p)}
                onReject={() => void handleReject(p)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ProposalRow({
  proposal, busy, onApprove, onReject,
}: {
  proposal: ProposalReviewItem;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const conf = CONFIDENCE_LABEL_KO[proposal.confidence_label] ?? CONFIDENCE_LABEL_KO.unknown;
  const isConflict = proposal.conflict_type != null;

  return (
    <li
      data-testid="proposal-review-row"
      data-proposal-id={proposal.id}
      data-status={proposal.status}
      data-conflict-type={proposal.conflict_type ?? ""}
      data-can-approve={proposal.can_approve ? "true" : "false"}
      data-can-reject={proposal.can_reject ? "true" : "false"}
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr auto",
        gap: 14,
        alignItems: "stretch",
        padding: 12,
        border: isConflict
          ? "1px solid color-mix(in srgb, var(--color-warning) 55%, transparent)"
          : "1px solid var(--color-border-divider)",
        borderRadius: 8,
        background: isConflict
          ? "color-mix(in srgb, var(--color-warning) 4%, var(--color-bg-canvas))"
          : "var(--color-bg-canvas)",
      }}
    >
      <ProposalPreview imageKey={proposal.image_key} alt={`page ${proposal.page_number} Q${proposal.detected_problem_number}`} />

      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)" }}>
            Q{proposal.detected_problem_number}
            <span style={{ marginLeft: 6, fontWeight: 500, color: "var(--color-text-muted)", fontSize: 12 }}>
              · page {proposal.page_number}
            </span>
          </span>
          <Badge tone="neutral" size="sm" data-testid="proposal-status-badge">
            {proposal.ui_status_label}
          </Badge>
          <Badge tone={conf.tone} size="sm" variant="soft">
            {conf.text}
          </Badge>
          {proposal.promoted_problem_id != null && (
            <Badge tone="success" size="sm">
              등록됨 · #{proposal.promoted_problem_id}
            </Badge>
          )}
        </div>

        <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          문서 #{proposal.document_id}
          {proposal.created_at && (
            <span>{"  ·  "}생성 {formatDate(proposal.created_at)}</span>
          )}
          {proposal.reviewed_at && (
            <span>{"  ·  "}검수 {formatDate(proposal.reviewed_at)}</span>
          )}
        </div>

        {proposal.user_message && (
          <div
            data-testid="proposal-user-message"
            data-conflict-type={proposal.conflict_type ?? ""}
            style={{
              display: "flex", alignItems: "flex-start", gap: 6,
              padding: "8px 10px",
              borderRadius: 6,
              background: isConflict
                ? "color-mix(in srgb, var(--color-warning) 12%, transparent)"
                : "var(--color-bg-surface-soft, #f3f4f6)",
              color: isConflict
                ? "var(--color-status-warning, #d97706)"
                : "var(--color-text-secondary)",
              fontSize: 12, fontWeight: 600, lineHeight: 1.4,
            }}
          >
            <AlertTriangle size={ICON_FOR_BADGE.sm} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{proposal.user_message}</span>
          </div>
        )}
      </div>

      <div style={{
        display: "flex", flexDirection: "column", gap: 6,
        alignSelf: "stretch", justifyContent: "center", minWidth: 92,
      }}>
        <Button
          size="sm"
          intent="primary"
          disabled={!proposal.can_approve || busy}
          loading={busy}
          onClick={onApprove}
          leftIcon={<CheckCircle2 size={ICON.sm} />}
          data-testid="proposal-approve-button"
          title={!proposal.can_approve ? (proposal.user_message ?? "승인할 수 없는 상태입니다") : undefined}
        >
          승인
        </Button>
        <Button
          size="sm"
          intent="danger"
          disabled={!proposal.can_reject || busy}
          loading={busy}
          onClick={onReject}
          leftIcon={<XCircle size={ICON.sm} />}
          data-testid="proposal-reject-button"
          title={!proposal.can_reject ? "거절할 수 없는 상태입니다" : undefined}
        >
          거절
        </Button>
      </div>
    </li>
  );
}

function ProposalPreview({ imageKey, alt }: { imageKey: string; alt: string }) {
  // backend 가 image_url 을 안 내려줌 — image_key 가 있을 때만 storage presign
  // (tenant 격리 검증 포함) 으로 1회 가져온다. 신규 endpoint 안 만듦.
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!imageKey) { setUrl(null); setFailed(false); return; }
    let cancelled = false;
    setFailed(false);
    setUrl(null);
    getPresignedUrl(imageKey)
      .then((r) => { if (!cancelled) setUrl(r.url || null); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [imageKey]);

  if (!imageKey) {
    return (
      <div
        data-testid="proposal-preview-empty"
        style={{
          width: 120, height: 120, borderRadius: 6,
          background: "var(--color-bg-surface-soft, #f3f4f6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, color: "var(--color-text-muted)",
        }}
      >
        미리보기 없음
      </div>
    );
  }

  if (failed) {
    return (
      <div
        style={{
          width: 120, height: 120, borderRadius: 6,
          background: "var(--color-bg-surface-soft, #f3f4f6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, color: "var(--color-text-muted)", textAlign: "center", padding: 6,
        }}
      >
        미리보기 불러오기 실패
      </div>
    );
  }

  return (
    <div style={{
      width: 120, height: 120, borderRadius: 6, overflow: "hidden",
      background: "white", border: "1px solid var(--color-border-divider)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {url ? (
        <img
          src={url}
          alt={alt}
          data-testid="proposal-preview-image"
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
        />
      ) : (
        <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>로딩 중…</div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yy}/${mm}/${dd} ${hh}:${mi}`;
  } catch {
    return iso;
  }
}
