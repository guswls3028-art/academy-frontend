import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Badge, Button, EmptyState, ICON } from "@/shared/ui/ds";
import {
  fetchStudentActivities,
  studentSupportQueryKeys,
  type StudentActivityCategory,
} from "./studentSupport.api";
import styles from "./StudentActivityPanel.module.css";

const CATEGORY_OPTIONS: Array<{ value: StudentActivityCategory | ""; label: string }> = [
  { value: "", label: "전체 활동" },
  { value: "login", label: "로그인" },
  { value: "home", label: "홈·일반" },
  { value: "homework", label: "숙제" },
  { value: "video", label: "영상" },
  { value: "exam", label: "시험" },
  { value: "result", label: "성적 확인" },
  { value: "attendance", label: "출결" },
  { value: "clinic", label: "클리닉" },
  { value: "notice", label: "공지·질문" },
  { value: "profile", label: "내 정보" },
  { value: "fee", label: "수납" },
  { value: "guide", label: "사용 안내" },
];

const DEVICE_LABEL = {
  mobile: "휴대폰",
  tablet: "태블릿",
  desktop: "PC",
} as const;

function compactActivityTime(value: string): string {
  return new Date(value).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function exactActivityTime(value: string): string {
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function StudentActivityPanel({ studentId }: { studentId: number }) {
  const searchId = useId();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [category, setCategory] = useState<StudentActivityCategory | "">("");
  const [includeSupport, setIncludeSupport] = useState(false);
  const [draftQuery, setDraftQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const query = useQuery({
    queryKey: studentSupportQueryKeys.activities(
      studentId,
      days,
      category,
      includeSupport,
      appliedQuery,
    ),
    queryFn: () => fetchStudentActivities(studentId, {
      days,
      category,
      includeSupport,
      query: appliedQuery,
    }),
    enabled: studentId > 0,
  });

  const submitSearch = () => setAppliedQuery(draftQuery.trim());
  const clearSearch = () => {
    setDraftQuery("");
    setAppliedQuery("");
  };

  return (
    <section className={styles.root} aria-label="학생 활동 감사">
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>학생 활동 감사</h2>
          <p className={styles.description}>
            화면을 실제로 연 시각을 서버 수신 기준으로 보여줍니다.
          </p>
        </div>
        <div className={styles.filters}>
          <label>
            <span>기간</span>
            <select value={days} onChange={(event) => setDays(Number(event.target.value) as 7 | 30 | 90)}>
              <option value={7}>최근 7일</option>
              <option value={30}>최근 30일</option>
              <option value={90}>최근 90일</option>
            </select>
          </label>
          <label>
            <span>행동</span>
            <select value={category} onChange={(event) => setCategory(event.target.value as StudentActivityCategory | "")}>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className={styles.supportToggle}>
            <input
              type="checkbox"
              checked={includeSupport}
              onChange={(event) => setIncludeSupport(event.target.checked)}
            />
            <span>교직원 대리보기 포함</span>
          </label>
        </div>
      </header>

      <form
        className={styles.searchForm}
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          submitSearch();
        }}
      >
        <label htmlFor={searchId}>기록 검색</label>
        <div className={styles.searchControl}>
          <Search size={ICON.sm} aria-hidden />
          <input
            id={searchId}
            value={draftQuery}
            maxLength={80}
            placeholder="시험명, 과제명, 화면명 또는 교직원"
            onChange={(event) => setDraftQuery(event.target.value)}
          />
          {appliedQuery && (
            <button type="button" className={styles.clearSearch} onClick={clearSearch}>
              검색 지우기
            </button>
          )}
          <Button type="submit" size="sm">검색</Button>
        </div>
      </form>

      {query.isLoading ? (
        <EmptyState scope="panel" tone="loading" title="활동 기록을 불러오는 중…" />
      ) : query.isError ? (
        <EmptyState
          scope="panel"
          tone="error"
          title="활동 기록을 불러오지 못했습니다"
          description="잠시 후 다시 시도해 주세요."
          actions={<Button size="sm" onClick={() => void query.refetch()}>다시 불러오기</Button>}
        />
      ) : !query.data?.results.length ? (
        <EmptyState
          scope="panel"
          tone="empty"
          title={appliedQuery ? `“${appliedQuery}” 기록이 없습니다` : "조건에 맞는 활동이 없습니다"}
          description={appliedQuery
            ? "검색어를 줄이거나 기간과 행동 조건을 바꿔 보세요."
            : "새 활동은 로그인하거나 학생 화면을 연 뒤부터 기록됩니다."}
          actions={appliedQuery ? <Button size="sm" onClick={clearSearch}>전체 기록 보기</Button> : undefined}
        />
      ) : (
        <>
          <div className={styles.resultSummary} aria-live="polite">
            <div>
              <strong>{query.data.total_count.toLocaleString("ko-KR")}건</strong>
              <span>{appliedQuery ? `“${appliedQuery}” 검색 결과` : `최근 ${days}일 기록`}</span>
            </div>
            <span>
              {query.data.has_more
                ? `최신 ${query.data.count}건 표시 · 검색으로 범위를 좁혀 주세요`
                : "서버 수신 기록 전체"}
              {query.isFetching ? " · 갱신 중" : ""}
            </span>
          </div>
          <ol className={styles.timeline}>
            {query.data.results.map((item) => (
              <li key={item.id} className={styles.item}>
                <span className={styles.marker} data-support={item.actor_mode === "support" ? "true" : undefined} aria-hidden />
                <details className={styles.itemBody}>
                  <summary>
                    <div className={styles.itemTopline}>
                      <strong>{item.label}</strong>
                      {item.actor_mode === "support" && <Badge tone="info">교직원 대리보기</Badge>}
                    </div>
                    <div className={styles.meta}>
                      <time dateTime={item.occurred_at}>{compactActivityTime(item.occurred_at)}</time>
                      <span aria-hidden>·</span>
                      <span>{DEVICE_LABEL[item.device_class]}</span>
                      <span aria-hidden>·</span>
                      <span>{item.actor_label}</span>
                      <span className={styles.detailHint}>증거 상세</span>
                    </div>
                  </summary>
                  <div className={styles.evidenceCard}>
                    <dl>
                      <div><dt>서버 수신 시각</dt><dd>{exactActivityTime(item.occurred_at)}</dd></div>
                      <div><dt>사용 주체</dt><dd>{item.actor_label}</dd></div>
                      {item.target_label && <div><dt>확인 대상</dt><dd>{item.target_label}</dd></div>}
                      <div><dt>증거 번호</dt><dd>{item.evidence_id}</dd></div>
                    </dl>
                    <p>화면 열람 증거입니다. 제출·완료 여부는 해당 업무 기록과 함께 확인하세요.</p>
                  </div>
                </details>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
