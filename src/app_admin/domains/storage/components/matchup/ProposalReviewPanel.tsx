// PATH: src/app_admin/domains/storage/components/matchup/ProposalReviewPanel.tsx
//
// Phase F (2026-05-10) — Stage 6.3A Proposal Review UI v1.
//
// 자동분리(YOLO/VLM/OCR) 결과와 직접 자른 문항의 OCR 정보 제안을 승인/거절하는 큐 화면.
// backend `/matchup/proposals/` user_v1 schema 와 1:1 (sanitized: paper_type/engine/
// raw confidence/raw_response/analysis_version_key 등은 서버가 미노출).
//
// 기본 정의 SSOT(2026-05-09) §6 백엔드 기본 구조 / §7 모델 역할 재정의:
//   YOLO/V11/V12/Hybrid 출력 = 정답 X, 후보 O. Proposal 통과 → accepted 만 FinalProblem.
//
// 운영 조건:
//   ENV `MATCHUP_PROPOSAL_FIRST_TENANTS` default off → 대부분 doc 에서 빈 list.
//   off 인 doc 도 panel 자체는 노출 (학원장이 검수 화면을 알 수 있도록 안내 문구).
//
// 의도적 미노출 (서버가 안 내려줌, schema 도 X):
//   paper_type / engine / model_version / raw confidence float / raw_response /
//   analysis_version_key / tenant_id / reviewed_by_id. manual_index는 sanitized
//   target_problem_id / proposed_text / proposed_format만 표시한다.
//   학원장 시야에 들어갈 필요 없음.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, CheckCircle2, XCircle, AlertTriangle, Loader2, FileSearch, ShieldCheck } from "lucide-react";
import { ICON, Button, Badge } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import {
  fetchProposals,
  approveProposal,
  rejectProposal,
  type ProposalReviewItem,
  type ProposalConfidenceLabel,
  type ProposalConflictType,
} from "../../api/matchup.api";
import { storageQueryKeys } from "../../queryKeys";

type Props = {
  documentId: number;
  documentTitle: string;
  onClose: () => void;
};

const CONFIDENCE_TONE: Record<ProposalConfidenceLabel, "success" | "warning" | "danger" | "neutral"> = {
  high: "success",
  medium: "warning",
  low: "danger",
  unknown: "neutral",
};

const CONFIDENCE_LABEL: Record<ProposalConfidenceLabel, string> = {
  high: "신뢰도 높음",
  medium: "신뢰도 중간",
  low: "신뢰도 낮음",
  unknown: "신뢰도 불명",
};

const CONFLICT_LABEL: Record<NonNullable<ProposalConflictType>, string> = {
  manual_overlap: "직접 자른 영역과 겹침",
  number_conflict: "번호 충돌",
};

