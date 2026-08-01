import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Badge, ICON } from "@/shared/ui/ds";
import { cx } from "@/shared/utils/cx";
import {
  Camera,
  ChevronRight,
  Clock,
  Search,
  Wrench,
} from "@teacher/shared/ui/Icons";
import {
  TEACHER_TOOL_CATEGORIES,
  TEACHER_TOOLS,
  type TeacherToolCategory,
  type TeacherToolIcon,
} from "../toolCatalog";
import styles from "./ToolsHubPage.module.css";

type CategoryFilter = "전체" | TeacherToolCategory;

const TOOL_ICONS: Record<TeacherToolIcon, typeof Camera> = {
  solver: Camera,
  timer: Clock,
};

export default function ToolsHubPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("전체");

  const filteredTools = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
    return TEACHER_TOOLS.filter((tool) => {
      if (category !== "전체" && tool.category !== category) return false;
      if (!normalizedQuery) return true;
      return [
        tool.title,
        tool.description,
        tool.category,
        ...tool.keywords,
      ].some((value) => value.toLocaleLowerCase("ko-KR").includes(normalizedQuery));
    });
  }, [category, query]);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroIcon} aria-hidden="true">
          <Wrench size={ICON.lg} />
        </div>
        <div>
          <p className={styles.eyebrow}>TEACHER TOOLKIT</p>
          <h1 className={styles.title}>도구</h1>
          <p className={styles.description}>
            수업 준비부터 현장 운영까지, 필요한 작업을 빠르게 꺼내 쓰세요.
          </p>
        </div>
      </header>

      <section className={styles.finder} aria-label="도구 찾기">
        <label className={styles.search}>
          <Search size={ICON.sm} aria-hidden="true" />
          <span className={styles.srOnly}>도구 검색</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="도구 이름이나 할 일 검색"
          />
        </label>
        <div className={styles.filters} aria-label="도구 분류">
          {(["전체", ...TEACHER_TOOL_CATEGORIES] as CategoryFilter[]).map((item) => (
            <button
              type="button"
              key={item}
              className={cx(styles.filterButton, category === item && styles.filterButtonActive)}
              onClick={() => setCategory(item)}
              aria-pressed={category === item}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <div className={styles.listHeader}>
        <h2>도구 모음</h2>
        <span>{filteredTools.length}개</span>
      </div>

      {filteredTools.length > 0 ? (
        <div className={styles.toolGrid}>
          {filteredTools.map((tool) => {
            const ToolIcon = TOOL_ICONS[tool.icon];
            return (
              <Link key={tool.id} to={tool.path} className={styles.toolCard}>
                <div className={styles.cardRail}>
                  <Badge
                    tone={tool.status === "beta" ? "warning" : "success"}
                    size="xs"
                  >
                    {tool.status === "beta" ? "Beta" : "안정"}
                  </Badge>
                  <span className={styles.categoryLabel}>{tool.category}</span>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.toolIcon} aria-hidden="true">
                    <ToolIcon size={ICON.lg} />
                  </div>
                  <div className={styles.cardCopy}>
                    <h3>{tool.title}</h3>
                    <p>{tool.description}</p>
                  </div>
                </div>
                <div className={styles.cardAction}>
                  <span>열기</span>
                  <ChevronRight size={ICON.sm} aria-hidden="true" />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className={styles.empty}>
          <Search size={ICON.lg} aria-hidden="true" />
          <strong>찾는 도구가 없습니다.</strong>
          <span>검색어나 분류를 바꿔 보세요.</span>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("전체");
            }}
          >
            검색 초기화
          </button>
        </div>
      )}
    </div>
  );
}
