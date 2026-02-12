// PATH: src/features/students/pages/StudentsHomePage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

const STORAGE_KEY = "students-selected-ids";

import { useStudentsQuery } from "../hooks/useStudentsQuery";
import {
  bulkDeleteStudents,
  bulkRestoreStudents,
  bulkPermanentDeleteStudents,
} from "../api/students";
import StudentsTable from "../components/StudentsTable";
import StudentCreateModal from "../components/StudentCreateModal";
import StudentFilterModal from "../components/StudentFilterModal";

import { Button, EmptyState } from "@/shared/ui/ds";
import { DomainListToolbar } from "@/shared/ui/domain";
import { feedback } from "@/shared/ui/feedback/feedback";

export default function StudentsHomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  const isDeletedTab = location.pathname.includes("/deleted");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<any>({});
  const [showCreate, setShowCreate] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [sort, setSort] = useState("-registeredAt");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>(() => {
    try {
      const k = `${STORAGE_KEY}-${isDeletedTab ? "deleted" : "home"}`;
      const v = sessionStorage.getItem(k);
      if (v) {
        const arr = JSON.parse(v);
        return Array.isArray(arr) ? arr.filter((x) => typeof x === "number") : [];
      }
    } catch {}
    return [];
  });
  const [deleting, setDeleting] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    setSort(isDeletedTab ? "-deletedAt" : "-registeredAt");
  }, [isDeletedTab]);

  const prevTabRef = useRef(isDeletedTab);
  useEffect(() => {
    if (prevTabRef.current !== isDeletedTab) {
      prevTabRef.current = isDeletedTab;
      setSelectedIds([]);
    }
  }, [isDeletedTab]);

  useEffect(() => {
    const k = `${STORAGE_KEY}-${isDeletedTab ? "deleted" : "home"}`;
    sessionStorage.setItem(k, JSON.stringify(selectedIds));
  }, [selectedIds, isDeletedTab]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, filters, isDeletedTab]);

  const { data: queryResult, isLoading } = useStudentsQuery(
    search,
    filters,
    sort,
    page,
    isDeletedTab
  );
  const data = queryResult?.data ?? [];
  const totalCount = queryResult?.count ?? 0;
  const pageSize = queryResult?.pageSize ?? 50;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const activeFilterCount = useMemo(
    () => Object.keys(filters || {}).length,
    [filters]
  );

  const selectionBar = (
    <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-center gap-2 pl-1">
      <span
        className="text-[13px] font-semibold"
        style={{
          color: selectedIds.length > 0 ? "var(--color-primary)" : "var(--color-text-muted)",
        }}
      >
        {selectedIds.length}명 선택됨
      </span>
      <span className="text-[var(--color-border-divider)]">|</span>
      {!isDeletedTab && (
        <>
          <Button intent="secondary" size="sm" onClick={() => feedback.info("메시지 발송 기능 준비 중입니다.")}>
            메시지 발송
          </Button>
          <Button intent="secondary" size="sm" onClick={() => feedback.info("엑셀 다운로드 기능 준비 중입니다.")}>
            엑셀 다운로드
          </Button>
          <Button intent="secondary" size="sm" onClick={() => feedback.info("태그 추가 기능 준비 중입니다.")}>
            태그 추가
          </Button>
          <Button intent="secondary" size="sm" onClick={() => feedback.info("비밀번호 변경 기능 준비 중입니다.")}>
            비밀번호 변경
          </Button>
          <Button
            intent="danger"
            size="sm"
            disabled={selectedIds.length === 0 || deleting}
            onClick={async () => {
              if (selectedIds.length === 0) return;
              const selected = (data ?? []).filter((s) => selectedIds.includes(s.id));
              const parts = selected.map(
                (s) => `${s.name}(${Array.isArray(s.enrollments) ? s.enrollments.length : 0}개 강의 수강 중)`
              );
              const msg =
                parts.length > 0
                  ? `${parts.join(", ")}\n\n위 ${selectedIds.length}명을 삭제하시겠습니까? 30일간 보관 후 자동 삭제됩니다.`
                  : `선택한 ${selectedIds.length}명을 삭제하시겠습니까? 30일간 보관 후 자동 삭제됩니다.`;
              if (!window.confirm(msg)) return;
              setDeleting(true);
              try {
                const { deleted } = await bulkDeleteStudents(selectedIds);
                setSelectedIds([]);
                qc.invalidateQueries({ queryKey: ["students"] });
                feedback.success(`${deleted}명 삭제되었습니다.`);
              } catch (e: unknown) {
                feedback.error(e instanceof Error ? e.message : "삭제 중 오류가 발생했습니다.");
              } finally {
                setDeleting(false);
              }
            }}
          >
            {deleting ? "삭제 중…" : "삭제"}
          </Button>
        </>
      )}
      {isDeletedTab && (
        <>
          <Button
            intent="primary"
            size="sm"
            disabled={selectedIds.length === 0 || deleting}
            onClick={async () => {
              if (selectedIds.length === 0) return;
              if (!window.confirm(`선택한 ${selectedIds.length}명을 복원하시겠습니까?`)) return;
              setDeleting(true);
              try {
                const { restored } = await bulkRestoreStudents(selectedIds);
                setSelectedIds([]);
                qc.invalidateQueries({ queryKey: ["students"] });
                feedback.success(`${restored}명 복원되었습니다.`);
              } catch (e: unknown) {
                feedback.error(e instanceof Error ? e.message : "복원 중 오류가 발생했습니다.");
              } finally {
                setDeleting(false);
              }
            }}
          >
            {deleting ? "복원 중…" : "복원"}
          </Button>
          <Button
            intent="danger"
            size="sm"
            disabled={selectedIds.length === 0 || deleting}
            onClick={async () => {
              if (selectedIds.length === 0) return;
              if (!window.confirm(`선택한 ${selectedIds.length}명을 즉시 영구 삭제하시겠습니까? 복구할 수 없습니다.`)) return;
              setDeleting(true);
              try {
                const { deleted } = await bulkPermanentDeleteStudents(selectedIds);
                setSelectedIds([]);
                qc.invalidateQueries({ queryKey: ["students"] });
                feedback.success(`${deleted}명 영구 삭제되었습니다.`);
              } catch (e: unknown) {
                feedback.error(e instanceof Error ? e.message : "삭제 중 오류가 발생했습니다.");
              } finally {
                setDeleting(false);
              }
            }}
          >
            {deleting ? "삭제 중…" : "즉시 삭제"}
          </Button>
        </>
      )}
    </div>

    {totalPages > 1 && (
      <div className="flex flex-wrap items-center gap-1 pl-1">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPage(p)}
            style={{
              minWidth: 32,
              height: 32,
              padding: "0 8px",
              fontSize: 13,
              fontWeight: page === p ? 700 : 500,
              borderRadius: 6,
              border: page === p ? "2px solid var(--color-primary)" : "1px solid var(--color-border-divider)",
              background: page === p ? "var(--state-selected-bg)" : "var(--color-bg-surface)",
              color: page === p ? "var(--color-primary)" : "var(--color-text-secondary)",
              cursor: "pointer",
            }}
          >
            {p}
          </button>
        ))}
      </div>
    )}
    </div>
  );

  return (
    <>
      <div className="flex flex-col gap-4">
        <DomainListToolbar
          totalLabel={isLoading ? "…" : `총 ${totalCount}명${isDeletedTab ? " (30일 후 자동 삭제)" : ""}`}
          searchSlot={
            <input
              className="ds-input"
              placeholder="이름 / 아이디 / 전화번호 / 학교 검색"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ maxWidth: 360 }}
            />
          }
          filterSlot={
            <Button intent="secondary" onClick={() => setShowFilter(true)}>
              고급 필터{activeFilterCount ? ` (${activeFilterCount})` : ""}
            </Button>
          }
          primaryAction={
            !isDeletedTab ? (
              <Button intent="primary" onClick={() => setShowCreate(true)}>
                학생 추가
              </Button>
            ) : null
          }
          belowSlot={selectionBar}
        />

        {/* 엑셀 업로드 진행바 (모달 닫고 진행 중일 때) */}
        {bulkUploadProgress && !showCreate && (
          <div
            style={{
              marginBottom: 12,
              padding: "12px 16px",
              background: "color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-surface))",
              border: "1px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-border-divider))",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  height: 8,
                  background: "var(--color-bg-surface-soft)",
                  borderRadius: 4,
                  overflow: "hidden",
                  marginBottom: 4,
                }}
              >
                <div
                  style={{
                    width: `${(bulkUploadProgress.current / bulkUploadProgress.total) * 100}%`,
                    height: "100%",
                    background: "var(--color-primary)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>
                학생 등록 중… {Math.round((bulkUploadProgress.current / bulkUploadProgress.total) * 100)}%
                ({bulkUploadProgress.current}/{bulkUploadProgress.total}명)
              </span>
            </div>
          </div>
        )}

        {/* 테이블 */}
        <div>
          {isLoading ? (
            <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
          ) : data?.length ? (
            <StudentsTable
              data={data}
              search={search}
              sort={sort}
              onSortChange={setSort}
              onRowClick={(id) => !isDeletedTab && navigate(`/admin/students/${id}`)}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              isDeletedTab={isDeletedTab}
            />
          ) : (
            <EmptyState
              scope="panel"
              tone="empty"
              title={isDeletedTab ? "삭제된 학생이 없습니다" : "학생이 없습니다"}
              description={
                isDeletedTab
                  ? "삭제한 학생은 30일간 여기에 보관됩니다."
                  : "학생을 등록하면 목록/검색/이력 관리가 가능합니다."
              }
              actions={
                !isDeletedTab ? (
                  <Button intent="primary" onClick={() => setShowCreate(true)}>
                    학생 추가
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>
      </div>

      {/* MODALS */}
      <StudentCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => {
          setShowCreate(false);
          setBulkUploadProgress(null);
          qc.invalidateQueries({ queryKey: ["students"] });
        }}
        onBulkProgress={setBulkUploadProgress}
      />

      <StudentFilterModal
        open={showFilter}
        filters={filters}
        onClose={() => setShowFilter(false)}
        onApply={(next) => {
          setFilters(next);
          setShowFilter(false);
        }}
      />
    </>
  );
}
