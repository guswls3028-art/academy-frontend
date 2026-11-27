import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isHttpStatus } from "@/shared/api/contracts/community";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { Button, Tabs } from "@/shared/ui/ds";
import {
  fetchAdminPosts, fetchPost, fetchScopeNodes, resolvePostNodeIdsForCreate, type PostEntity,
} from "../api/community.api";
import CommunityEmptyState from "../components/CommunityEmptyState";
import PostCreatePane from "../components/PostCreatePane";
import { useLectureBoardNavigation } from "../hooks/useLectureBoardNavigation";
import { MaterialsPostDetail, MatPostCard } from "../pages/MaterialsBoardPage";
import { NoticeCard, NoticeCreatePane, NoticePostDetail } from "../pages/NoticeAdminPage";
import { adminCommunityQueryKeys as keys } from "../queryKeys";
import "./LectureCommunityBoard.css";

const BOARDS = [{ key: "notice", label: "공지사항" }, { key: "materials", label: "자료실" }];
const PAGE_SIZE = 20;
type Board = "notice" | "materials";

function positiveId(raw: string | null) {
  if (!raw || !/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

function accessDenied(error: unknown) {
  return isHttpStatus(error, 401) || isHttpStatus(error, 403) || isHttpStatus(error, 404);
}

function belongsToBoard(post: PostEntity, board: Board, lectureId: number) {
  return post.post_type === board && post.mappings?.some((row) => row.node_detail?.lecture === lectureId);
}

export default function LectureCommunityBoard({ lectureId }: { lectureId: number }) {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const navigation = useLectureBoardNavigation();
  const panel = useRef<HTMLElement>(null);
  const board: Board = params.get("board") === "materials" ? "materials" : "notice";
  const page = positiveId(params.get("page")) ?? 1;
  const selectedId = positiveId(params.get("post"));
  const composing = params.get("compose") === "1" && !params.has("post");
  const showPanel = params.has("post") || composing;
  const tenant = getTenantCodeForApiRequest();
  const listKey = board === "notice" ? keys.noticePosts : keys.materialsPosts;
  const label = board === "notice" ? "공지" : "자료";
  const scope = { scope: "lecture" as const, lectureId };
  const list = useQuery({
    queryKey: keys.lectureBoardPosts(board, tenant, lectureId, page),
    queryFn: () => fetchAdminPosts({ postType: board, lectureId, page, pageSize: PAGE_SIZE }),
  });
  const nodes = useQuery({
    queryKey: keys.lectureScopeNodes(tenant),
    queryFn: fetchScopeNodes,
    enabled: composing,
  });
  const rows = list.data?.results.filter((post) => belongsToBoard(post, board, lectureId)) ?? [];
  // A pasted ID never opens the tenant-wide editor until it appears on this lecture's server-filtered page.
  const selected = selectedId != null && rows.some((post) => post.id === selectedId);
  const detail = useQuery({
    queryKey: keys.lectureBoardPost(board, tenant, lectureId, selectedId),
    queryFn: () => fetchPost(selectedId!),
    enabled: selected && !accessDenied(list.error),
  });
  const pages = Math.max(1, Math.ceil((list.data?.count ?? 0) / PAGE_SIZE));

  function change(nextBoard: Board, nextPage = 1, target?: "new" | number, replace = false) {
    const next = new URLSearchParams(params);
    next.set("board", nextBoard);
    if (nextPage > 1) next.set("page", String(nextPage));
    else next.delete("page");
    next.delete("post");
    next.delete("compose");
    if (target === "new") next.set("compose", "1");
    if (typeof target === "number") next.set("post", String(target));
    setParams(next, { replace });
  }
  const close = () => change(board, page);
  function created(postId: number) {
    void queryClient.invalidateQueries({ queryKey: listKey });
    void queryClient.invalidateQueries({ queryKey: keys.counts(board) });
    navigation.proceed(() => change(board, 1, postId, true));
  }
  useEffect(() => {
    if (showPanel && !composing) panel.current?.focus({ preventScroll: true });
  }, [board, composing, selectedId, showPanel]);

  function panelMessage(message: string, retry?: () => void) {
    return <div className="lecture-community__message" role="status">
      <p>{message}</p>
      <div className="lecture-community__actions">
        {retry && <Button intent="secondary" size="sm" onClick={retry}>다시 시도</Button>}
        <Button intent="ghost" size="sm" onClick={close}>목록</Button>
      </div>
    </div>;
  }

  function pane() {
    if (composing) {
      if (nodes.isPending) return panelMessage("게시 대상을 불러오는 중입니다.");
      if (!nodes.data || nodes.isError || resolvePostNodeIdsForCreate(nodes.data, scope).kind !== "scoped") {
        return panelMessage("이 강의의 게시 대상을 확인할 수 없습니다.", () => void nodes.refetch());
      }
      const common = { scopeNodes: nodes.data, scopeParams: scope, onSuccess: created,
        onDraftStateChange: navigation.onCreateStateChange };
      return board === "notice"
        ? <NoticeCreatePane {...common} onCancel={close} />
        : <PostCreatePane {...common} postType="materials" onCancel={() => navigation.proceed(close)} />;
    }
    if (list.isPending || (list.isFetching && !selected) || (selected && detail.isPending)) return panelMessage("게시글을 불러오는 중입니다.");
    if (list.isError && (!list.data || accessDenied(list.error))) return panelMessage("이 강의의 게시글을 불러오지 못했습니다.", () => void list.refetch());
    if (selected && detail.isError && (!detail.data || accessDenied(detail.error))) return panelMessage("게시글을 불러오지 못했습니다.", () => void detail.refetch());
    if (!selectedId || !selected || !detail.data || !belongsToBoard(detail.data, board, lectureId)) {
      return panelMessage("이 강의에서 게시글을 찾을 수 없습니다.");
    }
    const deleted = () => navigation.proceed(() => change(board, page, undefined, true));
    return board === "notice"
      ? <NoticePostDetail key={selectedId} post={detail.data} onClose={() => navigation.proceed(close)}
          onDeleted={deleted} onDraftStateChange={navigation.onContentStateChange} />
      : <MaterialsPostDetail key={selectedId} post={detail.data} onClose={close} onDeleted={deleted}
          onTitleStateChange={navigation.onTitleStateChange} onContentStateChange={navigation.onContentStateChange}
          onAttachmentStateChange={navigation.onAttachmentStateChange} />;
  }

  const Card = board === "notice" ? NoticeCard : MatPostCard;
  return <section className="lecture-community" aria-label="강의 커뮤니티">
    <div className="lecture-community__toolbar">
      <Tabs ariaLabel="강의 커뮤니티 게시판" items={BOARDS} value={board}
        onChange={(key) => { if (key !== board) change(key === "materials" ? "materials" : "notice"); }} />
      {!composing && <Button intent="primary" size="sm" onClick={() => change(board, page, "new")}>
        {board === "notice" ? "공지 작성" : "자료 등록"}
      </Button>}
    </div>
    <div className={`lecture-community__panes${showPanel ? " lecture-community__panes--open" : ""}`}>
      <section className="lecture-community__list" aria-label={`${label} 목록`}>
        {list.isPending ? <CommunityEmptyState variant="loading" postType={board} /> :
         list.isError ? <CommunityEmptyState variant="error" postType={board} action={
           <Button size="sm" intent="secondary" onClick={() => void list.refetch()}>다시 시도</Button>
         } /> :
         rows.length ? rows.map((post) => <Card key={post.id} post={post} isActive={selectedId === post.id}
           onClick={() => { if (selectedId !== post.id) change(board, page, post.id); }} />) :
         <CommunityEmptyState variant="no-posts" postType={board}
           title={page > pages ? "이 페이지에 게시글이 없습니다." : `이 강의에 등록된 ${label === "공지" ? "공지가" : "자료가"} 없습니다.`}
           description={page > pages ? "첫 페이지에서 다시 확인해 주세요." : undefined}
           action={page > pages ? <Button size="sm" intent="secondary" onClick={() => change(board)}>첫 페이지</Button> : undefined} />}
        {!list.isError && (pages > 1 || page > 1) && <nav className="lecture-community__pages" aria-label="게시글 페이지">
          <Button size="sm" intent="secondary" disabled={page <= 1} onClick={() => change(board, Math.min(page - 1, pages))}>이전</Button>
          <span>{page} / {pages}</span>
          <Button size="sm" intent="secondary" disabled={page >= pages} onClick={() => change(board, page + 1)}>다음</Button>
        </nav>}
      </section>
      {showPanel && <section key={`${board}-${composing ? "new" : selectedId}`} ref={panel} tabIndex={-1}
        className="lecture-community__panel" aria-label={`${label} ${composing ? "작성" : "상세"}`}>
        {selected && detail.isError && detail.data && !accessDenied(detail.error) &&
          <div className="lecture-community__actions" role="status">최신 내용을 불러오지 못했습니다.
            <Button size="sm" intent="secondary" onClick={() => void detail.refetch()}>다시 시도</Button>
          </div>}
        {pane()}
      </section>}
    </div>
  </section>;
}
