import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, GitBranch, RefreshCw, Search, ShieldCheck } from "lucide-react";
import useAuth from "@/auth/hooks/useAuth";
import { useProgram } from "@/shared/program";
import { Badge, ICON, type BadgeTone } from "@/shared/ui/ds";
import { canViewAgentSessions } from "./access";
import { getAgentSessions, type AgentNode, type AgentState } from "./api";
import layout from "@dev/layout/DevLayout.module.css";
import { devQueryKeys } from "@dev/shared/queryKeys";
import s from "./AgentSessionsPage.module.css";

const STATES: Record<AgentState, { label: string; tone: BadgeTone; order: number }> = {
  running: { label: "작업 중", tone: "primary", order: 0 },
  waiting: { label: "대기", tone: "warning", order: 1 },
  completed: { label: "응답 완료", tone: "success", order: 2 },
  interrupted: { label: "중단·종료", tone: "neutral", order: 3 },
  unknown: { label: "확인 필요", tone: "neutral", order: 4 },
};
const PROVIDERS = { codex: "Codex", claude: "Claude" };
const EVIDENCE = { runtime: "실행 프로세스의 현재 상태", last_turn: "마지막 응답 기록 기준", closed: "종료 기록 기준", unknown: "상태를 확인할 기록이 부족합니다" };

function timeLabel(value: string | null, now: number) {
  if (!value) return "기록 없음";
  const age = Math.max(0, now - Date.parse(value));
  if (!Number.isFinite(age)) return "기록 없음";
  if (age < 60_000) return "방금";
  if (age < 3_600_000) return `${Math.floor(age / 60_000)}분 전`;
  if (age < 86_400_000) return `${Math.floor(age / 3_600_000)}시간 전`;
  return `${Math.floor(age / 86_400_000)}일 전`;
}

