import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Badge, Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import RichTextEditor from "@/shared/ui/editor/RichTextEditor";
import { createPost, resolvePostNodeIdsForCreate, type CommunityScopeParams, type ScopeNodeMinimal } from "../api/community.api";
import { usePostAttachmentBatch } from "../hooks/usePostAttachmentBatch";
import { NoticeDraftFiles } from "./NoticeAttachments";
import "../notice-attachments.css";

export default function PostCreatePane({ postType, scopeNodes, scopeParams, onCancel, onSuccess }: {
  postType: "board" | "materials";
  scopeNodes: ScopeNodeMinimal[];
  scopeParams: CommunityScopeParams;
  onCancel: () => void;
  onSuccess: (postId: number) => void;
}) {
  const confirm = useConfirm();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [createdId, setCreatedId] = useState<number | null>(null);
  const created = useRef<number | null>(null);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const batch = usePostAttachmentBatch();
  const resolvedScope = useMemo(() => resolvePostNodeIdsForCreate(scopeNodes, scopeParams), [scopeNodes, scopeParams]);
  const label = postType === "materials" ? "자료" : "게시물";
  const scopeLabel = scopeParams.scope === "session"
    ? scopeNodes.find((node) => node.lecture === scopeParams.lectureId && node.session === scopeParams.sessionId)?.session_title ?? "선택된 차시"
    : scopeParams.scope === "lecture"
      ? scopeNodes.find((node) => node.lecture === scopeParams.lectureId)?.lecture_title ?? "선택된 강의" : "전체 대상";
  const dirty = Boolean(title || content || batch.files.length);
  const locked = busy || createdId != null;
  useEffect(() => {
    if (!dirty) return;
    const preventExit = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventExit);
    return () => window.removeEventListener("beforeunload", preventExit);
  }, [dirty]);
  const cancel = async () => {
    if (saving.current) return;
    if (dirty && !await confirm({ title: "작성 취소", message: created.current == null ? "작성 중인 내용과 파일 선택을 취소할까요?" : "글은 이미 저장되어 있습니다. 첨부 재시도를 종료하고 돌아갈까요?", confirmText: "돌아가기" })) return;
    if (created.current != null) onSuccess(created.current);
    else onCancel();
  };
  const submit = async () => {
    if (saving.current || !title.trim() || resolvedScope.kind === "invalid") return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      if (created.current == null) {
        const post = await createPost({ post_type: postType, title: title.trim(), content, node_ids: resolvedScope.nodeIds });
        created.current = post.id;
        setCreatedId(post.id);
      }
      await batch.upload(created.current);
      onSuccess(created.current);
    } catch (cause) {
      const message = getApiErrorMessage(cause, "등록에 실패했습니다. 다시 시도해 주세요.");
      setError(created.current == null ? message : `게시물은 저장됐지만 첨부파일 등록에 실패했습니다. 선택한 파일은 유지됩니다. ${message}`);
    } finally { saving.current = false; setBusy(false); }
  };
  return <>
    <header className="qna-inbox__thread-header"><div className="qna-inbox__thread-title-row">
      <div className="qna-inbox__thread-title-group">
        <h1 className="qna-inbox__thread-title">{postType === "materials" ? "새 자료 등록" : "새 게시물 작성"}</h1>
        <div className="qna-inbox__thread-meta"><Badge tone="primary">대상: {scopeLabel}</Badge></div>
        <p className="cms-attach__hint">{scopeParams.scope === "all" ? "전체 학생에게 보입니다." : `${scopeLabel} 학생에게만 보입니다.`}</p>
      </div>
      <div className="qna-inbox__thread-actions"><Button intent="secondary" size="sm" disabled={busy} onClick={() => void cancel()}>취소</Button></div>
    </div></header>
    <div className="cms-form__body">
      <div className="cms-form__field"><label className="community-field__label community-field__label--required">제목</label>
        <input className="ds-input cms-form__input--full" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`${label} 제목을 입력하세요`} readOnly={locked} autoFocus />
      </div>
      <div className="cms-form__field"><label className="community-field__label">내용</label>
        <RichTextEditor value={content} onChange={setContent} onFileAttach={batch.add} placeholder="내용을 입력하세요..." minHeight={250} readOnly={locked} />
      </div>
      <div className="cms-form__field">
        <div className="cms-attach__header"><label className="community-field__label cms-form__label--no-margin">첨부파일 ({batch.files.length}/10)</label>
          {postType !== "materials" && <Button intent="ghost" size="sm" disabled={busy || batch.locked || batch.files.length >= 10} onClick={() => input.current?.click()}>+ 파일 추가</Button>}
          <label htmlFor={inputId} className={postType === "materials" ? "ds-button cms-attach__picker" : "cms-form__file-input--hidden"} data-intent="ghost" data-size="sm" data-disabled={busy || batch.locked || batch.files.length >= 10 ? "true" : "false"}>
          {postType === "materials" && <span className="ds-button__label">+ 파일 추가</span>}
          <input id={inputId} ref={input} type="file" multiple className={postType === "materials" ? "cms-attach__picker-input" : "cms-form__file-input--hidden"} aria-label="첨부할 파일 선택" disabled={busy || batch.locked || batch.files.length >= 10} onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            batch.add(files);
          }} />
          </label>
        </div>
        <NoticeDraftFiles files={batch.files} disabled={busy || batch.locked} onRemove={batch.remove} />
        {batch.locked && <p className="cms-attach__hint">게시물이 이미 저장되어 첨부파일을 변경할 수 없습니다. 같은 파일로 다시 시도해 주세요.</p>}
      </div>
      {error && <p role="alert" className="community-field__error">{error}</p>}
      <div className="cms-form__actions">
        <Button intent="secondary" size="sm" disabled={busy} onClick={() => void cancel()}>취소</Button>
        <Button intent="primary" size="sm" disabled={busy || !title.trim() || resolvedScope.kind === "invalid"} onClick={() => void submit()}>{busy ? createdId ? "첨부 재시도 중…" : "등록 중…" : createdId ? "첨부 다시 시도" : "등록"}</Button>
      </div>
    </div>
  </>;
}
