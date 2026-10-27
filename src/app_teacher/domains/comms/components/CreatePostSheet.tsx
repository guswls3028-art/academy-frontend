/* eslint-disable no-restricted-syntax */
// PATH: src/app_teacher/domains/comms/components/CreatePostSheet.tsx
// 게시글/공지 작성 바텀시트 — 스코프 선택(전체/강의/차시) 포함
// R-11: 기존 인라인 style baseline. 마이그레이션은 별도 백로그.
import { useState, useMemo, useRef } from "react";
import { ICON } from "@/shared/ui/ds";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchScopeNodes, createPost, uploadPostAttachments } from "../api";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import MobileRichEditor from "@teacher/shared/ui/MobileRichEditor";
import { AlertCircle, ChevronDown, Paperclip, X } from "@teacher/shared/ui/Icons";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";
import { useConfirm } from "@/shared/ui/confirm";
import { richHtmlToPlainText } from "@/shared/utils/richHtml";
import { teacherCommsQueryKeys } from "../queryKeys";
import { createClientRequestKey } from "@/shared/api/contracts/community";
import { selectCommunityFiles } from "@/shared/utils/selectCommunityFiles";
interface Props {
  open: boolean;
  onClose: () => void;
  postType: string; // "notice" | "board" | "materials"
  postTypeLabel: string; // "공지사항" | "게시글" | "자료"
}

type Scope = "all" | "lecture" | "session";

function htmlToVisibleText(html: string): string {
  return richHtmlToPlainText(html);
}

