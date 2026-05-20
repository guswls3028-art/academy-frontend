// PATH: src/app_teacher/domains/developer/pages/DeveloperPages.tsx
// To개발자 — 패치노트 · 버그 제보 · 피드백 (모바일)
import { useState, useEffect, useRef } from "react";
import { ICON } from "@/shared/ui/ds";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, BackButton } from "@teacher/shared/ui/Card";
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
import styles from "./DeveloperPages.module.css";

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
        <h1 className={`${styles.title} text-[17px] font-bold flex-1`}>패치노트</h1>
      </div>

      <div className="flex flex-col gap-2">
        {PATCH_NOTES.map((note, i) => {
          const counts = { new: 0, fix: 0, improve: 0, security: 0 };
          note.entries.forEach((e) => counts[e.category]++);
          const isLatest = i === 0;
          return (
            <button
              type="button"
              key={note.version}
              onClick={() => setSelected(note)}
              className={`${styles.noteButton} ${isLatest ? styles.latestNoteButton : ""} flex flex-col items-start text-left cursor-pointer rounded-xl`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`${styles.primaryText} text-sm font-bold`}>
                  {note.version}
                </span>
                {isLatest && <Badge tone="primary" size="xs">LATEST</Badge>}
                <span className={`${styles.mutedText} text-[11px] ml-auto`}>
                  {note.date}
                </span>
              </div>
              <div className={`${styles.primaryText} text-[13px] font-semibold mt-1`}>
                {note.codename}
              </div>
              <p className={`${styles.mutedText} text-[12px] mt-0.5 leading-snug`}>
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
            <div className={`${styles.mutedText} text-[11px]`}>
              {selected.date}
            </div>
            <div className={`${styles.secondaryText} text-[13px] leading-relaxed`}>
              {selected.summary}
            </div>
            <div className="flex flex-col gap-1.5 mt-2">
              {selected.entries.map((e, idx) => (
                <div
                  key={idx}
                  className={`${styles.patchEntry} flex items-start gap-2 rounded-lg`}
                >
                  <Badge tone={CATEGORY_TONE[e.category]} size="xs">
                    {CATEGORY_LABEL[e.category]}
                  </Badge>
                  <span className={`${styles.primaryText} text-[13px] leading-snug`}>
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
  const previewUrlsRef = useRef<string[]>([]);

  const isBug = kind === "bug";
  const heading = isBug ? "버그 제보" : "피드백";
  const titlePrefix = isBug ? "[BUG]" : "[FEEDBACK]";
  const placeholder = isBug
    ? "어떤 버그인지 간단히 (예: 출석 저장이 안 됩니다)"
    : "제목 (예: 바로가기에 수납 추가 요청)";

  const addImage = (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    previewUrlsRef.current = [...previewUrlsRef.current, previewUrl];
    setImages((p) => [...p, file]);
    setPreviews((p) => [...p, previewUrl]);
  };

  const removeImage = (idx: number) => {
    const previewUrl = previewUrlsRef.current[idx];
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrlsRef.current = previewUrlsRef.current.filter((_, i) => i !== idx);
    setPreviews((p) => p.filter((_, i) => i !== idx));
    setImages((p) => p.filter((_, i) => i !== idx));
  };

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach(URL.revokeObjectURL);
      previewUrlsRef.current = [];
    };
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
      previewUrlsRef.current.forEach(URL.revokeObjectURL);
      previewUrlsRef.current = [];
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
        <h1 className={`${styles.title} text-[17px] font-bold flex-1`}>
          {heading}
        </h1>
      </div>

      <Card>
        <div className={`${styles.mutedText} text-[12px] leading-relaxed`}>
          {isBug
            ? "버그가 발생한 화면의 스크린샷을 함께 첨부해 주세요."
            : "불편한 점이나 개선 아이디어를 자유롭게 보내 주세요."}
        </div>
      </Card>

      <div>
        <label className={`${styles.mutedText} text-[11px] font-semibold block mb-1`}>
          제목
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={placeholder}
          className={`${styles.field} w-full text-sm`}
        />
      </div>

      <div>
        <label className={`${styles.mutedText} text-[11px] font-semibold block mb-1`}>
          상세 내용
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={isBug ? "언제·무엇을 했을 때 어떤 현상이 나타났는지" : "자유롭게 작성해 주세요"}
          rows={6}
          className={`${styles.field} ${styles.textarea} w-full text-sm`}
        />
      </div>

      {/* 이미지 업로드 */}
      <div className="flex flex-col gap-2">
        <label
          className={`${styles.uploadLabel} flex items-center justify-center gap-2 cursor-pointer rounded-xl`}
        >
          <ImagePlus size={ICON.sm} />
          <span className="text-[13px] font-semibold">스크린샷 / 사진 첨부</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className={styles.hiddenInput}
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
              <div key={src} className={`${styles.previewItem} relative rounded-lg overflow-hidden`}>
                <img src={src} alt={`첨부 ${i + 1}`} className={styles.previewImage} />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className={`${styles.removeImageButton} absolute cursor-pointer`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => submitMut.mutate()}
        disabled={submitMut.isPending || !title.trim()}
        className={`${styles.submitButton} flex items-center justify-center gap-2 text-sm font-bold cursor-pointer w-full disabled:opacity-50`}
      >
        <Send size={ICON.xs} />
        {submitMut.isPending ? "전송 중…" : "보내기"}
      </button>
    </div>
  );
}
