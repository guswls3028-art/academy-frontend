// PATH: src/app_teacher/domains/students/pages/StudentListPage.tsx
// 학생 목록 — 강의딱지 + 전화번호(학부모/학생) + 검색
import { useState, useDeferredValue } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { formatPhone } from "@/shared/utils/formatPhone";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { fetchStudents } from "../api";

export default function StudentListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const { data, isLoading } = useQuery({
    queryKey: ["students-mobile", deferredSearch],
    queryFn: () =>
      fetchStudents({
        search: deferredSearch.trim() || undefined,
        page_size: 50,
      }),
  });

  const students = data?.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <SearchIcon />
        <input
          type="text"
          placeholder="이름 또는 전화번호 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm outline-none"
          style={{
            padding: "10px 12px 10px 36px",
            border: "1px solid var(--tc-border-strong)",
            borderRadius: "var(--tc-radius)",
            background: "var(--tc-surface)",
            color: "var(--tc-text)",
          }}
        />
      </div>

      {/* Count */}
      {!isLoading && students.length > 0 && (
        <div className="text-xs" style={{ color: "var(--tc-text-muted)" }}>
          총 {data?.count ?? students.length}명
        </div>
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
            const sub = [
              s.grade != null ? `${s.grade}학년` : null,
              s.school,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <button
                key={s.id}
                onClick={() => navigate(`/teacher/students/${s.id}`)}
                className="flex gap-3 rounded-xl w-full text-left cursor-pointer"
                style={{
                  padding: "var(--tc-space-3) var(--tc-space-4)",
                  background: "var(--tc-surface)",
                  border: "1px solid var(--tc-border)",
                }}
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold shrink-0"
                  style={{ background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}
                >
                  {name[0]}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {/* Name + Lecture chips */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[15px] font-semibold" style={{ color: "var(--tc-text)" }}>
                      {name}
                    </span>
                    {enrollments.map((e: any) => (
                      <LectureChip
                        key={e.id ?? e.lectureId}
                        lectureName={e.lectureName ?? e.lecture_title ?? ""}
                        color={e.lectureColor ?? e.lecture_color}
                        chipLabel={e.lectureChipLabel ?? e.lecture_chip_label}
                        size={16}
                      />
                    ))}
                  </div>

                  {/* Grade/School */}
                  {sub && (
                    <div className="text-[12px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
                      {sub}
                    </div>
                  )}

                  {/* Phone numbers */}
                  <div className="flex gap-3 mt-1 text-[12px]" style={{ color: "var(--tc-text-secondary)" }}>
                    {parentPhone && (
                      <a
                        href={`tel:${parentPhone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="no-underline flex items-center gap-0.5"
                        style={{ color: "var(--tc-text-secondary)" }}
                      >
                        <span style={{ color: "var(--tc-text-muted)" }}>부</span>
                        {formatPhone(parentPhone)}
                      </a>
                    )}
                    {studentPhone && (
                      <a
                        href={`tel:${studentPhone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="no-underline flex items-center gap-0.5"
                        style={{ color: "var(--tc-text-secondary)" }}
                      >
                        <span style={{ color: "var(--tc-text-muted)" }}>학</span>
                        {formatPhone(studentPhone)}
                      </a>
                    )}
                  </div>
                </div>

                <ChevronRight />
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState
          scope="panel"
          tone="empty"
          title={search ? `"${search}" 검색 결과 없음` : "학생이 없습니다"}
        />
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--tc-text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2">
      <circle cx={11} cy={11} r={8} />
      <line x1={21} y1={21} x2={16.65} y2={16.65} />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--tc-text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 self-center">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
