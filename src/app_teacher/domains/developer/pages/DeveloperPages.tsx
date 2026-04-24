// PATH: src/app_teacher/domains/developer/pages/DeveloperPages.tsx
// To개발자 — 패치노트 · 버그 제보 · 피드백 (모바일)
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, SectionTitle, BackButton } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { ImagePlus, Trash2, Send } from "@teacher/shared/ui/Icons";
import {
  createPost,
  uploadPostAttachments,
} from "@admin/domains/community/api/community.api";
import {
  PATCH_NOTES,
  type PatchNote,
  type NoteCategory,
} from "@admin/domains/developer/pages/patchNotesData";

const CATEGORY_LABEL: Record<NoteCategory, string> = {
  new: "NEW",
  fix: "FIX",
  improve: "IMPROVE",
  security: "SECURITY",
};

const CATEGORY_TONE: Record<NoteCategory, "success" | "danger" | "warning" | "info"> = {
  new: "success",
  fix: "danger",
  improve: "info",
  security: "warning",
};

/* ═══════════════════ 패치노트 ═══════════════════ */

export function PatchNotesPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<PatchNote | null>(null);

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="flex items-center gap-2 py-0.5">
        <BackButton onClick={() => navigate(-1)} />
        <h1 className="text-[17px] font-bold flex-1" style={{ color: "var(--tc-text)" }}>패치노트</h1>
      </div>

      <div className="flex flex-col gap-2">
        {PATCH_NOTES.map((note, i) => {
          const counts = { new: 0, fix: 0, improve: 0, security: 0 };
          note.entries.forEach((e) => counts[e.category]++);
          const isLatest = i === 0;
          return (
            <button
              key={note.version}
              onClick={() => setSelected(note)}
              className="flex flex-col items-start text-left cursor-pointer rounded-xl"
              style={{
                padding: "var(--tc-space-3) var(--tc-space-4)",
                minHeight: "var(--tc-touch-min)",
                background: "var(--tc-surface)",
                border: isLatest ? "2px solid var(--tc-primary)" : "1px solid var(--tc-border)",
              }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold" style={{ color: "var(--tc-text)" }}>
                  {note.version}
                </span>
                {isLatest && <Badge tone="primary" size="xs">LATEST</Badge>}
                <span className="text-[11px] ml-auto" style={{ color: "var(--tc-text-muted)" }}>
                  {note.date}
                </span>
              </div>
              <div className="text-[13px] font-semibold mt-1" style={{ color: "var(--tc-text)" }}>
                {note.codename}
              </div>
              <p className="text-[12px] mt-0.5 leading-snug" style={{ color: "var(--tc-text-muted)" }}>
                {note.summary}
              </p>
              <div className="flex gap-1 mt-2 flex-wrap">
                {(Object.keys(counts) as NoteCategory[]).map((k) =>
                  counts[k] > 0 ? (
                    <Badge key={k} tone={CATEGORY_TONE[k]} size="xs">
                      {counts[k]} {CATEGORY_LABEL[k]}
                    </Badge>
                  ) : null,
                )}
              </div>
            </button>
          );
        })}
      </div>

      <BottomSheet
        open={selected != null}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.version} · ${selected.codename}` : ""}
      >
        {selected && (
          <div className="flex flex-col gap-2 pb-3">
            <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
              {selected.date}
            </div>
            <div className="text-[13px] leading-relaxed" style={{ color: "var(--tc-text-secondary)" }}>
              {selected.summary}
            </div>
            <div className="flex flex-col gap-1.5 mt-2">
              {selected.entries.map((e, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 rounded-lg"
                  style={{
                    padding: "var(--tc-space-2) var(--tc-space-3)",
                    background: "var(--tc-surface-soft)",
                    border: "1px solid var(--tc-border)",
                  }}
                >
                  <Badge tone={CATEGORY_TONE[e.category]} size="xs">
                    {CATEGORY_LABEL[e.category]}
                  </Badge>
                  <span className="text-[13px] leading-snug" style={{ color: "var(--tc-text)" }}>
                    {e.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

/* ═══════════════════ 버그 제보 ═══════════════════ */

export function BugReportPage() {
  return <SubmissionForm kind="bug" />;
}

/* ═══════════════════ 피드백 ═══════════════════ */

export function FeedbackPage() {
  return <SubmissionForm kind="feedback" />;
}

/* ─── 공용 제출 폼 ─── */
function SubmissionForm({ kind }: { kind: "bug" | "feedback" }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const isBug = kind === "bug";
  const heading = isBug ? "버그 제보" : "피드백";
  const titlePrefix = isBug ? "[BUG]" : "[FEEDBACK]";
  const placeholder = isBug
    ? "어떤 버그인지 간단히 (예: 출석 저장이 안 됩니다)"
    : "제목 (예: 바로가기에 수납 추가 요청)";

  const addImage = (file: File) => {
    setImages((p) => [...p, file]);
    setPreviews((p) => [...p, URL.createObjectURL(file)]);
  };

  const removeImage = (idx: number) => {
    setPreviews((p) => {
      URL.revokeObjectURL(p[idx]);
      return p.filter((_, i) => i !== idx);
    });
    setImages((p) => p.filter((_, i) => i !== idx));
  };

  useEffect(() => {
    return () => previews.forEach(URL.revokeObjectURL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("제목을 입력해주세요.");
      const post = await createPost({
        post_type: "board",
        title: `${titlePrefix} ${title.trim()}`,
        content: content.trim(),
        node_ids: [],
      });
      if (images.length > 0) {
        await uploadPostAttachments(post.id, images);
      }
      return post;
    },
    onSuccess: () => {
      teacherToast.success(isBug ? "버그 제보가 등록되었습니다." : "피드백이 등록되었습니다.");
      setTitle("");
      setContent("");
      previews.forEach(URL.revokeObjectURL);
      setImages([]);
      setPreviews([]);
      qc.invalidateQueries({ queryKey: ["dev-posts"] });
    },
    onError: (e: Error) => teacherToast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="flex items-center gap-2 py-0.5">
        <BackButton onClick={() => navigate(-1)} />
        <h1 className="text-[17px] font-bold flex-1" style={{ color: "var(--tc-text)" }}>
          {heading}
        </h1>
      </div>

      <Card>
        <div className="text-[12px] leading-relaxed" style={{ color: "var(--tc-text-muted)" }}>
          {isBug
            ? "버그가 발생한 화면의 스크린샷을 함께 첨부해 주세요."
            : "불편한 점이나 개선 아이디어를 자유롭게 보내 주세요."}
        </div>
      </Card>

      <div>
        <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>
          제목
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={placeholder}
          className="w-full text-sm"
          style={fieldStyle}
        />
      </div>

      <div>
        <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>
          상세 내용
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={isBug ? "언제·무엇을 했을 때 어떤 현상이 나타났는지" : "자유롭게 작성해 주세요"}
          rows={6}
          className="w-full text-sm"
          style={{ ...fieldStyle, minHeight: 140, resize: "vertical" }}
        />
      </div>

      {/* 이미지 업로드 */}
      <div className="flex flex-col gap-2">
        <label
          className="flex items-center justify-center gap-2 cursor-pointer rounded-xl"
          style={{
            padding: "12px",
            minHeight: "var(--tc-touch-min)",
            background: "var(--tc-surface)",
            border: "1px dashed var(--tc-border-strong)",
            color: "var(--tc-text-secondary)",
          }}
        >
          <ImagePlus size={16} />
          <span className="text-[13px] font-semibold">스크린샷 / 사진 첨부</span>
          <input
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              const files = e.target.files;
              if (!files) return;
              for (const f of Array.from(files)) {
                if (f.type.startsWith("image/")) addImage(f);
              }
              e.target.value = "";
            }}
          />
        </label>

        {previews.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {previews.map((src, i) => (
              <div key={i} className="relative rounded-lg overflow-hidden"
                style={{ border: "1px solid var(--tc-border)", aspectRatio: "1/1", background: "var(--tc-surface-soft)" }}>
                <img src={src} alt={`첨부 ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute cursor-pointer"
                  style={{
                    top: 4, right: 4,
                    width: 28, height: 28,
                    borderRadius: 14,
                    background: "rgba(0,0,0,0.6)",
                    color: "#fff",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => submitMut.mutate()}
        disabled={submitMut.isPending || !title.trim()}
        className="flex items-center justify-center gap-2 text-sm font-bold cursor-pointer w-full disabled:opacity-50"
        style={{
          padding: "14px",
          minHeight: "var(--tc-touch-min)",
          borderRadius: "var(--tc-radius)",
          border: "none",
          background: "var(--tc-primary)",
          color: "#fff",
        }}
      >
        <Send size={14} />
        {submitMut.isPending ? "전송 중…" : "보내기"}
      </button>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  padding: "10px 12px",
  minHeight: "var(--tc-touch-min)",
  borderRadius: "var(--tc-radius-sm)",
  border: "1px solid var(--tc-border-strong)",
  background: "var(--tc-surface)",
  color: "var(--tc-text)",
  outline: "none",
};
