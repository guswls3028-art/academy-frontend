// PATH: src/app_admin/domains/storage/components/matchup/MergeProblemsModal.tsx
//
// 쪼개진 문항 합치기 모달.
//
// 시험지에서 한 문항이 컬럼/페이지 경계로 인해 자동분리에서 N개 problem으로 쪼개진 경우,
// 사용자가 그리드에서 N개를 선택하면 이 모달이 열려 위→아래 stack 순서를 확인하고
// 최종 문항 번호를 정해 1개 problem으로 합칠 수 있게 한다.
//
// UX:
//   - 좌: 미리보기 (선택한 이미지를 위→아래로 stack한 결과 prerender)
//   - 우: 순서 리스트 (위/아래 화살표로 reorder) + 최종 번호 선택
//   - "합치기" → POST → 성공 시 close + invalidate
//
// 주의:
//   - primary는 첫 번째(위쪽). 첫 번째 problem의 ID가 그대로 유지되고 나머지는 삭제됨.
//   - 합친 후 OCR/임베딩이 비동기로 재계산됨 — 매치 결과는 잠시 후 갱신.

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, ArrowUp, ArrowDown, Loader2, Layers } from "lucide-react";
import { ICON, Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { mergeMatchupProblems } from "../../api/matchup.api";
import type { MatchupProblem } from "../../api/matchup.api";

type Props = {
  docId: number;
  problems: MatchupProblem[]; // 그리드에서 선택된 problem들 (선택 순서대로)
  onClose: () => void;
  onSuccess: (mergedProblemId: number) => void;
};

export default function MergeProblemsModal({ docId, problems, onClose, onSuccess }: Props) {
  const qc = useQueryClient();
  // 선택 순서를 모달 내부 state로 복사 (reorder 가능)
  const [ordered, setOrdered] = useState<MatchupProblem[]>(problems);
  // 최종 번호 — 기본값 = min(numbers)
  const defaultNumber = useMemo(
    () => Math.min(...problems.map((p) => p.number)),
    [problems],
  );
  const [targetNumber, setTargetNumber] = useState<number>(defaultNumber);
  const [submitting, setSubmitting] = useState(false);

  // 부모(MatchupPage)가 React Query polling으로 problems prop을 매 refetch마다 새 reference로
  // 넘기는데, 그 떄마다 ordered를 리셋하면 모달 내부 reorder가 사라진다. id 집합이 실제로
  // 바뀐 경우만 동기화 — 부모가 다른 모달 세션을 열었거나 problems 자체가 변한 경우.
  const idKey = useMemo(() => problems.map((p) => p.id).join(","), [problems]);
  useEffect(() => {
    setOrdered(problems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  const moveItem = (idx: number, delta: -1 | 1) => {
    const next = idx + delta;
    if (next < 0 || next >= ordered.length) return;
    setOrdered((prev) => {
      const arr = prev.slice();
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  };

  const handleConfirm = async () => {
    if (ordered.length < 2) {
      feedback.error("합치려면 2개 이상 선택해야 합니다.");
      return;
    }
    if (!Number.isInteger(targetNumber) || targetNumber < 1 || targetNumber > 999) {
      feedback.error("문항 번호는 1~999 사이여야 합니다.");
      return;
    }
    setSubmitting(true);
    try {
      const merged = await mergeMatchupProblems(
        docId,
        ordered.map((p) => p.id),
        targetNumber,
      );
      feedback.success(`${ordered.length}개 문항을 Q${merged.number}로 합쳤습니다. OCR/임베딩 재계산 중입니다.`);
      qc.invalidateQueries({ queryKey: ["matchup-problems", docId] });
      qc.invalidateQueries({ queryKey: ["matchup-documents"] });
      onSuccess(merged.id);
      onClose();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { detail?: string } } };
      const msg = ax?.response?.data?.detail
        || (e instanceof Error ? e.message : "합치기 실패");
      feedback.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={() => { if (!submitting) onClose(); }}
      style={/* eslint-disable-line no-restricted-syntax */ {
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
      }}
    >
      <div
        data-testid="matchup-merge-modal"
        onClick={(e) => e.stopPropagation()}
        style={/* eslint-disable-line no-restricted-syntax */ {
          background: "var(--color-bg-surface)",
          borderRadius: "var(--radius-xl)",
          width: "min(960px, 96vw)",
          height: "min(720px, 90vh)",
          display: "flex", flexDirection: "column",
          boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
      >
        {/* 헤더 */}
        <div style={/* eslint-disable-line no-restricted-syntax */ {
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "var(--space-3) var(--space-5)",
          borderBottom: "1px solid var(--color-border-divider)",
          flexShrink: 0,
        }}>
          <div style={/* eslint-disable-line no-restricted-syntax */ { display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <Layers size={ICON.md} style={/* eslint-disable-line no-restricted-syntax */ { color: "var(--color-brand-primary)" }} />
            <h3 style={/* eslint-disable-line no-restricted-syntax */ { margin: 0, fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)" }}>
              쪼개진 문항 합치기
            </h3>
            <span style={/* eslint-disable-line no-restricted-syntax */ {
              fontSize: 11, padding: "2px 8px", borderRadius: 999,
              background: "color-mix(in srgb, var(--color-brand-primary) 12%, transparent)",
              color: "var(--color-brand-primary)", fontWeight: 700,
            }}>
              {ordered.length}개 → 1개
            </span>
          </div>
          <button
            onClick={() => { if (!submitting) onClose(); }}
            disabled={submitting}
            style={/* eslint-disable-line no-restricted-syntax */ {
              background: "none", border: "none", cursor: submitting ? "wait" : "pointer",
              color: "var(--color-text-muted)", padding: 4,
            }}
            title="닫기 (Esc)"
          >
            <X size={ICON.md} />
          </button>
        </div>

        {/* 본문 — 좌 미리보기 / 우 순서·번호 컨트롤 */}
        <div style={/* eslint-disable-line no-restricted-syntax */ {
          flex: 1, minHeight: 0, display: "flex",
        }}>
          {/* 좌: stack 미리보기 */}
          <div style={/* eslint-disable-line no-restricted-syntax */ {
            flex: 1.4, minWidth: 0, padding: "var(--space-4)",
            background: "var(--color-bg-surface-soft)",
            overflowY: "auto",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          }}>
            <p style={/* eslint-disable-line no-restricted-syntax */ {
              fontSize: 11, color: "var(--color-text-muted)",
              margin: "0 0 var(--space-2) 0", textAlign: "center",
            }}>
              위 → 아래 순서로 합쳐집니다 (최종 결과 미리보기)
            </p>
            {ordered.map((p, idx) => (
              <div
                key={p.id}
                style={/* eslint-disable-line no-restricted-syntax */ {
                  width: "100%", maxWidth: 480,
                  background: "white",
                  border: "1px solid var(--color-border-divider)",
                  borderRadius: 4,
                  padding: 4,
                  position: "relative",
                }}
              >
                <div style={/* eslint-disable-line no-restricted-syntax */ {
                  position: "absolute", top: 6, left: 6,
                  background: "var(--color-brand-primary)",
                  color: "white",
                  fontSize: 10, fontWeight: 700,
                  padding: "1px 6px", borderRadius: 999,
                  zIndex: 1,
                }}>
                  {idx + 1}
                </div>
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={`Q${p.number}`}
                    style={/* eslint-disable-line no-restricted-syntax */ {
                      display: "block", width: "100%", height: "auto",
                    }}
                  />
                ) : (
                  <div style={/* eslint-disable-line no-restricted-syntax */ {
                    minHeight: 80, display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--color-text-muted)", fontSize: 12,
                  }}>
                    이미지 없음 (Q{p.number})
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 우: 순서 + 번호 컨트롤 */}
          <div style={/* eslint-disable-line no-restricted-syntax */ {
            flex: 1, minWidth: 280,
            borderLeft: "1px solid var(--color-border-divider)",
            padding: "var(--space-4)",
            display: "flex", flexDirection: "column", gap: "var(--space-3)",
            overflowY: "auto",
          }}>
            <div>
              <label style={/* eslint-disable-line no-restricted-syntax */ {
                display: "block", fontSize: 11, fontWeight: 700,
                color: "var(--color-text-muted)", textTransform: "uppercase",
                letterSpacing: 0.5, marginBottom: 6,
              }}>
                최종 문항 번호
              </label>
              <input
                type="number"
                min={1}
                max={999}
                value={targetNumber}
                disabled={submitting}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setTargetNumber(Number.isFinite(v) ? v : defaultNumber);
                }}
                data-testid="matchup-merge-target-number"
                style={/* eslint-disable-line no-restricted-syntax */ {
                  width: 100, padding: "6px 10px", fontSize: 14, fontWeight: 600,
                  border: "1px solid var(--color-border-divider)",
                  borderRadius: 4,
                  background: "var(--color-bg-surface)",
                  color: "var(--color-text-primary)",
                }}
              />
              <p style={/* eslint-disable-line no-restricted-syntax */ {
                fontSize: 11, color: "var(--color-text-muted)",
                margin: "4px 0 0 0", lineHeight: 1.4,
              }}>
                기본값은 선택한 문항 중 가장 작은 번호입니다.
              </p>
            </div>

            <div style={/* eslint-disable-line no-restricted-syntax */ { borderTop: "1px solid var(--color-border-divider)", paddingTop: "var(--space-3)" }}>
              <label style={/* eslint-disable-line no-restricted-syntax */ {
                display: "block", fontSize: 11, fontWeight: 700,
                color: "var(--color-text-muted)", textTransform: "uppercase",
                letterSpacing: 0.5, marginBottom: 6,
              }}>
                순서 ({ordered.length}개) — 위가 위쪽
              </label>
              <ul style={/* eslint-disable-line no-restricted-syntax */ {
                listStyle: "none", padding: 0, margin: 0,
                display: "flex", flexDirection: "column", gap: 4,
              }}>
                {ordered.map((p, idx) => (
                  <li
                    key={p.id}
                    style={/* eslint-disable-line no-restricted-syntax */ {
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "6px 8px",
                      border: "1px solid var(--color-border-divider)",
                      borderRadius: 4,
                      background: "var(--color-bg-surface)",
                      fontSize: 12,
                    }}
                  >
                    <span style={/* eslint-disable-line no-restricted-syntax */ {
                      width: 22, height: 22, borderRadius: "50%",
                      background: "color-mix(in srgb, var(--color-brand-primary) 12%, transparent)",
                      color: "var(--color-brand-primary)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}>
                      {idx + 1}
                    </span>
                    <span style={/* eslint-disable-line no-restricted-syntax */ {
                      flex: 1, minWidth: 0, fontWeight: 600,
                      color: "var(--color-text-primary)",
                    }}>
                      Q{p.number}
                    </span>
                    <button
                      type="button"
                      onClick={() => moveItem(idx, -1)}
                      disabled={submitting || idx === 0}
                      title="위로"
                      style={/* eslint-disable-line no-restricted-syntax */ {
                        background: "none", border: "1px solid var(--color-border-divider)",
                        borderRadius: 4, padding: 3, cursor: idx === 0 ? "not-allowed" : "pointer",
                        opacity: idx === 0 ? 0.35 : 1,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <ArrowUp size={ICON.xs} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(idx, 1)}
                      disabled={submitting || idx === ordered.length - 1}
                      title="아래로"
                      style={/* eslint-disable-line no-restricted-syntax */ {
                        background: "none", border: "1px solid var(--color-border-divider)",
                        borderRadius: 4, padding: 3,
                        cursor: idx === ordered.length - 1 ? "not-allowed" : "pointer",
                        opacity: idx === ordered.length - 1 ? 0.35 : 1,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <ArrowDown size={ICON.xs} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div style={/* eslint-disable-line no-restricted-syntax */ {
              fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.5,
              padding: "var(--space-2) var(--space-3)",
              background: "var(--color-bg-surface-soft)",
              borderRadius: 4, marginTop: "auto",
            }}>
              · 합친 후 텍스트와 매치 결과는 자동으로 재계산됩니다 (잠시 소요)<br />
              · 원본 PDF/이미지는 변경되지 않습니다
            </div>
          </div>
        </div>

        {/* 하단 액션 */}
        <div style={/* eslint-disable-line no-restricted-syntax */ {
          display: "flex", justifyContent: "flex-end", gap: "var(--space-2)",
          padding: "var(--space-3) var(--space-5)",
          borderTop: "1px solid var(--color-border-divider)",
          flexShrink: 0,
        }}>
          <Button intent="ghost" size="sm" onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={submitting || ordered.length < 2}
            data-testid="matchup-merge-confirm-btn"
            leftIcon={
              submitting
                ? <Loader2 size={ICON.sm} className="animate-spin" />
                : <Layers size={ICON.sm} />
            }
          >
            {submitting ? "합치는 중..." : `${ordered.length}개를 Q${targetNumber}로 합치기`}
          </Button>
        </div>
      </div>
    </div>
  );
}
