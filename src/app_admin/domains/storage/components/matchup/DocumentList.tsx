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
import { Button, ICON } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import type { MatchupDocument, SegmentationMethod } from "../../api/matchup.api";
import type { DocProgressMap } from "../../hooks/useMatchupPolling";
import { getDocumentIntent } from "./documentIntent";
import css from "@/shared/ui/domain/PanelWithTreeLayout.module.css";
import styles from "./DocumentList.module.css";

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
  pending: <Loader2 size={ICON.sm} className={`${styles.statusIcon} ${styles.statusIconMuted}`} />,
  processing: <Loader2 size={ICON.sm} className={`${styles.statusIcon} ${styles.statusIconBrand} animate-spin`} />,
  done: <CheckCircle2 size={ICON.sm} className={`${styles.statusIcon} ${styles.statusIconSuccess}`} />,
  failed: <AlertCircle size={ICON.sm} className={`${styles.statusIcon} ${styles.statusIconDanger}`} />,
} as const;

const STATUS_LABEL = {
  pending: "대기",
  processing: "처리 중",
  done: "",
  failed: "실패",
} as const;

const SEG_META: Record<SegmentationMethod, { label: string; tone: "success" | "brand" | "secondary" | "warning"; tip: string }> = {
  text: { label: "텍스트", tone: "success", tip: "PDF 텍스트 직접 추출" },
  ocr: { label: "OCR", tone: "brand", tip: "스캔본 OCR로 텍스트 추출" },
  mixed: { label: "혼합", tone: "brand", tip: "텍스트 + OCR 혼합 추출" },
  image: { label: "이미지", tone: "secondary", tip: "단일 이미지 업로드" },
  none: { label: "미검출", tone: "warning", tip: "문제 영역을 못 찾음 — 페이지 단위로 처리됨" },
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
      className={styles.categoryMenuItem}
      data-danger={danger}
    >
      <span className={styles.categoryMenuIcon}>
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

  // ⌘/Ctrl + K — 자료 100+ 환경에서 검색이 1순위 액션. 단축키로 input focus + 기존값 select.
  // input/textarea/contenteditable 안에서는 통과 (이름/카테고리 인라인 편집 중일 때 방해 금지).
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.key === "k" || e.key === "K")) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const t = e.target as HTMLElement | null;
      if (t?.matches("input, textarea, [contenteditable='true']")) return;
      e.preventDefault();
      const el = searchInputRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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
        className={styles.docRow}
        data-testid="matchup-doc-row"
        data-doc-id={doc.id}
        data-doc-status={doc.status}
        data-doc-intent={intent}
        data-selected={isSelected}
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
      >
        <FileText size={ICON.sm} className={styles.docFileIcon} />
        <div className={styles.docBody}>
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
              className={styles.docRenameInput}
            />
          ) : (
            <div
              className={styles.docTitle}
              data-selected={isSelected}
              title={doc.title}
            >
              {doc.title}
            </div>
          )}

          <div className={styles.docMetaRow}>
            {STATUS_ICON[doc.status]}
            <span
              className={styles.statusText}
              data-status={doc.status}
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
                className={styles.segBadge}
                data-tone={segInfo.tone}
              >
                {segInfo.label}
              </span>
            )}

            {doc.subject && (
              <span
                title="과목"
                className={styles.subjectBadge}
              >
                {doc.subject}
              </span>
            )}
          </div>

          {doc.status === "processing" && progress && (
            <progress
              className={styles.progressBar}
              data-testid="matchup-progress-bar"
              max={100}
              value={Math.min(100, Math.max(0, progress.percent))}
              title={`${progress.stepName} ${Math.round(progress.percent)}% — 자세한 단계는 우측 패널에서 확인할 수 있어요`}
            />
          )}
        </div>

        <div
          className={styles.rowActions}
        >
          {doc.status === "failed" && (
            <button
              type="button"
              className={`${styles.rowIconButton} ${styles.retryButton}`}
              onClick={(e) => handleRetry(e, doc.id)}
              title="재시도"
            >
              <RefreshCw size={ICON.sm} />
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
            className={`${styles.rowIconButton} ${styles.rowMore}`}
          >
            <MoreVertical size={ICON.sm} />
          </button>
          {/* 휴지통은 hover로만 노출 — 마우스 이동 중 오클릭 위험 완화. */}
          <button
            type="button"
            className={`${styles.rowIconButton} ${styles.rowTrash}`}
            onClick={(e) => handleDelete(e, doc.id)}
            title="삭제"
          >
            <Trash2 size={ICON.sm} />
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
      <div className={css.treeNavHeader}>
        <span className={css.treeNavTitle}>전체 자료</span>
        <div className={styles.headerActions}>
          <Button
            intent="ghost"
            size="sm"
            onClick={() => onUpload("reference")}
            data-testid="matchup-reference-upload-button"
            leftIcon={<BookOpen size={ICON.sm} />}
            title="교재·기출 등 참고 자료 업로드"
          >
            자료
          </Button>
          <Button
            intent="ghost"
            size="sm"
            onClick={() => onUpload("test")}
            data-testid="matchup-upload-button"
            leftIcon={<ClipboardList size={ICON.sm} />}
            title="학생 시험지 업로드"
          >
            시험지
          </Button>
        </div>
      </div>

      {/* 검색 + 필터 */}
      {documents.length > 0 && (
        <div className={styles.filterPanel}>
          <div className={styles.searchBox}>
            <Search
              size={ICON.xs}
              className={styles.searchIcon}
            />
            <input
              ref={searchInputRef}
              data-testid="matchup-doc-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="제목·카테고리·과목·학년 검색  (⌘K)"
              title="⌘/Ctrl + K 로 빠르게 검색창 포커스"
              className={styles.searchInput}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className={styles.searchClear}
                title="지우기"
              >
                <X size={ICON.xs} />
              </button>
            )}
          </div>
          <div className={styles.filterRow}>
            <button
              type="button"
              className={styles.filterButton}
              data-active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
            >
              전체 {counts.all}
            </button>
            <button
              type="button"
              className={styles.filterButton}
              data-active={statusFilter === "processing"}
              data-dimmed={counts.processing === 0 && statusFilter !== "processing"}
              onClick={() => setStatusFilter("processing")}
              title={counts.processing === 0 ? "처리 중인 문서가 없습니다" : undefined}
            >
              처리중 {counts.processing}
            </button>
            <button
              type="button"
              className={styles.filterButton}
              data-active={statusFilter === "done"}
              onClick={() => setStatusFilter("done")}
            >
              완료 {counts.done}
            </button>
            <button
              type="button"
              className={styles.filterButton}
              data-active={statusFilter === "failed"}
              data-alert={counts.failed > 0 && statusFilter !== "failed"}
              data-dimmed={counts.failed === 0 && statusFilter !== "failed"}
              onClick={() => setStatusFilter("failed")}
              title={counts.failed === 0 ? "실패한 문서가 없습니다" : undefined}
            >
              실패 {counts.failed}
            </button>
            {/* intent 카운트 — 시험지/참고자료 분리 노출. 별도 행 → 같은 행으로 통합해 시각 잡음 감소.
                톤은 brand/info 계열. warning은 위험 의미라 분류 카운터엔 부적절. */}
            <span className={styles.filterSpacer} aria-hidden />
            <span className={styles.intentCounter} data-tone="brand" title="등록된 시험지 전체 개수">
              <ClipboardList size={ICON.xs} />
              시험지 {counts.test}
            </span>
            <span className={styles.counterDivider}>·</span>
            <span className={styles.intentCounter} data-tone="secondary" title="등록된 참고자료 전체 개수">
              <BookOpen size={ICON.xs} />
              참고자료 {counts.reference}
            </span>
          </div>
          {(search || statusFilter !== "all") && (
            <div className={styles.filterResult}>
              필터 결과 {filtered.length}건
            </div>
          )}
        </div>
      )}

      <div className={css.treeScroll}>
        {documents.length === 0 && (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>
              업로드된 문서가 없습니다
            </p>
          </div>
        )}

        {documents.length > 0 && filtered.length === 0 && (
          <div className={styles.filteredEmptyState}>
            <p className={styles.filteredEmptyText}>
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
            <div key={group.key} className={styles.groupBlock}>
              {/* 카테고리(학교) 헤더 */}
              <div
                data-testid="matchup-category-header"
                data-category={headerCategory}
                className={styles.categoryHeader}
                data-uncategorized={isUncategorized}
              >
                {/* 헤더 본문 — 클릭 시 접힘 토글. 인라인 편집/병합 중에는 토글 비활성. */}
                <div
                  className={styles.categoryHeaderBody}
                  data-editing={isRenaming || isMerging}
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
                >
                  {/* 행 1: chevron · folder · 제목 — 제목이 카운트 없이 전체 폭을 차지 */}
                  <div className={styles.categoryTitleRow}>
                  {isCollapsed
                    ? <ChevronRight size={ICON.sm} className={styles.categoryChevron} />
                    : <ChevronDown size={ICON.sm} className={styles.categoryChevron} />
                  }
                  <FolderOpen
                    size={ICON.sm}
                    className={styles.categoryFolderIcon}
                    data-uncategorized={isUncategorized}
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
                      className={styles.categoryEditControl}
                    />
                  ) : isMerging ? (
                    <select
                      data-testid="matchup-category-merge-select"
                      defaultValue=""
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => commitMerge(e.target.value)}
                      className={styles.categoryEditControl}
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
                    <span
                      title={group.label}
                      className={styles.categoryTitle}
                      data-uncategorized={isUncategorized}
                    >
                      {group.label}
                    </span>
                  )}
                  </div>

                  {/* 행 2: 카운트 — 제목 글자 시작 위치에 맞춰 들여쓰기. 제목이 길어도 카운트가 폭을 잡아먹지 않음. */}
                  {!isRenaming && !isMerging && (group.tests.length > 0 || group.references.length > 0) && (
                    <div
                      title={`시험지 ${group.tests.length}건 · 참고자료 ${group.references.length}건`}
                      className={styles.categoryCounts}
                    >
                      {group.tests.length > 0 && (
                        <span className={styles.categoryCountTest}>
                          시험지 {group.tests.length}
                        </span>
                      )}
                      {group.tests.length > 0 && group.references.length > 0 && (
                        <span className={styles.categoryCountDivider}>·</span>
                      )}
                      {group.references.length > 0 && (
                        <span>자료 {group.references.length}</span>
                      )}
                    </div>
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
                      className={`${styles.categoryActionButton} ${styles.categoryActionPrimary}`}
                    >
                      <Check size={ICON.xs} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); cancelRename(); }}
                      title="취소 (Esc)"
                      className={styles.categoryActionButton}
                    >
                      <X size={ICON.xs} />
                    </button>
                  </>
                )}
                {isMerging && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); cancelMerge(); }}
                    title="병합 취소"
                    className={styles.categoryActionButton}
                  >
                    <X size={ICON.xs} />
                  </button>
                )}

                {/* ⋮ 액션 메뉴 — 편집 중 아닐 때만 */}
                {!isRenaming && !isMerging && (
                  <div data-category-menu className={styles.categoryMenuShell}>
                    <button
                      type="button"
                      data-testid="matchup-category-menu-trigger"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuKey(isMenuOpen ? null : group.key);
                      }}
                      title="카테고리 작업"
                      className={styles.categoryMenuTrigger}
                    >
                      <MoreVertical size={ICON.sm} />
                    </button>
                    {isMenuOpen && (
                      <div
                        data-testid="matchup-category-menu"
                        role="menu"
                        className={styles.categoryMenu}
                      >
                        <CategoryMenuItem
                          icon={<ClipboardList size={ICON.sm} />}
                          label="이 카테고리로 시험지 업로드"
                          onClick={(e) => {
                            e.stopPropagation();
                            closeMenu();
                            onUpload("test", headerCategory);
                          }}
                        />
                        <CategoryMenuItem
                          icon={<BookOpen size={ICON.sm} />}
                          label="이 카테고리로 자료 업로드"
                          onClick={(e) => {
                            e.stopPropagation();
                            closeMenu();
                            onUpload("reference", headerCategory);
                          }}
                        />
                        {onPromoteFromInventory && (
                          <CategoryMenuItem
                            icon={<Database size={ICON.sm} />}
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
                            <div className={styles.categoryMenuDivider} />
                            {onRenameCategory && (
                              <CategoryMenuItem
                                icon={<Pencil size={ICON.sm} />}
                                label="이름 변경"
                                onClick={(e) => { e.stopPropagation(); startRename(); }}
                              />
                            )}
                            {onMergeCategory && mergeCandidates.length > 0 && (
                              <CategoryMenuItem
                                icon={<FolderInput size={ICON.sm} />}
                                label="다른 카테고리에 합치기"
                                onClick={(e) => { e.stopPropagation(); startMerge(); }}
                              />
                            )}
                            {onClearCategory && (
                              <CategoryMenuItem
                                icon={<Eraser size={ICON.sm} />}
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
                      <div className={styles.intentSectionLabel} data-intent="test">
                        <ClipboardList size={ICON.xs} />
                        시험지 {group.tests.length}건
                      </div>
                      {group.tests.map(renderDocRow)}
                    </>
                  )}
                  {group.references.length > 0 && (
                    <>
                      <div className={styles.intentSectionLabel} data-intent="reference">
                        <BookOpen size={ICON.xs} />
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
          className={styles.categoryDialog}
        >
          <div className={styles.categoryDialogTitle}>
            카테고리 변경
          </div>
          <div className={styles.categoryDialogSubtitle}>
            {rowCategoryDoc.title}
          </div>
          <div className={styles.categoryChipRow}>
            <button
              type="button"
              className={styles.categoryChip}
              data-kind="uncategorized"
              onClick={async () => {
                const id = rowCategoryEditId;
                setRowCategoryEditId(null);
                setRowMenu(null);
                await onChangeDocumentCategory(id, "");
              }}
            >
              미분류
            </button>
            {categorySuggestions.map((c) => (
              <button
                key={c}
                type="button"
                className={styles.categoryChip}
                data-selected={c === (rowCategoryDoc.category || "").trim()}
                onClick={async () => {
                  const id = rowCategoryEditId;
                  setRowCategoryEditId(null);
                  setRowMenu(null);
                  await onChangeDocumentCategory(id, c);
                }}
                disabled={c === (rowCategoryDoc.category || "").trim()}
              >
                {c} {c === (rowCategoryDoc.category || "").trim() && "✓"}
              </button>
            ))}
          </div>
          <div className={styles.categoryDraftRow}>
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
              className={styles.categoryDraftInput}
            />
            <button
              type="button"
              onClick={() => setRowCategoryEditId(null)}
              className={styles.categoryDraftCancel}
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
          className={styles.rowMenu}
          // eslint-disable-next-line no-restricted-syntax
          style={{
            top: rowMenu.y,
            left: rowMenu.x,
          }}
        >
          <div className={styles.rowMenuTitle}>
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
              className={styles.rowMenuItem}
            >
              <Pencil size={ICON.sm} />
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
              className={styles.rowMenuItem}
            >
              <FileText size={ICON.sm} />
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
              className={styles.rowMenuItem}
            >
              <FolderInput size={ICON.sm} />
              <span>카테고리 변경 — {rowMenuDoc.category || "미분류"}</span>
            </button>
          )}
          {rowMenuDoc.status === "failed" && (
            <>
              {/* P2-η (2026-05-08) — 에러 메시지 진입점. 이전엔 행 hover tooltip 만
                  있어서 모바일/태블릿에서 학원장이 원인 모르고 같은 doc 반복 재시도
                  하던 결함 차단. */}
              <button
                type="button"
                role="menuitem"
                data-testid="matchup-doc-row-show-error"
                onClick={async (e) => {
                  e.stopPropagation();
                  setRowMenu(null);
                  await confirm({
                    title: "분석 실패 원인",
                    message: rowMenuDoc.error_message || "원인을 확인할 수 없는 오류입니다. 재시도하거나 자료를 다시 업로드해 주세요.",
                    confirmText: "확인",
                    cancelText: "닫기",
                  });
                }}
                className={styles.rowMenuItem}
              >
                <AlertCircle size={ICON.sm} />
                <span>에러 상세 보기</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setRowMenu(null);
                  onRetry(rowMenuDoc.id);
                }}
                className={styles.rowMenuItem}
              >
                <RefreshCw size={ICON.sm} />
                <span>재시도</span>
              </button>
            </>
          )}
          <div className={styles.rowMenuDivider} />
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
            className={styles.rowMenuItem}
            data-danger
          >
            <Trash2 size={ICON.sm} />
            <span>삭제</span>
          </button>
        </div>
      )}
    </>
  );
}