export default function CreatePostSheet({ open, onClose, postType, postTypeLabel }: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [lectureId, setLectureId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const createdPost = useRef<number | null>(null);
  const uploadKey = useRef<string | null>(null);
  const submitting = useRef(false);
  const [createdPostId, setCreatedPostId] = useState<number | null>(null);
  const [pendingUpload, setPendingUpload] = useState(false);

  const { data: scopeNodes } = useQuery({
    queryKey: teacherCommsQueryKeys.scopeNodes,
    queryFn: fetchScopeNodes,
    enabled: open,
  });

  // Derive unique lectures from scope nodes
  const lectures = useMemo(() => {
    if (!scopeNodes) return [];
    const map = new Map<number, string>();
    for (const n of scopeNodes) {
      if (!map.has(n.lecture)) map.set(n.lecture, n.lecture_title);
    }
    return Array.from(map, ([id, title]) => ({ id, title }));
  }, [scopeNodes]);

  // Derive sessions for selected lecture
  const sessions = useMemo(() => {
    if (!scopeNodes || !lectureId) return [];
    return scopeNodes
      .filter((n) => n.lecture === lectureId && n.session != null)
      .map((n) => ({ id: n.session!, title: n.session_title || `차시 ${n.session}` }));
  }, [scopeNodes, lectureId]);

  // Resolve node_ids based on scope selection
  const resolvedNodeIds = useMemo(() => {
    if (!scopeNodes) return [];
    if (scope === "all") return []; // Global scope — no node_ids
    if (scope === "lecture" && lectureId) {
      const node = scopeNodes.find((n) => n.lecture === lectureId && n.session == null);
      return node ? [node.id] : [];
    }
    if (scope === "session" && lectureId && sessionId) {
      const node = scopeNodes.find((n) => n.lecture === lectureId && n.session === sessionId);
      return node ? [node.id] : [];
    }
    return [];
  }, [scopeNodes, scope, lectureId, sessionId]);
  const scopeReady = scope === "all" || resolvedNodeIds.length > 0;
  const contentText = useMemo(() => htmlToVisibleText(content), [content]);
  const hasDraft =
    title.trim().length > 0 ||
    contentText.length > 0 ||
    files.length > 0 ||
    isUrgent ||
    scope !== "all" ||
    lectureId !== null ||
    sessionId !== null;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!scopeReady) {
        throw new Error("공개 범위를 선택하세요.");
      }
      if (contentText.length === 0) {
        throw new Error("내용을 입력하세요.");
      }
      if (createdPost.current == null) {
        const post = await createPost({ post_type: postType, title: title.trim(), content, node_ids: resolvedNodeIds, is_urgent: isUrgent });
        createdPost.current = post.id;
        setCreatedPostId(post.id);
      }
      if (files.length) {
        uploadKey.current ??= createClientRequestKey();
        setPendingUpload(true);
        try {
          await uploadPostAttachments(createdPost.current, files, uploadKey.current);
        } catch (error) {
          if ((error as { response?: { status?: number } }).response?.status === 400) {
            uploadKey.current = null;
            setPendingUpload(false);
          }
          throw error;
        }
      }
      return { id: createdPost.current };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teacherCommsQueryKeys.posts });
      teacherToast.success(`${postTypeLabel}이 등록되었습니다.`);
      resetAndClose();
    },
    onError: (e) => teacherToast.error(extractApiError(e, `${postTypeLabel}을 등록하지 못했습니다.`)),
    onSettled: () => { submitting.current = false; },
  });

  const resetAndClose = () => {
    setTitle("");
    setContent("");
    setScope("all");
    setLectureId(null);
    setSessionId(null);
    setIsUrgent(false);
    setFiles([]);
    createdPost.current = null;
    uploadKey.current = null;
    setCreatedPostId(null);
    setPendingUpload(false);
    mutation.reset();
    onClose();
  };

  const requestClose = async () => {
    if (mutation.isPending) return;
    if (hasDraft) {
      const ok = await confirm({
        title: "작성 취소",
        message: createdPostId == null ? "입력한 내용과 첨부파일 선택이 사라집니다. 닫을까요?" : "글은 이미 저장되어 있습니다. 첨부 재시도를 종료하고 닫을까요?",
        confirmText: "닫기",
        cancelText: "계속 작성",
        danger: true,
      });
      if (!ok) return;
    }
    if (createdPostId != null) void qc.invalidateQueries({ queryKey: teacherCommsQueryKeys.posts });
    resetAndClose();
  };

  const canSubmit = title.trim().length > 0 && contentText.length > 0 && scopeReady && !mutation.isPending;
  const contentLocked = mutation.isPending || createdPostId != null;
  const filesLocked = mutation.isPending || pendingUpload;
  const addFiles = (incoming: File[]) => {
    if (!filesLocked) setFiles(selectCommunityFiles(files, incoming));
  };

  return (
    <BottomSheet open={open} onClose={() => void requestClose()} title={`${postTypeLabel} 작성`}>
      <div className="flex flex-col gap-3" style={{ padding: "var(--tc-space-4) 0 var(--tc-space-2)" }}>
        {/* Scope selector */}
        <div>
          <label className="text-[11px] font-semibold block mb-1.5" style={{ color: "var(--tc-text-muted)" }}>공개 범위</label>
          <div className="flex gap-2">
            {(["all", "lecture", "session"] as Scope[]).map((s) => (
              <button
                key={s}
                type="button"
                disabled={contentLocked}
                onClick={() => { setScope(s); if (s === "all") { setLectureId(null); setSessionId(null); } if (s === "lecture") setSessionId(null); }}
                className="text-[12px] font-semibold cursor-pointer"
                style={{
                  flex: 1,
                  padding: "8px 6px",
                  borderRadius: "var(--tc-radius)",
                  border: scope === s ? "2px solid var(--tc-primary)" : "1px solid var(--tc-border)",
                  background: scope === s ? "var(--tc-primary-bg)" : "var(--tc-surface-soft)",
                  color: scope === s ? "var(--tc-primary)" : "var(--tc-text-secondary)",
                  textAlign: "center",
                }}
              >
                {s === "all" ? "전체" : s === "lecture" ? "강의별" : "차시별"}
              </button>
            ))}
          </div>
        </div>

        {/* Lecture selector */}
        {(scope === "lecture" || scope === "session") && (
          <SelectField label="강의" value={lectureId} disabled={contentLocked} onChange={(v) => { setLectureId(v); setSessionId(null); }}
            options={lectures.map((l) => ({ value: l.id, label: l.title }))} placeholder="강의 선택" />
        )}

        {/* Session selector */}
        {scope === "session" && lectureId && (
          <SelectField label="차시" value={sessionId} disabled={contentLocked} onChange={setSessionId}
            options={sessions.map((s) => ({ value: s.id, label: s.title }))} placeholder="차시 선택" />
        )}

        {/* Title */}
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>제목</label>
          <input
            type="text"
            value={title}
            readOnly={contentLocked}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`${postTypeLabel} 제목`}
            className="w-full text-sm"
            style={{
              padding: "8px 10px", borderRadius: "var(--tc-radius-sm)",
              border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)",
              color: "var(--tc-text)", outline: "none",
            }}
          />
        </div>

        {/* Content — Rich Text Editor */}
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>내용</label>
          <MobileRichEditor value={content} onChange={setContent} onFileAttach={addFiles} readOnly={contentLocked} placeholder="내용을 입력하세요" minHeight={120} />
        </div>

        {/* Urgent toggle (notices only) */}
        {postType === "notice" && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isUrgent} disabled={contentLocked} onChange={(e) => setIsUrgent(e.target.checked)}
              style={{ accentColor: "var(--tc-danger)" }} />
            <AlertCircle size={ICON.xs} style={{ color: "var(--tc-danger)" }} />
            <span className="text-[13px] font-medium" style={{ color: "var(--tc-text)" }}>긴급 공지</span>
          </label>
        )}

        {/* File attachments */}
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>첨부파일 (최대 10개)</label>
          <button onClick={() => fileRef.current?.click()} type="button" disabled={filesLocked || files.length >= 10}
            className="flex items-center gap-1.5 text-[12px] font-medium cursor-pointer"
            style={{ padding: "6px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px dashed var(--tc-border-strong)", background: "none", color: "var(--tc-text-secondary)" }}>
            <Paperclip size={ICON.sm} /> 파일 선택
          </button>
          <input ref={fileRef} type="file" multiple disabled={filesLocked} onChange={(e) => {
            const selected = Array.from(e.target.files || []);
            addFiles(selected);
            if (fileRef.current) fileRef.current.value = "";
          }} style={{ display: "none" }} />
          {files.length > 0 && (
            <div className="flex flex-col gap-1 mt-1.5">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--tc-text-secondary)" }}>
                  <Paperclip size={10} />
                  <span className="flex-1 truncate">{f.name}</span>
                  <span style={{ color: "var(--tc-text-muted)" }}>{(f.size / 1024).toFixed(0)}KB</span>
                  <button type="button" disabled={filesLocked} aria-label={`${f.name} 제거`} onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="flex cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-danger)", padding: 0 }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        {createdPostId != null && <p role="status" className="text-sm">글은 저장되었습니다. 첨부파일만 다시 시도할 수 있습니다.</p>}
        {mutation.error && <p role="alert" className="text-sm">{extractApiError(mutation.error, "첨부파일을 저장하지 못했습니다. 선택한 파일은 유지됩니다.")}</p>}
        <button
          onClick={() => { if (canSubmit && !submitting.current) { submitting.current = true; mutation.mutate(); } }}
          disabled={!canSubmit}
          className="w-full text-sm font-bold cursor-pointer"
          style={{
            padding: "12px",
            borderRadius: "var(--tc-radius)",
            border: "none",
            background: canSubmit ? "var(--tc-primary)" : "var(--tc-surface-soft)",
            color: canSubmit ? "var(--tc-primary-contrast)" : "var(--tc-text-muted)",
            marginTop: 4,
          }}
        >
          {mutation.isPending ? "작성 중..." : createdPostId != null ? "첨부 다시 시도" : `${postTypeLabel} 등록`}
        </button>

      </div>
    </BottomSheet>
  );
}

/* Select dropdown styled for mobile */
function SelectField({ label, value, onChange, options, placeholder, disabled }: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  options: { value: number; label: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>{label}</label>
      <div className="relative">
        <select
          disabled={disabled}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          className="w-full text-sm appearance-none"
          style={{
            padding: "8px 30px 8px 10px", borderRadius: "var(--tc-radius-sm)",
            border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)",
            color: value ? "var(--tc-text)" : "var(--tc-text-muted)", outline: "none",
          }}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown size={ICON.xs} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--tc-text-muted)", pointerEvents: "none" }} />
      </div>
    </div>
  );
}
