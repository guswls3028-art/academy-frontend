// PATH: src/app_teacher/domains/exams/pages/ExamTemplatesPage.tsx
// 시험 템플릿 — 조회 + 적용 강의 목록 (편집은 강의→차시→시험에서)
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ICON } from "@/shared/ui/ds";
import { ChevronLeft, FileText } from "@teacher/shared/ui/Icons";
import { TabBar } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { fetchTemplatesWithUsage, fetchHomeworkTemplatesWithUsage } from "../api";
import type { TeacherTemplateWithUsage } from "../api";
import { teacherExamsQueryKeys } from "../queryKeys";
import styles from "./ExamTemplatesPage.module.css";

type Tab = "exam" | "homework";

export default function ExamTemplatesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("exam");

  const { data: examTemplates, isLoading: examLoading } = useQuery({
    queryKey: teacherExamsQueryKeys.examTemplatesUsage,
    queryFn: fetchTemplatesWithUsage,
    enabled: tab === "exam",
  });

  const { data: hwTemplates, isLoading: hwLoading } = useQuery({
    queryKey: teacherExamsQueryKeys.homeworkTemplatesUsage,
    queryFn: fetchHomeworkTemplatesWithUsage,
    enabled: tab === "homework",
  });

  const loading = tab === "exam" ? examLoading : hwLoading;
  const items = tab === "exam" ? examTemplates : hwTemplates;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button onClick={() => navigate(-1)} className={styles.backButton} type="button">
          <ChevronLeft size={ICON.lg} />
        </button>
        <h1 className={styles.title}>템플릿 관리</h1>
      </div>

      <TabBar
        tabs={[
          { key: "exam" as Tab, label: "시험 템플릿" },
          { key: "homework" as Tab, label: "과제 템플릿" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className={styles.description}>
        템플릿의 수정·생성은 <span className={styles.descriptionStrong}>강의 → 차시</span>에서 진행합니다. 이 페이지는 전체 템플릿과 적용 강의를 조회할 수 있습니다.
      </div>

      {loading ? <EmptyState scope="panel" tone="loading" title="불러오는 중…" /> :
        items && items.length > 0 ? (
          <div className={styles.templateList}>
            {items.map((template) => (
              <TemplateCard key={template.id} template={template} kind={tab} />
            ))}
          </div>
        ) : <EmptyState scope="panel" tone="empty" title="템플릿이 없습니다" />}
    </div>
  );
}

function TemplateCard({ template, kind }: { template: TeacherTemplateWithUsage; kind: Tab }) {
  const navigate = useNavigate();
  const usages = Array.isArray(template.usages) ? template.usages : Array.isArray(template.applied_lectures) ? template.applied_lectures : [];
  const title = template.title ?? template.name ?? "제목 없음";
  const subject = template.subject ?? template.category;

  return (
    <div className={styles.templateCard}>
      <div className={styles.templateHeader}>
        <FileText size={ICON.xs} className={styles.templateIcon} />
        <div className={styles.templateText}>
          <div className={styles.templateTitle}>{title}</div>
          {subject && <div className={styles.subject}>{subject}</div>}
        </div>
        <Badge tone={kind === "exam" ? "primary" : "info"} size="xs">{kind === "exam" ? "시험" : "과제"}</Badge>
      </div>
      {usages.length > 0 ? (
        <div className={styles.usageList}>
          {usages.slice(0, 6).map((usage, index) => (
            <button
              key={usage.id ?? index}
              onClick={() => usage.lecture_id && navigate(`/teacher/classes/${usage.lecture_id}`)}
              className={styles.usageButton}
              type="button"
            >
              {(usage.lecture_color || usage.lecture_chip_label) && (
                <LectureChip
                  lectureName={usage.lecture_title ?? usage.lecture_name ?? ""}
                  color={usage.lecture_color ?? undefined}
                  chipLabel={usage.lecture_chip_label}
                  size={20}
                />
              )}
              <span className={styles.lectureName}>{usage.lecture_title ?? usage.lecture_name}</span>
            </button>
          ))}
          {usages.length > 6 && (
            <span className={styles.moreCount}>+{usages.length - 6}</span>
          )}
        </div>
      ) : (
        <div className={styles.emptyUsage}>적용된 강의가 없습니다.</div>
      )}
    </div>
  );
}
