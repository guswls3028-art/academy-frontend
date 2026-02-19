/**
 * 학생 Q&A — 메일 보내기처럼 질문 + 사진/파일 첨부 전송
 * 정렬·목록·상세는 관리자 페이지에서 처리
 */
import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import { fetchBlockTypes, createPost } from "@/features/community/api/community.api";

const QNA_BLOCK_CODE = "qna";
const MAX_FILES = 5;
const MAX_SIZE_MB = 10;

export default function QnaPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: blockTypes = [] } = useQuery({
    queryKey: ["community-block-types"],
    queryFn: () => fetchBlockTypes(),
  });

  const qnaBlockType =
    blockTypes.find((b) => (b.code || "").toLowerCase() === QNA_BLOCK_CODE) ?? blockTypes[0];
  const effectiveBlockTypeId = qnaBlockType?.id ?? blockTypes[0]?.id;

  const createMut = useMutation({
    mutationFn: () =>
      createPost({
        block_type: effectiveBlockTypeId!,
        title: title.trim(),
        content: content.trim(),
        node_ids: [],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-community-posts"] });
      setTitle("");
      setContent("");
      setFiles([]);
    },
  });

  const canSubmit =
    title.trim().length > 0 && content.trim().length > 0 && effectiveBlockTypeId != null;

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files || []);
    const ok: File[] = [];
    for (const f of chosen) {
      if (f.size > MAX_SIZE_MB * 1024 * 1024) continue;
      if (ok.length + files.length >= MAX_FILES) break;
      ok.push(f);
    }
    setFiles((prev) => [...prev, ...ok].slice(0, MAX_FILES));
    e.target.value = "";
  };
  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  return (
    <StudentPageShell
      title="질문 보내기"
      description="궁금한 점을 적어 보내면 선생님이 확인해 주세요."
    >
      <div
        className="stu-section stu-section--nested"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--stu-space-4)",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--stu-text-muted)" }}>
            제목
          </span>
          <input
            type="text"
            placeholder="질문 제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="stu-input"
            style={{ width: "100%" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)", flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--stu-text-muted)" }}>
            내용
          </span>
          <textarea
            placeholder="질문 내용을 적어 주세요."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            className="stu-textarea"
            style={{ width: "100%", resize: "vertical", minHeight: 160 }}
          />
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--stu-text-muted)" }}>
            사진·파일 (선택, 최대 {MAX_FILES}개, 개당 {MAX_SIZE_MB}MB)
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            multiple
            onChange={addFiles}
            style={{ display: "none" }}
          />
          <button
            type="button"
            className="stu-btn stu-btn--secondary stu-btn--sm"
            onClick={() => fileInputRef.current?.click()}
            style={{ alignSelf: "flex-start" }}
          >
            파일 선택
          </button>
          {files.length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "var(--stu-space-2) var(--stu-space-3)",
                    background: "var(--stu-surface)",
                    border: "1px solid var(--stu-border)",
                    borderRadius: "var(--stu-radius)",
                    fontSize: 13,
                    color: "var(--stu-text)",
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                    {f.name} ({(f.size / 1024).toFixed(1)}KB)
                  </span>
                  <button
                    type="button"
                    className="stu-btn stu-btn--ghost stu-btn--sm"
                    onClick={() => removeFile(i)}
                    style={{ flexShrink: 0, padding: "var(--stu-space-1) var(--stu-space-2)" }}
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {createMut.isSuccess && (
          <div
            style={{
              padding: "var(--stu-space-3)",
              background: "var(--stu-success-bg)",
              borderRadius: "var(--stu-radius)",
              fontSize: 14,
              color: "var(--stu-success-text)",
            }}
          >
            질문이 전달되었습니다. 선생님이 확인 후 답변해 주실 거예요.
          </div>
        )}
        {createMut.isError && (
          <div style={{ fontSize: 13, color: "var(--stu-danger)" }}>
            {createMut.error instanceof Error ? createMut.error.message : "전송에 실패했습니다."}
          </div>
        )}
        <button
          type="button"
          className="stu-btn stu-btn--primary"
          disabled={!canSubmit || createMut.isPending}
          onClick={() => createMut.mutate()}
          style={{ alignSelf: "flex-end" }}
        >
          {createMut.isPending ? "보내는 중…" : "질문 보내기"}
        </button>
      </div>
    </StudentPageShell>
  );
}
