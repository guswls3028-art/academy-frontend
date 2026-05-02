// PATH: src/app_teacher/domains/storage/pages/StudentInventoryPage.tsx
// 학생 인벤토리 — 학생 선택 → 그 학생의 자료 조회/업로드/삭제
import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { Card, SectionTitle, BackButton } from "@teacher/shared/ui/Card";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { Upload, Trash2, Download, Search, Users } from "@teacher/shared/ui/Icons";
import {
  fetchInventoryList,
  uploadFile,
  deleteFile,
  getPresignedUrl,
  type InventoryFile,
} from "../api";
import { fetchStudents } from "@teacher/domains/students/api";
import { useConfirm } from "@/shared/ui/confirm";

function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

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
    mutationFn: (id: string) => deleteFile("student", id, selected!.ps),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-student-inventory", selected?.ps] });
      teacherToast.success("삭제됨");
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
        <h1 className="text-[17px] font-bold flex-1 truncate" style={{ color: "var(--tc-text)" }}>
          {selected ? `${selected.name} 자료` : "학생 인벤토리"}
        </h1>
        {selected && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-[12px] font-bold cursor-pointer flex items-center gap-1"
              style={{
                padding: "8px 12px",
                minHeight: "var(--tc-touch-min)",
                borderRadius: "var(--tc-radius)",
                border: "none",
                background: "var(--tc-primary)",
                color: "#fff",
              }}
            >
              <Upload size={14} /> 업로드
            </button>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: "none" }}
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
          <div className="flex items-center gap-2 rounded-xl"
            style={{ padding: "8px 12px", background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}>
            <Search size={16} style={{ color: "var(--tc-text-muted)", flexShrink: 0 }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="학생 이름, 전화번호"
              className="flex-1 text-sm"
              style={{ border: "none", background: "transparent", color: "var(--tc-text)", outline: "none" }}
            />
          </div>

          {studentsLoading ? (
            <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
          ) : students.length === 0 ? (
            <EmptyState scope="panel" tone="empty" title="학생이 없습니다" />
          ) : (
            <div className="flex flex-col gap-1.5">
              {students.map((s: any) => {
                const ps = s.psNumber ?? s.ps_number;
                if (!ps) return null;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelected({ id: s.id, ps, name: s.name })}
                    className="flex items-center gap-3 rounded-xl w-full text-left cursor-pointer"
                    style={{
                      padding: "var(--tc-space-3) var(--tc-space-4)",
                      minHeight: "var(--tc-touch-min)",
                      background: "var(--tc-surface)",
                      border: "1px solid var(--tc-border)",
                    }}
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}>
                      {(s.name ?? "?")[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>
                        {s.name}
                      </div>
                      <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
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
                  <div key={f.id} className="flex items-center gap-3 rounded-xl"
                    style={{
                      padding: "var(--tc-space-3) var(--tc-space-4)",
                      minHeight: "var(--tc-touch-min)",
                      background: "var(--tc-surface)",
                      border: "1px solid var(--tc-border)",
                    }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: "var(--tc-text)" }}>
                        {f.displayName || f.name}
                      </div>
                      <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                        {formatBytes(f.sizeBytes)} · {new Date(f.createdAt).toLocaleDateString("ko-KR")}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload(f)}
                      className="cursor-pointer shrink-0"
                      style={{ padding: 8, minWidth: 36, minHeight: 36, background: "none", border: "none", color: "var(--tc-primary)" }}
                    >
                      <Download size={14} />
                    </button>
                    <button
                      onClick={async () => {
                        const ok = await confirm({ title: "파일 삭제", message: "이 파일을 삭제하시겠습니까?", confirmText: "삭제", danger: true });
                        if (ok) deleteMut.mutate(f.id);
                      }}
                      className="cursor-pointer shrink-0"
                      style={{ padding: 8, minWidth: 36, minHeight: 36, background: "none", border: "none", color: "var(--tc-text-muted)" }}
                    >
                      <Trash2 size={14} />
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
              <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>표시 이름</label>
              <input
                type="text"
                value={uploadMeta.displayName}
                onChange={(e) => setUploadMeta({ ...uploadMeta, displayName: e.target.value })}
                className="w-full text-sm"
                style={{
                  padding: "10px 12px",
                  minHeight: "var(--tc-touch-min)",
                  borderRadius: "var(--tc-radius-sm)",
                  border: "1px solid var(--tc-border-strong)",
                  background: "var(--tc-surface)",
                  color: "var(--tc-text)",
                  outline: "none",
                }}
              />
            </div>
            <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
              {uploadMeta.file.name} · {formatBytes(uploadMeta.file.size)}
            </div>
            <button
              onClick={() => uploadMut.mutate(uploadMeta)}
              disabled={uploadMut.isPending || !uploadMeta.displayName.trim()}
              className="text-sm font-bold cursor-pointer w-full disabled:opacity-50 mt-1"
              style={{
                padding: "14px",
                minHeight: "var(--tc-touch-min)",
                borderRadius: "var(--tc-radius)",
                border: "none",
                background: "var(--tc-primary)",
                color: "#fff",
              }}
            >
              {uploadMut.isPending ? "업로드 중…" : "업로드"}
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
