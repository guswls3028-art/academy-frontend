// PATH: src/app_admin/domains/students/pages/StudentsHomePage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "@/shared/ui/confirm";

import { useStudentsQuery } from "../hooks/useStudentsQuery";
import {
  bulkDeleteStudents,
  bulkRestoreStudents,
  bulkPermanentDeleteStudents,
  checkDeletedStudentDuplicates,
  fixDeletedStudentDuplicates,
  toggleStudentActive,
  type ClientStudent,
  type StudentFilters,
} from "../api/students.api";
import { downloadStudentsExcel, type StudentExportRow } from "../excel/studentExcel";
import StudentsTable, { getStudentsTableColumnsDef } from "../components/StudentsTable";
import StudentCreateModal from "../components/StudentCreateModal";
import StudentFilterModal from "../components/StudentFilterModal";
import TagAddModal from "../components/TagAddModal";
import PasswordResetModal, { type PwResetTarget } from "../components/PasswordResetModal";

import { Button, EmptyState } from "@/shared/ui/ds";
import { DomainListToolbar, useTableColumnPrefs, TableColumnPicker } from "@/shared/ui/domain";
import { feedback } from "@/shared/ui/feedback/feedback";
import NotificationPreviewModal from "@/shared/ui/notifications/NotificationPreviewModal";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import styles from "./StudentsHomePage.module.css";

const EMPTY_STUDENTS: ClientStudent[] = [];