export default function ProposalReviewPanel({ documentId, documentTitle, onClose }: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<number | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: storageQueryKeys.matchupPendingProposals(documentId),
    queryFn: () => fetchProposals({ documentId, status: "pending", limit: 200 }),
    staleTime: 15_000,
  });

  const proposals = data?.proposals ?? [];

  const handleApprove = async (p: ProposalReviewItem) => {
    if (!p.can_approve) {
      feedback.info(p.user_message || "이 항목은 승인할 수 없습니다.");
      return;
    }
    setBusyId(p.id);
    try {
      await approveProposal(p.id);
      feedback.success(p.proposal_kind === "manual_index"
        ? `문항 #${p.target_problem_id ?? "-"} 정보 승인 완료`
        : `Q${p.detected_problem_number} 승인 — 매치업에 추가됨`);
      await qc.invalidateQueries({ queryKey: storageQueryKeys.matchupProposals(documentId) });
      await qc.invalidateQueries({ queryKey: storageQueryKeys.matchupProblems(documentId) });
      await qc.invalidateQueries({ queryKey: storageQueryKeys.matchupDocuments });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? (e as Error)?.message
        ?? "승인 실패";
      feedback.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (p: ProposalReviewItem) => {
    if (!p.can_reject) {
      feedback.info(p.user_message || "이 항목은 거절할 수 없습니다.");
      return;
    }
    const isManualIndex = p.proposal_kind === "manual_index";
    const ok = await confirm({
      title: isManualIndex ? `문항 #${p.target_problem_id ?? "-"} 정보 제안 거절` : `Q${p.detected_problem_number} 거절`,
      message: isManualIndex
        ? "제안된 OCR 텍스트와 형식을 반영하지 않습니다. 직접 자른 원본 문항은 그대로 유지됩니다."
        : `자동분리 결과를 거절합니다. 거절된 항목은 매치업에 포함되지 않으며, 자료의 문항 카드에도 추가되지 않습니다.\n\n` +
          `거절 후에도 [직접 자르기]로 같은 페이지에서 박스를 다시 그릴 수 있습니다.`,
      confirmText: "거절",
      cancelText: "취소",
      danger: true,
    });
    if (!ok) return;
    setBusyId(p.id);
    try {
      await rejectProposal(p.id, { code: "manual_reject" });
      feedback.success(isManualIndex
        ? `문항 #${p.target_problem_id ?? "-"} 정보 제안 거절 완료`
        : `Q${p.detected_problem_number} 거절 완료`);
      await qc.invalidateQueries({ queryKey: storageQueryKeys.matchupProposals(documentId) });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? (e as Error)?.message
        ?? "거절 실패";
      feedback.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  const renderBboxPreview = (bbox: ProposalReviewItem["bbox"]) => {
    if (!bbox) return null;
    let x = 0, y = 0, w = 0, h = 0;
    if (Array.isArray(bbox) && bbox.length >= 4) {
      [x, y, w, h] = bbox as number[];
    } else if (typeof bbox === "object") {
      const b = bbox as { x: number; y: number; w: number; h: number };
      x = b.x; y = b.y; w = b.w; h = b.h;
    } else {
      return null;
    }
    return (
      <div
        title={`bbox ${(x * 100).toFixed(0)}%,${(y * 100).toFixed(0)} → ${(w * 100).toFixed(0)}%,${(h * 100).toFixed(0)}%`}
        style={/* eslint-disable-line no-restricted-syntax */ {
          position: "relative",
          width: 96, height: 132, flexShrink: 0,
          background: "var(--color-bg-surface-soft)",
          border: "1px solid var(--color-border-divider)",
          borderRadius: 4,
        }}
      >
        <div style={/* eslint-disable-line no-restricted-syntax */ {
          position: "absolute",
          left: `${x * 100}%`, top: `${y * 100}%`,
          width: `${w * 100}%`, height: `${h * 100}%`,
          border: "2px solid var(--color-brand-primary)",
          background: "color-mix(in srgb, var(--color-brand-primary) 14%, transparent)",
          borderRadius: 2,
        }} />
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI 자동분리 검수"
      onClick={onClose}
      style={/* eslint-disable-line no-restricted-syntax */ {
        position: "fixed", inset: 0, zIndex: 9400,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
        padding: "var(--space-4)",
      }}
    >
      <div
        data-testid="matchup-proposal-review-panel"
        onClick={(e) => e.stopPropagation()}
        style={/* eslint-disable-line no-restricted-syntax */ {
          background: "var(--color-bg-surface)",
          borderRadius: "var(--radius-xl)",
          width: "min(960px, 96vw)",
          maxHeight: "min(820px, 92vh)",
          display: "flex", flexDirection: "column",
          boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={/* eslint-disable-line no-restricted-syntax */ {
          padding: "var(--space-3) var(--space-5)",
          borderBottom: "1px solid var(--color-border-divider)",
          flexShrink: 0,
          display: "flex", alignItems: "center", gap: "var(--space-2)",
        }}>
          <ShieldCheck size={ICON.md} style={/* eslint-disable-line no-restricted-syntax */ { color: "var(--color-brand-primary)", flexShrink: 0 }} />
          <div style={/* eslint-disable-line no-restricted-syntax */ { flex: 1, minWidth: 0 }}>
            <h3 style={/* eslint-disable-line no-restricted-syntax */ {
              margin: 0, fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              AI 제안 검수 — {documentTitle}
            </h3>
            <p style={/* eslint-disable-line no-restricted-syntax */ {
              margin: "2px 0 0 0", fontSize: 11, color: "var(--color-text-muted)",
            }}>
              자동 분리 후보와 직접 자른 문항의 OCR 정보 제안을 확인하고 승인하거나 거절합니다.
            </p>
          </div>
          <span style={/* eslint-disable-line no-restricted-syntax */ {
            fontSize: 12, color: "var(--color-text-muted)", whiteSpace: "nowrap",
          }}>
            {isFetching && !isLoading && (
              <Loader2 size={ICON.xs} className="animate-spin" style={/* eslint-disable-line no-restricted-syntax */ { verticalAlign: "middle", marginRight: 4 }} />
            )}
            대기 {data?.total ?? 0}건
          </span>
          <button
            type="button"
            onClick={onClose}
            data-testid="matchup-proposal-review-close"
            style={/* eslint-disable-line no-restricted-syntax */ {
              background: "none", border: "none", cursor: "pointer",
              color: "var(--color-text-secondary)", padding: 4, display: "flex",
            }}
            title="닫기"
          >
            <X size={ICON.md} />
          </button>
        </div>

        {/* Body */}
        <div style={/* eslint-disable-line no-restricted-syntax */ {
          flex: 1, minHeight: 0, overflowY: "auto",
          padding: "var(--space-4) var(--space-5)",
          display: "flex", flexDirection: "column", gap: "var(--space-3)",
        }}>
          {isLoading ? (
            <div style={/* eslint-disable-line no-restricted-syntax */ {
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "var(--space-6)", gap: "var(--space-2)",
              color: "var(--color-text-muted)", fontSize: 13,
            }}>
              <Loader2 size={ICON.md} className="animate-spin" />
              검수 큐 불러오는 중…
            </div>
          ) : isError ? (
            <div style={/* eslint-disable-line no-restricted-syntax */ {
              display: "flex", flexDirection: "column", gap: "var(--space-2)",
              padding: "var(--space-4)",
              background: "color-mix(in srgb, var(--color-danger) 6%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-danger)", fontSize: 13,
            }}>
              <span><AlertTriangle size={ICON.sm} style={/* eslint-disable-line no-restricted-syntax */ { verticalAlign: "middle", marginRight: 4 }} /> 검수 큐 불러오기 실패</span>
              <Button intent="ghost" size="sm" onClick={() => refetch()}>다시 시도</Button>
            </div>
          ) : proposals.length === 0 ? (
            <div data-testid="matchup-proposal-review-empty"
              style={/* eslint-disable-line no-restricted-syntax */ {
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                padding: "var(--space-8) var(--space-4)",
                gap: "var(--space-3)",
                textAlign: "center",
              }}>
              <FileSearch size={28} style={/* eslint-disable-line no-restricted-syntax */ { color: "var(--color-text-muted)", opacity: 0.5 }} />
              <p style={/* eslint-disable-line no-restricted-syntax */ {
                fontSize: 14, color: "var(--color-text-secondary)", margin: 0, fontWeight: 600,
              }}>
                검수 대기 중인 제안이 없습니다
              </p>
              <p style={/* eslint-disable-line no-restricted-syntax */ {
                fontSize: 12, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.6, maxWidth: 480,
              }}>
                자동 분리 또는 직접 자른 문항의 OCR 분석이 끝나면<br />
                승인하거나 거절할 수 있는 제안이 여기에 나타납니다.
              </p>
            </div>
          ) : (
            proposals.map((p) => {
              const isBusy = busyId === p.id;
              const tone = CONFIDENCE_TONE[p.confidence_label];
              const conflict = p.conflict_type;
              const isManualIndex = p.proposal_kind === "manual_index";
              return (
                <div
                  key={p.id}
                  data-testid="matchup-proposal-card"
                  data-proposal-id={p.id}
                  style={/* eslint-disable-line no-restricted-syntax */ {
                    display: "flex", gap: "var(--space-3)",
                    padding: "var(--space-3)",
                    border: conflict
                      ? "1px solid color-mix(in srgb, var(--color-warning) 50%, transparent)"
                      : "1px solid var(--color-border-divider)",
                    borderRadius: "var(--radius-md)",
                    background: conflict
                      ? "color-mix(in srgb, var(--color-warning) 4%, var(--color-bg-surface))"
                      : "var(--color-bg-surface)",
                    opacity: isBusy ? 0.6 : 1,
                    transition: "opacity 0.15s",
                  }}
                >
                  {renderBboxPreview(p.bbox)}
                  <div style={/* eslint-disable-line no-restricted-syntax */ {
                    flex: 1, minWidth: 0,
                    display: "flex", flexDirection: "column", gap: "var(--space-1)",
                  }}>
                    <div style={/* eslint-disable-line no-restricted-syntax */ {
                      display: "flex", alignItems: "center", gap: "var(--space-2)",
                      flexWrap: "wrap",
                    }}>
                      <strong style={/* eslint-disable-line no-restricted-syntax */ {
                        fontSize: 14, color: "var(--color-text-primary)",
                      }}>
                        {isManualIndex ? `문항 #${p.target_problem_id ?? "-"}` : `Q${p.detected_problem_number}`}
                      </strong>
                      <span style={/* eslint-disable-line no-restricted-syntax */ {
                        fontSize: 11, color: "var(--color-text-muted)",
                      }}>
                        {p.page_number}페이지
                      </span>
                      <Badge tone={tone} size="sm">{CONFIDENCE_LABEL[p.confidence_label]}</Badge>
                      {isManualIndex && (
                        <Badge tone="info" size="sm" variant="soft">직접 자른 문항 OCR</Badge>
                      )}
                      {p.ui_status_label && (
                        <Badge tone="neutral" size="sm">{p.ui_status_label}</Badge>
                      )}
                      {conflict && (
                        <Badge tone="warning" size="sm">
                          {CONFLICT_LABEL[conflict]}
                        </Badge>
                      )}
                    </div>
                    {p.user_message && (
                      <p style={/* eslint-disable-line no-restricted-syntax */ {
                        margin: 0, fontSize: 12, color: "var(--color-text-secondary)",
                        lineHeight: 1.5,
                      }}>
                        {p.user_message}
                      </p>
                    )}
                    {isManualIndex && (
                      <div
                        data-testid="matchup-proposal-manual-index-content"
                        style={/* eslint-disable-line no-restricted-syntax */ {
                          display: "flex", flexDirection: "column", gap: 6,
                          marginTop: 4, padding: "8px 10px",
                          border: "1px solid var(--color-border-divider)",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--color-bg-surface-soft)",
                        }}
                      >
                        <span style={/* eslint-disable-line no-restricted-syntax */ {
                          fontSize: 11, fontWeight: 700, color: "var(--color-text-secondary)",
                        }}>
                          제안 형식 · {p.proposed_format || "형식 미지정"}
                        </span>
                        <span style={/* eslint-disable-line no-restricted-syntax */ {
                          maxHeight: 140, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "keep-all",
                          fontSize: 12, lineHeight: 1.6, color: "var(--color-text-primary)",
                        }}>
                          {p.proposed_text || "제안된 OCR 텍스트가 없습니다."}
                        </span>
                      </div>
                    )}
                    <div style={/* eslint-disable-line no-restricted-syntax */ {
                      display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap",
                    }}>
                      <Button
                        intent="primary"
                        size="sm"
                        onClick={() => handleApprove(p)}
                        disabled={!p.can_approve || isBusy}
                        data-testid="matchup-proposal-approve"
                        leftIcon={<CheckCircle2 size={ICON.sm} />}
                      >
                        승인
                      </Button>
                      <Button
                        intent="ghost"
                        size="sm"
                        onClick={() => handleReject(p)}
                        disabled={!p.can_reject || isBusy}
                        data-testid="matchup-proposal-reject"
                        leftIcon={<XCircle size={ICON.sm} />}
                      >
                        거절
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div style={/* eslint-disable-line no-restricted-syntax */ {
          padding: "var(--space-2) var(--space-5)",
          borderTop: "1px solid var(--color-border-divider)",
          background: "var(--color-bg-surface-soft)",
          fontSize: 11, color: "var(--color-text-muted)",
          flexShrink: 0,
        }}>
          자동 분리 승인은 새 문항을 추가하고 · OCR 정보 승인은 표시된 텍스트와 형식을 직접 자른 문항에 반영합니다.
        </div>
      </div>
    </div>
  );
}
