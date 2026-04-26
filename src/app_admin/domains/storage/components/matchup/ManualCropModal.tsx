// PATH: src/app_admin/domains/storage/components/matchup/ManualCropModal.tsx
//
// 수동 문항 자르기 모달.
//
// 자동 분리가 처참할 때 사용자가 직접 원본 위에 박스를 그려 problem을 추가/덮어씀.
// 윈도우 편집도구로 잘라서 다시 올리는 비효율 제거 — 앱 내에서 즉시 반영.
//
// UX 핵심:
//  - 페이지 썸네일 좌측 → 클릭하면 메인 캔버스에 큰 페이지가 뜨고 마우스 드래그로 박스
//  - 박스 완료 즉시 우측 인스펙터 = 번호 입력 + "이 영역 저장" CTA. Enter 키 OK.
//  - 저장 즉시 우측 목록에 카드 표시(즉각 피드백). 다음 박스 바로 가능.
//  - 같은 번호 problem 있으면 덮어쓰기 confirm.
//  - ESC 닫기 (드래그 중이면 박스 취소만).

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Trash2, AlertCircle, Loader2, Crop } from "lucide-react";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import {
  fetchDocumentPages,
  manualCropMatchupProblem,
  fetchMatchupProblems,
  deleteMatchupProblem,
} from "../../api/matchup.api";
import type { MatchupDocument } from "../../api/matchup.api";

type Props = {
  document: MatchupDocument;
  onClose: () => void;
};

