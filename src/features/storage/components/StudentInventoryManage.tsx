// PATH: src/features/storage/components/StudentInventoryManage.tsx
// 학생 인벤토리 관리 — 이름/PS 검색 후 해당 학생 인벤토리 진입

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, FolderOpen } from "lucide-react";
import { fetchStudents } from "@/features/students/api/students";
import type { ClientStudent } from "@/features/students/api/students";
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
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["storage-student-search", debouncedSearch],
    queryFn: () => fetchStudents(debouncedSearch, {}, "", 1, false),
    enabled: debouncedSearch.length >= 1,
  });

  const students = data?.data ?? [];
  const showExplorer = selectedPs != null;

  const handleSelectStudent = (student: ClientStudent) => {
    setSelectedPs(student.psNumber);
    onOpenStudent?.(student.psNumber);
    navigate(`/admin/storage/student/${student.psNumber}`, { replace: true });
  };

  const handleBack = () => {
    setSelectedPs(null);
    navigate("/admin/storage", { replace: true });
  };

  if (showExplorer) {
    return (
      <div className={styles.root}>
        <div className={styles.backBar}>
          <button type="button" className={styles.backBtn} onClick={handleBack}>
            ← 목록으로
          </button>
          <span className={styles.psLabel}>학생 PS: {selectedPs}</span>
        </div>
        <StudentStorageExplorer studentPs={selectedPs} />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.searchWrap}>
        <Search size={20} className={styles.searchIcon} />
        <input
          type="text"
          className={styles.searchInput}
          placeholder="학생 이름 또는 PS번호로 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {debouncedSearch.length < 1 ? (
        <div className={styles.placeholder}>
          학생 이름이나 PS번호를 입력하면 해당 학생의 인벤토리로 이동할 수 있습니다.
        </div>
      ) : isLoading ? (
        <div className={styles.placeholder}>검색 중...</div>
      ) : students.length === 0 ? (
        <div className={styles.placeholder}>검색 결과가 없습니다.</div>
      ) : (
        <ul className={styles.list}>
          {students.slice(0, 50).map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={styles.row}
                onClick={() => handleSelectStudent(s)}
              >
                <FolderOpen size={18} />
                <span className={styles.name}>{s.name}</span>
                <span className={styles.ps}>{s.psNumber}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
