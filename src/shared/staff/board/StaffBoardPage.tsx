import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useMatch, useNavigate, useParams, useSearchParams } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, FileText, MessageCircle, Paperclip, Pencil, Search } from "lucide-react";
import { Badge, Button, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import { DomainLayout } from "@/shared/ui/layout";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { addReply, boardDate, boardKeys, boardLabels, boardListLabels, boardWriteLabels, deletePost, downloadAttachment, removeAttachment,
  useBoardList, useBoardPost, useBoardScope, type BoardScope, type BoardFilter, type Post, type PostRow } from "./api";
import { boardListParams, boardRoot, boardSearchLimit, mobileBoardRoot } from "@/core/router/workspaceRoutes";
import PostEditor from "./PostEditor";
import BoardReply from "./BoardReply";
import styles from "./StaffBoard.module.css";
import { createRandomUuid } from "@/shared/utils/randomUuid";
import { getSessionItem, setSessionItem } from "@/shared/utils/safeSessionStorage";

const lastBoardRow = "staff-board:last-opened-row";

export default function StaffBoardPage() {
  const { category, postId } = useParams();
  const scope = useBoardScope();
  const compactWorkspace = useMatch({ path: mobileBoardRoot, end: false });
  const root = compactWorkspace ? mobileBoardRoot : boardRoot;
  const categories = Object.keys(boardListLabels) as BoardFilter[];
  if (!category || !categories.includes(category as BoardFilter)) return <Navigate replace to={`${root}/all`} />;
  if (postId && (!/^[1-9]\d*$/.test(postId) || !Number.isSafeInteger(Number(postId)))) {
    return <Navigate replace to={`${root}/${category}`} />;
  }
  return <BoardScreen key={JSON.stringify([...scope, category, postId])}
    root={root} scope={scope} category={category as BoardFilter} id={postId ? Number(postId) : undefined} />;
}

function BoardScreen({ root, scope, category, id }: { root: string; scope: BoardScope; category: BoardFilter; id?: number }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requestedPage = Number(params.get("page"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const q = params.get("q")?.trim().slice(0, boardSearchLimit) ?? "";
  const search = boardListParams(q, page).toString();
  const suffix = search ? `?${search}` : "";
  const categoryPath = `${root}/${category}`;
  const cache = useQueryClient();
  const [editor, setEditor] = useState<Post | "new" | null>(null);
  function deleted(postId: number) {
    const list = cache.getQueryData<{ results: PostRow[] }>(boardKeys.list(scope, category, page, 20, q));
    const nextPage = list?.results.length === 1 ? Math.max(1, page - 1) : list ? page : 1;
    const nextSearch = boardListParams(q, nextPage).toString();
    navigate(categoryPath + (nextSearch ? `?${nextSearch}` : ""), { replace: true });
    void cache.invalidateQueries({ queryKey: boardKeys.lists(scope) });
    cache.removeQueries({ queryKey: boardKeys.detail(scope, postId), exact: true });
    feedback.success("글을 삭제했습니다.");
  }
  function saved(row: PostRow) {
    void cache.invalidateQueries({ queryKey: scope });
    setEditor(null);
    if (!id) navigate(`${categoryPath}/${row.id}${suffix}`);
  }
  const tabs = (Object.keys(boardListLabels) as BoardFilter[]).map(key => ({
    key, label: boardListLabels[key], path: `${root}/${key}`,
  }));
  return (
    <DomainLayout title="교직원 게시판" description="같은 학원의 강사와 조교 등 직원끼리 공지와 자료를 공유합니다."
      tabs={tabs}>
      {id ? <PostDetail root={root} scope={scope} id={id} category={category} listUrl={categoryPath + suffix} onEdit={setEditor} onDeleted={deleted} />
        : <PostList scope={scope} category={category} path={categoryPath} page={page} q={q} suffix={suffix} onWrite={() => setEditor("new")}
            onListChange={(nextQuery, nextPage) => setParams(boardListParams(nextQuery, nextPage))} />}
      {editor && <PostEditor category={category} post={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} onSaved={saved} />}
    </DomainLayout>
  );
}

function PostList({ scope, category, path, page, q, suffix, onWrite, onListChange }: {
  scope: BoardScope; category: BoardFilter; path: string; page: number; q: string; suffix: string; onWrite: () => void;
  onListChange: (q: string, page?: number) => void;
}) {
  const query = useBoardList(scope, category, { page, q });
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searchInput.current) searchInput.current.value = q;
  }, [q]);
  const data = query.data;
  const location = useLocation();
  const entry = JSON.stringify([...scope, path + suffix, location.key]) + ":";
  const lastOpened = getSessionItem(lastBoardRow);
  const returnId = lastOpened?.startsWith(entry) ? Number(lastOpened.slice(entry.length)) : location.state?.returnPostId;
  const selected = data?.results.find(post => post.id === returnId)?.id;
  const returnLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const link = returnLink.current;
    if (link && document.activeElement === document.body) {
      link.focus({ preventScroll: true });
      link.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [location.key, selected]);
  function search(event: FormEvent) {
    event.preventDefault();
    const keyword = searchInput.current?.value.trim() ?? "";
    if (searchInput.current) searchInput.current.value = keyword;
    onListChange(keyword);
  }
  return (
    <section className={styles.sheet} aria-label={boardListLabels[category]}>
      <header className={styles.sheetHeader}>
        <div className={styles.listHeading}><h2>{boardListLabels[category]}</h2>
          {!query.isError && data && <span className={styles.meta} aria-live="polite">{q ? "검색 결과 " : ""}{data.count.toLocaleString("ko-KR")}건</span>}
        </div>
        <form className={styles.search} role="search" aria-label={`${boardListLabels[category]} 검색`} onSubmit={search}>
          <div className={styles.searchField}>
            <Search size={ICON.sm} aria-hidden="true" />
            <input ref={searchInput} type="search" aria-label="게시글 검색어"
              placeholder={category === "resource" || category === "all" ? "제목·내용·파일명" : "제목·내용"}
              defaultValue={q} maxLength={boardSearchLimit} />
          </div>
          <Button type="submit">검색</Button>
          {q && <Button onClick={() => { onListChange(""); searchInput.current?.focus(); }}>검색 초기화</Button>}
        </form>
        <Button intent="primary" leftIcon={<Pencil size={ICON_FOR_BUTTON.md} />} onClick={onWrite}>
          {category === "all" ? "글쓰기" : boardWriteLabels[category]}
        </Button>
      </header>
      {query.isError ? (
        <div className={styles.state} role="alert"><p>게시글 목록을 불러오지 못했습니다.</p>
          <Button onClick={() => void query.refetch()}>다시 시도</Button>
          {page > 1 && <Button onClick={() => onListChange(q)}>첫 페이지</Button>}
        </div>
      ) : !data ? (
        <p role="status" className={styles.state}>게시글을 불러오는 중입니다.</p>
      ) : (
        <>
          {data.results.length ? <table className={styles.rows} aria-label={`${boardListLabels[category]} 목록`}>
            <thead><tr>
              <th scope="col">제목</th><th scope="col">게시판</th><th scope="col">작성자</th><th scope="col">작성일</th>
            </tr></thead>
            <tbody>{data.results.map(post => (
              <tr key={post.id} className={post.id === selected ? styles.lastOpened : undefined}>
                <td><Link to={`${path}/${post.id}${suffix}`} ref={post.id === selected ? returnLink : undefined}
                  onClick={event => {
                    if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
                      setSessionItem(lastBoardRow, entry + post.id);
                    }
                  }}>
                  <span className={styles.rowTitle}>
                    <strong>{post.title}</strong>
                    {post.reply_count > 0 && <span className={styles.replyCount} aria-label={`댓글 ${post.reply_count}개`}><MessageCircle size={ICON.xs} aria-hidden="true" />{post.reply_count}</span>}
                  </span>
                  {post.attachment_name && <span className={styles.filename}><Paperclip size={ICON.xs} aria-hidden="true" />{post.attachment_name}</span>}
                </Link></td>
                <td><Badge size="sm">{boardLabels[post.category]}</Badge></td>
                <td>{post.author_name}</td>
                <td><time dateTime={post.created_at}>{boardDate(post.created_at)}</time></td>
              </tr>
            ))}</tbody>
          </table> : <div className={styles.empty}><FileText size={ICON.xl} aria-hidden="true" />
            <p>{q ? "검색 결과가 없습니다." : "아직 등록된 글이 없습니다."}</p>
            {q && <span>검색어를 바꾸거나 검색 초기화로 전체 글을 볼 수 있습니다.</span>}
          </div>}
          {(data.previous || data.next) && <nav className={styles.pagination} aria-label="목록 페이지">
            <Button size="sm" disabled={!data.previous} onClick={() => onListChange(q, page - 1)}>이전</Button>
            <span>{page} / {Math.ceil(data.count / 20)}</span>
            <Button size="sm" disabled={!data.next} onClick={() => onListChange(q, page + 1)}>다음</Button>
          </nav>}
        </>
      )}
    </section>
  );
}

