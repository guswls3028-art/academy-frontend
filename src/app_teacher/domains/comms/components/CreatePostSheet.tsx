// PATH: src/app_teacher/domains/comms/components/CreatePostSheet.tsx
// 게시글/공지 작성 바텀시트 — 스코프 선택(전체/강의/차시) 포함
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchScopeNodes, createPost, type ScopeNode } from "../api";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { AlertCircle, ChevronDown } from "@teacher/shared/ui/Icons";

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
    mutationFn: () => createPost({
      post_type: postType,
      title,
      content,
      node_ids: resolvedNodeIds,
      is_urgent: isUrgent,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-comms"] });
      resetAndClose();
    },
  });

  const resetAndClose = () => {
    setTitle("");
    setContent("");
    setScope("all");
    setLectureId(null);
    setSessionId(null);
    setIsUrgent(false);
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

        {/* Content */}
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>내용</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력하세요"
            rows={6}
            className="w-full text-sm"
            style={{
              padding: "8px 10px", borderRadius: "var(--tc-radius-sm)",
              border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)",
              color: "var(--tc-text)", outline: "none", resize: "vertical",
            }}
          />
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

        {mutation.isError && (
          <div className="text-[12px] text-center" style={{ color: "var(--tc-danger)" }}>
            작성에 실패했습니다. 다시 시도해주세요.
          </div>
        )}
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
