/* eslint-disable no-restricted-syntax -- R-11 baseline: 기존 파일 인라인 style 64건 잔존. CSS 모듈 이전은 별도 리팩터 작업. */
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
import { X, Plus, Trash2, AlertCircle, Loader2, Crop, ClipboardPaste } from "lucide-react";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import {
  fetchDocumentPages,
  manualCropMatchupProblem,
  pasteImageAsMatchupProblem,
  fetchMatchupProblems,
  deleteMatchupProblem,
} from "../../api/matchup.api";
import type { MatchupDocument } from "../../api/matchup.api";

type Props = {
  document: MatchupDocument;
  onClose: () => void;
  // 검수 모달(LowConfPageReviewer) → 직접 자르기 인계 시 시작 페이지 지정.
  initialPage?: number;
};

type DraftBox = {
  pageIndex: number;
  // 모두 0..1 (페이지 정규화)
  x: number;
  y: number;
  w: number;
  h: number;
};

type DragMode =
  | "draw"   // 새 박스 그리기
  | "move"   // 박스 이동
  | "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w"; // 핸들 방향

const HANDLE_CURSOR: Record<Exclude<DragMode, "draw" | "move">, string> = {
  nw: "nwse-resize", n: "ns-resize", ne: "nesw-resize",
  e: "ew-resize", se: "nwse-resize", s: "ns-resize",
  sw: "nesw-resize", w: "ew-resize",
};

