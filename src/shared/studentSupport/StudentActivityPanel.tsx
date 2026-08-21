import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, EmptyState } from "@/shared/ui/ds";
import {
  fetchStudentActivities,
  type StudentActivityCategory,
} from "./studentSupport.api";
import styles from "./StudentActivityPanel.module.css";

const CATEGORY_OPTIONS: Array<{ value: StudentActivityCategory | ""; label: string }> = [
  { value: "", label: "전체 활동" },
  { value: "login", label: "로그인" },
  { value: "homework", label: "숙제" },
  { value: "video", label: "영상" },
  { value: "exam", label: "시험" },
  { value: "result", label: "성적 확인" },
  { value: "attendance", label: "출결" },
  { value: "clinic", label: "클리닉" },
  { value: "notice", label: "공지·질문" },
];

const DEVICE_LABEL = {
  mobile: "휴대폰",
  tablet: "태블릿",
  desktop: "PC",
} as const;

export default function StudentActivityPanel({ studentId }: { studentId: number }) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [category, setCategory] = useState<StudentActivityCategory | "">("");
  const [includeSupport, setIncludeSupport] = useState(false);
  const query = useQuery({
    queryKey: ["student-activities", studentId, days, category, includeSupport],
    queryFn: () => fetchStudentActivities(studentId, { days, category, includeSupport }),
    enabled: studentId > 0,
  });

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

      {query.isLoading ? (
        <EmptyState scope="panel" tone="loading" title="활동 기록을 불러오는 중…" />
      ) : query.isError ? (
        <EmptyState
          scope="panel"
          tone="error"
          title="활동 기록을 불러오지 못했습니다"
          description="잠시 후 다시 시도해 주세요."
          actions={<button type="button" className={styles.retry} onClick={() => void query.refetch()}>다시 불러오기</button>}
        />
      ) : !query.data?.results.length ? (
        <EmptyState
          scope="panel"
          tone="empty"
          title="조건에 맞는 활동이 없습니다"
          description="새 활동은 로그인하거나 학생 화면을 연 뒤부터 기록됩니다."
        />
      ) : (
        <ol className={styles.timeline}>
          {query.data.results.map((item) => (
            <li key={item.id} className={styles.item}>
              <span className={styles.marker} data-support={item.actor_mode === "support" ? "true" : undefined} aria-hidden />
              <div className={styles.itemBody}>
                <div className={styles.itemTopline}>
                  <strong>{item.label}</strong>
                  {item.actor_mode === "support" && <Badge tone="info">교직원 대리보기</Badge>}
                </div>
                <div className={styles.meta}>
                  <time dateTime={item.occurred_at}>
                    {new Date(item.occurred_at).toLocaleString("ko-KR", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                  <span aria-hidden>·</span>
                  <span>{DEVICE_LABEL[item.device_class]}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
