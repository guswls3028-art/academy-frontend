// PATH: src/app_teacher/domains/exams/pages/ExamTemplatesPage.tsx
// 시험 템플릿 — 조회 + 적용 강의 목록 (편집은 강의→차시→시험에서)
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { ChevronLeft, FileText } from "@teacher/shared/ui/Icons";
import { Card, TabBar } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { fetchTemplatesWithUsage, fetchHomeworkTemplatesWithUsage } from "../api";

type Tab = "exam" | "homework";

export default function ExamTemplatesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("exam");

  const { data: examTemplates, isLoading: examLoading } = useQuery({
    queryKey: ["teacher-exam-templates-usage"],
    queryFn: fetchTemplatesWithUsage,
    enabled: tab === "exam",
  });

  const { data: hwTemplates, isLoading: hwLoading } = useQuery({
    queryKey: ["teacher-homework-templates-usage"],
    queryFn: fetchHomeworkTemplatesWithUsage,
    enabled: tab === "homework",
  });

  const loading = tab === "exam" ? examLoading : hwLoading;
  const items = tab === "exam" ? examTemplates : hwTemplates;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <button onClick={() => navigate(-1)} className="flex p-1 cursor-pointer"
          style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[17px] font-bold flex-1" style={{ color: "var(--tc-text)" }}>템플릿 관리</h1>
      </div>

      <TabBar
        tabs={[
          { key: "exam" as Tab, label: "시험 템플릿" },
          { key: "homework" as Tab, label: "과제 템플릿" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="text-[11px] px-1" style={{ color: "var(--tc-text-muted)", lineHeight: 1.5 }}>
        템플릿의 수정·생성은 <span style={{ fontWeight: 600 }}>강의 → 차시</span>에서 진행합니다. 이 페이지는 전체 템플릿과 적용 강의를 조회할 수 있습니다.
      </div>

      {loading ? <EmptyState scope="panel" tone="loading" title="불러오는 중…" /> :
        items && items.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {items.map((t: any) => (
              <TemplateCard key={t.id} template={t} kind={tab} />
            ))}
          </div>
        ) : <EmptyState scope="panel" tone="empty" title="템플릿이 없습니다" />}
    </div>
  );
}

function TemplateCard({ template, kind }: { template: any; kind: Tab }) {
  const navigate = useNavigate();
  const usages = Array.isArray(template.usages) ? template.usages : Array.isArray(template.applied_lectures) ? template.applied_lectures : [];
  const title = template.title ?? template.name ?? "제목 없음";
  const subject = template.subject ?? template.category;

  return (
    <Card style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
      <div className="flex items-center gap-2 mb-2">
        <FileText size={14} style={{ color: "var(--tc-primary)", flexShrink: 0 }} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: "var(--tc-text)" }}>{title}</div>
          {subject && <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>{subject}</div>}
        </div>
        <Badge tone={kind === "exam" ? "primary" : "info"} size="xs">{kind === "exam" ? "시험" : "과제"}</Badge>
      </div>
      {usages.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {usages.slice(0, 6).map((u: any, i: number) => (
            <button key={u.id ?? i} onClick={() => u.lecture_id && navigate(`/teacher/classes/${u.lecture_id}`)}
              className="flex items-center gap-1 text-[11px] font-medium cursor-pointer"
              style={{
                padding: "3px 8px", borderRadius: "var(--tc-radius-full)",
                border: "1px solid var(--tc-border)",
                background: "var(--tc-surface-soft)",
                color: "var(--tc-text-secondary)",
              }}>
              {(u.lecture_color || u.lecture_chip_label) && (
                <LectureChip lectureName={u.lecture_title ?? u.lecture_name ?? ""} color={u.lecture_color} chipLabel={u.lecture_chip_label} size={14} />
              )}
              <span className="truncate" style={{ maxWidth: 120 }}>{u.lecture_title ?? u.lecture_name}</span>
            </button>
          ))}
          {usages.length > 6 && (
            <span className="text-[11px] px-1 py-0.5" style={{ color: "var(--tc-text-muted)" }}>+{usages.length - 6}</span>
          )}
        </div>
      ) : (
        <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>적용된 강의가 없습니다.</div>
      )}
    </Card>
  );
}
