import { useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, FileText, MessageCircle, Paperclip, Pencil } from "lucide-react";
import { Button, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { DomainLayout } from "@/shared/ui/layout";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { addReply, boardDate, boardKeys, boardLabels, boardRoot, boardTabs, downloadAttachment, removeAttachment,
  useBoardList, useBoardPost, useBoardScope, type BoardScope, type Category, type Post, type PostRow } from "@/shared/staff/board/api";
import PostEditor from "./PostEditor";
import styles from "@/shared/staff/board/StaffBoard.module.css";
import { createRandomUuid } from "@/shared/utils/randomUuid";

export default function StaffBoardPage() {
  const { category, postId } = useParams();
  const scope = useBoardScope();
  if (!category || !boardTabs.some(tab => tab.key === category)) return <Navigate replace to={boardTabs[0].path} />;
  if (postId && !/^[1-9]\d*$/.test(postId)) return <Navigate replace to={`${boardRoot}/${category}`} />;
  return <BoardScreen key={JSON.stringify([...scope, category, postId])}
    scope={scope} category={category as Category} id={postId ? Number(postId) : undefined} />;
}

function BoardScreen({ scope, category, id }: { scope: BoardScope; category: Category; id?: number }) {
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [editor, setEditor] = useState<Post | "new" | null>(null);
  function saved(row: PostRow) {
    void cache.invalidateQueries({ queryKey: scope });
    setEditor(null);
    navigate(`${boardRoot}/${row.category}/${row.id}`);
  }
  return (
    <DomainLayout title="교직원 게시판" description="같은 학원의 강사와 조교 등 직원끼리 공지와 자료를 공유합니다."
      tabs={boardTabs} headerActions={!id && <Button intent="primary" leftIcon={<Pencil size={ICON_FOR_BUTTON.md} />}
        onClick={() => setEditor("new")}>글쓰기</Button>}>
      {id ? <PostDetail scope={scope} id={id} category={category} onEdit={setEditor} />
        : <PostList scope={scope} category={category} />}
      {editor && <PostEditor category={category} post={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} onSaved={saved} />}
    </DomainLayout>
  );
}

function PostList({ scope, category }: { scope: BoardScope; category: Category }) {
  const [params, setParams] = useSearchParams();
  const requestedPage = Number(params.get("page"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const query = useBoardList(scope, category, page);
  if (query.isError) return <div className={styles.state} role="alert"><p>게시글 목록을 불러오지 못했습니다.</p><Button onClick={() => void query.refetch()}>다시 시도</Button>
    {page > 1 && <Button onClick={() => setParams({})}>첫 페이지</Button>}</div>;
  if (!query.data) return <p role="status" className={styles.state}>게시글을 불러오는 중입니다.</p>;
  const { count, previous, next, results } = query.data;
  return (
    <section className={styles.sheet} aria-label={boardLabels[category]}>
      <header className={styles.sheetHeader}><h2>{boardLabels[category]}</h2><span>{count.toLocaleString("ko-KR")}건</span></header>
      {results.length ? <ul className={styles.rows}>
        {results.map(post => (
          <li key={post.id}><Link to={`${boardRoot}/${category}/${post.id}${page > 1 ? "?page=" + page : ""}`}>
            <div className={styles.rowTitle}><strong>{post.title}</strong>
              {post.attachment_name && <Paperclip size={ICON.xs} aria-label="첨부파일 있음" />}
              {post.reply_count > 0 && <span className={styles.replyCount} aria-label={`댓글 ${post.reply_count}개`}><MessageCircle size={ICON.xs} />{post.reply_count}</span>}
            </div>
            <span className={styles.meta}>{post.author_name} · <time dateTime={post.created_at}>{boardDate(post.created_at)}</time></span>
          </Link></li>
        ))}
      </ul> : <div className={styles.empty}><FileText size={ICON.xl} aria-hidden="true" />
        <p>아직 등록된 글이 없습니다.</p><span>글쓰기를 눌러 첫 글을 남겨 보세요.</span></div>}
      {(previous || next) && <nav className={styles.pagination} aria-label="목록 페이지">
        <Button size="sm" disabled={!previous} onClick={() => setParams(page === 2 ? {} : { page: String(page - 1) })}>이전</Button>
        <span>{page} / {Math.ceil(count / 20)}</span>
        <Button size="sm" disabled={!next} onClick={() => setParams({ page: String(page + 1) })}>다음</Button>
      </nav>}
    </section>
  );
}

function PostDetail({ scope, category, id, onEdit }: {
  scope: BoardScope; category: Category; id: number; onEdit: (post: Post) => void;
}) {
  const [params] = useSearchParams();
  const cache = useQueryClient();
  const post = useBoardPost(scope, id);
  const confirm = useConfirm();
  const [text, setText] = useState("");
  const replyAttempt = useRef<{ body: string; key: string } | null>(null);
  const reply = useMutation({
    mutationFn: ({ body, key }: NonNullable<typeof replyAttempt.current>) => addReply(id, body, key),
    onSuccess: (created) => {
      cache.setQueryData<Post>(boardKeys.detail(scope, id), current => !current || current.replies.some(r => r.id === created.id)
        ? current : { ...current, replies: [...current.replies, created], reply_count: current.reply_count + 1 });
      void cache.invalidateQueries({ queryKey: scope });
      replyAttempt.current = null;
      setText("");
    },
  });
  const download = useMutation({ mutationFn: (filename: string) => downloadAttachment(id, filename) });
  const remove = useMutation({
    mutationFn: () => removeAttachment(id),
    onSuccess: () => {
      cache.setQueryData<Post>(boardKeys.detail(scope, id), current => current && {
        ...current, attachment_name: "", can_remove_attachment: false,
      });
      void cache.invalidateQueries({ queryKey: scope });
    },
  });

  async function confirmAttachmentRemoval(filename: string) {
    const accepted = await confirm({
      title: "첨부파일 제거",
      message: `${filename} 파일을 제거할까요? 게시글과 댓글은 그대로 남습니다.`,
      confirmText: "첨부파일 제거",
      danger: true,
    });
    if (accepted) remove.mutate();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body || reply.isPending) return;
    const previous = replyAttempt.current;
    const submission = previous?.body === body ? previous : { body, key: createRandomUuid() };
    replyAttempt.current = submission;
    reply.mutate(submission);
  }
  const data = post.data;
  const listUrl = `${boardRoot}/${category}${params.has("page") ? "?page=" + encodeURIComponent(params.get("page")!) : ""}`;
  if (data && data.category !== category) return <Navigate replace to={`${boardRoot}/${data.category}/${id}`} />;
  return (
    <div className={styles.detail}>
      <Link className={styles.back} to={listUrl}><ArrowLeft size={ICON.sm} />{boardLabels[category]} 목록</Link>
      {post.isError ? <div className={styles.state} role="alert"><p>글을 불러오지 못했습니다. 접근 권한이나 게시글 상태를 확인해 주세요.</p>
        <Button onClick={() => void post.refetch()}>다시 시도</Button></div>
        : !data ? <p className={styles.state} role="status">글을 불러오는 중입니다.</p> : (
          <>
            <article className={styles.article}>
              <header><h2>{data.title}</h2>
                <div className={styles.byline}><span className={styles.meta}>{data.author_name} · <time dateTime={data.created_at}>{boardDate(data.created_at)}</time></span>
                  {data.can_edit && <Button size="sm" onClick={() => onEdit(data)}>글 수정</Button>}</div>
              </header>
              <p className={styles.content}>{data.body}</p>
              {data.attachment_name && <div className={styles.attachment}>
                <div className={styles.attachmentActions}>
                  <Button leftIcon={<Download size={ICON_FOR_BUTTON.md} />} loading={download.isPending}
                    disabled={remove.isPending} onClick={() => download.mutate(data.attachment_name)}>
                    {data.attachment_name} 다운로드
                  </Button>
                  {data.can_remove_attachment && (
                    <Button intent="secondary" loading={remove.isPending} disabled={download.isPending}
                      onClick={() => void confirmAttachmentRemoval(data.attachment_name)}>첨부파일 제거</Button>
                  )}
                </div>
                {download.isError && <p role="alert" className={styles.error}>파일을 받지 못했습니다. 다운로드를 다시 눌러 주세요.</p>}
                {remove.isError && <p role="alert" className={styles.error}>첨부파일을 제거하지 못했습니다. 다시 시도해 주세요.</p>}
              </div>}
              {remove.isSuccess && !data.attachment_name && <p role="status">첨부파일을 제거했습니다.</p>}
            </article>
            <section className={styles.replies} aria-label="댓글"><h2>댓글 <span>{data.replies.length}</span></h2>
              <ul>{data.replies.map(item => <li key={item.id}>
                <div className={styles.meta}><strong>{item.author_name}</strong> · <time dateTime={item.created_at}>{boardDate(item.created_at)}</time></div>
                <p className={styles.content}>{item.body}</p>
              </li>)}</ul>
              <form className={styles.form} onSubmit={submit}>
                <label><span className={styles.srOnly}>댓글 내용</span><textarea rows={2} required maxLength={5000} placeholder="댓글을 남겨 주세요."
                  value={text} onChange={e => setText(e.target.value)} disabled={reply.isPending} /></label>
                {reply.isError && <p role="alert" className={styles.error}>{getApiErrorMessage(reply.error, "댓글을 등록하지 못했습니다. 다시 시도해 주세요.")}</p>}
                <Button type="submit" size="sm" loading={reply.isPending} disabled={!text.trim()}>댓글 등록</Button>
              </form>
            </section>
          </>
        )}
    </div>
  );
}