export default function StudentsHomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const isMobile = useIsMobile();

  const isDeletedTab = location.pathname.includes("/deleted");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<StudentFilters>({});
  const [showCreate, setShowCreate] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [sort, setSort] = useState("-registeredAt");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [withdrawalNotif, setWithdrawalNotif] = useState<{ open: boolean; ids: number[] }>({ open: false, ids: [] });
  const [duplicateFixing, setDuplicateFixing] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [passwordResetTarget, setPasswordResetTarget] = useState<PwResetTarget>("student");
  const [tagAdding, setTagAdding] = useState(false);
  const [passwordResetting, setPasswordResetting] = useState(false);

  useEffect(() => {
    setSort(isDeletedTab ? "-deletedAt" : "-registeredAt");
  }, [isDeletedTab]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [search, filters, isDeletedTab]);

  const { data: queryResult, isLoading, isError, refetch } = useStudentsQuery(
    search,
    filters,
    sort,
    page,
    isDeletedTab
  );
  const data = queryResult?.data ?? EMPTY_STUDENTS;
  const totalCount = queryResult?.count ?? 0;
  const pageSize = queryResult?.pageSize ?? 50;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleSelectedStudents = useMemo(
    () => data.filter((student) => selectedIdSet.has(student.id)),
    [data, selectedIdSet]
  );
  const visibleSelectedIds = useMemo(
    () => visibleSelectedStudents.map((student) => student.id),
    [visibleSelectedStudents]
  );
  const selectedCount = visibleSelectedIds.length;

  useEffect(() => {
    setSelectedIds((prev) => {
      const visibleIds = new Set(data.map((student) => student.id));
      const next = prev.filter((studentId) => visibleIds.has(studentId));
      return next.length === prev.length ? prev : next;
    });
  }, [data]);

  const activeFilterCount = useMemo(
    () => Object.keys(filters).length,
    [filters]
  );

  const studentsColumnsDef = useMemo(
    () => getStudentsTableColumnsDef(isDeletedTab),
    [isDeletedTab]
  );
  const tablePrefs = useTableColumnPrefs(
    isDeletedTab ? "students-deleted" : "students-home",
    studentsColumnsDef
  );

  function handleSortChange(nextSort: string) {
    setSort(nextSort);
    setPage(1);
    setSelectedIds([]);
  }

  function handlePageChange(nextPage: number) {
    if (nextPage === page) return;
    setPage(nextPage);
    setSelectedIds([]);
  }

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, nextActive }: { id: number; nextActive: boolean }) =>
      toggleStudentActive(id, nextActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["student"] });
    },
    onError: () => { feedback.error("상태 변경에 실패했습니다."); },
  });
  const togglingId =
    toggleActiveMutation.isPending && toggleActiveMutation.variables
      ? toggleActiveMutation.variables.id
      : null;

  const selectionBar = (
    <div className={styles.selectionBar}>
      <div className={`flex items-center gap-2 pl-1 ${styles.selectionActions}`}>
        <span
          className={`text-[13px] font-semibold ${styles.selectedCount}`}
          data-selected={selectedCount > 0 ? "true" : "false"}
        >
          {selectedCount}명 선택됨
        </span>
        <span className={`text-[var(--color-border-divider)] ${styles.selectionDivider}`}>|</span>
        <Button intent="secondary" size="sm" onClick={() => setSelectedIds([])} disabled={selectedCount === 0}>
          선택 해제
        </Button>
        <span className={`text-[var(--color-border-divider)] ${styles.selectionDivider}`}>|</span>
        {!isDeletedTab && (
          <>
            <Button
              intent="secondary"
              size="sm"
              disabled={selectedCount === 0}
              onClick={() => {
                if (visibleSelectedStudents.length === 0) {
                  feedback.info("선택한 학생이 없습니다.");
                  return;
                }
                const rows: StudentExportRow[] = visibleSelectedStudents.map((s) => ({
                  name: s.name,
                  parentPhone: s.parentPhone ?? null,
                  studentPhone: s.studentPhone ?? null,
                  school: s.school ?? null,
                  grade: s.grade ?? null,
                  schoolClass: s.schoolClass ?? null,
                  major: s.major ?? null,
                  gender: s.gender ?? null,
                  omrCode: s.omrCode ?? "",
                  registeredAt: s.registeredAt ?? null,
                  tags: (s.tags ?? []).map((t) => ({ name: t.name })),
                }));
                void downloadStudentsExcel(rows, `학생목록_${visibleSelectedStudents.length}명.xlsx`)
                  .then(() => feedback.success(`엑셀 다운로드됨 (${visibleSelectedStudents.length}명)`))
                  .catch(() => feedback.error("엑셀 다운로드에 실패했습니다."));
              }}
            >
              엑셀 다운로드
            </Button>
            <Button intent="secondary" size="sm" onClick={() => setShowTagModal(true)} disabled={selectedCount === 0}>
              태그 추가
            </Button>
            <Button intent="secondary" size="sm" onClick={() => setShowPasswordResetModal(true)} disabled={selectedCount === 0}>
              비밀번호 변경
            </Button>
            {/* destructive 액션은 시각적으로 분리 — 위험 액션 오클릭 방지 */}
            <span className={`text-[var(--color-border-divider)] ${styles.selectionDivider}`} aria-hidden>|</span>
            <Button
              intent="danger"
              size="sm"
              disabled={selectedCount === 0 || deleting}
              onClick={async () => {
                if (visibleSelectedIds.length === 0) return;
                const parts = visibleSelectedStudents.map(
                  (s) => `${s.displayName ?? s.name}(${Array.isArray(s.enrollments) ? s.enrollments.length : 0}개 강의 수강 중)`
                );
                const msg =
                  parts.length > 0
                    ? `${parts.join(", ")}\n\n위 ${visibleSelectedIds.length}명을 삭제하시겠습니까? 30일간 보관 후 자동 삭제됩니다.`
                    : `선택한 ${visibleSelectedIds.length}명을 삭제하시겠습니까? 30일간 보관 후 자동 삭제됩니다.`;
                if (!(await confirm({ title: "학생 삭제", message: msg, confirmText: "삭제", danger: true }))) return;
                setDeleting(true);
                try {
                  const deletedIds = [...visibleSelectedIds];
                  const { deleted } = await bulkDeleteStudents(visibleSelectedIds);
                  setSelectedIds([]);
                  qc.invalidateQueries({ queryKey: ["students"] });
                  feedback.success(`${deleted}명 삭제되었습니다.`);
                  if (deleted > 0) setWithdrawalNotif({ open: true, ids: deletedIds });
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
              disabled={selectedCount === 0 || deleting}
              onClick={async () => {
                if (visibleSelectedIds.length === 0) return;
                if (!(await confirm({ title: "학생 복원", message: `선택한 ${visibleSelectedIds.length}명을 복원하시겠습니까?`, confirmText: "복원" }))) return;
                setDeleting(true);
                try {
                  const { restored, skipped = [] } = await bulkRestoreStudents(visibleSelectedIds);
                  setSelectedIds([]);
                  qc.invalidateQueries({ queryKey: ["students"] });
                  if (skipped.length > 0) {
                    const firstReason = skipped[0]?.reason ? `: ${skipped[0].reason}` : "";
                    feedback.warning(`${restored}명 복원, ${skipped.length}명은 복원하지 못했습니다${firstReason}`);
                  } else {
                    feedback.success(`${restored}명 복원되었습니다.`);
                  }
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
              disabled={selectedCount === 0 || deleting}
              onClick={async () => {
                if (visibleSelectedIds.length === 0) return;
                if (!(await confirm({ title: "영구 삭제", message: `선택한 ${visibleSelectedIds.length}명을 즉시 영구 삭제하시겠습니까? 복구할 수 없습니다.`, confirmText: "영구 삭제", danger: true }))) return;
                setDeleting(true);
                try {
                  const { deleted } = await bulkPermanentDeleteStudents(visibleSelectedIds);
                  setSelectedIds([]);
                  qc.invalidateQueries({ queryKey: ["students"] });
                  feedback.success(`${deleted}명 영구 삭제되었습니다.`);
                } catch (e: unknown) {
                  const msg = getApiErrorMessage(e, "삭제 중 오류가 발생했습니다.");
                  feedback.error(msg);
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
        {(() => {
          const maxVisible = 7;
          let start = Math.max(1, page - Math.floor(maxVisible / 2));
          const end = Math.min(totalPages, start + maxVisible - 1);
          if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
          const pages: number[] = [];
          for (let i = start; i <= end; i++) pages.push(i);
          return (
            <>
              {start > 1 && (
                <>
                  <button type="button" onClick={() => handlePageChange(1)} className={styles.paginationButton}>1</button>
                  {start > 2 && <span className={styles.paginationEllipsis}>…</span>}
                </>
              )}
              {pages.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePageChange(p)}
                  className={styles.paginationButton}
                  data-active={page === p ? "true" : "false"}
                >
                  {p}
                </button>
              ))}
              {end < totalPages && (
                <>
                  {end < totalPages - 1 && <span className={styles.paginationEllipsis}>…</span>}
                  <button type="button" onClick={() => handlePageChange(totalPages)} className={styles.paginationButton}>{totalPages}</button>
                </>
              )}
            </>
          );
        })()}
      </div>
    )}
    </div>
  );

  return (
    <>
      <div className="flex flex-col gap-4">
        <DomainListToolbar
          totalLabel={
            isLoading ? (
              "…"
            ) : isDeletedTab ? (
              // SSOT 디자인 예외: 삭제된 학생 탭에서만 총계 좌측에 중복 정리(새로고침) 아이콘 노출
              <span className={styles.deletedTotalInline}>
                <button
                  type="button"
                  title="중복 정리"
                  aria-label="중복 정리"
                  disabled={deleting || duplicateFixing}
                  onClick={async () => {
                    try {
                      const r = await checkDeletedStudentDuplicates();
                      if (r.records_to_remove === 0) return;
                      setDuplicateFixing(true);
                      await fixDeletedStudentDuplicates();
                      qc.invalidateQueries({ queryKey: ["students"] });
                    } catch (err) {
                      console.warn("중복 정리 실패:", err);
                      feedback.error("중복 정리 중 오류가 발생했습니다.");
                    } finally {
                      setDuplicateFixing(false);
                    }
                  }}
                  className={styles.duplicateFixButton}
                >
                  {duplicateFixing ? (
                    <span className={styles.duplicateFixingText}>…</span>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M23 4v6h-6M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                  )}
                </button>
                <span>총 {totalCount}명 (30일 후 자동 삭제)</span>
              </span>
            ) : (
              `총 ${totalCount}명`
            )
          }
          searchSlot={
            <input
              data-guide="students-search"
              placeholder={isMobile ? "검색" : "이름 / 아이디 / 전화번호 / 학교 검색"}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={isMobile ? `ds-input ${styles.searchInput} ${styles.searchInputMobile}` : `ds-input ${styles.searchInput}`}
            />
          }
          filterSlot={
            <div className="flex items-center gap-2">
              <Button intent="secondary" onClick={() => setShowFilter(true)}>
                고급 필터{activeFilterCount ? ` (${activeFilterCount})` : ""}
              </Button>
              <TableColumnPicker
                allColumns={tablePrefs.allColumns}
                visibleKeys={tablePrefs.visibleKeys}
                onToggle={tablePrefs.setColumnVisible}
                onReset={tablePrefs.resetToDefaults}
                triggerLabel="컬럼 표시"
              />
            </div>
          }
          primaryAction={
            !isDeletedTab ? (
              <Button data-guide="students-add-btn" intent="primary" onClick={() => setShowCreate(true)}>
                학생 추가
              </Button>
            ) : null
          }
          belowSlot={selectionBar}
        />

        {/* 엑셀 업로드 진행바 (모달 닫고 진행 중일 때) */}
        {bulkUploadProgress && !showCreate && (
          <div className={styles.bulkProgressPanel}>
            <div className={styles.bulkProgressBody}>
              <progress
                className={styles.bulkProgressBar}
                value={bulkUploadProgress.current}
                max={bulkUploadProgress.total}
                aria-label="학생 일괄 등록 진행률"
              />
              <span className={styles.bulkProgressText}>
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
          ) : isError ? (
            <EmptyState
              scope="panel"
              tone="error"
              title="학생 목록을 불러올 수 없습니다"
              description="네트워크 또는 서버 문제일 수 있습니다. 잠시 후 다시 시도해 주세요."
              actions={
                <Button intent="secondary" onClick={() => refetch()}>
                  다시 시도
                </Button>
              }
            />
          ) : data?.length ? (
            <div data-guide="students-table">
            <StudentsTable
              data={data}
              search={search}
              sort={sort}
              onSortChange={handleSortChange}
              onRowClick={(id) => !isDeletedTab && navigate(`/admin/students/${id}`)}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              isDeletedTab={isDeletedTab}
              onToggleActive={
                !isDeletedTab
                  ? (id, nextActive) => toggleActiveMutation.mutate({ id, nextActive })
                  : undefined
              }
              togglingId={togglingId ?? undefined}
              columnPrefs={{
                visibleColumns: tablePrefs.visibleColumns,
                columnWidths: tablePrefs.columnWidths,
                setColumnWidth: tablePrefs.setColumnWidth,
              }}
            />
            </div>
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

      {/* 태그 추가 모달 — 선택한 학생들에게 태그 일괄 부여 */}
      <TagAddModal
        open={showTagModal}
        onClose={() => setShowTagModal(false)}
        studentIds={visibleSelectedIds}
        onSuccess={() => {
          setShowTagModal(false);
          setSelectedIds([]);
          qc.invalidateQueries({ queryKey: ["students"] });
          qc.invalidateQueries({ queryKey: ["student"] });
        }}
        adding={tagAdding}
        setAdding={setTagAdding}
      />

      {/* 비밀번호 변경(임시 비밀번호 발송) 모달 */}
      <PasswordResetModal
        open={showPasswordResetModal}
        onClose={() => setShowPasswordResetModal(false)}
        selectedStudents={visibleSelectedStudents}
        target={passwordResetTarget}
        onTargetChange={setPasswordResetTarget}
        onSuccess={() => {
          setShowPasswordResetModal(false);
          setSelectedIds([]);
          qc.invalidateQueries({ queryKey: ["students"] });
        }}
        resetting={passwordResetting}
        setResetting={setPasswordResetting}
      />

      {/* 퇴원 알림 수동 발송 모달 */}
      <NotificationPreviewModal
        open={withdrawalNotif.open}
        onClose={() => setWithdrawalNotif({ open: false, ids: [] })}
        mode="manual"
        trigger="withdrawal_complete"
        studentIds={withdrawalNotif.ids}
        label="퇴원 처리 완료 안내"
        sendTo="parent"
      />
    </>
  );
}
