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
  createDeveloperCommunityPost,
  uploadDeveloperPostAttachments,
} from "../api/communityFeedback";
import {
  PATCH_NOTES,
  type PatchNote,
  type NoteCategory,
} from "@/shared/product/patchNotesData";
import { teacherDeveloperQueryKeys } from "../queryKeys";
import styles from "./DeveloperPages.module.css";

const CATEGORY_LABEL: Record<NoteCategory, string> = {
  new: "신규",
  improve: "개선",
  fix: "수정",
  security: "안정성",
};

const CATEGORY_TONE: Record<NoteCategory, "success" | "danger" | "warning" | "info"> = {
  new: "info",
  fix: "success",
  improve: "info",
  security: "warning",
};

const CATEGORY_ORDER: NoteCategory[] = ["new", "improve", "fix", "security"];

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

      <div className={styles.releaseIntro}>
        <span className={styles.releaseEyebrow}>운영 릴리스 장부</span>
        <strong>운영에 반영된 변경만 기록합니다.</strong>
        <p>봉인된 릴리스 문서와 배포 검증 결과를 기준으로 최근 변경을 정리했습니다.</p>
        <div className={styles.releaseCurrent}>
          <span>현재 기준</span>
          <b>{PATCH_NOTES[0].version}</b>
          <span>{PATCH_NOTES[0].date}</span>
          <Badge tone="success" size="xs">운영 반영</Badge>
        </div>
      </div>

      <div className={styles.releaseListHead}>
        <strong>최근 운영 릴리스</strong>
        <span>최신순 · {PATCH_NOTES.length}건</span>
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
              aria-label={`${note.version} ${note.codename} 상세 보기`}
            >
              <div className={styles.noteMeta}>
                <span className={styles.noteDate}>{note.date}</span>
                <span className={styles.noteVersion}>{note.version}</span>
                {isLatest && <Badge tone="primary" size="xs">최신</Badge>}
                <span className={styles.noteStatus}>운영 반영</span>
              </div>
              <div className={styles.noteTitle}>
                {note.codename}
              </div>
              <p className={styles.noteSummary}>
                {note.summary}
              </p>
              <div className={styles.noteTags}>
                {CATEGORY_ORDER.map((k) =>
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
          <div className={styles.sheetContent}>
            <div className={styles.sheetMeta}>
              <span>{selected.version}</span>
              <span>{selected.date}</span>
              <Badge tone="success" size="xs">운영 반영</Badge>
            </div>
            <div className={styles.sheetSummary}>
              {selected.summary}
            </div>
            {CATEGORY_ORDER.map((category) => {
              const entries = selected.entries.filter((entry) => entry.category === category);
              if (entries.length === 0) return null;
              return (
                <section key={category} className={styles.sheetSection}>
                  <div className={styles.sheetSectionTitle}>
                    <Badge tone={CATEGORY_TONE[category]} size="xs">
                      {CATEGORY_LABEL[category]}
                    </Badge>
                    <span>{entries.length}건</span>
                  </div>
                  <ul>
                    {entries.map((entry) => <li key={entry.text}>{entry.text}</li>)}
                  </ul>
                </section>
              );
            })}
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
      const post = await createDeveloperCommunityPost({
        post_type: "board",
        title: `${titlePrefix} ${title.trim()}`,
        content: content.trim(),
        node_ids: [],
      });
      if (images.length > 0) {
        await uploadDeveloperPostAttachments(post.id, images);
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
      qc.invalidateQueries({ queryKey: teacherDeveloperQueryKeys.posts });
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