type DraftBox = {
  pageIndex: number;
  // 모두 0..1 (페이지 정규화)
  x: number;
  y: number;
  w: number;
  h: number;
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export default function ManualCropModal({ document: doc, onClose }: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();

  const [activePage, setActivePage] = useState(0);
  const [draft, setDraft] = useState<DraftBox | null>(null);
  const [number, setNumber] = useState<number>(1);
  const [saving, setSaving] = useState(false);

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const pagesQuery = useQuery({
    queryKey: ["matchup-doc-pages", doc.id],
    queryFn: () => fetchDocumentPages(doc.id),
    staleTime: 5 * 60 * 1000,
  });

  const problemsQuery = useQuery({
    queryKey: ["matchup-problems", doc.id],
    queryFn: () => fetchMatchupProblems(doc.id),
  });

  const pages = pagesQuery.data?.pages ?? [];
  const activePageData = pages[activePage];
  const problems = problemsQuery.data ?? [];
  const problemsOnPage = useMemo(
    () => problems.filter((p) => (p.meta as Record<string, unknown> | null)?.page_index === activePage),
    [problems, activePage],
  );

  // 다음 추천 번호: 기존 + draft 다음 빈 번호
  useEffect(() => {
    if (problems.length === 0) {
      setNumber(1);
      return;
    }
    const used = new Set(problems.map((p) => p.number));
    let n = 1;
    while (used.has(n)) n += 1;
    setNumber(n);
  }, [problems]);

  // ESC: 드래그 중이면 취소만, 아니면 모달 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (draft) {
          setDraft(null);
        } else if (!saving) {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft, saving, onClose]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!activePageData || !canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const x = clamp01((e.clientX - rect.left) / rect.width);
    const y = clamp01((e.clientY - rect.top) / rect.height);
    dragStartRef.current = { x, y };
    isDraggingRef.current = true;
    setDraft({ pageIndex: activePage, x, y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !dragStartRef.current || !canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const cx = clamp01((e.clientX - rect.left) / rect.width);
    const cy = clamp01((e.clientY - rect.top) / rect.height);
    const sx = dragStartRef.current.x;
    const sy = dragStartRef.current.y;
    setDraft({
      pageIndex: activePage,
      x: Math.min(sx, cx),
      y: Math.min(sy, cy),
      w: Math.abs(cx - sx),
      h: Math.abs(cy - sy),
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    dragStartRef.current = null;
    if (draft && (draft.w < 0.005 || draft.h < 0.005)) {
      setDraft(null);
    }
  };

  const handleSave = useCallback(async () => {
    if (!draft || !activePageData) return;
    if (draft.w < 0.005 || draft.h < 0.005) {
      feedback.error("선택 영역이 너무 작습니다. 다시 그려주세요.");
      return;
    }
    if (!Number.isFinite(number) || number < 1 || number > 999) {
      feedback.error("문항 번호는 1~999 사이여야 합니다.");
      return;
    }

    const existing = problems.find((p) => p.number === number);
    if (existing) {
      const ok = await confirm({
        title: `${number}번 문제 덮어쓰기`,
        message: `${number}번 문제가 이미 있습니다. 새로 자른 영역으로 교체하시겠습니까?`,
        confirmText: "덮어쓰기",
        danger: true,
      });
      if (!ok) return;
    }

    setSaving(true);
    try {
      await manualCropMatchupProblem(doc.id, {
        pageIndex: draft.pageIndex,
        bbox: { x: draft.x, y: draft.y, w: draft.w, h: draft.h },
        number,
      });
      await qc.invalidateQueries({ queryKey: ["matchup-problems", doc.id] });
      await qc.invalidateQueries({ queryKey: ["matchup-documents"] });
      feedback.success(`${number}번 문제 저장됨`);
      setDraft(null);
      // 다음 빈 번호로 자동 이동
      setNumber((prev) => prev + 1);
    } catch (e) {
      console.error(e);
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "저장에 실패했습니다.";
      feedback.error(msg);
    } finally {
      setSaving(false);
    }
  }, [draft, activePageData, number, doc.id, problems, qc, confirm]);

  const handleDeleteProblem = async (problemId: number, num: number) => {
    const ok = await confirm({
      title: `${num}번 문제 삭제`,
      message: `${num}번 문제를 삭제할까요? 이미지도 함께 사라집니다.`,
      confirmText: "삭제",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteMatchupProblem(problemId);
      await qc.invalidateQueries({ queryKey: ["matchup-problems", doc.id] });
      await qc.invalidateQueries({ queryKey: ["matchup-documents"] });
      feedback.success(`${num}번 문제 삭제됨`);
    } catch {
      feedback.error("삭제 실패");
    }
  };

  // Save on Enter (드래프트가 있을 때만)
  const handleNumberKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && draft && !saving) {
      e.preventDefault();
      void handleSave();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
      }}
      onClick={saving ? undefined : onClose}
    >
      <div
        data-testid="matchup-manual-crop-modal"
        style={{
          background: "var(--color-bg-surface)", borderRadius: "var(--radius-xl)",
          width: "min(1200px, 96vw)", height: "min(820px, 92vh)",
          display: "flex", flexDirection: "column",
          boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: "var(--space-3) var(--space-5)",
          borderBottom: "1px solid var(--color-border-divider)",
          flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0 }}>
            <Crop size={16} style={{ color: "var(--color-brand-primary)", flexShrink: 0 }} />
            <h3 style={{
              margin: 0, fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              직접 자르기 — {doc.title}
            </h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {pages.length > 0 ? `${activePage + 1} / ${pages.length} 페이지` : ""}
              {" · "}
              {problems.length}문제 등록
            </span>
            <button
              onClick={onClose}
              disabled={saving}
              style={{
                background: "none", border: "none",
                cursor: saving ? "not-allowed" : "pointer",
                color: "var(--color-text-secondary)",
                opacity: saving ? 0.5 : 1,
              }}
              title="닫기 (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body: [페이지 썸네일] [캔버스] [인스펙터] */}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {/* 좌: 페이지 썸네일 */}
          <div style={{
            width: 110, flexShrink: 0,
            borderRight: "1px solid var(--color-border-divider)",
            overflowY: "auto", padding: "var(--space-2)",
            background: "var(--color-bg-surface-soft)",
          }}>
            {pagesQuery.isLoading && (
              <div style={{ padding: "var(--space-4)", textAlign: "center" }}>
                <Loader2 size={16} className="animate-spin" style={{ color: "var(--color-text-muted)" }} />
              </div>
            )}
            {pages.map((p) => (
              <button
                key={p.index}
                type="button"
                onClick={() => { setActivePage(p.index); setDraft(null); }}
                data-testid="matchup-crop-page-thumb"
                data-page={p.index}
                style={{
                  width: "100%", marginBottom: 6,
                  border: activePage === p.index
                    ? "2px solid var(--color-brand-primary)"
                    : "1px solid var(--color-border-divider)",
                  borderRadius: 6, background: "var(--color-bg-surface)",
                  cursor: "pointer", padding: 4,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                }}
                title={`${p.index + 1}페이지`}
              >
                <img
                  src={p.url}
                  alt={`Page ${p.index + 1}`}
                  loading="lazy"
                  style={{
                    width: "100%", aspectRatio: `${p.width || 1} / ${p.height || 1.4}`,
                    objectFit: "contain", background: "white",
                  }}
                />
                <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontWeight: 600 }}>
                  {p.index + 1}
                </span>
              </button>
            ))}
          </div>

          {/* 중앙: 캔버스 */}
          <div style={{
            flex: 1, minWidth: 0,
            display: "flex", flexDirection: "column",
            background: "var(--color-bg-surface-soft)",
          }}>
            <div style={{
              padding: "6px var(--space-3)",
              fontSize: 11, color: "var(--color-text-muted)",
              borderBottom: "1px solid var(--color-border-divider)",
              flexShrink: 0,
              background: "var(--color-bg-surface)",
            }}>
              마우스로 드래그해 문항 영역을 선택 → 우측에서 번호 입력 후 Enter 또는 "이 영역 저장"
            </div>
            <div style={{
              flex: 1, minHeight: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "var(--space-3)",
              overflow: "auto",
            }}>
              {pagesQuery.isLoading ? (
                <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
                  <Loader2 size={18} className="animate-spin" style={{ marginRight: 6 }} />
                  페이지 준비 중…
                </div>
              ) : pagesQuery.isError ? (
                <div style={{
                  color: "var(--color-danger)", fontSize: 13,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <AlertCircle size={16} /> 페이지 로드 실패
                </div>
              ) : !activePageData ? (
                <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
                  페이지가 없습니다.
                </div>
              ) : (
                <div
                  ref={canvasContainerRef}
                  data-testid="matchup-crop-canvas"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  style={{
                    position: "relative",
                    background: "white",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
                    borderRadius: 4,
                    cursor: "crosshair",
                    userSelect: "none",
                    maxWidth: "100%",
                    maxHeight: "100%",
                    aspectRatio: `${activePageData.width || 1} / ${activePageData.height || 1.4}`,
                    width: "auto",
                    height: "100%",
                  }}
                >
                  <img
                    src={activePageData.url}
                    alt={`Page ${activePage + 1}`}
                    draggable={false}
                    style={{
                      width: "100%", height: "100%", display: "block",
                      objectFit: "contain", pointerEvents: "none",
                    }}
                  />
                  {/* 기존 problem 박스 (page_index 매칭 — meta에 bbox_norm 있을 때) */}
                  {problemsOnPage.map((p) => {
                    const m = p.meta as Record<string, unknown> | null;
                    const bb = (m?.bbox_norm as number[] | undefined) || null;
                    if (!bb || bb.length !== 4) return null;
                    const [bx, by, bw, bh] = bb;
                    return (
                      <div
                        key={p.id}
                        title={`${p.number}번 (저장됨)`}
                        style={{
                          position: "absolute",
                          left: `${bx * 100}%`, top: `${by * 100}%`,
                          width: `${bw * 100}%`, height: `${bh * 100}%`,
                          border: "2px solid var(--color-success)",
                          background: "color-mix(in srgb, var(--color-success) 12%, transparent)",
                          pointerEvents: "none",
                        }}
                      >
                        <span style={{
                          position: "absolute", top: -2, left: -2,
                          background: "var(--color-success)", color: "white",
                          fontSize: 10, fontWeight: 800, padding: "1px 5px",
                          borderRadius: 3,
                        }}>
                          {p.number}
                        </span>
                      </div>
                    );
                  })}
                  {/* 현재 그리는 박스 */}
                  {draft && draft.pageIndex === activePage && (
                    <div
                      data-testid="matchup-crop-draft"
                      style={{
                        position: "absolute",
                        left: `${draft.x * 100}%`, top: `${draft.y * 100}%`,
                        width: `${draft.w * 100}%`, height: `${draft.h * 100}%`,
                        border: "2px solid var(--color-brand-primary)",
                        background: "color-mix(in srgb, var(--color-brand-primary) 14%, transparent)",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 우: 인스펙터 + 등록된 문제 목록 */}
          <div style={{
            width: 280, flexShrink: 0,
            borderLeft: "1px solid var(--color-border-divider)",
            display: "flex", flexDirection: "column", minHeight: 0,
          }}>
            {/* 드래프트 인스펙터 */}
            <div style={{
              padding: "var(--space-3)",
              borderBottom: "1px solid var(--color-border-divider)",
              background: draft
                ? "color-mix(in srgb, var(--color-brand-primary) 6%, var(--color-bg-surface))"
                : "var(--color-bg-surface-soft)",
              flexShrink: 0,
            }}>
              {draft ? (
                <>
                  <div style={{
                    fontSize: 11, fontWeight: 700,
                    color: "var(--color-brand-primary)", marginBottom: "var(--space-2)",
                  }}>
                    선택 영역 ({(draft.w * 100).toFixed(0)}% × {(draft.h * 100).toFixed(0)}%)
                  </div>
                  <label style={{
                    display: "flex", alignItems: "center", gap: 6,
                    fontSize: 13, marginBottom: "var(--space-2)",
                  }}>
                    <span style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>번호</span>
                    <input
                      type="number"
                      min={1} max={999}
                      value={number}
                      onChange={(e) => setNumber(Number(e.target.value) || 1)}
                      onKeyDown={handleNumberKey}
                      data-testid="matchup-crop-number-input"
                      autoFocus
                      style={{
                        flex: 1, padding: "5px 8px",
                        border: "1px solid var(--color-border-divider)",
                        borderRadius: 4, fontSize: 13, fontWeight: 700,
                      }}
                    />
                  </label>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving}
                    data-testid="matchup-crop-save-btn"
                    style={{ width: "100%" }}
                  >
                    {saving ? "저장 중…" : `${number}번으로 저장 (Enter)`}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setDraft(null)}
                    disabled={saving}
                    style={{
                      width: "100%", marginTop: 6,
                      background: "none", border: "none",
                      color: "var(--color-text-muted)", fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    영역 다시 그리기 (Esc)
                  </button>
                </>
              ) : (
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                  마우스로 드래그해서 문항 영역을 선택하세요. 자른 영역은 즉시 저장됩니다.
                </div>
              )}
            </div>

            {/* 이 페이지의 등록된 문제 */}
            <div style={{
              flex: 1, minHeight: 0, overflowY: "auto",
              padding: "var(--space-3)",
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700,
                color: "var(--color-text-secondary)", marginBottom: "var(--space-2)",
                textTransform: "uppercase", letterSpacing: 0.4,
              }}>
                이 페이지 ({problemsOnPage.length}) · 전체 {problems.length}
              </div>
              {problemsOnPage.length === 0 && (
                <div style={{
                  fontSize: 11, color: "var(--color-text-muted)",
                  padding: "var(--space-2)",
                  border: "1px dashed var(--color-border-divider)",
                  borderRadius: 4, textAlign: "center",
                }}>
                  이 페이지에 저장된 영역이 없습니다.
                </div>
              )}
              {problemsOnPage.map((p) => (
                <div
                  key={p.id}
                  data-testid="matchup-crop-problem-row"
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 8px",
                    border: "1px solid var(--color-border-divider)",
                    borderRadius: 4, marginBottom: 4,
                    background: "var(--color-bg-surface)",
                  }}
                >
                  <span style={{
                    fontSize: 12, fontWeight: 800, color: "var(--color-success)",
                    minWidth: 24,
                  }}>
                    {p.number}번
                  </span>
                  <span style={{
                    flex: 1, fontSize: 11, color: "var(--color-text-muted)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {(p.meta as Record<string, unknown> | null)?.manual ? "수동" : "자동"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteProblem(p.id, p.number)}
                    title="삭제"
                    style={{
                      background: "none", border: "none",
                      color: "var(--color-text-muted)", cursor: "pointer",
                      padding: 2, display: "flex",
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* Footer hint */}
            <div style={{
              padding: "var(--space-2) var(--space-3)",
              borderTop: "1px solid var(--color-border-divider)",
              fontSize: 11, color: "var(--color-text-muted)",
              flexShrink: 0,
            }}>
              <Plus size={11} style={{ verticalAlign: "middle", marginRight: 3 }} />
              자른 결과는 즉시 그리드에 반영됩니다.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
