// PATH: src/app_teacher/domains/storage/pages/StudentInventoryPage.tsx
// 학생 인벤토리 — 학생 선택 → 그 학생의 자료 조회/업로드/삭제
import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState, ICON } from "@/shared/ui/ds";
import { SectionTitle, BackButton } from "@teacher/shared/ui/Card";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { Upload, Trash2, Download, Search } from "@teacher/shared/ui/Icons";
import {
  fetchInventoryList,
  uploadFile,
  deleteFile,
  getPresignedUrl,
  type InventoryFile,
} from "../api";
import { fetchStudents } from "@teacher/domains/students/api";
import type { ClientStudent } from "@/shared/api/contracts/students";
import { useConfirm } from "@/shared/ui/confirm";
import { formatStorageBytes as formatBytes } from "../storageFormat";
import styles from "./StudentInventoryPage.module.css";

export default function StudentInventoryPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ id: number; ps: string; name: string } | null>(null);
  const [uploadMeta, setUploadMeta] = useState<{ file: File; displayName: string } | null>(null);

  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ["teacher-students-for-inventory", search],
    queryFn: () => fetchStudents({ search: search.trim() || undefined, page_size: 50 }),
  });

  const students = studentsData?.data ?? [];

  const { data: inventory, isLoading: invLoading } = useQuery({
    queryKey: ["teacher-student-inventory", selected?.ps],
    queryFn: () => fetchInventoryList("student", selected!.ps),
    enabled: !!selected?.ps,
  });

  const files = useMemo(() => inventory?.files ?? [], [inventory]);

  const uploadMut = useMutation({
    mutationFn: (u: { file: File; displayName: string }) =>
      uploadFile({
        scope: "student",
        folderId: null,
        displayName: u.displayName,
        description: "",
        icon: "file",
        file: u.file,
        studentPs: selected!.ps,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-student-inventory", selected?.ps] });
      teacherToast.success("업로드 완료");
      setUploadMeta(null);
    },
    onError: () => teacherToast.error("업로드에 실패했습니다."),
  });

  const deleteMut = useMutation({
    mutationFn: (file: InventoryFile) => deleteFile("student", file.id, selected!.ps),
    onSuccess: (_data, file) => {
      qc.invalidateQueries({ queryKey: ["teacher-student-inventory", selected?.ps] });
      teacherToast.success(`'${file.displayName || file.name}' 파일을 삭제했습니다.`);
    },
    onError: () => teacherToast.error("삭제에 실패했습니다."),
  });

  const handleDownload = async (file: InventoryFile) => {
    try {
      const { url } = await getPresignedUrl(file.r2Key);
      window.open(url, "_blank");
    } catch {
      teacherToast.error("다운로드 URL을 가져올 수 없습니다.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <BackButton onClick={() => (selected ? setSelected(null) : navigate(-1))} />
        <h1 className={`${styles.title} text-[17px] font-bold flex-1 truncate`}>
          {selected ? `${selected.name} 자료` : "학생 인벤토리"}
        </h1>
        {selected && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`${styles.uploadButton} text-[12px] font-bold cursor-pointer flex items-center gap-1`}
            >
              <Upload size={ICON.xs} /> 업로드
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className={styles.hiddenInput}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploadMeta({ file, displayName: file.name });
                e.target.value = "";
              }}
            />
          </>
        )}
      </div>

      {!selected && (
        <>
          <div className={`${styles.searchBox} flex items-center gap-2 rounded-xl`}>
            <Search size={ICON.sm} className={styles.searchIcon} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="학생 이름, 전화번호"
              className={`${styles.searchInput} flex-1 text-sm`}
            />
          </div>

          {studentsLoading ? (
            <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
          ) : students.length === 0 ? (
            <EmptyState scope="panel" tone="empty" title="학생이 없습니다" />
          ) : (
            <div className="flex flex-col gap-1.5">
              {students.map((s: ClientStudent) => {
                const ps = s.psNumber;
                if (!ps) return null;
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => setSelected({ id: s.id, ps, name: s.name })}
                    className={`${styles.studentButton} flex items-center gap-3 rounded-xl w-full text-left cursor-pointer`}
                  >
                    <div className={`${styles.avatar} w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0`}>
                      {(s.name ?? "?")[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`${styles.primaryText} text-sm font-semibold`}>
                        {s.name}
                      </div>
                      <div className={`${styles.mutedText} text-[11px]`}>
                        ID {ps}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {selected && (
        <>
          {invLoading && <EmptyState scope="panel" tone="loading" title="불러오는 중…" />}
          {!invLoading && files.length === 0 && (
            <EmptyState scope="panel" tone="empty" title="배포된 자료가 없습니다" />
          )}
          {files.length > 0 && (
            <>
              <SectionTitle>파일 ({files.length})</SectionTitle>
              <div className="flex flex-col gap-1.5">
                {files.map((f) => (
                  <div key={f.id} className={`${styles.fileRow} flex items-center gap-3 rounded-xl`}>
                    <div className="flex-1 min-w-0">
                      <div className={`${styles.primaryText} text-sm font-semibold truncate`}>
                        {f.displayName || f.name}
                      </div>
                      <div className={`${styles.mutedText} text-[11px]`}>
                        {formatBytes(f.sizeBytes)} · {new Date(f.createdAt).toLocaleDateString("ko-KR")}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownload(f)}
                      aria-label={`${f.displayName || f.name} 다운로드`}
                      title={`${f.displayName || f.name} 다운로드`}
                      className={`${styles.iconButton} ${styles.primaryIconButton} cursor-pointer shrink-0`}
                    >
                      <Download size={ICON.xs} />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await confirm({ title: "파일 삭제", message: `'${f.displayName || f.name}' 파일을 삭제합니다. 계속할까요?`, confirmText: "삭제", danger: true });
                        if (ok) deleteMut.mutate(f);
                      }}
                      aria-label={`${f.displayName || f.name} 삭제`}
                      title={`${f.displayName || f.name} 삭제`}
                      className={`${styles.iconButton} ${styles.mutedIconButton} cursor-pointer shrink-0`}
                    >
                      <Trash2 size={ICON.xs} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Upload meta sheet */}
      <BottomSheet open={uploadMeta != null} onClose={() => setUploadMeta(null)} title="업로드 정보">
        {uploadMeta && (
          <div className="flex flex-col gap-2 pb-3">
            <div>
              <label className={`${styles.mutedText} text-[11px] font-semibold block mb-1`}>표시 이름</label>
              <input
                type="text"
                value={uploadMeta.displayName}
                onChange={(e) => setUploadMeta({ ...uploadMeta, displayName: e.target.value })}
                className={`${styles.field} w-full text-sm`}
              />
            </div>
            <div className={`${styles.mutedText} text-[11px]`}>
              {uploadMeta.file.name} · {formatBytes(uploadMeta.file.size)}
            </div>
            <button
              type="button"
              onClick={() => uploadMut.mutate(uploadMeta)}
              disabled={uploadMut.isPending || !uploadMeta.displayName.trim()}
              className={`${styles.confirmUploadButton} text-sm font-bold cursor-pointer w-full disabled:opacity-50 mt-1`}
            >
              {uploadMut.isPending ? "업로드 중…" : "업로드"}
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
