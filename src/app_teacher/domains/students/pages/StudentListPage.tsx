// PATH: src/app_teacher/domains/students/pages/StudentListPage.tsx
// 학생 목록 — 강의딱지 + 전화번호 + 검색 + 필터
import { useState, useDeferredValue } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { formatPhone } from "@/shared/utils/formatPhone";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { Search, Filter, ChevronRight, Plus } from "@teacher/shared/ui/Icons";
import { Badge } from "@teacher/shared/ui/Badge";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { fetchStudents } from "../api";
import CreateStudentSheet from "../components/CreateStudentSheet";

type FilterState = {
  grade?: string;
  gender?: string;
  status?: string;
};

export default function StudentListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({});
  const deferredSearch = useDeferredValue(search);

  const hasFilter = Object.values(filters).some(Boolean);

  const { data, isLoading } = useQuery({
    queryKey: ["students-mobile", deferredSearch, filters],
    queryFn: () =>
      fetchStudents({
        search: deferredSearch.trim() || undefined,
        page_size: 50,
        ...(filters.grade ? { grade: Number(filters.grade) } : {}),
        ...(filters.gender ? { gender: filters.gender } : {}),
      }),
  });

  const students = data?.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <div className="text-[17px] font-bold" style={{ color: "var(--tc-text)" }}>학생</div>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1 text-xs font-bold cursor-pointer"
          style={{ padding: "6px 12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
          <Plus size={14} /> 학생 등록
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--tc-text-muted)" }} />
          <input
            type="text"
            placeholder="이름, 전화번호, 학교"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-sm outline-none"
            style={{ padding: "10px 12px 10px 36px", border: "1px solid var(--tc-border-strong)", borderRadius: "var(--tc-radius)", background: "var(--tc-surface)", color: "var(--tc-text)" }}
          />
        </div>
        <button
          onClick={() => setShowFilter(true)}
          className="flex items-center justify-center shrink-0 cursor-pointer"
          style={{
            width: 40, height: 40, borderRadius: "var(--tc-radius)",
            border: hasFilter ? "2px solid var(--tc-primary)" : "1px solid var(--tc-border-strong)",
            background: hasFilter ? "var(--tc-primary-bg)" : "var(--tc-surface)",
            color: hasFilter ? "var(--tc-primary)" : "var(--tc-text-muted)",
          }}
        >
          <Filter size={18} />
        </button>
      </div>

      {/* Active filters */}
      {hasFilter && (
        <div className="flex gap-1.5 flex-wrap">
          {filters.grade && <Badge tone="primary" pill>{filters.grade}학년</Badge>}
          {filters.gender && <Badge tone="primary" pill>{filters.gender === "M" ? "남" : "여"}</Badge>}
          <button onClick={() => setFilters({})} className="text-[11px] cursor-pointer" style={{ color: "var(--tc-danger)", background: "none", border: "none" }}>초기화</button>
        </div>
      )}

      {/* Count */}
      {!isLoading && students.length > 0 && (
        <div className="text-xs" style={{ color: "var(--tc-text-muted)" }}>총 {data?.count ?? students.length}명</div>
      )}

      {/* List */}
      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : students.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {students.map((s: any) => {
            const name = s.name ?? s.displayName ?? "이름 없음";
            const enrollments = s.enrollments ?? [];
            const parentPhone = s.parentPhone ?? s.parent_phone;
            const studentPhone = s.studentPhone ?? s.student_phone ?? s.phone;
            const sub = [s.grade != null ? `${s.grade}학년` : null, s.school].filter(Boolean).join(" · ");

            return (
              <button
                key={s.id}
                onClick={() => navigate(`/teacher/students/${s.id}`)}
                className="flex gap-3 rounded-xl w-full text-left cursor-pointer"
                style={{ padding: "var(--tc-space-3) var(--tc-space-4)", background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold shrink-0" style={{ background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}>{name[0]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[15px] font-semibold" style={{ color: "var(--tc-text)" }}>{name}</span>
                    {enrollments.map((e: any) => (
                      <LectureChip key={e.id ?? e.lectureId} lectureName={e.lectureName ?? e.lecture_title ?? ""} color={e.lectureColor ?? e.lecture_color} chipLabel={e.lectureChipLabel ?? e.lecture_chip_label} size={16} />
                    ))}
                  </div>
                  {sub && <div className="text-[12px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>{sub}</div>}
                  <div className="flex gap-3 mt-1 text-[12px]" style={{ color: "var(--tc-text-secondary)" }}>
                    {parentPhone && <a href={`tel:${parentPhone}`} onClick={(e) => e.stopPropagation()} className="no-underline" style={{ color: "var(--tc-text-secondary)" }}>부 {formatPhone(parentPhone)}</a>}
                    {studentPhone && <a href={`tel:${studentPhone}`} onClick={(e) => e.stopPropagation()} className="no-underline" style={{ color: "var(--tc-text-secondary)" }}>학 {formatPhone(studentPhone)}</a>}
                  </div>
                </div>
                <ChevronRight size={16} className="shrink-0 self-center" style={{ color: "var(--tc-text-muted)" }} />
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState scope="panel" tone="empty" title={search ? `"${search}" 결과 없음` : "학생이 없습니다"} />
      )}

      {/* Filter bottom sheet */}
      <BottomSheet open={showFilter} onClose={() => setShowFilter(false)} title="필터">
        <div className="flex flex-col gap-4 p-4">
          <FilterGroup label="학년" options={[{ v: "", l: "전체" }, { v: "1", l: "1학년" }, { v: "2", l: "2학년" }, { v: "3", l: "3학년" }, { v: "4", l: "4학년" }, { v: "5", l: "5학년" }, { v: "6", l: "6학년" }]} value={filters.grade ?? ""} onChange={(v) => setFilters((f) => ({ ...f, grade: v || undefined }))} />
          <FilterGroup label="성별" options={[{ v: "", l: "전체" }, { v: "M", l: "남" }, { v: "F", l: "여" }]} value={filters.gender ?? ""} onChange={(v) => setFilters((f) => ({ ...f, gender: v || undefined }))} />
          <FilterGroup label="상태" options={[{ v: "", l: "전체" }, { v: "active", l: "활성" }, { v: "inactive", l: "비활성" }]} value={filters.status ?? ""} onChange={(v) => setFilters((f) => ({ ...f, status: v || undefined }))} />
          <div className="flex gap-2">
            <button onClick={() => setFilters({})} className="flex-1 text-sm font-semibold py-2.5 rounded-lg cursor-pointer" style={{ background: "var(--tc-surface-soft)", color: "var(--tc-text-secondary)", border: "1px solid var(--tc-border)" }}>
              초기화
            </button>
            <button onClick={() => setShowFilter(false)} className="flex-1 text-sm font-semibold py-2.5 rounded-lg cursor-pointer" style={{ background: "var(--tc-primary)", color: "#fff", border: "none" }}>
              적용
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Create student sheet */}
      <CreateStudentSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function FilterGroup({ label, options, value, onChange }: { label: string; options: { v: string; l: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="text-sm font-semibold mb-2" style={{ color: "var(--tc-text)" }}>{label}</div>
      <div className="flex gap-2 flex-wrap">
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className="text-[13px] font-medium px-3 py-1.5 rounded-full cursor-pointer"
            style={{
              border: value === o.v ? "2px solid var(--tc-primary)" : "1px solid var(--tc-border)",
              background: value === o.v ? "var(--tc-primary-bg)" : "var(--tc-surface)",
              color: value === o.v ? "var(--tc-primary)" : "var(--tc-text-secondary)",
            }}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}
