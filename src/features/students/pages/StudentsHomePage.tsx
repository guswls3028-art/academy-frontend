// PATH: src/features/students/pages/StudentsHomePage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { useStudentsQuery } from "../hooks/useStudentsQuery";
import StudentsTable from "../components/StudentsTable";
import StudentCreateModal from "../components/StudentCreateModal";
import StudentFilterModal from "../components/StudentFilterModal";
import DeleteConfirmModal from "../components/DeleteConfirmModal";

import { Button, EmptyState } from "@/shared/ui/ds";

export default function StudentsHomePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<any>({});
  const [showCreate, setShowCreate] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [sort, setSort] = useState("-registeredAt");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useStudentsQuery(search, filters, sort);
  const activeFilterCount = useMemo(
    () => Object.keys(filters || {}).length,
    [filters]
  );

  return (
    <>
      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-divider)]">
        {/* CARD HEADER */}
        <div className="px-5 py-4 border-b border-[var(--border-divider)]">
          <div className="text-base font-semibold mb-2">
            학생 관리
          </div>

          <input
            className="ds-input"
            placeholder="이름 / 아이디 / 전화번호 / 학교 검색"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ maxWidth: 360 }}
          />
        </div>

        {/* CARD ACTIONS */}
        <div className="px-5 py-3 flex items-center gap-2 border-b border-[var(--border-divider)]">
          <Button intent="secondary" onClick={() => setShowFilter(true)}>
            고급 필터{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </Button>
          <Button intent="primary" onClick={() => setShowCreate(true)}>
            학생 추가
          </Button>

          <span className="ml-auto text-sm font-semibold text-[var(--color-text-muted)]">
            {isLoading ? "불러오는 중…" : `${data?.length ?? 0}명`}
          </span>
        </div>

        {/* CARD BODY */}
        <div className="p-4">
          {isLoading ? (
            <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
          ) : data?.length ? (
            <StudentsTable
              data={data}
              search={search}
              sort={sort}
              onSortChange={setSort}
              onDelete={(id) => setDeleteId(id)}
              onRowClick={(id) => navigate(`/admin/students/${id}`)}
            />
          ) : (
            <EmptyState
              scope="panel"
              tone="empty"
              title="학생이 없습니다"
              description="학생을 등록하면 목록/검색/이력 관리가 가능합니다."
              actions={
                <Button intent="primary" onClick={() => setShowCreate(true)}>
                  학생 추가
                </Button>
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
          qc.invalidateQueries({ queryKey: ["students"] });
        }}
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

      {deleteId != null && (
        <DeleteConfirmModal
          open
          id={deleteId}
          onClose={() => setDeleteId(null)}
          onSuccess={() => {
            setDeleteId(null);
            qc.invalidateQueries({ queryKey: ["students"] });
          }}
        />
      )}
    </>
  );
}
