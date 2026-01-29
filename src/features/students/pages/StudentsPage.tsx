// PATH: src/features/students/pages/StudentsPage.tsx

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { useStudentsQuery } from "../hooks/useStudentsQuery";
import StudentsTable from "../components/StudentsTable";
import StudentFormModal from "../components/StudentCreateModal";
import StudentFilterModal from "../components/StudentFilterModal";
import { deleteStudent } from "../api/students";

import { Page, PageHeader, PageSection, PageToolbar } from "@/shared/ui/page";

export default function StudentsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<any>({});
  const [showModal, setShowModal] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [sort, setSort] = useState<"date" | "name">("date");

  const hasFilter = Object.keys(filters || {}).length > 0;

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isFetching } = useStudentsQuery(search, filters, sort);

  async function handleDelete(id: number) {
    if (!confirm("삭제하시겠습니까?")) return;
    await deleteStudent(id);
    qc.invalidateQueries({ queryKey: ["students"] });
  }

  return (
    <Page>
      <PageHeader
        title="학생 관리"
        description="학생 계정 및 기본 정보를 관리합니다."
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-md text-sm font-semibold
              bg-[var(--color-primary)]
              text-white"
          >
            학생 추가
          </button>
        }
      />

      <PageSection className="bg-[var(--bg-surface-soft)] border rounded-xl">
        <PageToolbar>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                className="w-64 py-2 px-3 text-sm rounded-md
                  border border-[var(--border-divider)]
                  bg-[var(--bg-app)]"
                placeholder="이름으로 학생 검색"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              {isFetching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2
                  w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" />
              )}
            </div>

            <button
              onClick={() => setSearch(searchInput)}
              className="px-3 py-2 text-sm rounded-md
                border border-[var(--border-divider)]
                hover:bg-[var(--bg-surface)]"
            >
              검색
            </button>

            <button
              onClick={() => setShowFilter(true)}
              className="relative px-3 py-2 text-sm text-[var(--text-secondary)]"
            >
              고급 필터
              {hasFilter && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[var(--color-primary)]" />
              )}
            </button>
          </div>
        </PageToolbar>
      </PageSection>

      <PageSection className="border rounded-xl overflow-hidden">
        <StudentsTable
          data={data || []}
          search={search}
          sort={sort}
          onSortChange={(v) => setSort(v as any)}
          onDelete={handleDelete}
          onRowClick={(id) => navigate(String(id))}
        />
      </PageSection>

      {showModal && (
        <StudentFormModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            qc.invalidateQueries({ queryKey: ["students"] });
          }}
        />
      )}

      <StudentFilterModal
        open={showFilter}
        filters={filters}
        onClose={() => setShowFilter(false)}
        onApply={(next) => {
          setFilters(next);
          setShowFilter(false);
        }}
      />
    </Page>
  );
}
