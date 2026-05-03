// PATH: src/app_admin/domains/storage/components/matchup/DocumentList.tsx
// 좌측 문서 목록 패널
//
// 멘탈 모델: 카테고리(학교/세트) → intent(시험지/참고자료) → 문서.
// 사용자는 저장소에서 폴더로 학교를 분류하고, 매치업도 그 폴더 단위로 보고 싶어함.
// 빈 카테고리 자동 접힘. 검색 + 상태 필터.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText, Loader2, AlertCircle, CheckCircle2, RefreshCw, Trash2,
  Search, X, BookOpen, ClipboardList, ChevronDown, ChevronRight, FolderOpen,
  MoreVertical, Pencil, FolderInput, Eraser, Database, Check,
} from "lucide-react";
import { Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import type { MatchupDocument, SegmentationMethod } from "../../api/matchup.api";
import type { DocProgressMap } from "../../hooks/useMatchupPolling";
import { getDocumentIntent } from "./documentIntent";
import css from "@/shared/ui/domain/PanelWithTreeLayout.module.css";

type Props = {
  documents: MatchupDocument[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onUpload: (intent?: "reference" | "test", defaultCategory?: string) => void;
  onPromoteFromInventory?: (defaultCategory?: string) => void;
  onRenameCategory?: (from: string, to: string) => Promise<void> | void;
  onMergeCategory?: (from: string, to: string) => Promise<void> | void;
  onClearCategory?: (name: string) => Promise<void> | void;
  onDelete: (id: number) => void;
  onRetry: (id: number) => void;
  // 행 컨텍스트 액션. 미지원 시 메뉴에서 항목이 비활성/숨김.
  onChangeIntent?: (id: number, next: "reference" | "test") => Promise<void> | void;
  onRenameDocument?: (id: number, title: string) => Promise<void> | void;
  onChangeDocumentCategory?: (id: number, category: string) => Promise<void> | void;
  progressMap?: DocProgressMap;
};

type StatusFilter = "all" | "processing" | "done" | "failed";

const UNCATEGORIZED_KEY = "__uncategorized__";
const UNCATEGORIZED_LABEL = "미분류";

const STATUS_ICON = {
  pending: <Loader2 size={14} style={{ color: "var(--color-text-muted)" }} />,
  processing: <Loader2 size={14} className="animate-spin" style={{ color: "var(--color-brand-primary)" }} />,
  done: <CheckCircle2 size={14} style={{ color: "var(--color-success)" }} />,
  failed: <AlertCircle size={14} style={{ color: "var(--color-danger)" }} />,
} as const;

const STATUS_LABEL = {
  pending: "대기",
  processing: "처리 중",
  done: "",
  failed: "실패",
} as const;

const SEG_META: Record<SegmentationMethod, { label: string; color: string; tip: string }> = {
  text: { label: "텍스트", color: "var(--color-success)", tip: "PDF 텍스트 직접 추출" },
  ocr: { label: "OCR", color: "var(--color-brand-primary)", tip: "스캔본 OCR로 텍스트 추출" },
  mixed: { label: "혼합", color: "var(--color-brand-primary)", tip: "텍스트 + OCR 혼합 추출" },
  image: { label: "이미지", color: "var(--color-text-secondary)", tip: "단일 이미지 업로드" },
  none: { label: "미검출", color: "var(--color-warning)", tip: "문제 영역을 못 찾음 — 페이지 단위로 처리됨" },
};

function categoryKeyOf(doc: MatchupDocument): string {
  return (doc.category || "").trim() || UNCATEGORIZED_KEY;
}

function categoryLabelOf(key: string): string {
  return key === UNCATEGORIZED_KEY ? UNCATEGORIZED_LABEL : key;
}

function CategoryMenuItem({
  icon, label, onClick, danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      data-testid="matchup-category-menu-item"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "6px 10px",
        background: "transparent",
        border: "none",
        borderRadius: "var(--radius-sm)",
        textAlign: "left",
        fontSize: 12,
        fontWeight: 500,
        color: danger ? "var(--color-danger)" : "var(--color-text-primary)",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger
          ? "color-mix(in srgb, var(--color-danger) 10%, transparent)"
          : "var(--color-bg-surface-soft)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span style={{ flexShrink: 0, color: danger ? "var(--color-danger)" : "var(--color-text-secondary)", display: "flex" }}>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

export default function DocumentList({
  documents, selectedId, onSelect, onUpload,
  onPromoteFromInventory, onRenameCategory, onMergeCategory, onClearCategory,
  onDelete, onRetry,
  onChangeIntent, onRenameDocument, onChangeDocumentCategory,
  progressMap = {},
}: Props) {
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // 행 컨텍스트 메뉴 — 우클릭 또는 ··· 클릭 시 표시.
  // 위치 좌표(viewport 기준)와 doc id를 저장. 다른 곳 클릭/Esc로 닫힘.
  const [rowMenu, setRowMenu] = useState<{ id: number; x: number; y: number } | null>(null);
  // 인라인 이름 변경 (rename) — 활성 doc id + 입력값
  const [renamingDocId, setRenamingDocId] = useState<number | null>(null);
  const [renameDocValue, setRenameDocValue] = useState("");
  // 행 메뉴 — 카테고리 변경 sub-popover (datalist suggestion + 직접 입력)
  const [rowCategoryEditId, setRowCategoryEditId] = useState<number | null>(null);
  const [rowCategoryDraft, setRowCategoryDraft] = useState("");
  // 카테고리 헤더 액션 메뉴 열림 키 (한 번에 하나만)
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  // 인라인 이름 변경: 활성 카테고리 키 + 입력값
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  // 병합 모드: 활성 카테고리 키 (선택지로 다른 카테고리 노출)
  const [mergingKey, setMergingKey] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingKey && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingKey]);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!openMenuKey) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-category-menu]")) return;
      setOpenMenuKey(null);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [openMenuKey]);

  // 행 컨텍스트 메뉴 외부 클릭/Esc 닫기 (카테고리 sub-popover 포함)
  useEffect(() => {
    if (!rowMenu && !rowCategoryEditId) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-row-menu]")) return;
      setRowMenu(null);
      setRowCategoryEditId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setRowMenu(null);
        setRowCategoryEditId(null);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [rowMenu, rowCategoryEditId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (statusFilter !== "all") {
        if (statusFilter === "processing" && !(d.status === "processing" || d.status === "pending")) return false;
        if (statusFilter === "done" && d.status !== "done") return false;
        if (statusFilter === "failed" && d.status !== "failed") return false;
      }
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        (d.category || "").toLowerCase().includes(q) ||
        d.subject.toLowerCase().includes(q) ||
        d.grade_level.toLowerCase().includes(q)
      );
    });
  }, [documents, search, statusFilter]);

  // 카테고리(학교) > intent(시험지/참고자료) 2단 그룹.
  // 카테고리 정렬: 미분류 마지막, 나머지는 가나다순.
  const grouped = useMemo(() => {
    const map = new Map<string, { test: MatchupDocument[]; reference: MatchupDocument[] }>();
    for (const d of filtered) {
      const key = categoryKeyOf(d);
      if (!map.has(key)) map.set(key, { test: [], reference: [] });
      const intent = getDocumentIntent(d);
      map.get(key)![intent === "test" ? "test" : "reference"].push(d);
    }
    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a === UNCATEGORIZED_KEY) return 1;
      if (b === UNCATEGORIZED_KEY) return -1;
      return a.localeCompare(b, "ko");
    });
    return keys.map((key) => ({
      key,
      label: categoryLabelOf(key),
      tests: map.get(key)!.test,
      references: map.get(key)!.reference,
    }));
  }, [filtered]);

  const counts = useMemo(() => ({
    all: documents.length,
    processing: documents.filter((d) => d.status === "processing" || d.status === "pending").length,
    done: documents.filter((d) => d.status === "done").length,
    failed: documents.filter((d) => d.status === "failed").length,
    // intent별 글로벌 합계 — 카테고리 내부 헤더 "시험지 · N"이 카테고리별 카운트라
    // 사용자가 전체 시험지 수로 오인하던 정합성 결함 보완.
    test: documents.filter((d) => getDocumentIntent(d) === "test").length,
    reference: documents.filter((d) => getDocumentIntent(d) === "reference").length,
  }), [documents]);

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const ok = await confirm({
      title: "문서 삭제",
      message: "이 문서와 추출된 문제가 모두 삭제됩니다.",
      confirmText: "삭제",
      danger: true,
    });
    if (ok) onDelete(id);
  };

  const handleRetry = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    onRetry(id);
  };

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? "color-mix(in srgb, var(--color-brand-primary) 12%, transparent)" : "transparent",
    border: "1px solid",
    borderColor: active ? "var(--color-brand-primary)" : "var(--color-border-divider)",
    color: active ? "var(--color-brand-primary)" : "var(--color-text-secondary)",
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: 4,
    cursor: "pointer",
  });

  const renderDocRow = (doc: MatchupDocument) => {
    const segMethod = doc.meta?.segmentation_method;
    const segInfo = segMethod ? SEG_META[segMethod] : null;
    const progress = progressMap[doc.id];
    const isSelected = selectedId === doc.id;
    const intent = getDocumentIntent(doc);
    const isRenamingThis = renamingDocId === doc.id;

    const openRowMenuAt = (clientX: number, clientY: number) => {
      // viewport 우측/하단 끝 잘림 방지 — 메뉴 폭/높이 추정으로 클램프.
      const MENU_W = 200;
      const MENU_H = 220;
      const x = Math.min(clientX, window.innerWidth - MENU_W - 8);
      const y = Math.min(clientY, window.innerHeight - MENU_H - 8);
      setRowMenu({ id: doc.id, x, y });
    };

    return (
      <div
        key={doc.id}
        data-testid="matchup-doc-row"
        data-doc-id={doc.id}
        data-doc-status={doc.status}
        data-doc-intent={intent}
        onClick={() => { if (!isRenamingThis) onSelect(doc.id); }}
        onContextMenu={(e) => {
          // 일반 PC 사용자가 우클릭 시도 시 빈 OS 메뉴 대신 커스텀 메뉴 표시.
          // 단, 사용자가 텍스트를 선택했거나 input/textarea 등 인터랙션 영역에서
          // 우클릭하면 OS 메뉴(복사/붙여넣기 등) 통과 — 텍스트 복사 사용성 보존.
          const sel = window.getSelection?.();
          const hasTextSelection = sel && !sel.isCollapsed && sel.toString().length > 0;
          const target = e.target as HTMLElement | null;
          const isEditableTarget = !!target?.closest("input, textarea, [contenteditable='true']");
          if (hasTextSelection || isEditableTarget) return;  // OS 우클릭 메뉴 통과
          e.preventDefault();
          e.stopPropagation();
          onSelect(doc.id);
          openRowMenuAt(e.clientX, e.clientY);
        }}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "var(--space-2)",
          padding: "var(--space-2) var(--space-3)",
          cursor: "pointer",
          borderRadius: "var(--radius-md)",
          margin: "0 var(--space-2) 2px var(--space-3)",
          background: isSelected
            ? "color-mix(in srgb, var(--color-brand-primary) 8%, var(--color-bg-surface))"
            : doc.status === "failed"
              ? "color-mix(in srgb, var(--color-danger) 4%, transparent)"
              : intent === "test"
                ? "color-mix(in srgb, var(--color-warning) 5%, transparent)"
                : undefined,
          borderLeft: isSelected
            ? "3px solid var(--color-brand-primary)"
            : doc.status === "failed"
              ? "3px solid color-mix(in srgb, var(--color-danger) 40%, transparent)"
              : intent === "test"
                ? "3px solid color-mix(in srgb, var(--color-warning) 35%, transparent)"
                : "3px solid transparent",
          transition: "background 0.15s, border-color 0.15s",
        }}
      >
        <FileText size={14} style={{ color: "var(--color-text-muted)", marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {isRenamingThis ? (
            <input
              autoFocus
              value={renameDocValue}
              onChange={(e) => setRenameDocValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={async (e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  e.preventDefault();
                  const next = renameDocValue.trim();
                  if (next && next !== doc.title && onRenameDocument) {
                    await onRenameDocument(doc.id, next);
                  }
                  setRenamingDocId(null);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setRenamingDocId(null);
                }
              }}
              onBlur={() => setRenamingDocId(null)}
              style={{
                width: "100%",
                fontSize: 12.5, fontWeight: 600,
                padding: "2px 6px",
                border: "1px solid var(--color-brand-primary)",
                borderRadius: 4,
                background: "var(--color-bg-surface)",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
            />
          ) : (
            <div
              title={doc.title}
              style={{
                fontSize: 12.5, fontWeight: 600, color: "var(--color-text-primary)",
                overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                lineHeight: 1.35,
              }}
            >
              {doc.title}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", marginTop: 2, flexWrap: "wrap" }}>
            {STATUS_ICON[doc.status]}
            <span
              style={{
                fontSize: 11,
                color: doc.status === "failed" ? "var(--color-danger)" : "var(--color-text-muted)",
                fontWeight: doc.status === "failed" ? 600 : 400,
              }}
              title={doc.status === "failed" ? doc.error_message || "처리 실패" : undefined}
            >
              {doc.status === "done"
                ? `${doc.problem_count}문제`
                : doc.status === "processing" && progress && progress.percent > 0
                  ? `${progress.stepName} ${Math.round(progress.percent)}%`
                  : STATUS_LABEL[doc.status]}
            </span>

            {doc.status === "done" && segInfo && (
              <span
                title={segInfo.tip}
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: `color-mix(in srgb, ${segInfo.color} 12%, transparent)`,
                  color: segInfo.color,
                  fontWeight: 600,
                }}
              >
                {segInfo.label}
              </span>
            )}

            {doc.subject && (
              <span
                title="과목"
                style={{
                  fontSize: 10, padding: "1px 6px", borderRadius: 4,
                  background: "var(--color-bg-surface-soft)",
                  color: "var(--color-text-secondary)",
                  border: "1px solid var(--color-border-divider)",
                }}
              >
                {doc.subject}
              </span>
            )}
          </div>

          {doc.status === "processing" && progress && (
            <div
              style={{
                marginTop: 6,
                height: 3,
                borderRadius: 2,
                background: "var(--color-bg-surface-soft)",
                overflow: "hidden",
              }}
            >
              <div
                data-testid="matchup-progress-bar"
                style={{
                  width: `${Math.min(100, Math.max(0, progress.percent))}%`,
                  height: "100%",
                  background: "var(--color-brand-primary)",
                  transition: "width 0.3s",
                }}
              />
            </div>
          )}
        </div>

        <div
          className="matchup-row-actions"
          style={{ display: "flex", gap: 2, flexShrink: 0, marginTop: 2 }}
        >
          {doc.status === "failed" && (
            <button
              onClick={(e) => handleRetry(e, doc.id)}
              title="재시도"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-danger)", padding: 2 }}
            >
              <RefreshCw size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              onSelect(doc.id);
              // 버튼 우측 정렬 + 살짝 아래로
              const MENU_W = 200;
              const x = Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8);
              const y = Math.min(r.bottom + 4, window.innerHeight - 220 - 8);
              setRowMenu({ id: doc.id, x: Math.max(8, x), y });
            }}
            title="더보기"
            data-testid="matchup-doc-row-more"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--color-text-muted)", padding: 2,
            }}
          >
            <MoreVertical size={13} />
          </button>
          {/* 휴지통은 hover로만 노출 — 마우스 이동 중 오클릭 위험 완화. */}
          <button
            className="matchup-row-trash"
            onClick={(e) => handleDelete(e, doc.id)}
            title="삭제"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--color-text-muted)", padding: 2,
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    );
  };

  const rowMenuDoc = rowMenu ? documents.find((d) => d.id === rowMenu.id) ?? null : null;
  const rowCategoryDoc = rowCategoryEditId ? documents.find((d) => d.id === rowCategoryEditId) ?? null : null;
  // 자주 쓰는 카테고리 — 빈도순 상위 6개
  const categorySuggestions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of documents) {
      const c = (d.category || "").trim();
      if (!c) continue;
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k]) => k);
  }, [documents]);

  return (
    <>
      {/* 행 hover 시 휴지통/더보기 노출 + 150ms 딜레이로 오클릭 완화.
          touch 디바이스(@media hover:none)는 hover가 없으므로 항상 노출. */}
      <style>{`
        @media (hover: hover) {
          [data-testid='matchup-doc-row'] .matchup-row-trash,
          [data-testid='matchup-doc-row'] [data-testid='matchup-doc-row-more'] {
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.15s ease 0.15s;
          }
          [data-testid='matchup-doc-row']:hover .matchup-row-trash,
          [data-testid='matchup-doc-row']:hover [data-testid='matchup-doc-row-more'],
          [data-testid='matchup-doc-row']:focus-within .matchup-row-trash,
          [data-testid='matchup-doc-row']:focus-within [data-testid='matchup-doc-row-more'] {
            opacity: 1;
            pointer-events: auto;
          }
        }
        @media (hover: none) {
          [data-testid='matchup-doc-row'] .matchup-row-trash,
          [data-testid='matchup-doc-row'] [data-testid='matchup-doc-row-more'] {
            opacity: 1;
            pointer-events: auto;
          }
        }
      `}</style>
      <div className={css.treeNavHeader}>
        <span className={css.treeNavTitle}>매치업 풀</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Button
            intent="ghost"
            size="sm"
            onClick={() => onUpload("reference")}
            data-testid="matchup-reference-upload-button"
            leftIcon={<BookOpen size={14} />}
            title="교재·기출 등 참고 자료 업로드"
          >
            자료
          </Button>
          <Button
            intent="ghost"
            size="sm"
            onClick={() => onUpload("test")}
            data-testid="matchup-upload-button"
            leftIcon={<ClipboardList size={14} />}
            title="학생 시험지 업로드"
          >
            시험지
          </Button>
        </div>
      </div>

      {/* 검색 + 필터 */}
      {documents.length > 0 && (
        <div style={{
          padding: "var(--space-2) var(--space-3)",
          borderBottom: "1px solid var(--color-border-divider)",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          <div style={{ position: "relative" }}>
            <Search
              size={12}
              style={{
                position: "absolute",
                left: 8, top: "50%", transform: "translateY(-50%)",
                color: "var(--color-text-muted)", pointerEvents: "none",
              }}
            />
            <input
              data-testid="matchup-doc-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="제목·카테고리·과목·학년 검색"
              style={{
                width: "100%",
                padding: "5px 26px 5px 24px",
                border: "1px solid var(--color-border-divider)",
                borderRadius: 6,
                fontSize: 12,
                background: "var(--color-bg-surface)",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--color-text-muted)", padding: 2, display: "flex",
                }}
                title="지우기"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button style={filterBtnStyle(statusFilter === "all")} onClick={() => setStatusFilter("all")}>
              전체 {counts.all}
            </button>
            <button style={filterBtnStyle(statusFilter === "processing")} onClick={() => setStatusFilter("processing")}>
              처리중 {counts.processing}
            </button>
            <button style={filterBtnStyle(statusFilter === "done")} onClick={() => setStatusFilter("done")}>
              완료 {counts.done}
            </button>
            <button
              style={{
                ...filterBtnStyle(statusFilter === "failed"),
                ...(counts.failed > 0 && statusFilter !== "failed" ? {
                  borderColor: "color-mix(in srgb, var(--color-danger) 40%, var(--color-border-divider))",
                  color: "var(--color-danger)",
                } : {}),
              }}
              onClick={() => setStatusFilter("failed")}
            >
              실패 {counts.failed}
            </button>
          </div>
          {/* intent 글로벌 합계 — 학원장이 매치업 풀 규모를 한눈에 인지 */}
          <div style={{
            display: "flex", gap: 8, alignItems: "center",
            fontSize: 11, color: "var(--color-text-muted)",
            paddingTop: 2,
          }}>
            <span title="등록된 시험지 전체 개수" style={{ color: "var(--color-warning)", fontWeight: 700 }}>
              <ClipboardList size={11} style={{ verticalAlign: "-2px", marginRight: 3 }} />
              시험지 {counts.test}
            </span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span title="등록된 참고자료 전체 개수" style={{ color: "var(--color-brand-primary)", fontWeight: 700 }}>
              <BookOpen size={11} style={{ verticalAlign: "-2px", marginRight: 3 }} />
              참고자료 {counts.reference}
            </span>
            {(search || statusFilter !== "all") && (
              <span style={{ marginLeft: "auto", opacity: 0.7 }}>
                필터 결과 {filtered.length}건
              </span>
            )}
          </div>
        </div>
      )}

      <div className={css.treeScroll}>
        {documents.length === 0 && (
          <div style={{ padding: "var(--space-6) var(--space-4)", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>
              업로드된 문서가 없습니다
            </p>
          </div>
        )}

        {documents.length > 0 && filtered.length === 0 && (
          <div style={{ padding: "var(--space-5) var(--space-4)", textAlign: "center" }}>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}>
              조건에 맞는 문서가 없습니다
            </p>
          </div>
        )}

        {grouped.map((group) => {
          const isCollapsed = !!collapsed[group.key];
          const total = group.tests.length + group.references.length;
          if (total === 0) return null;
          const isUncategorized = group.key === UNCATEGORIZED_KEY;
          const headerCategory = isUncategorized ? "" : group.key;
          const isMenuOpen = openMenuKey === group.key;
          const isRenaming = renamingKey === group.key;
          const isMerging = mergingKey === group.key;
          // 병합 후보: 자기 자신과 미분류 제외한 다른 카테고리들
          const mergeCandidates = grouped
            .map((g) => g.key)
            .filter((k) => k !== group.key && k !== UNCATEGORIZED_KEY);

          const closeMenu = () => setOpenMenuKey(null);
          const startRename = () => {
            setRenameValue(group.key);
            setRenamingKey(group.key);
            closeMenu();
          };
          const cancelRename = () => {
            setRenamingKey(null);
            setRenameValue("");
          };
          const commitRename = async () => {
            const next = renameValue.trim();
            if (!next || next === group.key) {
              cancelRename();
              return;
            }
            if (onRenameCategory) {
              await onRenameCategory(group.key, next);
            }
            cancelRename();
          };
          const startMerge = () => {
            setMergingKey(group.key);
            closeMenu();
          };
          const cancelMerge = () => setMergingKey(null);
          const commitMerge = async (target: string) => {
            if (!target || target === group.key) {
              cancelMerge();
              return;
            }
            if (onMergeCategory) {
              await onMergeCategory(group.key, target);
            }
            cancelMerge();
          };
          const confirmClear = async () => {
            closeMenu();
            const ok = await confirm({
              title: "카테고리 비우기",
              message: `"${group.label}" 카테고리의 ${total}개 문서를 미분류로 이동합니다. 문서 자체는 유지됩니다.`,
              confirmText: "비우기",
              danger: true,
            });
            if (ok && onClearCategory) await onClearCategory(group.key);
          };

          return (
            <div key={group.key} style={{ marginBottom: "var(--space-2)" }}>
              {/* 카테고리(학교) 헤더 */}
              <div
                data-testid="matchup-category-header"
                data-category={headerCategory}
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                  width: "calc(100% - var(--space-4))",
                  margin: "0 var(--space-2) var(--space-1)",
                  padding: "7px 6px 7px 8px",
                  borderRadius: "var(--radius-sm)",
                  background: isUncategorized
                    ? "var(--color-bg-surface-soft)"
                    : "color-mix(in srgb, var(--color-brand-primary) 8%, var(--color-bg-surface))",
                  border: "1px solid",
                  borderColor: isUncategorized
                    ? "var(--color-border-divider)"
                    : "color-mix(in srgb, var(--color-brand-primary) 25%, transparent)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  fontFamily: "inherit",
                }}
              >
                {/* 헤더 본문 — 클릭 시 접힘 토글. 인라인 편집/병합 중에는 토글 비활성. */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (isRenaming || isMerging) return;
                    toggleCollapse(group.key);
                  }}
                  onKeyDown={(e) => {
                    if (isRenaming || isMerging) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleCollapse(group.key);
                    }
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    cursor: isRenaming || isMerging ? "default" : "pointer",
                    textAlign: "left",
                  }}
                >
                  {isCollapsed
                    ? <ChevronRight size={13} style={{ color: "var(--color-text-secondary)", flexShrink: 0 }} />
                    : <ChevronDown size={13} style={{ color: "var(--color-text-secondary)", flexShrink: 0 }} />
                  }
                  <FolderOpen
                    size={13}
                    style={{
                      color: isUncategorized
                        ? "var(--color-text-muted)"
                        : "var(--color-brand-primary)",
                      flexShrink: 0,
                    }}
                  />

                  {isRenaming ? (
                    <input
                      ref={renameInputRef}
                      data-testid="matchup-category-rename-input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                        else if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
                      }}
                      maxLength={100}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: "2px 6px",
                        fontSize: 12,
                        fontWeight: 700,
                        border: "1px solid var(--color-brand-primary)",
                        borderRadius: 4,
                        background: "var(--color-bg-surface)",
                        color: "var(--color-text-primary)",
                        outline: "none",
                      }}
                    />
                  ) : isMerging ? (
                    <select
                      data-testid="matchup-category-merge-select"
                      defaultValue=""
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => commitMerge(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: "2px 6px",
                        fontSize: 12,
                        fontWeight: 600,
                        border: "1px solid var(--color-brand-primary)",
                        borderRadius: 4,
                        background: "var(--color-bg-surface)",
                        color: "var(--color-text-primary)",
                      }}
                    >
                      <option value="" disabled>합칠 대상 카테고리…</option>
                      {mergeCandidates.length === 0 && (
                        <option value="" disabled>(다른 카테고리 없음)</option>
                      )}
                      {mergeCandidates.map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  ) : (
                    <span style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: isUncategorized
                        ? "var(--color-text-secondary)"
                        : "var(--color-brand-primary)",
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {group.label}
                    </span>
                  )}

                  {!isRenaming && !isMerging && (
                    <span
                      title={`시험지 ${group.tests.length}건 · 참고자료 ${group.references.length}건`}
                      style={{
                        fontSize: 11,
                        color: "var(--color-text-muted)",
                        display: "inline-flex",
                        gap: 5,
                        alignItems: "center",
                        flexShrink: 0,
                        fontWeight: 700,
                      }}
                    >
                      {group.tests.length > 0 && (
                        <span style={{ color: "var(--color-warning)" }}>
                          시험지 {group.tests.length}
                        </span>
                      )}
                      {group.tests.length > 0 && group.references.length > 0 && (
                        <span style={{ color: "var(--color-border-divider)" }}>·</span>
                      )}
                      {group.references.length > 0 && (
                        <span>자료 {group.references.length}</span>
                      )}
                    </span>
                  )}
                </div>

                {/* 인라인 편집 액션 버튼 */}
                {isRenaming && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); commitRename(); }}
                      title="저장 (Enter)"
                      data-testid="matchup-category-rename-save"
                      style={{
                        background: "var(--color-brand-primary)", color: "white",
                        border: "none", borderRadius: 4,
                        padding: "3px 8px", cursor: "pointer", display: "flex", alignItems: "center",
                      }}
                    >
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); cancelRename(); }}
                      title="취소 (Esc)"
                      style={{
                        background: "var(--color-bg-surface-soft)",
                        border: "1px solid var(--color-border-divider)",
                        borderRadius: 4, color: "var(--color-text-muted)",
                        padding: "3px 8px", cursor: "pointer", display: "flex", alignItems: "center",
                      }}
                    >
                      <X size={12} />
                    </button>
                  </>
                )}
                {isMerging && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); cancelMerge(); }}
                    title="병합 취소"
                    style={{
                      background: "var(--color-bg-surface-soft)",
                      border: "1px solid var(--color-border-divider)",
                      borderRadius: 4, color: "var(--color-text-muted)",
                      padding: "3px 8px", cursor: "pointer", display: "flex", alignItems: "center",
                    }}
                  >
                    <X size={12} />
                  </button>
                )}

                {/* ⋮ 액션 메뉴 — 편집 중 아닐 때만 */}
                {!isRenaming && !isMerging && (
                  <div data-category-menu style={{ position: "relative", flexShrink: 0 }}>
                    <button
                      type="button"
                      data-testid="matchup-category-menu-trigger"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuKey(isMenuOpen ? null : group.key);
                      }}
                      title="카테고리 작업"
                      style={{
                        background: "transparent",
                        border: "1px solid transparent",
                        borderRadius: 4,
                        padding: "2px 4px",
                        cursor: "pointer",
                        color: "var(--color-text-secondary)",
                        display: "flex", alignItems: "center",
                      }}
                    >
                      <MoreVertical size={14} />
                    </button>
                    {isMenuOpen && (
                      <div
                        data-testid="matchup-category-menu"
                        role="menu"
                        style={{
                          position: "absolute",
                          right: 0,
                          top: "calc(100% + 4px)",
                          zIndex: 50,
                          minWidth: 220,
                          background: "var(--color-bg-surface)",
                          border: "1px solid var(--color-border-divider)",
                          borderRadius: "var(--radius-md)",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                          padding: 4,
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        <CategoryMenuItem
                          icon={<ClipboardList size={13} />}
                          label="이 카테고리로 시험지 업로드"
                          onClick={(e) => {
                            e.stopPropagation();
                            closeMenu();
                            onUpload("test", headerCategory);
                          }}
                        />
                        <CategoryMenuItem
                          icon={<BookOpen size={13} />}
                          label="이 카테고리로 자료 업로드"
                          onClick={(e) => {
                            e.stopPropagation();
                            closeMenu();
                            onUpload("reference", headerCategory);
                          }}
                        />
                        {onPromoteFromInventory && (
                          <CategoryMenuItem
                            icon={<Database size={13} />}
                            label="저장소에서 가져오기"
                            onClick={(e) => {
                              e.stopPropagation();
                              closeMenu();
                              onPromoteFromInventory(headerCategory);
                            }}
                          />
                        )}
                        {!isUncategorized && (
                          <>
                            <div style={{ height: 1, background: "var(--color-border-divider)", margin: "2px 0" }} />
                            {onRenameCategory && (
                              <CategoryMenuItem
                                icon={<Pencil size={13} />}
                                label="이름 변경"
                                onClick={(e) => { e.stopPropagation(); startRename(); }}
                              />
                            )}
                            {onMergeCategory && mergeCandidates.length > 0 && (
                              <CategoryMenuItem
                                icon={<FolderInput size={13} />}
                                label="다른 카테고리에 합치기"
                                onClick={(e) => { e.stopPropagation(); startMerge(); }}
                              />
                            )}
                            {onClearCategory && (
                              <CategoryMenuItem
                                icon={<Eraser size={13} />}
                                label="카테고리 비우기 (미분류로)"
                                danger
                                onClick={(e) => { e.stopPropagation(); confirmClear(); }}
                              />
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!isCollapsed && (
                <>
                  {group.tests.length > 0 && (
                    <>
                      <div style={{
                        margin: "var(--space-1) var(--space-2) 4px var(--space-3)",
                        fontSize: 10,
                        fontWeight: 800,
                        color: "var(--color-warning)",
                        letterSpacing: 0.3,
                        display: "inline-flex", alignItems: "center", gap: 4,
                      }}>
                        <ClipboardList size={10} />
                        시험지 {group.tests.length}건
                      </div>
                      {group.tests.map(renderDocRow)}
                    </>
                  )}
                  {group.references.length > 0 && (
                    <>
                      <div style={{
                        margin: "var(--space-2) var(--space-2) 4px var(--space-3)",
                        fontSize: 10,
                        fontWeight: 800,
                        color: "var(--color-brand-primary)",
                        letterSpacing: 0.3,
                        display: "inline-flex", alignItems: "center", gap: 4,
                      }}>
                        <BookOpen size={10} />
                        참고자료 {group.references.length}건
                      </div>
                      {group.references.map(renderDocRow)}
                    </>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      {/* 카테고리 변경 sub-popover — 행 메뉴에서 진입 */}
      {rowCategoryEditId && rowCategoryDoc && onChangeDocumentCategory && (
        <div
          data-row-menu
          role="dialog"
          aria-label="카테고리 변경"
          style={{
            position: "fixed",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1001,
            minWidth: 320,
            maxWidth: 420,
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-divider)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.16)",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)" }}>
            카테고리 변경
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: -6 }}>
            {rowCategoryDoc.title}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            <button
              type="button"
              onClick={async () => {
                const id = rowCategoryEditId;
                setRowCategoryEditId(null);
                setRowMenu(null);
                await onChangeDocumentCategory(id, "");
              }}
              style={{
                fontSize: 11, padding: "3px 9px", borderRadius: 4,
                background: "var(--color-bg-surface-soft)",
                color: "var(--color-text-muted)",
                border: "1px dashed var(--color-border-divider)",
                cursor: "pointer",
                fontWeight: 600,
                fontFamily: "inherit",
              }}
            >
              미분류
            </button>
            {categorySuggestions.map((c) => (
              <button
                key={c}
                type="button"
                onClick={async () => {
                  const id = rowCategoryEditId;
                  setRowCategoryEditId(null);
                  setRowMenu(null);
                  await onChangeDocumentCategory(id, c);
                }}
                disabled={c === (rowCategoryDoc.category || "").trim()}
                style={{
                  fontSize: 11, padding: "3px 9px", borderRadius: 4,
                  background: c === (rowCategoryDoc.category || "").trim()
                    ? "color-mix(in srgb, var(--color-brand-primary) 18%, transparent)"
                    : "color-mix(in srgb, var(--color-brand-primary) 8%, transparent)",
                  color: "var(--color-brand-primary)",
                  border: "1px solid color-mix(in srgb, var(--color-brand-primary) 35%, transparent)",
                  cursor: c === (rowCategoryDoc.category || "").trim() ? "default" : "pointer",
                  fontWeight: 600,
                  fontFamily: "inherit",
                  opacity: c === (rowCategoryDoc.category || "").trim() ? 0.7 : 1,
                }}
              >
                {c} {c === (rowCategoryDoc.category || "").trim() && "✓"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              autoFocus
              value={rowCategoryDraft}
              onChange={(e) => setRowCategoryDraft(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const id = rowCategoryEditId;
                  const next = rowCategoryDraft.trim();
                  setRowCategoryEditId(null);
                  setRowMenu(null);
                  await onChangeDocumentCategory(id, next);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setRowCategoryEditId(null);
                }
              }}
              placeholder="새 카테고리 입력 후 Enter"
              style={{
                flex: 1,
                fontSize: 12, padding: "5px 10px",
                border: "1px solid var(--color-border-divider)",
                borderRadius: 4,
                background: "var(--color-bg-surface)",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={() => setRowCategoryEditId(null)}
              style={{
                fontSize: 11, padding: "5px 10px", borderRadius: 4,
                background: "transparent",
                color: "var(--color-text-muted)",
                border: "1px solid var(--color-border-divider)",
                cursor: "pointer",
                fontWeight: 600,
                fontFamily: "inherit",
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}
      {/* 행 컨텍스트 메뉴 popover — 우클릭 또는 ··· 클릭으로 열림 */}
      {rowMenu && rowMenuDoc && (
        <div
          data-row-menu
          role="menu"
          style={{
            position: "fixed",
            top: rowMenu.y,
            left: rowMenu.x,
            zIndex: 1000,
            minWidth: 200,
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-divider)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: 4,
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          <div style={{
            padding: "6px 10px 4px",
            fontSize: 10,
            color: "var(--color-text-muted)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.4,
            borderBottom: "1px solid var(--color-border-divider)",
            marginBottom: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {rowMenuDoc.title}
          </div>
          {onRenameDocument && (
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setRenameDocValue(rowMenuDoc.title);
                setRenamingDocId(rowMenuDoc.id);
                setRowMenu(null);
              }}
              style={menuItemStyle()}
            >
              <Pencil size={13} />
              <span>이름 변경</span>
            </button>
          )}
          {onChangeIntent && (
            <button
              type="button"
              role="menuitem"
              onClick={async (e) => {
                e.stopPropagation();
                const next = getDocumentIntent(rowMenuDoc) === "test" ? "reference" : "test";
                setRowMenu(null);
                await onChangeIntent(rowMenuDoc.id, next);
              }}
              style={menuItemStyle()}
            >
              <FileText size={13} />
              <span>{getDocumentIntent(rowMenuDoc) === "test" ? "참고자료로 변경" : "시험지로 변경"}</span>
            </button>
          )}
          {onChangeDocumentCategory && (
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setRowCategoryEditId(rowMenuDoc.id);
                setRowCategoryDraft(rowMenuDoc.category || "");
              }}
              style={menuItemStyle()}
            >
              <FolderInput size={13} />
              <span>카테고리 변경 — {rowMenuDoc.category || "미분류"}</span>
            </button>
          )}
          {rowMenuDoc.status === "failed" && (
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setRowMenu(null);
                onRetry(rowMenuDoc.id);
              }}
              style={menuItemStyle()}
            >
              <RefreshCw size={13} />
              <span>재시도</span>
            </button>
          )}
          <div style={{ height: 1, background: "var(--color-border-divider)", margin: "2px 0" }} />
          <button
            type="button"
            role="menuitem"
            onClick={async (e) => {
              e.stopPropagation();
              const id = rowMenuDoc.id;
              setRowMenu(null);
              const ok = await confirm({
                title: "문서 삭제",
                message: "이 문서와 추출된 문제가 모두 삭제됩니다.",
                confirmText: "삭제",
                danger: true,
              });
              if (ok) onDelete(id);
            }}
            style={menuItemStyle(true)}
          >
            <Trash2 size={13} />
            <span>삭제</span>
          </button>
        </div>
      )}
    </>
  );
}

function menuItemStyle(danger = false): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "6px 10px",
    background: "transparent",
    border: "none",
    borderRadius: "var(--radius-sm)",
    textAlign: "left",
    fontSize: 12,
    fontWeight: 500,
    color: danger ? "var(--color-danger)" : "var(--color-text-primary)",
    cursor: "pointer",
    fontFamily: "inherit",
  };
}
