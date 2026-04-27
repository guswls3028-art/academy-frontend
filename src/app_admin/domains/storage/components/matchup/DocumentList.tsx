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
  progressMap = {},
}: Props) {
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
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

    return (
      <div
        key={doc.id}
        data-testid="matchup-doc-row"
        data-doc-id={doc.id}
        onClick={() => onSelect(doc.id)}
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
          <div
            title={doc.title}
            style={{
              fontSize: 12.5, fontWeight: 600, color: "var(--color-text-primary)",
              overflow: "hidden", textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              wordBreak: "break-all",
              lineHeight: 1.3,
            }}
          >
            {doc.title}
          </div>

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

        <div style={{ display: "flex", gap: 2, flexShrink: 0, marginTop: 2 }}>
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
            onClick={(e) => handleDelete(e, doc.id)}
            title="삭제"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 2 }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
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
                      title={`시험지 ${group.tests.length} · 자료 ${group.references.length}`}
                      style={{
                        fontSize: 10,
                        color: "var(--color-text-muted)",
                        display: "inline-flex",
                        gap: 3,
                        alignItems: "center",
                        flexShrink: 0,
                        fontWeight: 700,
                      }}
                    >
                      {group.tests.length > 0 && (
                        <span style={{ color: "var(--color-warning)" }}>
                          시{group.tests.length}
                        </span>
                      )}
                      {group.tests.length > 0 && group.references.length > 0 && (
                        <span style={{ color: "var(--color-border-divider)" }}>·</span>
                      )}
                      {group.references.length > 0 && (
                        <span>자{group.references.length}</span>
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
                        margin: "var(--space-1) var(--space-2) 2px var(--space-3)",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--color-warning)",
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                      }}>
                        시험지 · {group.tests.length}
                      </div>
                      {group.tests.map(renderDocRow)}
                    </>
                  )}
                  {group.references.length > 0 && (
                    <>
                      <div style={{
                        margin: "var(--space-2) var(--space-2) 2px var(--space-3)",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--color-brand-primary)",
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                      }}>
                        참고 자료 · {group.references.length}
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
    </>
  );
}
