/**
 * 과제 제출 — 미완료 시험/과제 목록에서 선택 → 파일 업로드
 *
 * 흐름:
 * 1. 성적 API에서 미합격 과제·시험 목록 표시
 * 2. 학생이 제출 대상 선택
 * 3. 파일(동영상·사진) 선택 후 제출
 * 4. submissions API로 전송 (target_type + target_id)
 */
import { useState, useRef, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import { useMyGradesSummary } from "@/student/domains/grades/hooks/useMyGradesSummary";
import type { MyExamGradeSummary, MyHomeworkGradeSummary } from "@/student/domains/grades/api/grades";
import { createSubmission } from "@/features/submissions/api";
import { IconExam, IconClipboard, IconImage, IconVideo } from "@/student/shared/ui/icons/Icons";

const ACCEPT = "image/*,video/*";
const MAX_SIZE_MB = 100;

type SelectedTarget =
  | { type: "exam"; id: number; title: string }
  | { type: "homework"; id: number; title: string };

export default function SubmitAssignmentPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selected, setSelected] = useState<SelectedTarget | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: grades, isLoading: gradesLoading } = useMyGradesSummary();

  // 미합격 과제·시험 필터
  const unfinishedHomeworks = useMemo(
    () => (grades?.homeworks ?? []).filter((h) => !h.passed),
    [grades?.homeworks],
  );
  const unfinishedExams = useMemo(
    () => (grades?.exams ?? []).filter((e) => !e.is_pass),
    [grades?.exams],
  );

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("제출 대상을 선택해 주세요.");
      if (!selectedFile) throw new Error("파일을 선택해 주세요.");
      if (selectedFile.size > MAX_SIZE_MB * 1024 * 1024) {
        throw new Error(`파일 크기는 ${MAX_SIZE_MB}MB 이하여야 합니다.`);
      }
      const isVideo = selectedFile.type.startsWith("video/");
      const kind = selected.type === "exam"
        ? (isVideo ? "homework_video" : "omr_scan")
        : (isVideo ? "homework_video" : "homework_image");

      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("target_type", selected.type);
      fd.append("target_id", String(selected.id));
      fd.append("file", selectedFile);

      return createSubmission(fd);
    },
    onSuccess: () => {
      setSelectedFile(null);
      setError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["student", "grades", "summary"] });
    },
    onError: (e: Error) => {
      setError(e.message || "제출에 실패했습니다.");
    },
  });

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);
    if (!file) { setSelectedFile(null); return; }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`파일 크기는 ${MAX_SIZE_MB}MB 이하여야 합니다.`);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const canSubmit = !!selected && !!selectedFile && !uploadMut.isPending;

  return (
    <StudentPageShell
      title="과제 제출"
      description="미완료 시험·과제를 선택한 뒤 파일을 업로드하세요."
      onBack={() => window.history.back()}
    >
      <div className="stu-section stu-section--nested" style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
        {/* 에러 / 성공 메시지 */}
        {(uploadMut.isError || error) && (
          <div role="alert" style={{ padding: "var(--stu-space-3)", background: "var(--stu-danger-bg)", border: "1px solid var(--stu-danger-border)", borderRadius: "var(--stu-radius)", fontSize: 14, color: "var(--stu-danger-text)", fontWeight: 600 }}>
            {error || (uploadMut.error instanceof Error ? uploadMut.error.message : "제출에 실패했습니다.")}
          </div>
        )}
        {uploadMut.isSuccess && (
          <div style={{ padding: "var(--stu-space-3)", background: "var(--stu-success-bg)", borderRadius: "var(--stu-radius)", fontSize: 14, color: "var(--stu-success-text)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>제출이 완료되었습니다.</span>
            <Link to="/student/grades" style={{ fontSize: 13, fontWeight: 600, color: "var(--stu-primary)" }}>성적 확인 →</Link>
          </div>
        )}

        {/* STEP 1: 제출 대상 선택 */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--stu-text-muted)", marginBottom: 8 }}>
            1. 제출 대상 선택
          </div>

          {gradesLoading && (
            <div className="stu-muted" style={{ fontSize: 13 }}>불러오는 중…</div>
          )}

          {!gradesLoading && unfinishedHomeworks.length === 0 && unfinishedExams.length === 0 && (
            <div style={{ padding: "var(--stu-space-4)", background: "var(--stu-surface-soft)", borderRadius: "var(--stu-radius)", fontSize: 14, color: "var(--stu-text-muted)", textAlign: "center" }}>
              제출할 미완료 과제·시험이 없습니다.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {/* 미완료 과제 */}
            {unfinishedHomeworks.map((h: MyHomeworkGradeSummary) => {
              const isSelected = selected?.type === "homework" && selected.id === h.homework_id;
              return (
                <button
                  key={`hw-${h.homework_id}`}
                  type="button"
                  onClick={() => setSelected({ type: "homework", id: h.homework_id, title: h.title })}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: isSelected ? "var(--stu-primary-bg)" : "var(--stu-surface)",
                    border: `2px solid ${isSelected ? "var(--stu-primary)" : "var(--stu-border)"}`,
                    borderRadius: "var(--stu-radius)",
                    fontSize: 14,
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                    transition: "border-color 0.15s",
                  }}
                >
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 24, height: 24, borderRadius: 6,
                    background: "var(--stu-surface-soft)", flexShrink: 0,
                  }}>
                    <IconClipboard style={{ width: 14, height: 14, color: "var(--stu-primary)" }} />
                  </span>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: "var(--stu-text-muted)",
                    background: "var(--stu-surface-soft)", padding: "1px 6px", borderRadius: 4,
                    flexShrink: 0,
                  }}>
                    과
                  </span>
                  <span style={{ flex: 1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {h.title}
                  </span>
                  {h.lecture_title && (
                    <span className="stu-muted" style={{ fontSize: 12, flexShrink: 0 }}>
                      {h.lecture_title}
                    </span>
                  )}
                </button>
              );
            })}

            {/* 미완료 시험 */}
            {unfinishedExams.map((e: MyExamGradeSummary) => {
              const isSelected = selected?.type === "exam" && selected.id === e.exam_id;
              return (
                <button
                  key={`ex-${e.exam_id}`}
                  type="button"
                  onClick={() => setSelected({ type: "exam", id: e.exam_id, title: e.title })}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: isSelected ? "var(--stu-primary-bg)" : "var(--stu-surface)",
                    border: `2px solid ${isSelected ? "var(--stu-primary)" : "var(--stu-border)"}`,
                    borderRadius: "var(--stu-radius)",
                    fontSize: 14,
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                    transition: "border-color 0.15s",
                  }}
                >
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 24, height: 24, borderRadius: 6,
                    background: "var(--stu-surface-soft)", flexShrink: 0,
                  }}>
                    <IconExam style={{ width: 14, height: 14, color: "var(--stu-primary)" }} />
                  </span>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: "var(--stu-text-muted)",
                    background: "var(--stu-surface-soft)", padding: "1px 6px", borderRadius: 4,
                    flexShrink: 0,
                  }}>
                    시
                  </span>
                  <span style={{ flex: 1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.title}
                  </span>
                  {e.lecture_title && (
                    <span className="stu-muted" style={{ fontSize: 12, flexShrink: 0 }}>
                      {e.lecture_title}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2: 파일 선택 */}
        {selected && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--stu-text-muted)", marginBottom: 8 }}>
              2. 파일 선택
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              onChange={onFileChange}
              style={{ display: "none" }}
            />

            <button
              type="button"
              className="stu-btn stu-btn--secondary"
              onClick={() => fileInputRef.current?.click()}
              style={{ alignSelf: "flex-start" }}
            >
              파일 선택 (동영상·사진, 최대 {MAX_SIZE_MB}MB)
            </button>

            {selectedFile && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "var(--stu-space-2) var(--stu-space-3)",
                background: "var(--stu-surface)", border: "1px solid var(--stu-border)",
                borderRadius: "var(--stu-radius)", fontSize: 14, marginTop: 8,
              }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                  {selectedFile.type.startsWith("video/")
                    ? <IconVideo style={{ width: 16, height: 16, color: "var(--stu-text-muted)", flexShrink: 0 }} />
                    : <IconImage style={{ width: 16, height: 16, color: "var(--stu-text-muted)", flexShrink: 0 }} />}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)}MB)
                  </span>
                </span>
                <button
                  type="button"
                  className="stu-btn stu-btn--ghost stu-btn--sm"
                  onClick={() => { setSelectedFile(null); setError(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                >
                  삭제
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: 제출 */}
        {selected && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, color: "var(--stu-text-muted)" }}>
              제출 대상: <b>{selected.type === "exam" ? "시" : "과"} {selected.title}</b>
            </div>
            <button
              type="button"
              className="stu-btn stu-btn--primary"
              disabled={!canSubmit}
              onClick={() => uploadMut.mutate()}
              style={{ minHeight: 44 }}
            >
              {uploadMut.isPending ? "제출 중…" : "제출하기"}
            </button>
          </div>
        )}
      </div>
    </StudentPageShell>
  );
}
