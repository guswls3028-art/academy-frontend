// PATH: src/app_admin/domains/storage/components/StudentInventoryManage.tsx
// 학생 인벤토리 관리 — 좌측 학생 리스트 | 우측 인벤토리 탐색기 (3컬럼 통합 뷰)

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, User } from "lucide-react";
import { fetchStudents } from "@admin/domains/students/api/students.api";
import type { ClientStudent } from "@admin/domains/students/api/students.api";
import StudentStorageExplorer from "./StudentStorageExplorer";
import styles from "./StudentInventoryManage.module.css";

type StudentInventoryManageProps = {
  initialStudentPs?: string;
  onOpenStudent?: (ps: string) => void;
};

export default function StudentInventoryManage({
  initialStudentPs,
  onOpenStudent,
}: StudentInventoryManageProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedPs, setSelectedPs] = useState<string | null>(initialStudentPs ?? null);

  useEffect(() => {
    setSelectedPs(initialStudentPs ?? null);
  }, [initialStudentPs]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["storage-student-search", debouncedSearch],
    queryFn: () => fetchStudents(debouncedSearch, {}, "", 1, false),
  });

  const students = data?.data ?? [];

  const handleSelectStudent = (student: ClientStudent) => {
    setSelectedPs(student.psNumber);
    onOpenStudent?.(student.psNumber);
    navigate(`/admin/storage/students/${student.psNumber}`, { replace: true });
  };

  return (
    <div className={styles.root}>
      {/* 좌측: 학생 선택 패널 */}
      <aside className={styles.studentPanel}>
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="이름 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.studentList}>
          {isLoading ? (
            <div className={styles.placeholder}>불러오는 중...</div>
          ) : students.length === 0 ? (
            <div className={styles.placeholder}>
              {debouncedSearch ? "검색 결과 없음" : "등록된 학생 없음"}
            </div>
          ) : (
            students.slice(0, 50).map((s) => (
              <button
                key={s.id}
                type="button"
                className={
                  styles.studentRow +
                  (selectedPs === s.psNumber ? " " + styles.studentRowActive : "")
                }
                onClick={() => handleSelectStudent(s)}
              >
                <User size={16} className={styles.studentIcon} />
                <span className={styles.studentName}>{s.name}</span>
                <span className={styles.studentPs}>{s.psNumber}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* 우측: 인벤토리 탐색기 */}
      <div className={styles.explorerArea}>
        {selectedPs ? (
          <StudentStorageExplorer studentPs={selectedPs} />
        ) : (
          <div className={styles.emptyState}>
            <User size={40} strokeWidth={1.2} />
            <p>좌측에서 학생을 선택하세요</p>
          </div>
        )}
      </div>
    </div>
  );
}