const MIN_BOX = 0.005; // 최소 0.5%

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// 드래그 모드별로 시작 박스 + 마우스 델타 기반 새 박스 계산.
// 모든 좌표는 0..1 정규화. 결과는 가시 box (음수 w/h 없음, 최소 크기 유지).
function applyDrag(
  mode: DragMode,
  startBox: DraftBox,
  startMouse: { x: number; y: number },
  curMouse: { x: number; y: number },
): DraftBox {
  const dx = curMouse.x - startMouse.x;
  const dy = curMouse.y - startMouse.y;
  const sb = startBox;
  const right = sb.x + sb.w;
  const bottom = sb.y + sb.h;

  switch (mode) {
    case "draw": {
      // 자유 드래그 — 시작 = startBox.x/y 그대로 두고 cur 좌표로 사각 만들기
      const x1 = Math.min(sb.x, curMouse.x);
      const y1 = Math.min(sb.y, curMouse.y);
      const x2 = Math.max(sb.x, curMouse.x);
      const y2 = Math.max(sb.y, curMouse.y);
      return { pageIndex: sb.pageIndex, x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    }
    case "move": {
      const nx = Math.max(0, Math.min(1 - sb.w, sb.x + dx));
      const ny = Math.max(0, Math.min(1 - sb.h, sb.y + dy));
      return { ...sb, x: nx, y: ny };
    }
    case "n": {
      const ny = Math.max(0, Math.min(bottom - MIN_BOX, sb.y + dy));
      return { ...sb, y: ny, h: bottom - ny };
    }
    case "s": {
      const nb = Math.max(sb.y + MIN_BOX, Math.min(1, bottom + dy));
      return { ...sb, h: nb - sb.y };
    }
    case "w": {
      const nx = Math.max(0, Math.min(right - MIN_BOX, sb.x + dx));
      return { ...sb, x: nx, w: right - nx };
    }
    case "e": {
      const nr = Math.max(sb.x + MIN_BOX, Math.min(1, right + dx));
      return { ...sb, w: nr - sb.x };
    }
    case "nw": {
      const nx = Math.max(0, Math.min(right - MIN_BOX, sb.x + dx));
      const ny = Math.max(0, Math.min(bottom - MIN_BOX, sb.y + dy));
      return { ...sb, x: nx, y: ny, w: right - nx, h: bottom - ny };
    }
    case "ne": {
      const ny = Math.max(0, Math.min(bottom - MIN_BOX, sb.y + dy));
      const nr = Math.max(sb.x + MIN_BOX, Math.min(1, right + dx));
      return { ...sb, y: ny, w: nr - sb.x, h: bottom - ny };
    }
    case "sw": {
      const nx = Math.max(0, Math.min(right - MIN_BOX, sb.x + dx));
      const nb = Math.max(sb.y + MIN_BOX, Math.min(1, bottom + dy));
      return { ...sb, x: nx, w: right - nx, h: nb - sb.y };
    }
    case "se": {
      const nr = Math.max(sb.x + MIN_BOX, Math.min(1, right + dx));
      const nb = Math.max(sb.y + MIN_BOX, Math.min(1, bottom + dy));
      return { ...sb, w: nr - sb.x, h: nb - sb.y };
    }
  }
}

export default function ManualCropModal({ document: doc, onClose, initialPage }: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();

  const [activePage, setActivePage] = useState(initialPage ?? 0);
  const [draft, setDraft] = useState<DraftBox | null>(null);
  const [number, setNumber] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  // 클립보드/파일 paste — 현재 붙여넣은 이미지(파일+미리보기 URL+다음 빈 번호)
  const [pasted, setPasted] = useState<{ file: File; previewUrl: string; number: number } | null>(null);

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    mode: DragMode;
    startMouse: { x: number; y: number };
    startBox: DraftBox;
  } | null>(null);

  // 정규화 좌표 변환: 마우스 client 좌표 → 캔버스 0..1
  const toNorm = useCallback((clientX: number, clientY: number) => {
    const el = canvasContainerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    };
  }, []);

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
  // problemsQuery.data를 useMemo 안에서 사용 — `?? []` logical은 매 렌더 새 참조라
  // exhaustive-deps strict warn (이전 baseline 잔존, 내 prop 추가로 changed 파일 진입).
  const problems = useMemo(() => problemsQuery.data ?? [], [problemsQuery.data]);
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

  // ESC: 붙여넣기 미리보기 우선 → 드래그 → 모달 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pasted) {
          URL.revokeObjectURL(pasted.previewUrl);
          setPasted(null);
        } else if (draft) {
          setDraft(null);
        } else if (!saving) {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft, pasted, saving, onClose]);

  // 다음 빈 번호 계산 — paste 모드에서 사용
  const computeNextNumber = useCallback((): number => {
    if (problems.length === 0) return 1;
    const used = new Set(problems.map((p) => p.number));
    let n = 1;
    while (used.has(n)) n += 1;
    return n;
  }, [problems]);

  // 모달 어디서든 Ctrl+V — 클립보드 이미지를 paste 미리보기로 띄움
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (saving) return;
      // 인풋(번호 입력)에 포커스가 있고 텍스트(숫자) paste면 무시
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        const itemsForText = e.clipboardData?.types || [];
        const onlyText = itemsForText.length === 1 && itemsForText[0] === "text/plain";
        if (onlyText) return;
      }
      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;
      let imgFile: File | null = null;
      for (let i = 0; i < items.length; i += 1) {
        if (items[i].kind === "file" && items[i].type.startsWith("image/")) {
          imgFile = items[i].getAsFile();
          if (imgFile) break;
        }
      }
      if (!imgFile) return;
      e.preventDefault();
      const url = URL.createObjectURL(imgFile);
      setPasted((prev) => {
        if (prev) URL.revokeObjectURL(prev.previewUrl);
        return { file: imgFile!, previewUrl: url, number: computeNextNumber() };
      });
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [saving, computeNextNumber]);

  // 컴포넌트 언마운트 시 paste preview 정리
  useEffect(() => {
    return () => {
      if (pasted) URL.revokeObjectURL(pasted.previewUrl);
    };
  }, [pasted]);

  // 캔버스 빈 공간 mousedown → 새 박스 그리기 시작
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (!activePageData) return;
    const m = toNorm(e.clientX, e.clientY);
    if (!m) return;
    const startBox: DraftBox = { pageIndex: activePage, x: m.x, y: m.y, w: 0, h: 0 };
    dragStateRef.current = { mode: "draw", startMouse: m, startBox };
    setDraft(startBox);
  };

  // 박스 본체 mousedown → 이동
  const handleBoxMouseDown = (e: React.MouseEvent) => {
    if (!draft) return;
    e.stopPropagation();
    const m = toNorm(e.clientX, e.clientY);
    if (!m) return;
    dragStateRef.current = { mode: "move", startMouse: m, startBox: { ...draft } };
  };

  // 핸들 mousedown → 해당 방향 리사이즈
  const handleResizeMouseDown = (mode: Exclude<DragMode, "draw" | "move">) =>
    (e: React.MouseEvent) => {
      if (!draft) return;
      e.stopPropagation();
      const m = toNorm(e.clientX, e.clientY);
      if (!m) return;
      dragStateRef.current = { mode, startMouse: m, startBox: { ...draft } };
    };

  // window 단위로 mousemove/up 처리 — 캔버스 밖으로 마우스가 나가도 추적 끊기지 않음
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const ds = dragStateRef.current;
      if (!ds) return;
      const m = toNorm(e.clientX, e.clientY);
      if (!m) return;
      const next = applyDrag(ds.mode, ds.startBox, ds.startMouse, m);
      setDraft(next);
    };
    const onUp = () => {
      const ds = dragStateRef.current;
      if (!ds) return;
      dragStateRef.current = null;
      // draw 끝났는데 너무 작으면 폐기
      setDraft((cur) => {
        if (!cur) return cur;
        if (cur.w < MIN_BOX || cur.h < MIN_BOX) return null;
        return cur;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [toNorm]);

  // 화살표 키 미세조정: shift = 큰 단위(2%), 그냥 = 작은(0.5%)
  // alt = 크기 조정(우/하 단), 기본 = 위치 이동
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!draft) return;
      const target = e.target as HTMLElement | null;
      // 텍스트 인풋(번호 입력)에 포커스가 있으면 무시 — 숫자 변경/Enter 흐름 보존
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const isArrow = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key);
      if (!isArrow) return;
      e.preventDefault();
      const step = e.shiftKey ? 0.02 : 0.005;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      setDraft((cur) => {
        if (!cur) return cur;
        if (e.altKey) {
          // 크기 조정 — 우/하 변
          return {
            ...cur,
            w: Math.max(MIN_BOX, Math.min(1 - cur.x, cur.w + dx)),
            h: Math.max(MIN_BOX, Math.min(1 - cur.y, cur.h + dy)),
          };
        }
        return {
          ...cur,
          x: Math.max(0, Math.min(1 - cur.w, cur.x + dx)),
          y: Math.max(0, Math.min(1 - cur.h, cur.y + dy)),
        };
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft]);

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
      const created = await manualCropMatchupProblem(doc.id, {
        pageIndex: draft.pageIndex,
        bbox: { x: draft.x, y: draft.y, w: draft.w, h: draft.h },
        number,
      });
      // 옵티미스틱 즉시 반영 — invalidate 후 refetch 1~2초 지연 회피.
      // 모달 안 problem 목록과 외부 ProblemGrid 양쪽에 즉시 추가/교체.
      qc.setQueryData<typeof problems>(
        ["matchup-problems", doc.id],
        (old) => {
          const base = old ?? [];
          const filtered = base.filter((p) => p.number !== created.number);
          return [...filtered, created].sort((a, b) => a.number - b.number);
        },
      );
      // 백그라운드 invalidate (다음 fetch 보장만 — UI 대기 없음)
      qc.invalidateQueries({ queryKey: ["matchup-problems", doc.id] });
      qc.invalidateQueries({ queryKey: ["matchup-documents"] });
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

  const handleSavePaste = useCallback(async () => {
    if (!pasted) return;
    if (!Number.isFinite(pasted.number) || pasted.number < 1 || pasted.number > 999) {
      feedback.error("문항 번호는 1~999 사이여야 합니다.");
      return;
    }
    const existing = problems.find((p) => p.number === pasted.number);
    if (existing) {
      const ok = await confirm({
        title: `${pasted.number}번 문제 덮어쓰기`,
        message: `${pasted.number}번 문제가 이미 있습니다. 새 이미지로 교체하시겠습니까?`,
        confirmText: "덮어쓰기",
        danger: true,
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      const created = await pasteImageAsMatchupProblem(doc.id, pasted.file, pasted.number);
      qc.setQueryData<typeof problems>(
        ["matchup-problems", doc.id],
        (old) => {
          const base = old ?? [];
          const filtered = base.filter((p) => p.number !== created.number);
          return [...filtered, created].sort((a, b) => a.number - b.number);
        },
      );
      qc.invalidateQueries({ queryKey: ["matchup-problems", doc.id] });
      qc.invalidateQueries({ queryKey: ["matchup-documents"] });
      feedback.success(`${pasted.number}번 문제 저장됨 (붙여넣기)`);
      URL.revokeObjectURL(pasted.previewUrl);
      setPasted(null);
    } catch (e) {
      console.error(e);
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "이미지 붙여넣기 저장에 실패했습니다.";
      feedback.error(msg);
    } finally {
      setSaving(false);
    }
  }, [pasted, problems, doc.id, qc, confirm]);

  const handlePastePreviewKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && pasted && !saving) {
      e.preventDefault();
      void handleSavePaste();
    }
  };

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
              display: "flex", alignItems: "center", gap: "var(--space-2)",
              flexWrap: "wrap",
            }}>
              <span>드래그로 영역 선택 · 박스 끌어 이동 · 8방향 핸들 크기 조정 · ←↑↓→ 미세조정 (Shift=크게, Alt=크기) · 우측 번호 입력 후 Enter</span>
              <span style={{
                marginLeft: "auto",
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "2px 8px", borderRadius: 999,
                background: "color-mix(in srgb, var(--color-brand-primary) 8%, transparent)",
                color: "var(--color-brand-primary)", fontWeight: 600,
              }}>
                <ClipboardPaste size={11} /> Ctrl+V로 이미지 직접 붙여넣기
              </span>
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
                  onMouseDown={handleCanvasMouseDown}
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
                  {/* 현재 그리는 박스 + 8방향 리사이즈 핸들 */}
                  {draft && draft.pageIndex === activePage && (() => {
                    const bx = draft.x * 100, by = draft.y * 100;
                    const bw = draft.w * 100, bh = draft.h * 100;
                    const HANDLE_SIZE = 10;
                    const handleStyle = (cursor: string): React.CSSProperties => ({
                      position: "absolute",
                      width: HANDLE_SIZE, height: HANDLE_SIZE,
                      background: "var(--color-bg-surface)",
                      border: "2px solid var(--color-brand-primary)",
                      borderRadius: 2,
                      cursor,
                      zIndex: 2,
                    });
                    return (
                      <>
                        {/* 박스 본체 — 클릭 드래그로 이동 */}
                        <div
                          data-testid="matchup-crop-draft"
                          onMouseDown={handleBoxMouseDown}
                          style={{
                            position: "absolute",
                            left: `${bx}%`, top: `${by}%`,
                            width: `${bw}%`, height: `${bh}%`,
                            border: "2px solid var(--color-brand-primary)",
                            background: "color-mix(in srgb, var(--color-brand-primary) 14%, transparent)",
                            cursor: "move",
                            zIndex: 1,
                          }}
                        />
                        {/* 8방향 리사이즈 핸들 — 박스 외부 좌표로 정확히 배치 */}
                        <div onMouseDown={handleResizeMouseDown("nw")} style={{ ...handleStyle(HANDLE_CURSOR.nw),
                          left: `calc(${bx}% - ${HANDLE_SIZE / 2}px)`, top: `calc(${by}% - ${HANDLE_SIZE / 2}px)` }} />
                        <div onMouseDown={handleResizeMouseDown("n")} style={{ ...handleStyle(HANDLE_CURSOR.n),
                          left: `calc(${bx + bw / 2}% - ${HANDLE_SIZE / 2}px)`, top: `calc(${by}% - ${HANDLE_SIZE / 2}px)` }} />
                        <div onMouseDown={handleResizeMouseDown("ne")} style={{ ...handleStyle(HANDLE_CURSOR.ne),
                          left: `calc(${bx + bw}% - ${HANDLE_SIZE / 2}px)`, top: `calc(${by}% - ${HANDLE_SIZE / 2}px)` }} />
                        <div onMouseDown={handleResizeMouseDown("e")} style={{ ...handleStyle(HANDLE_CURSOR.e),
                          left: `calc(${bx + bw}% - ${HANDLE_SIZE / 2}px)`, top: `calc(${by + bh / 2}% - ${HANDLE_SIZE / 2}px)` }} />
                        <div onMouseDown={handleResizeMouseDown("se")} style={{ ...handleStyle(HANDLE_CURSOR.se),
                          left: `calc(${bx + bw}% - ${HANDLE_SIZE / 2}px)`, top: `calc(${by + bh}% - ${HANDLE_SIZE / 2}px)` }} />
                        <div onMouseDown={handleResizeMouseDown("s")} style={{ ...handleStyle(HANDLE_CURSOR.s),
                          left: `calc(${bx + bw / 2}% - ${HANDLE_SIZE / 2}px)`, top: `calc(${by + bh}% - ${HANDLE_SIZE / 2}px)` }} />
                        <div onMouseDown={handleResizeMouseDown("sw")} style={{ ...handleStyle(HANDLE_CURSOR.sw),
                          left: `calc(${bx}% - ${HANDLE_SIZE / 2}px)`, top: `calc(${by + bh}% - ${HANDLE_SIZE / 2}px)` }} />
                        <div onMouseDown={handleResizeMouseDown("w")} style={{ ...handleStyle(HANDLE_CURSOR.w),
                          left: `calc(${bx}% - ${HANDLE_SIZE / 2}px)`, top: `calc(${by + bh / 2}% - ${HANDLE_SIZE / 2}px)` }} />
                      </>
                    );
                  })()}
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
            {/* paste 미리보기 (가장 우선) */}
            {pasted && (
              <div style={{
                padding: "var(--space-3)",
                borderBottom: "1px solid var(--color-border-divider)",
                background: "color-mix(in srgb, var(--color-brand-primary) 6%, var(--color-bg-surface))",
                flexShrink: 0,
                display: "flex", flexDirection: "column", gap: "var(--space-2)",
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700,
                  color: "var(--color-brand-primary)",
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <ClipboardPaste size={12} /> 붙여넣은 이미지
                </div>
                <img
                  src={pasted.previewUrl}
                  alt="붙여넣은 이미지 미리보기"
                  data-testid="matchup-paste-preview"
                  style={{
                    maxWidth: "100%", maxHeight: 160,
                    objectFit: "contain",
                    border: "1px solid var(--color-border-divider)",
                    borderRadius: 4, background: "white",
                    alignSelf: "center",
                  }}
                />
                <label style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontSize: 13,
                }}>
                  <span style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>번호</span>
                  <input
                    type="number"
                    min={1} max={999}
                    value={pasted.number}
                    onChange={(e) => setPasted((p) => p ? { ...p, number: Number(e.target.value) || 1 } : p)}
                    onKeyDown={handlePastePreviewKey}
                    data-testid="matchup-paste-number-input"
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
                  onClick={handleSavePaste}
                  disabled={saving}
                  data-testid="matchup-paste-save-btn"
                  style={{ width: "100%" }}
                >
                  {saving ? "저장 중…" : `${pasted.number}번으로 저장 (Enter)`}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(pasted.previewUrl);
                    setPasted(null);
                  }}
                  disabled={saving}
                  style={{
                    width: "100%",
                    background: "none", border: "none",
                    color: "var(--color-text-muted)", fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  취소 (Esc)
                </button>
              </div>
            )}
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
                  마우스로 드래그해서 문항 영역을 선택하거나, <strong style={{ color: "var(--color-brand-primary)" }}>Ctrl+V</strong>로 클립보드 이미지를 바로 붙여넣을 수 있습니다.
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
