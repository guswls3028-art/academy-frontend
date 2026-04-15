// PATH: src/app_teacher/domains/students/pages/StudentListPage.tsx
// 학생 목록 — 카드형 + 검색
import { useState, useDeferredValue } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { formatPhone } from "@/shared/utils/formatPhone";
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
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--tc-text-muted)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute left-3 top-1/2 -translate-y-1/2"
        >
          <circle cx={11} cy={11} r={8} />
          <line x1={21} y1={21} x2={16.65} y2={16.65} />
        </svg>
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

      {/* List */}
      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : students.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {students.map((s: any) => {
            const name = s.name ?? s.displayName ?? "이름 없음";
            const sub = [s.grade != null ? `${s.grade}학년` : null, s.school]
              .filter(Boolean)
              .join(" · ");

            return (
              <button
                key={s.id}
                onClick={() => navigate(`/teacher/students/${s.id}`)}
                className="flex items-center gap-3 rounded-lg w-full text-left cursor-pointer"
                style={{
                  padding: "var(--tc-space-3) var(--tc-space-4)",
                  background: "var(--tc-surface)",
                  border: "1px solid var(--tc-border)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold shrink-0"
                  style={{
                    background: "var(--tc-primary-bg)",
                    color: "var(--tc-primary)",
                  }}
                >
                  {name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[15px] font-semibold"
                    style={{ color: "var(--tc-text)" }}
                  >
                    {name}
                  </div>
                  {sub && (
                    <div
                      className="text-xs mt-0.5"
                      style={{ color: "var(--tc-text-muted)" }}
                    >
                      {sub}
                    </div>
                  )}
                </div>
                {s.studentPhone && (
                  <a
                    href={`tel:${s.studentPhone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex p-1"
                    style={{ color: "var(--tc-primary)" }}
                  >
                    <PhoneIcon />
                  </a>
                )}
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

function PhoneIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
