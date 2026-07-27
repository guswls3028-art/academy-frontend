import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  CheckCircle2,
  CircleDot,
  Inbox,
  Lightbulb,
  MessageSquareText,
  Paperclip,
  Phone,
  RefreshCw,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { Badge, ICON } from "@/shared/ui/ds";
import { createClientRequestKey } from "@/shared/api/contracts/community";
import { numericDateText, numericDateTimeText } from "@/shared/utils/displayText";
import {
  getInboxAttachmentUrl,
  type InboxItem,
  type InboxSource,
  type InboxStatus,
  type InboxType,
} from "@dev/domains/inbox/api/inbox.api";
import {
  useCreateInboxReply,
  useInboxItems,
  useUpdateInboxItem,
} from "@dev/domains/inbox/hooks/useInbox";
import { useDevToast } from "@dev/shared/components/useDevToast";
import layout from "@dev/layout/DevLayout.module.css";
import styles from "./InboxPage.module.css";

const PAGE_SIZE = 30;
type TypeFilter = InboxType | "all";
type StatusFilter = InboxStatus | "all";

export default function InboxPage() {
  const { toast } = useDevToast();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyRequestKey, setReplyRequestKey] = useState(createClientRequestKey);
  const [adminMemo, setAdminMemo] = useState("");
  const detailPaneRef = useRef<HTMLElement | null>(null);
  const lastSelectedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchDraft.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  const filters = useMemo(
    () => ({
      type: typeFilter,
      status: statusFilter,
      q: searchQuery,
      page,
      pageSize: PAGE_SIZE,
    }),
    [page, searchQuery, statusFilter, typeFilter],
  );
  const inboxQuery = useInboxItems(filters);
  const replyMutation = useCreateInboxReply();
  const updateItemMutation = useUpdateInboxItem();

  const items = useMemo(() => inboxQuery.data?.results ?? [], [inboxQuery.data]);
  const summary = inboxQuery.data?.summary;
  const selected = useMemo(
    () => items.find((item) => itemKey(item) === selectedKey) ?? null,
    [items, selectedKey],
  );
  const pageCount = Math.max(1, Math.ceil((inboxQuery.data?.count ?? 0) / PAGE_SIZE));

  useEffect(() => {
    if (selectedKey && inboxQuery.data && !items.some((item) => itemKey(item) === selectedKey)) {
      setSelectedKey(null);
    }
  }, [inboxQuery.data, items, selectedKey]);

  useEffect(() => {
    if (selectedKey !== lastSelectedKeyRef.current) {
      setAdminMemo(selected?.admin_memo ?? "");
      lastSelectedKeyRef.current = selectedKey;
    }
  }, [selected, selectedKey]);

  useEffect(() => {
    if (inboxQuery.data && page > pageCount) setPage(pageCount);
  }, [inboxQuery.data, page, pageCount]);

  function chooseType(next: TypeFilter) {
    setTypeFilter(next);
    setPage(1);
    setSelectedKey(null);
  }

  async function handleReply() {
    if (
      !selected
      || selected.source !== "support"
      || !replyText.trim()
      || replyMutation.isPending
    ) return;
    try {
      await replyMutation.mutateAsync({
        postId: selected.id,
        content: replyText.trim(),
        idempotencyKey: replyRequestKey,
      });
      setReplyText("");
      setReplyRequestKey(createClientRequestKey());
      toast("답변을 등록했습니다.");
    } catch {
      toast("답변을 등록하지 못했습니다.", "error");
    }
  }

  function handleReplyTextChange(value: string) {
    setReplyText(value);
    setReplyRequestKey(createClientRequestKey());
  }

  async function handleOperationalUpdate(nextStatus: InboxStatus) {
    if (!selected || selected.source === "support") return;
    try {
      await updateItemMutation.mutateAsync({
        item: selected,
        status: nextStatus,
        adminMemo,
      });
      toast(nextStatus === "resolved" ? "처리 완료로 변경했습니다." : "미처리로 되돌렸습니다.");
    } catch {
      toast("처리 상태를 저장하지 못했습니다.", "error");
    }
  }

  return (
    <>
      <header className={layout.header}>
        <div className={layout.headerLeft}>
          <Link to="/dev/dashboard" className={styles.breadcrumbLink}>Dashboard</Link>
          <span className={styles.breadcrumbSeparator}>/</span>
          <span className={styles.breadcrumbCurrent}>문의함</span>
        </div>
        <div className={layout.headerRight}>
          <span
            className={`${layout.headerBadge} ${styles.queueStatus}`}
            data-state={summary && summary.open > 0 ? "pending" : "done"}
          >
            {inboxQuery.isLoading
              ? "문의 확인 중"
              : inboxQuery.isError
                ? "상태 확인 실패"
                : summary && summary.open > 0
                  ? `미처리 ${summary.open}건`
                  : "처리 대기 없음"}
          </span>
        </div>
      </header>

      <div className={layout.content}>
        <section className={styles.pageIntro}>
          <div>
            <p className={styles.eyebrow}>OPERATIONS INTAKE</p>
            <h1>문의 운영함</h1>
            <p>도입 문의, 버그 제보, 개선 의견을 한곳에서 확인하고 처리합니다.</p>
          </div>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => inboxQuery.refetch()}
            disabled={inboxQuery.isFetching}
          >
            <RefreshCw size={ICON.sm} className={inboxQuery.isFetching ? styles.spinning : undefined} />
            새로고침
          </button>
        </section>

        <div className={styles.summaryGrid} aria-label="문의 현황">
          <SummaryCard label="미처리" value={summary?.open ?? null} icon={CircleDot} tone="warning" testId="inbox-summary-open" />
          <SummaryCard label="도입 문의" value={summary?.contacts ?? null} icon={Phone} tone="teal" />
          <SummaryCard label="버그" value={summary?.bugs ?? null} icon={TriangleAlert} tone="danger" />
          <SummaryCard label="개선 의견" value={summary?.feedbacks ?? null} icon={Lightbulb} tone="primary" />
          <SummaryCard label="처리 완료" value={summary?.resolved ?? null} icon={CheckCircle2} tone="success" />
        </div>

        <div className={styles.workspace}>
          <section className={`${layout.card} ${styles.queuePane}`} aria-label="문의 목록">
            <div className={styles.queueToolbar}>
              <label className={styles.searchBox}>
                <Search size={ICON.sm} />
                <span className={styles.srOnly}>문의 검색</span>
                <input
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="학원, 이름, 제목, 전화번호 검색"
                />
                {searchDraft && (
                  <button type="button" onClick={() => setSearchDraft("")} aria-label="검색어 지우기">
                    <X size={ICON.xs} />
                  </button>
                )}
              </label>
              <select
                className={styles.statusSelect}
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as StatusFilter);
                  setPage(1);
                  setSelectedKey(null);
                }}
                aria-label="처리 상태"
              >
                <option value="open">미처리</option>
                <option value="resolved">처리 완료</option>
                <option value="all">전체 상태</option>
              </select>
            </div>

            <div className={styles.typeFilters} role="group" aria-label="문의 유형">
              {([
                ["all", "전체", summary?.total ?? null],
                ["contact", "도입 문의", summary?.contacts ?? null],
                ["bug", "버그", summary?.bugs ?? null],
                ["feedback", "개선", summary?.feedbacks ?? null],
              ] as const).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  className={styles.typeFilter}
                  data-active={typeFilter === value ? "true" : undefined}
                  aria-pressed={typeFilter === value}
                  onClick={() => chooseType(value)}
                >
                  {label}<span>{count ?? "—"}</span>
                </button>
              ))}
            </div>

            <div className={styles.queueCount}>
              <span>{inboxQuery.data?.count ?? 0}건</span>
              {inboxQuery.isFetching && !inboxQuery.isLoading && <span>업데이트 중</span>}
            </div>

            <div className={styles.itemList}>
              {inboxQuery.isLoading ? (
                <QueueSkeleton />
              ) : inboxQuery.isError ? (
                <StateMessage
                  icon={TriangleAlert}
                  title="문의함을 불러오지 못했습니다"
                  description="권한 또는 서버 연결을 확인한 뒤 다시 시도해 주세요."
                  actionLabel="다시 시도"
                  onAction={() => inboxQuery.refetch()}
                />
              ) : items.length === 0 ? (
                <StateMessage
                  icon={Inbox}
                  title={statusFilter === "open" ? "처리할 문의가 없습니다" : "조건에 맞는 문의가 없습니다"}
                  description={searchQuery ? "검색어 또는 필터를 바꿔 보세요." : "새 문의가 들어오면 이곳에 표시됩니다."}
                />
              ) : (
                items.map((item) => (
                  <button
                    key={itemKey(item)}
                    type="button"
                    className={styles.itemButton}
                    data-selected={selectedKey === itemKey(item) ? "true" : undefined}
                    aria-pressed={selectedKey === itemKey(item)}
                    data-testid={`inbox-item-${item.source}-${item.id}`}
                    onClick={() => {
                      setSelectedKey(itemKey(item));
                      setReplyText("");
                      if (window.matchMedia("(max-width: 900px)").matches) {
                        window.setTimeout(() => detailPaneRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
                      }
                    }}
                  >
                    <div className={styles.itemTop}>
                      <TypeBadge type={item.inquiry_type} />
                      <SourceBadge source={item.source} />
                      <span className={styles.itemTime}>{relativeTimeText(item.created_at)}</span>
                    </div>
                    <strong className={styles.itemTitle}>{item.subject}</strong>
                    <p className={styles.itemPreview}>{plainText(item.content) || "상세 내용 없음"}</p>
                    <div className={styles.itemMeta}>
                      <span><Building2 size={ICON.xs} />{item.tenant_name || item.tenant_code || "공개 사용자"}</span>
                      <span>{item.author_display_name || "사용자"}</span>
                      {item.status === "open" && <span className={styles.openDot}>미처리</span>}
                    </div>
                  </button>
                ))
              )}
            </div>

            {pageCount > 1 && (
              <div className={styles.pagination}>
                <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>이전</button>
                <span>{page} / {pageCount}</span>
                <button type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>다음</button>
              </div>
            )}
          </section>

          <section ref={detailPaneRef} className={`${layout.card} ${styles.detailPane}`} aria-label="문의 상세">
            {selected ? (
              <InboxDetail
                item={selected}
                adminMemo={adminMemo}
                replyText={replyText}
                isSaving={updateItemMutation.isPending}
                isReplying={replyMutation.isPending}
                onAdminMemoChange={setAdminMemo}
                onReplyTextChange={handleReplyTextChange}
                onReply={handleReply}
                onOperationalUpdate={handleOperationalUpdate}
                onClose={() => setSelectedKey(null)}
                onAttachment={async (attachmentId) => {
                  const popup = window.open("", "_blank");
                  try {
                    const { url } = await getInboxAttachmentUrl(selected.id, attachmentId);
                    if (popup) {
                      popup.opener = null;
                      popup.location.href = url;
                    } else {
                      window.location.assign(url);
                    }
                  } catch {
                    popup?.close();
                    toast("첨부파일을 열지 못했습니다.", "error");
                  }
                }}
              />
            ) : (
              <div className={styles.detailEmpty}>
                <div className={styles.detailEmptyIcon}><MessageSquareText size={ICON.xl} /></div>
                <h2>문의 내용을 확인하세요</h2>
                <p>왼쪽 목록에서 문의를 선택하면 연락처, 본문, 처리 기록이 표시됩니다.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function InboxDetail({
  item,
  adminMemo,
  replyText,
  isSaving,
  isReplying,
  onAdminMemoChange,
  onReplyTextChange,
  onReply,
  onOperationalUpdate,
  onClose,
  onAttachment,
}: {
  item: InboxItem;
  adminMemo: string;
  replyText: string;
  isSaving: boolean;
  isReplying: boolean;
  onAdminMemoChange: (value: string) => void;
  onReplyTextChange: (value: string) => void;
  onReply: () => void;
  onOperationalUpdate: (status: InboxStatus) => void;
  onClose: () => void;
  onAttachment: (attachmentId: number) => void;
}) {
  return (
    <div className={styles.detailShell} data-testid="inbox-detail">
      <header className={styles.detailHeader}>
        <div className={styles.detailBadges}>
          <TypeBadge type={item.inquiry_type} />
          <StatusBadge status={item.status} />
          <SourceBadge source={item.source} />
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="상세 닫기">
            <X size={ICON.sm} />
          </button>
        </div>
        <h2>{item.subject}</h2>
        <p>
          {item.author_display_name || "사용자"} · {numericDateTimeText(item.created_at)}
        </p>
      </header>

      <div className={styles.detailScroll}>
        <dl className={styles.contextGrid}>
          <div><dt>학원</dt><dd>{item.tenant_name || "공개 사용자"}{item.tenant_code ? ` · ${item.tenant_code}` : ""}</dd></div>
          <div><dt>유입 경로</dt><dd>{item.source_label}</dd></div>
          {item.contact_phone && (
            <div>
              <dt>연락처</dt>
              <dd><a href={`tel:${item.contact_phone}`}><Phone size={ICON.xs} />{item.contact_phone}</a></dd>
            </div>
          )}
          {item.context.route && <div><dt>화면 경로</dt><dd>{item.context.route}</dd></div>}
          {item.context.screen_size && <div><dt>화면 크기</dt><dd>{item.context.screen_size}</dd></div>}
          {item.category_label && <div><dt>관심 항목</dt><dd>{item.category_label}</dd></div>}
        </dl>

        <section className={styles.detailSection}>
          <h3>문의 내용</h3>
          <div className={styles.messageBody}>{plainText(item.content) || "작성된 상세 내용이 없습니다."}</div>
        </section>

        {item.attachments.length > 0 && (
          <section className={styles.detailSection}>
            <h3>첨부파일 {item.attachments.length}개</h3>
            <div className={styles.attachmentList}>
              {item.attachments.map((attachment) => (
                <button type="button" key={attachment.id} onClick={() => onAttachment(attachment.id)}>
                  <Paperclip size={ICON.sm} />
                  <span>{attachment.original_name}</span>
                  <small>{formatBytes(attachment.size_bytes)}</small>
                </button>
              ))}
            </div>
          </section>
        )}

        {item.source === "support" && (
          <section className={styles.detailSection}>
            <h3>대화 {item.replies.length}건</h3>
            {item.replies.length === 0 ? (
              <p className={styles.sectionEmpty}>아직 등록된 답변이 없습니다.</p>
            ) : (
              <div className={styles.replyList}>
                {item.replies.map((reply) => (
                  <article className={styles.replyCard} key={reply.id} data-platform={reply.is_platform_reply ? "true" : undefined}>
                    <div>
                      <strong>{reply.created_by_display || (reply.is_platform_reply ? "개발팀" : "문의자")}</strong>
                      {reply.is_platform_reply && <Badge tone="primary" size="xs">개발팀 답변</Badge>}
                      <time>{numericDateTimeText(reply.created_at)}</time>
                    </div>
                    <p>{plainText(reply.content)}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {item.source === "support" ? (
        <footer className={styles.composer}>
          <textarea
            value={replyText}
            onChange={(event) => onReplyTextChange(event.target.value)}
            placeholder="문의자에게 보낼 답변을 입력하세요."
            rows={3}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                onReply();
              }
            }}
          />
          <div>
            <span>Ctrl/⌘ + Enter로 전송</span>
            <button type="button" disabled={!replyText.trim() || isReplying} onClick={onReply}>
              {isReplying ? "전송 중…" : "답변 등록"}
            </button>
          </div>
        </footer>
      ) : (
        <footer className={styles.operationPanel}>
          <label>
            <span>내부 처리 메모</span>
            <textarea
              value={adminMemo}
              onChange={(event) => onAdminMemoChange(event.target.value)}
              placeholder="연락 결과나 후속 조치를 기록하세요. 외부에는 공개되지 않습니다."
              rows={2}
            />
          </label>
          <div>
            <button
              type="button"
              className={styles.secondaryAction}
              disabled={isSaving}
              onClick={() => onOperationalUpdate(item.status)}
            >
              메모 저장
            </button>
            <button
              type="button"
              className={item.status === "open" ? styles.resolveAction : styles.reopenAction}
              disabled={isSaving}
              onClick={() => onOperationalUpdate(item.status === "open" ? "resolved" : "open")}
            >
              {item.status === "open" ? "처리 완료" : "미처리로 전환"}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
  testId,
}: {
  label: string;
  value: number | null;
  icon: typeof CircleDot;
  tone: "warning" | "teal" | "danger" | "primary" | "success";
  testId?: string;
}) {
  return (
    <div className={styles.summaryCard} data-tone={tone} data-testid={testId}>
      <div><span>{label}</span><Icon size={ICON.md} /></div>
      <strong>{value ?? "—"}</strong>
    </div>
  );
}

function TypeBadge({ type }: { type: InboxType }) {
  const meta = {
    bug: { label: "버그", tone: "danger" as const },
    feedback: { label: "개선", tone: "primary" as const },
    contact: { label: "도입 문의", tone: "teal" as const },
  }[type];
  return <Badge tone={meta.tone} size="xs" shape="square">{meta.label}</Badge>;
}

function SourceBadge({ source }: { source: InboxSource }) {
  const label = source === "lead" ? "웹 문의" : source === "incident" ? "빠른 신고" : "지원 티켓";
  return <Badge tone="neutral" size="xs" shape="square">{label}</Badge>;
}

function StatusBadge({ status }: { status: InboxStatus }) {
  return (
    <Badge tone={status === "open" ? "warning" : "success"} size="xs" shape="square">
      {status === "open" ? "미처리" : "완료"}
    </Badge>
  );
}

function StateMessage({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: typeof Inbox;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className={styles.stateMessage}>
      <Icon size={ICON.lg} />
      <strong>{title}</strong>
      <p>{description}</p>
      {actionLabel && onAction && <button type="button" onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className={styles.skeletonList} aria-label="문의 목록 로딩 중">
      {[0, 1, 2, 3].map((value) => <div key={value}><span /><strong /><p /></div>)}
    </div>
  );
}

function itemKey(item: Pick<InboxItem, "source" | "id">) {
  return `${item.source}:${item.id}`;
}

function plainText(value: string) {
  if (!value) return "";
  const documentValue = new DOMParser().parseFromString(value, "text/html");
  return (documentValue.body.textContent || "").trim();
}

function relativeTimeText(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return numericDateText(iso);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
