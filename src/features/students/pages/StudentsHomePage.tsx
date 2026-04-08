// PATH: src/features/students/pages/StudentsHomePage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "@/shared/ui/confirm";

import { resolveTenantCodeString } from "@/shared/tenant";

const STORAGE_KEY = "students-selected-ids";

import { useStudentsQuery } from "../hooks/useStudentsQuery";
import {
  bulkDeleteStudents,
  bulkRestoreStudents,
  bulkPermanentDeleteStudents,
  checkDeletedStudentDuplicates,
  fixDeletedStudentDuplicates,
  toggleStudentActive,
  getTags,
  attachStudentTag,
  sendPasswordReset,
} from "../api/students";
import { downloadStudentsExcel, type StudentExportRow } from "../excel/studentExcel";
import StudentsTable, { getStudentsTableColumnsDef } from "../components/StudentsTable";
import StudentCreateModal from "../components/StudentCreateModal";
import StudentFilterModal from "../components/StudentFilterModal";
import TagAddModal from "../components/TagAddModal";
import PasswordResetModal, { type PwResetTarget } from "../components/PasswordResetModal";

import { Button, EmptyState } from "@/shared/ui/ds";
import { DomainListToolbar, useTableColumnPrefs, TableColumnPicker } from "@/shared/ui/domain";
import { feedback } from "@/shared/ui/feedback/feedback";
import NotificationPreviewModal from "@/features/messages/components/NotificationPreviewModal";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { useSendMessageModal } from "@/features/messages/context/SendMessageModalContext";
import { useIsMobile } from "@/shared/hooks/useIsMobile";

export default function StudentsHomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { openSendMessageModal } = useSendMessageModal();
  const isMobile = useIsMobile();

  const isDeletedTab = location.pathname.includes("/deleted");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<any>({});
  const [showCreate, setShowCreate] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [sort, setSort] = useState("-registeredAt");
  const [page, setPage] = useState(1);
  const tenantCode = resolveTenantCodeString();
  const [selectedIds, setSelectedIds] = useState<number[]>(() => {
    try {
      const k = `${STORAGE_KEY}-${tenantCode}-${isDeletedTab ? "deleted" : "home"}`;
      const v = sessionStorage.getItem(k);
      if (v) {
        const arr = JSON.parse(v);
        return Array.isArray(arr) ? arr.filter((x) => typeof x === "number") : [];
      }
    } catch {}
    return [];
  });
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

  const prevTabRef = useRef(isDeletedTab);
  useEffect(() => {
    if (prevTabRef.current !== isDeletedTab) {
      prevTabRef.current = isDeletedTab;
      setSelectedIds([]);
    }
  }, [isDeletedTab]);

  useEffect(() => {
    const k = `${STORAGE_KEY}-${tenantCode}-${isDeletedTab ? "deleted" : "home"}`;
    sessionStorage.setItem(k, JSON.stringify(selectedIds));
  }, [selectedIds, isDeletedTab, tenantCode]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
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

  const studentsColumnsDef = useMemo(
    () => getStudentsTableColumnsDef(isDeletedTab),
    [isDeletedTab]
  );
  const tablePrefs = useTableColumnPrefs(
    isDeletedTab ? "students-deleted" : "students-home",
    studentsColumnsDef
  );

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
      <Button intent="secondary" size="sm" onClick={() => setSelectedIds([])} disabled={selectedIds.length === 0}>
        선택 해제
      </Button>
      <span className="text-[var(--color-border-divider)]">|</span>
      {!isDeletedTab && (
        <>
          <Button intent="secondary" size="sm" onClick={() => {
            // 현재 테이블에 표시된 학생만 발송 대상에 포함 (이전 검색의 잔여 선택 제외)
            const visibleIds = new Set((data ?? []).map((s) => s.id));
            const validIds = selectedIds.filter((studentId) => visibleIds.has(studentId));
            if (validIds.length === 0) {
              feedback.info("현재 목록에 선택된 학생이 없습니다.");
              return;
            }
            openSendMessageModal({ studentIds: validIds, recipientLabel: `선택한 학생 ${validIds.length}명`, blockCategory: "student" });
          }}>
            메시지 발송
          </Button>
          <Button
            intent="secondary"
            size="sm"
            onClick={() => {
              const selected = (data ?? []).filter((s) => selectedIds.includes(s.id));
              if (selected.length === 0) {
                feedback.info("선택한 학생이 없습니다.");
                return;
              }
              const rows: StudentExportRow[] = selected.map((s) => ({
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
              downloadStudentsExcel(rows, `학생목록_${selected.length}명.xlsx`);
              feedback.success(`엑셀 다운로드됨 (${selected.length}명)`);
            }}
          >
            엑셀 다운로드
          </Button>
          <Button intent="secondary" size="sm" onClick={() => setShowTagModal(true)} disabled={selectedIds.length === 0}>
            태그 추가
          </Button>
          <Button intent="secondary" size="sm" onClick={() => setShowPasswordResetModal(true)} disabled={selectedIds.length === 0}>
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
                (s) => `${s.displayName ?? s.name}(${Array.isArray(s.enrollments) ? s.enrollments.length : 0}개 강의 수강 중)`
              );
              const msg =
                parts.length > 0
                  ? `${parts.join(", ")}\n\n위 ${selectedIds.length}명을 삭제하시겠습니까? 30일간 보관 후 자동 삭제됩니다.`
                  : `선택한 ${selectedIds.length}명을 삭제하시겠습니까? 30일간 보관 후 자동 삭제됩니다.`;
              if (!(await confirm({ title: "학생 삭제", message: msg, confirmText: "삭제", danger: true }))) return;
              setDeleting(true);
              try {
                const deletedIds = [...selectedIds];
                const { deleted } = await bulkDeleteStudents(selectedIds);
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
            disabled={selectedIds.length === 0 || deleting}
            onClick={async () => {
              if (selectedIds.length === 0) return;
              if (!(await confirm({ title: "학생 복원", message: `선택한 ${selectedIds.length}명을 복원하시겠습니까?`, confirmText: "복원" }))) return;
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
              if (!(await confirm({ title: "영구 삭제", message: `선택한 ${selectedIds.length}명을 즉시 영구 삭제하시겠습니까? 복구할 수 없습니다.`, confirmText: "영구 삭제", danger: true }))) return;
              setDeleting(true);
              try {
                const { deleted } = await bulkPermanentDeleteStudents(selectedIds);
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
          totalLabel={
            isLoading ? (
              "…"
            ) : isDeletedTab ? (
              // SSOT 디자인 예외: 삭제된 학생 탭에서만 총계 좌측에 중복 정리(새로고침) 아이콘 노출
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
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
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 28,
                    height: 28,
                    padding: 0,
                    border: "1px solid var(--color-border-divider)",
                    borderRadius: 6,
                    background: "var(--color-bg-surface)",
                    color: "var(--color-text-secondary)",
                    cursor: deleting || duplicateFixing ? "not-allowed" : "pointer",
                    opacity: deleting || duplicateFixing ? 0.6 : 1,
                  }}
                >
                  {duplicateFixing ? (
                    <span style={{ fontSize: 12 }}>…</span>
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
              className="ds-input"
              placeholder={isMobile ? "검색" : "이름 / 아이디 / 전화번호 / 학교 검색"}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ maxWidth: isMobile ? "none" : 360, width: isMobile ? "100%" : undefined }}
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
        studentIds={selectedIds}
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
        selectedStudents={(data ?? []).filter((s) => selectedIds.includes(s.id))}
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