export default function AgentSessionsPage() {
  const { user, isLoading } = useAuth();
  const { program } = useProgram();
  const allowed = canViewAgentSessions(user, program);
  const [now, setNow] = useState(Date.now);
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("all");
  const [state, setState] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(20);
  const detailRef = useRef<HTMLElement>(null);
  const query = useQuery({
    queryKey: devQueryKeys.agentSessions(user?.id, program?.tenantCode),
    queryFn: ({ signal }) => getAgentSessions(signal),
    enabled: allowed, refetchInterval: 30_000, refetchIntervalInBackground: false, retry: false,
  });
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const data = allowed ? query.data : undefined;
  const graph = useMemo(() => {
    const nodes = data?.nodes ?? [];
    const byId = new Map(nodes.map(node => [node.id, node]));
    const children = new Map<string, AgentNode[]>();
    for (const node of nodes) {
      if (node.parent_id && byId.has(node.parent_id)) {
        const siblings = children.get(node.parent_id) ?? [];
        siblings.push(node); children.set(node.parent_id, siblings);
      }
    }
    const active = new Set<string>();
    const included = new Set<string>();
    const needle = search.trim().toLocaleLowerCase();
    function includeAncestors(node: AgentNode, into: Set<string>) {
      let current: AgentNode | undefined = node;
      const visited = new Set<string>();
      while (current && !visited.has(current.id)) {
        visited.add(current.id); into.add(current.id);
        current = current.parent_id ? byId.get(current.parent_id) : undefined;
      }
    }
    for (const node of nodes) {
      if (node.status === "running") includeAncestors(node, active);
      if ((provider === "all" || node.provider === provider) && (state === "all" || node.status === state)
        && (!needle || `${node.title} ${node.role} ${PROVIDERS[node.provider]}`.toLocaleLowerCase().includes(needle))) includeAncestors(node, included);
    }
    const sort = (a: AgentNode, b: AgentNode) => (active.has(a.id) ? 0 : STATES[a.status].order) - (active.has(b.id) ? 0 : STATES[b.status].order) || (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
    for (const siblings of children.values()) siblings.sort(sort);
    return { nodes, byId, children, included, active, roots: nodes.filter(node => !node.parent_id || !byId.has(node.parent_id)).sort(sort) };
  }, [data, provider, state, search]);
  const visibleRoots = graph.roots.filter(node => graph.included.has(node.id));
  const selected = selectedId ? graph.byId.get(selectedId) : undefined;
  const stale = !!data && (data.source_status !== "connected" || query.isError || !data.collected_at
    || now - Date.parse(data.collected_at) > data.stale_after_seconds * 1000);
  const filtering = provider !== "all" || state !== "all" || !!search.trim();
  const rootsCount = graph.nodes.filter(node => !node.parent_id).length;
  const errorStatus = (query.error as { response?: { status?: number } } | null)?.response?.status;
  function toggle(id: string, open: boolean) {
    setExpanded(old => { const next = new Set(old); if (open) next.add(id); else next.delete(id); return next; });
    setCollapsed(old => { const next = new Set(old); if (open) next.delete(id); else next.add(id); return next; });
  }
  function selectNode(id: string) {
    setSelectedId(id);
    if (window.matchMedia("(max-width: 1100px)").matches) {
      requestAnimationFrame(() => {
        detailRef.current?.focus({ preventScroll: true });
        detailRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      });
    }
  }
  function renderNode(node: AgentNode, depth = 0, ancestors: string[] = []): ReactNode {
    if (ancestors.includes(node.id) || depth > 32 || !graph.included.has(node.id)) return null;
    const children = (graph.children.get(node.id) ?? []).filter(child => graph.included.has(child.id));
    const open = !collapsed.has(node.id) && (expanded.has(node.id) || filtering || graph.active.has(node.id));
    return <li key={node.id} className={s.treeItem}>
      <div className={`${s.row} ${selectedId === node.id ? s.selected : ""}`} style={{ "--depth": Math.min(depth, 4) } as CSSProperties}>
        {children.length > 0 ? <button type="button" className={s.expand} aria-expanded={open} aria-label={`${node.title} 하위 에이전트 ${open ? "접기" : "펼치기"}`} onClick={() => toggle(node.id, !open)}>{open ? <ChevronDown size={ICON.sm} /> : <ChevronRight size={ICON.sm} />}</button> : <span className={s.leaf} aria-hidden="true" />}
        <button type="button" className={s.nodeTitle} onClick={() => selectNode(node.id)} aria-pressed={selectedId === node.id}>
          <span className={s.titleText}>{node.title}</span>
          <span className={s.nodeMeta}>{PROVIDERS[node.provider]}<span>·</span>{node.role || "역할 미지정"}{children.length > 0 && <span>· 하위 {children.length}</span>}{node.parent_id && !graph.byId.has(node.parent_id) && <span>· 상위 기록 없음</span>}</span>
        </button>
        <span className={s.nodeState} title={EVIDENCE[node.evidence]}><Badge tone={stale ? "neutral" : STATES[node.status].tone} size="sm">{STATES[node.status].label}</Badge></span>
        <time className={s.nodeTime} dateTime={node.updated_at ?? undefined} title={node.updated_at ? new Date(node.updated_at).toLocaleString("ko-KR") : undefined}>{timeLabel(node.updated_at, now)}</time>
      </div>
      {open && children.length > 0 && <ol className={s.children}>{children.map(child => renderNode(child, depth + 1, [...ancestors, node.id]))}</ol>}
    </li>;
  }
  if (isLoading || !program) return <div className={s.empty} role="status">계정 정보를 확인하고 있습니다.</div>;
  if (!allowed || errorStatus === 401 || errorStatus === 403) return <section className={s.empty}><ShieldCheck size={ICON.xl} /><h1>접근 권한이 없습니다</h1><p>개발자 본인 계정에서만 확인할 수 있습니다.</p></section>;
  return <main className={`${layout.content} ${s.page}`}>
    <header className={s.header}>
      <div><div className={s.eyebrow}><GitBranch size={ICON.sm} /> DEVELOPER WORKSPACE</div><h1>AI 작업 상황판</h1><p>세션과 하위 에이전트의 흐름을 한눈에 확인합니다.</p></div>
      <div className={s.headerActions}><Badge tone="neutral" size="sm">읽기 전용</Badge><button type="button" className={s.button} onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw size={ICON.sm} className={query.isFetching ? s.spinning : undefined} />{query.isFetching ? "갱신 중" : "새로고침"}</button></div>
    </header>
    <div className={`${s.connection} ${stale || query.isError ? s.disconnected : ""}`} role="status"><span className={s.connectionDot} /><strong>{query.isPending ? "작업 현황 연결 중" : data?.source_status === "unavailable" ? "수집된 현황이 없습니다" : stale || query.isError ? "최신 현황 연결 끊김" : "현황 연결됨"}</strong><span>{data?.collected_at ? `마지막 수집 ${timeLabel(data.collected_at, now)}` : "개발 PC의 수집 상태를 확인해 주세요."}</span>{!stale && !query.isError && data?.collected_at && <span className={s.autoRefresh}>30초마다 갱신</span>}</div>
    {query.isError && <div className={s.notice} role="alert">현황을 불러오지 못했습니다. {data ? "아래는 마지막으로 수집한 기록입니다." : "잠시 후 다시 불러와 주세요."}<button type="button" onClick={() => void query.refetch()}>다시 불러오기</button></div>}
    {!!data?.source_errors.length && <div className={s.notice} role="alert">{data.source_errors.map(source => PROVIDERS[source]).join(" · ")} 기록을 읽지 못했습니다. 해당 제공자의 수는 전체 현황을 나타내지 않습니다.</div>}
    {data && data.source_status !== "unavailable" && <>
      <section className={s.summary} aria-label="세션 현황 요약"><div className={s.total}><span>세션</span><strong>{rootsCount}</strong><small>하위 에이전트 <b>{graph.nodes.length - rootsCount}</b></small></div>{(Object.entries(STATES) as [AgentState, typeof STATES[AgentState]][]).map(([key, value]) => <button type="button" key={key} className={`${s.summaryState} ${state === key ? s.summaryActive : ""}`} onClick={() => { setState(state === key ? "all" : key); setLimit(20); }} aria-pressed={state === key}><span>{value.label}</span><strong>{graph.nodes.filter(node => node.status === key).length}</strong></button>)}</section>
      <p className={s.scopeNote}>상태별 수는 세션과 하위 에이전트를 포함합니다. ‘응답 완료’는 마지막 응답의 종료이며, 업무나 배포의 성공 판정은 아닙니다.</p>
    </>}
    <div className={s.workspace}>
      <section className={s.board} aria-labelledby="session-tree-title">
        <div className={s.boardHeader}><div><h2 id="session-tree-title">세션 조직도</h2><span>{visibleRoots.length}개 세션 묶음</span></div><button type="button" className={s.textButton} onClick={() => { setExpanded(new Set()); setCollapsed(new Set(graph.nodes.map(node => node.id))); }}>모두 접기</button></div>
        <div className={s.filters}>
          <label className={s.search}><Search size={ICON.sm} /><input aria-label="세션·담당 역할 검색" placeholder="세션·담당 역할 검색" value={search} onChange={event => { setSearch(event.target.value); setLimit(20); }} /></label>
          <select aria-label="AI 제공자" value={provider} onChange={event => { setProvider(event.target.value); setLimit(20); }}><option value="all">전체 AI</option><option value="codex">Codex</option><option value="claude">Claude</option></select>
          <select aria-label="작업 상태" value={state} onChange={event => { setState(event.target.value); setLimit(20); }}><option value="all">전체 상태</option>{Object.entries(STATES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select>
        </div>
        {query.isPending ? <div className={s.empty} role="status">세션 현황을 불러오고 있습니다.</div> : !data ? <div className={s.empty}><p>아직 현황을 표시할 수 없습니다.</p></div> : !visibleRoots.length ? <div className={s.empty}><GitBranch size={ICON.xl} /><h3>{filtering ? "일치하는 세션이 없습니다" : data.source_status === "unavailable" ? "개발 PC 연결을 기다리고 있습니다" : "표시할 세션이 없습니다"}</h3><p>{filtering ? "검색어나 필터를 바꿔 확인해 주세요." : "새 상태가 수집되면 이곳에 표시됩니다."}</p>{filtering && <button type="button" className={s.button} onClick={() => { setSearch(""); setProvider("all"); setState("all"); }}>필터 초기화</button>}</div> : <ol className={s.tree}>{visibleRoots.slice(0, limit).map(node => renderNode(node))}</ol>}
        {visibleRoots.length > limit && <button type="button" className={s.more} onClick={() => setLimit(value => value + 20)}>세션 20개 더 보기</button>}
        <footer className={s.boardFooter}>최근 Codex 세션 최대 100개와 Academy의 Claude 기록을 표시합니다.{data?.truncated && " 표시 한도에 도달해 일부 오래된 에이전트는 생략되었습니다."}</footer>
      </section>
      <aside ref={detailRef} tabIndex={-1} className={s.detail} aria-label="선택한 세션 상세"><div className={s.detailHeading}><GitBranch size={ICON.md} /><h2>담당과 연결</h2></div>
        {selected ? <><h3>{selected.title}</h3><Badge tone={stale ? "neutral" : STATES[selected.status].tone}>{STATES[selected.status].label}</Badge><dl><dt>AI</dt><dd>{PROVIDERS[selected.provider]}</dd><dt>담당 역할</dt><dd>{selected.role || "미지정"}</dd><dt>상위 세션</dt><dd>{selected.parent_id ? graph.byId.get(selected.parent_id)?.title ?? "수집된 상위 기록 없음" : "독립 세션"}</dd><dt>하위 에이전트</dt><dd>{graph.children.get(selected.id)?.length ?? 0}개</dd><dt>최근 활동</dt><dd>{selected.updated_at ? new Date(selected.updated_at).toLocaleString("ko-KR") : "기록 없음"}</dd><dt>상태 근거</dt><dd>{EVIDENCE[selected.evidence]}</dd></dl></> : <div className={s.detailEmpty}><p>세션 이름을 선택하면<br />담당 역할과 연결 관계를 볼 수 있습니다.</p><span>확인된 관계만 연결합니다.</span></div>}
        <div className={s.privacy}><ShieldCheck size={ICON.sm} /><p>대화 본문과 인증정보는 전송하지 않습니다. 실행·중지 기능은 없습니다.</p></div>
      </aside>
    </div>
  </main>;
}
