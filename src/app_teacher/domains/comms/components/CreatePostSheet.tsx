// PATH: src/app_teacher/domains/comms/components/CreatePostSheet.tsx
// 게시글/공지 작성 바텀시트 — 스코프 선택(전체/강의/차시) 포함
import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchScopeNodes, createPost, uploadPostAttachment, type ScopeNode } from "../api";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import MobileRichEditor from "@teacher/shared/ui/MobileRichEditor";
import { AlertCircle, ChevronDown, Paperclip, X, Bell } from "@teacher/shared/ui/Icons";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";
import api from "@/shared/api/axios";

interface Props {
  open: boolean;
  onClose: () => void;
  postType: string; // "notice" | "board" | "materials"
  postTypeLabel: string; // "공지사항" | "게시글" | "자료"
}

type Scope = "all" | "lecture" | "session";

export default function CreatePostSheet({ open, onClose, postType, postTypeLabel }: Props) {
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [lectureId, setLectureId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [sendNotify, setSendNotify] = useState(false);
  const [notifyMode, setNotifyMode] = useState<"alimtalk" | "sms">("alimtalk");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: scopeNodes } = useQuery({
    queryKey: ["community-scope-nodes"],
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

  const mutation = useMutation({
    mutationFn: async () => {
      const post = await createPost({
        post_type: postType,
        title,
        content,
        node_ids: resolvedNodeIds,
        is_urgent: isUrgent,
      });
      // Upload attachments after post creation
      for (const file of files) {
        await uploadPostAttachment(post.id, file);
      }
      // Send notification message if requested — preview → confirm 2-step
      if (sendNotify) {
        try {
          const previewRes = await api.post("/messaging/manual-notification/preview/", {
            post_id: post.id,
            message_mode: notifyMode,
            node_ids: resolvedNodeIds,
            scope,
          });
          const token = previewRes.data?.preview_token ?? previewRes.data?.token;
          if (token) {
            await api.post("/messaging/manual-notification/confirm/", {
              preview_token: token,
              consent: true,
            });
          } else {
            console.warn("알림 preview_token 미반환", previewRes.data);
          }
        } catch (err) {
          console.warn("알림 발송 실패", err);
          teacherToast.error("게시물은 등록됐으나 알림 발송에 실패했습니다.");
        }
      }
      return post;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-comms"] });
      const notifyMsg = sendNotify ? ` (${notifyMode === "alimtalk" ? "알림톡" : "SMS"} 발송 요청됨)` : "";
      teacherToast.success(`${postTypeLabel}이 등록되었습니다.${notifyMsg}`);
      resetAndClose();
    },
    onError: (e) => teacherToast.error(extractApiError(e, `${postTypeLabel}을 등록하지 못했습니다.`)),
  });

  const resetAndClose = () => {
    setTitle("");
    setContent("");
    setScope("all");
    setLectureId(null);
    setSessionId(null);
    setIsUrgent(false);
    setFiles([]);
    setSendNotify(false);
    setNotifyMode("alimtalk");
    onClose();
  };

  const canSubmit = title.trim().length > 0 && content.trim().length > 0 && !mutation.isPending;

  return (
    <BottomSheet open={open} onClose={resetAndClose} title={`${postTypeLabel} 작성`}>
      <div className="flex flex-col gap-3" style={{ padding: "var(--tc-space-4) 0 var(--tc-space-2)" }}>
        {/* Scope selector */}
        <div>
          <label className="text-[11px] font-semibold block mb-1.5" style={{ color: "var(--tc-text-muted)" }}>공개 범위</label>
          <div className="flex gap-2">
            {(["all", "lecture", "session"] as Scope[]).map((s) => (
              <button
                key={s}
                type="button"
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
          <SelectField label="강의" value={lectureId} onChange={(v) => { setLectureId(v); setSessionId(null); }}
            options={lectures.map((l) => ({ value: l.id, label: l.title }))} placeholder="강의 선택" />
        )}

        {/* Session selector */}
        {scope === "session" && lectureId && (
          <SelectField label="차시" value={sessionId} onChange={setSessionId}
            options={sessions.map((s) => ({ value: s.id, label: s.title }))} placeholder="차시 선택" />
        )}

        {/* Title */}
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>제목</label>
          <input
            type="text"
            value={title}
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
          <MobileRichEditor value={content} onChange={setContent} placeholder="내용을 입력하세요" minHeight={120} />
        </div>

        {/* Urgent toggle (notices only) */}
        {postType === "notice" && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)}
              style={{ accentColor: "var(--tc-danger)" }} />
            <AlertCircle size={14} style={{ color: "var(--tc-danger)" }} />
            <span className="text-[13px] font-medium" style={{ color: "var(--tc-text)" }}>긴급 공지</span>
          </label>
        )}

        {/* Notification send (notices/materials) */}
        {(postType === "notice" || postType === "materials") && (
          <div style={{
            padding: "10px 12px", borderRadius: "var(--tc-radius-sm)",
            border: "1px solid var(--tc-border-subtle)",
            background: sendNotify ? "var(--tc-primary-bg)" : "var(--tc-surface-soft)",
          }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={14} style={{ color: sendNotify ? "var(--tc-primary)" : "var(--tc-text-muted)" }} />
                <div>
                  <div className="text-[13px] font-semibold" style={{ color: "var(--tc-text)" }}>작성 후 알림 발송</div>
                  <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                    {sendNotify ? "공개 범위 대상에 즉시 발송합니다" : "켜면 학생·학부모에게 메시지를 발송합니다"}
                  </div>
                </div>
              </div>
              <button onClick={() => setSendNotify(!sendNotify)} type="button" className="cursor-pointer shrink-0"
                style={{ background: "none", border: "none", padding: 0 }}>
                <div className="w-10 h-5 rounded-full relative"
                  style={{ background: sendNotify ? "var(--tc-primary)" : "var(--tc-border-strong)", transition: "background 150ms" }}>
                  <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow"
                    style={{ left: sendNotify ? 20 : 2, transition: "left 150ms" }} />
                </div>
              </button>
            </div>
            {sendNotify && (
              <div className="flex gap-1.5 mt-2">
                {[["alimtalk", "알림톡"], ["sms", "SMS"]].map(([v, l]) => (
                  <button key={v} onClick={() => setNotifyMode(v as any)} type="button"
                    className="flex-1 text-[11px] font-semibold cursor-pointer"
                    style={{
                      padding: "6px 10px", borderRadius: "var(--tc-radius-sm)",
                      border: `1px solid ${notifyMode === v ? "var(--tc-primary)" : "var(--tc-border)"}`,
                      background: notifyMode === v ? "var(--tc-surface)" : "var(--tc-surface-soft)",
                      color: notifyMode === v ? "var(--tc-primary)" : "var(--tc-text-secondary)",
                    }}>{l}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* File attachments */}
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>첨부파일 (최대 10개)</label>
          <button onClick={() => fileRef.current?.click()} type="button"
            className="flex items-center gap-1.5 text-[12px] font-medium cursor-pointer"
            style={{ padding: "6px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px dashed var(--tc-border-strong)", background: "none", color: "var(--tc-text-secondary)" }}>
            <Paperclip size={13} /> 파일 선택
          </button>
          <input ref={fileRef} type="file" multiple onChange={(e) => {
            const selected = Array.from(e.target.files || []);
            setFiles((prev) => [...prev, ...selected].slice(0, 10));
            if (fileRef.current) fileRef.current.value = "";
          }} style={{ display: "none" }} />
          {files.length > 0 && (
            <div className="flex flex-col gap-1 mt-1.5">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--tc-text-secondary)" }}>
                  <Paperclip size={10} />
                  <span className="flex-1 truncate">{f.name}</span>
                  <span style={{ color: "var(--tc-text-muted)" }}>{(f.size / 1024).toFixed(0)}KB</span>
                  <button onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="flex cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-danger)", padding: 0 }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          onClick={() => mutation.mutate()}
          disabled={!canSubmit}
          className="w-full text-sm font-bold cursor-pointer"
          style={{
            padding: "12px",
            borderRadius: "var(--tc-radius)",
            border: "none",
            background: canSubmit ? "var(--tc-primary)" : "var(--tc-surface-soft)",
            color: canSubmit ? "#fff" : "var(--tc-text-muted)",
            marginTop: 4,
          }}
        >
          {mutation.isPending ? "작성 중..." : `${postTypeLabel} 등록`}
        </button>

      </div>
    </BottomSheet>
  );
}

/* Select dropdown styled for mobile */
function SelectField({ label, value, onChange, options, placeholder }: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  options: { value: number; label: string }[];
  placeholder: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>{label}</label>
      <div className="relative">
        <select
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
        <ChevronDown size={14} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--tc-text-muted)", pointerEvents: "none" }} />
      </div>
    </div>
  );
}
