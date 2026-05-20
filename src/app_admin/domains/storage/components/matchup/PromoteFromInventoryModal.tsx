// PATH: src/app_admin/domains/storage/components/matchup/PromoteFromInventoryModal.tsx
// 저장소(InventoryFile) → 매치업 승격 모달.
//
// 사용자 시나리오: "이미 저장소에 PDF/사진 자료가 쌓여 있다. 일부를 매치업 분석으로 보내고 싶다."
// - admin scope의 PDF/PNG/JPG 파일만 표시 (백엔드 ALLOWED_CONTENT_TYPES 일치)
// - 이미 승격된 파일은 회색 + "이미 승격됨" 라벨
// - 다중 선택 → 카테고리 입력 → 병렬 승격
// - 폴더명을 카테고리로 자동 사용 토글 (백엔드 자동 추론 흐름과 일치)

import { useEffect, useMemo, useState } from "react";
import {
  Database,
  X,
  Search,
  FileText,
  FolderOpen,
  AlertCircle,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ICON, Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { fetchInventoryList } from "../../api/storage.api";
import type { InventoryFolder } from "../../api/storage.api";
import {
  promoteInventoryToMatchup,
  type PromoteAlreadyExistsError,
} from "../../api/matchup.api";
import { asyncStatusStore } from "@/shared/ui/asyncStatus";
import "./PromoteFromInventoryModal.css";

type Props = {
  onClose: () => void;
  defaultCategory?: string;
  categorySuggestions?: string[];
};

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

// 매치업 자동 무시 폴더 (services._infer_category_from_folder와 일치)
const MATCHUP_SYS_FOLDERS = new Set([
  "매치업-업로드",
  "매치업업로드",
  "matchup-upload",
  "matchup_upload",
  "matchup",
]);

function buildFolderPath(
  folder: InventoryFolder | undefined,
  byId: Map<string, InventoryFolder>
): string[] {
  const parts: string[] = [];
  let cur = folder;
  let safety = 0;
  while (cur && safety < 32) {
    parts.unshift(cur.name);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    safety += 1;
  }
  return parts;
}

function inferCategoryFromFolder(folderPath: string[]): string {
  // services.py와 동일 규칙: 매치업 시스템 폴더와 YYYY-MM 패턴 제외, 첫 의미 폴더 사용
  for (const name of folderPath) {
    const lower = name.toLowerCase();
    if (MATCHUP_SYS_FOLDERS.has(name) || MATCHUP_SYS_FOLDERS.has(lower)) {
      continue;
    }
    if (/^\d{4}-\d{2}$/.test(name)) continue;
    return name;
  }
  return "";
}

export default function PromoteFromInventoryModal({
  onClose,
  defaultCategory = "",
  categorySuggestions = [],
}: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState(defaultCategory);
  const [useFolderAsCategory, setUseFolderAsCategory] = useState(
    !defaultCategory
  );
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["storage-inventory", "admin"],
    queryFn: () => fetchInventoryList("admin"),
  });

  const folderById = useMemo(() => {
    const m = new Map<string, InventoryFolder>();
    (data?.folders ?? []).forEach((f) => m.set(f.id, f));
    return m;
  }, [data?.folders]);

  const allFiles = useMemo(() => data?.files ?? [], [data?.files]);
  const eligibleFiles = useMemo(
    () => allFiles.filter((f) => ALLOWED_TYPES.has(f.contentType)),
    [allFiles]
  );

  const visibleFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    const enriched = eligibleFiles.map((f) => {
      const folder = f.folderId ? folderById.get(f.folderId) : undefined;
      const folderPath = buildFolderPath(folder, folderById);
      return {
        file: f,
        folderPath,
        folderLabel: folderPath.length ? folderPath.join(" / ") : "(루트)",
        inferredCategory: inferCategoryFromFolder(folderPath),
        isPromoted: !!f.matchup,
      };
    });
    const filtered = q
      ? enriched.filter(
          (row) =>
            row.file.displayName.toLowerCase().includes(q) ||
            row.folderLabel.toLowerCase().includes(q) ||
            row.inferredCategory.toLowerCase().includes(q)
        )
      : enriched;
    return filtered.sort((a, b) => {
      if (a.isPromoted !== b.isPromoted) return a.isPromoted ? 1 : -1;
      const fa = a.folderLabel.localeCompare(b.folderLabel, "ko");
      if (fa !== 0) return fa;
      return a.file.displayName.localeCompare(b.file.displayName, "ko");
    });
  }, [eligibleFiles, folderById, search]);

  const selectableFiles = visibleFiles.filter((r) => !r.isPromoted);
  const allSelected =
    selectableFiles.length > 0 &&
    selectableFiles.every((r) => selected.has(r.file.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableFiles.map((r) => r.file.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [submitting, onClose]);

  const handleSubmit = async () => {
    if (selected.size === 0 || submitting) return;
    setSubmitting(true);
    setProgress({ done: 0, total: selected.size });

    let success = 0;
    let alreadyPromoted = 0;
    const failures: { name: string; reason: string }[] = [];
    const targets = visibleFiles.filter((r) => selected.has(r.file.id));

    let done = 0;
    await Promise.all(
      targets.map(async (row) => {
        const desiredCategory =
          useFolderAsCategory && row.inferredCategory
            ? row.inferredCategory
            : category;
        try {
          const doc = await promoteInventoryToMatchup({
            inventoryFileId: row.file.id,
            title: row.file.displayName,
            category: desiredCategory,
          });
          success += 1;
          if (doc.ai_job_id) {
            asyncStatusStore.addWorkerJob(
              `매치업 분석: ${doc.title}`,
              doc.ai_job_id,
              "matchup_analysis"
            );
          } else if (doc.id) {
            asyncStatusStore.addWorkerJob(
              `매치업 분석 준비 중: ${doc.title}`,
              `matchup-doc-${doc.id}`,
              "matchup_document_watch"
            );
          }
        } catch (e) {
          if (
            e &&
            typeof e === "object" &&
            (e as PromoteAlreadyExistsError).code === "already_promoted"
          ) {
            alreadyPromoted += 1;
          } else {
            const msg = e instanceof Error ? e.message : "가져오기 실패";
            failures.push({ name: row.file.displayName, reason: msg });
          }
        }
        done += 1;
        setProgress({ done, total: selected.size });
      })
    );

    setSubmitting(false);
    setProgress(null);

    qc.invalidateQueries({ queryKey: ["matchup-documents"] });
    qc.invalidateQueries({ queryKey: ["storage-inventory", "admin"] });

    if (success > 0) {
      const parts = [`${success}개 매치업으로 가져오기 완료`];
      if (alreadyPromoted > 0) parts.push(`${alreadyPromoted}개는 이미 등록됨`);
      if (failures.length > 0) parts.push(`${failures.length}개 실패`);
      feedback.success(parts.join(" · "));
    } else if (alreadyPromoted > 0 && failures.length === 0) {
      feedback.info(
        `선택한 ${alreadyPromoted}개 모두 이미 매치업에 등록된 파일입니다.`
      );
    } else if (failures.length > 0) {
      feedback.error(`가져오기 실패: ${failures[0].reason}`);
    }

    if (failures.length === 0) onClose();
  };

  return (
    <div
      className="matchup-promote-overlay"
      onClick={submitting ? undefined : onClose}
    >
      <div
        data-testid="matchup-promote-modal"
        className="matchup-promote-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="matchup-promote-header">
          <div className="matchup-promote-header-row">
            <h3 className="matchup-promote-title">
              <Database size={ICON.md} className="matchup-promote-brand-icon" />
              저장소에서 매치업으로 가져오기
            </h3>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              title={submitting ? "처리 중..." : "닫기"}
              className="matchup-promote-close"
            >
              <X size={ICON.md} />
            </button>
          </div>
          <p className="matchup-promote-description">
            선생님 저장소(admin)에 있는 PDF·이미지를 매치업 분석 대상으로 가져옵니다.
            폴더명을 카테고리로 자동 사용하면 학교/세트별 정리가 그대로 유지됩니다.
          </p>
        </div>

        <div className="matchup-promote-body">
          <div className="matchup-promote-search">
            <Search size={ICON.sm} className="matchup-promote-search-icon" />
            <input
              data-testid="matchup-promote-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="파일명·폴더 검색"
              className="matchup-promote-search-input"
            />
          </div>

          <div className="matchup-promote-summary">
            <span>
              가져올 파일 {selectableFiles.length}개 ·{" "}
              <strong className="matchup-promote-strong">
                {selected.size}개 선택
              </strong>
            </span>
            <button
              type="button"
              onClick={toggleAll}
              disabled={selectableFiles.length === 0}
              className="matchup-promote-select-all"
            >
              {allSelected ? "전체 해제" : "전체 선택"}
            </button>
          </div>

          {!isLoading &&
            !error &&
            eligibleFiles.length > 0 &&
            selectableFiles.length === 0 && (
              <div
                data-testid="matchup-promote-all-promoted"
                className="matchup-promote-info"
              >
                저장소의 PDF·이미지가 모두 이미 매치업에 등록되어 있습니다.
                새 자료를 가져오려면 먼저 저장소에 파일을 업로드하세요.
              </div>
            )}

          <div className="matchup-promote-list">
            {isLoading && (
              <div className="matchup-promote-empty">
                저장소 목록을 불러오는 중...
              </div>
            )}
            {!isLoading && error && (
              <div className="matchup-promote-empty matchup-promote-empty--danger">
                저장소를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.
              </div>
            )}
            {!isLoading && !error && visibleFiles.length === 0 && (
              <div className="matchup-promote-empty">
                {search
                  ? "조건에 맞는 파일이 없습니다."
                  : "저장소에 PDF·이미지 파일이 없습니다. 먼저 저장소에 업로드하세요."}
              </div>
            )}
            {!isLoading &&
              !error &&
              visibleFiles.map((row) => {
                const isSelected = selected.has(row.file.id);
                return (
                  <label
                    key={row.file.id}
                    data-testid="matchup-promote-row"
                    data-file-id={row.file.id}
                    data-promoted={row.isPromoted ? "true" : "false"}
                    data-selected={isSelected ? "true" : "false"}
                    className="matchup-promote-row"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={row.isPromoted || submitting}
                      onChange={() => toggleOne(row.file.id)}
                      className="matchup-promote-checkbox"
                    />
                    <FileText size={15} className="matchup-promote-file-icon" />
                    <div className="matchup-promote-file-body">
                      <div
                        title={row.file.displayName}
                        className="matchup-promote-file-name"
                      >
                        {row.file.displayName}
                      </div>
                      <div className="matchup-promote-file-meta">
                        <FolderOpen
                          size={ICON.xs}
                          className="matchup-promote-meta-icon"
                        />
                        <span className="matchup-promote-folder-label">
                          {row.folderLabel}
                        </span>
                        <span>·</span>
                        <span>
                          {(row.file.sizeBytes / 1024 / 1024).toFixed(1)}MB
                        </span>
                        {row.inferredCategory && (
                          <>
                            <span>·</span>
                            <span className="matchup-promote-category">
                              추정 카테고리: {row.inferredCategory}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {row.isPromoted && (
                      <span className="matchup-promote-promoted">
                        이미 등록됨
                      </span>
                    )}
                  </label>
                );
              })}
          </div>

          <div className="matchup-promote-policy">
            <label className="matchup-promote-folder-toggle">
              <input
                type="checkbox"
                checked={useFolderAsCategory}
                onChange={(e) => setUseFolderAsCategory(e.target.checked)}
                disabled={submitting}
                data-testid="matchup-promote-use-folder"
              />
              <span className="matchup-promote-policy-title">
                폴더명을 카테고리로 자동 사용
              </span>
              <span className="matchup-promote-policy-note">
                (각 파일의 상위 폴더명. 매치업·YYYY-MM 폴더는 자동 제외)
              </span>
            </label>
            <label
              className="matchup-promote-category-label"
              data-muted={useFolderAsCategory ? "true" : "false"}
            >
              {useFolderAsCategory
                ? "수동 카테고리 (폴더명 추정 실패 시 fallback)"
                : "선택한 모든 파일에 적용할 카테고리"}
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="예: 중대부고"
                list="matchup-promote-category-suggestions"
                disabled={submitting}
                data-testid="matchup-promote-category-input"
                className="matchup-promote-category-input"
              />
              <datalist id="matchup-promote-category-suggestions">
                {categorySuggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
          </div>

          {selected.size > 0 && !useFolderAsCategory && !category.trim() && (
            <div className="matchup-promote-warning">
              <AlertCircle size={ICON.xs} />
              카테고리 없이 진행하면 모두 미분류로 들어갑니다.
            </div>
          )}
        </div>

        <div className="matchup-promote-footer">
          {progress && (
            <span className="matchup-promote-progress">
              가져오는 중... {progress.done}/{progress.total}
            </span>
          )}
          <Button intent="ghost" size="sm" onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={selected.size === 0 || submitting}
            data-testid="matchup-promote-submit"
          >
            {submitting
              ? `가져오는 중... ${progress?.done ?? 0}/${progress?.total ?? selected.size}`
              : `${selected.size}개 매치업으로 가져오기`}
          </Button>
        </div>
      </div>
    </div>
  );
}