function PostDetail({ root, scope, category, id, listUrl, onEdit, onDeleted }: {
  root: string; scope: BoardScope; category: BoardFilter; id: number; listUrl: string; onEdit: (post: Post) => void;
  onDeleted: (postId: number) => void;
}) {
  const cache = useQueryClient();
  const post = useBoardPost(scope, id);
  const confirm = useConfirm();
  const deletion = useMutation({
    mutationFn: () => deletePost(id),
    onSuccess: () => onDeleted(id),
  });
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
  if (data && category !== "all" && data.category !== category) return <Navigate replace to={`${root}/${data.category}/${id}`} />;
  return (
    <div className={styles.detail}>
      <Link className={styles.back} to={listUrl} state={{ returnPostId: id }}><ArrowLeft size={ICON.sm} />{boardListLabels[category]} 목록</Link>
      {post.isError ? <div className={styles.state} role="alert"><p>글을 불러오지 못했습니다. 접근 권한이나 게시글 상태를 확인해 주세요.</p>
        <Button onClick={() => void post.refetch()}>다시 시도</Button></div>
        : !data ? <p className={styles.state} role="status">글을 불러오는 중입니다.</p> : (
          <>
            <article className={styles.article}>
              <header><h2>{data.title}</h2>
                <div className={styles.byline}><span className={styles.meta}>{data.author_name} · <time dateTime={data.created_at}>{boardDate(data.created_at)}</time></span>
                  <div className={styles.actions}>
                    {data.can_edit && <Button size="sm" disabled={deletion.isPending} onClick={() => onEdit(data)}>글 수정</Button>}
                    {data.can_delete && <Button size="sm" loading={deletion.isPending} onClick={async () => {
                      if (await confirm({ title: "글 삭제", message: `‘${data.title}’ 글을 삭제할까요? 댓글과 첨부파일도 게시판에서 볼 수 없게 됩니다.`, confirmText: "글 삭제", danger: true })) deletion.mutate();
                    }}>글 삭제</Button>}
                  </div></div>
                {deletion.isError && <p role="alert" className={styles.error}>{getApiErrorMessage(deletion.error, "글을 삭제하지 못했습니다. 다시 시도해 주세요.")}</p>}
              </header>
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
              <p className={styles.content}>{data.body}</p>
            </article>
            <section className={styles.replies} aria-label="댓글"><h2>댓글 <span>{data.replies.length}</span></h2>
              {data.replies.length > 0 ? <ul>{data.replies.map(item => <BoardReply key={item.id} item={item} scope={scope} postId={id} />)}</ul>
                : <p className={styles.meta}>아직 댓글이 없습니다.</p>}
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
