import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button, ICON } from "@/shared/ui/ds";
import styles from "./LectureRankingsPage.module.css";

export type ExamGroup = {
  sessionId: number;
  label: string;
  exams: { id: number; key: string; title: string; included: boolean }[];
};

type Props = {
  groups: ExamGroup[];
  checked: ReadonlySet<string>;
  custom: boolean;
  onChange: (keys: ReadonlySet<string> | null) => void;
};

export default function RankingExamFilter({ groups, checked, custom, onChange }: Props) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const term = query.trim().toLocaleLowerCase();
  const visible = groups.map((group) => ({
    ...group,
    exams: group.exams.filter((exam) => exam.title.toLocaleLowerCase().includes(term)),
  })).filter((group) => group.exams.length > 0);
  const matches = visible.flatMap((group) => group.exams);
  const total = groups.reduce((count, group) => count + group.exams.length, 0);

  function toggle(key: string) {
    const next = new Set(checked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  }

  return (
    <details className={styles.examFilter}>
      <summary>
        <span>시험 직접 선택</span>
        <span className={styles.filterCount}>
          {custom ? `${checked.size} / ${total}개 선택` : `차시 기본값 · ${checked.size}개`}
        </span>
        <ChevronDown size={ICON.sm} aria-hidden />
      </summary>
      <div className={styles.filterBody}>
        {total > 0 && (
          <>
            <label htmlFor={searchId}>시험명 검색</label>
            <input id={searchId} type="search" value={query}
              placeholder="예: 모의고사" onChange={(event) => setQuery(event.target.value)} />
            <div className={styles.filterActions}>
              <Button size="sm" intent="secondary" disabled={matches.length === 0}
                onClick={() => onChange(new Set(matches.map((exam) => exam.key)))}>
                {term ? `검색 결과 ${matches.length}개만 선택` : "전체 선택"}
              </Button>
              <Button size="sm" intent="ghost" disabled={checked.size === 0} onClick={() => onChange(new Set())}>선택 해제</Button>
              {custom && <Button size="sm" intent="ghost" aria-label="차시 기본값 복원" onClick={() => onChange(null)}>기본값 복원</Button>}
            </div>
          </>
        )}
        {visible.length > 0 ? (
          <div className={styles.examGroups}>
            {visible.map((group) => (
              <fieldset key={group.sessionId}>
                <legend>{group.label}</legend>
                {group.exams.map((exam) => (
                  <label key={exam.key} className={styles.examOption}>
                    <input type="checkbox" checked={checked.has(exam.key)} onChange={() => toggle(exam.key)} />
                    <span>{exam.title}</span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        ) : <p className={styles.filterEmpty}>{total ? "검색 결과가 없습니다. 다른 시험명으로 검색해 주세요." : "이 기간에 등록된 시험이 없습니다."}</p>}
      </div>
    </details>
  );
}
