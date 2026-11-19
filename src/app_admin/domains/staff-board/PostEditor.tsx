import { useState, type FormEvent, useId } from "react";
import { useMutation } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { boardLabels, savePost, type Category, type Post, type PostRow } from "@/shared/staff/board/api";
import styles from "@/shared/staff/board/StaffBoard.module.css";

export default function PostEditor({ category, post, onClose, onSaved }: {
  category: Category; post?: Post; onClose: () => void; onSaved: (row: PostRow) => void;
}) {
  const formId = useId();
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState("");
  const [discard, setDiscard] = useState(false);
  const save = useMutation({
    mutationFn: () => savePost(category, title.trim(), body.trim(), file, post?.id),
    onSuccess: onSaved,
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (save.isPending) return;
    if (!title.trim() || !body.trim()) { setValidation("제목과 내용을 입력해 주세요."); return; }
    if (file && file.size > 10 * 1024 * 1024) { setValidation("10 MB 이하의 파일을 선택해 주세요."); return; }
    setValidation("");
    save.mutate();
  }
  function close() {
    if (save.isPending) return;
    if (title !== (post?.title ?? "") || body !== (post?.body ?? "") || file) setDiscard(true);
    else onClose();
  }
  return (
    <AdminModal open onClose={close} closeDisabled={save.isPending} noMinimize trapFocus width={580}>
      <ModalHeader title={post ? "글 수정" : `${boardLabels[category]} 글쓰기`} description="같은 학원의 강사와 조교 등 직원에게 보입니다." noIcon />
      <ModalBody>
        <form id={formId} className={styles.form} onSubmit={submit}>
          <label>제목<input required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} disabled={save.isPending} autoFocus /></label>
          <label>내용<textarea required maxLength={20000} rows={7} value={body} onChange={e => setBody(e.target.value)} disabled={save.isPending} /></label>
          {category === "resource" && !post && (
            <label>첨부파일 <small>선택 · 최대 10 MB</small>
              <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} disabled={save.isPending} />
            </label>
          )}
          {validation && <p role="alert" className={styles.error}>{validation}</p>}
          {save.isError && <p role="alert" className={styles.error}>{getApiErrorMessage(save.error, "글을 저장하지 못했습니다. 다시 시도해 주세요.")}</p>}
        </form>
        {discard && <div role="alert" className={styles.discard}>
          <p>작성 중인 내용을 지울까요?</p>
          <Button onClick={() => setDiscard(false)}>계속 작성</Button>
          <Button intent="danger" onClick={onClose}>작성 취소</Button>
        </div>}
      </ModalBody>
      <ModalFooter right={<>
        <Button onClick={close} disabled={save.isPending}>취소</Button>
        <Button intent="primary" form={formId} type="submit" loading={save.isPending}>{post ? "수정 저장" : "등록"}</Button>
      </>} />
    </AdminModal>
  );
}
