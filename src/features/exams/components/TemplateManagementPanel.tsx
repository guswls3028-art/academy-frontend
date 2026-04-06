/**
 * TemplateManagementPanel
 *
 * 템플릿 목록 + 적용 중인 강의 연결을 시각적으로 보여주는 패널.
 * 디자인 원칙: 인간은 전체를 훑는다 — 카드 한 장에 템플릿 정체성 + 연결 강의가 한눈에 읽혀야 한다.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FileText, Plus } from "lucide-react";
import { EmptyState, Button } from "@/shared/ui/ds";
import {
  fetchTemplatesWithUsage,
  type TemplateWithUsage,
} from "../api/templatesWithUsage";
import CreateTemplateExamModal from "./create/CreateTemplateExamModal";
import styles from "./TemplateManagementPanel.module.css";

function formatDate(s: string | null | undefined): string {
  if (!s) return "";
  try {
    return new Date(s).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function TemplateManagementPanel() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates-with-usage"],
    queryFn: fetchTemplatesWithUsage,
  });

  const handleCreated = (_examId: number) => {
    qc.invalidateQueries({ queryKey: ["templates-with-usage"] });
  };

  const createButton = (
    <Button intent="primary" size="md" onClick={() => setShowCreate(true)}>
      <Plus size={16} />
      새 템플릿
    </Button>
  );

  if (isLoading) {
    return (
      <div className={styles.root}>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 0 var(--space-3)" }}>
          {createButton}
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className={styles.skeleton} />
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className={styles.emptyWrap}>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 0 var(--space-4)" }}>
          {createButton}
        </div>
        <EmptyState
          scope="panel"
          tone="empty"
          title="생성된 템플릿이 없습니다"
          description="새 템플릿 버튼을 눌러 직접 생성하거나, 강의 > 차시 > 시험에서 템플릿으로 저장할 수 있습니다."
        />
        <CreateTemplateExamModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 0 var(--space-3)" }}>
        {createButton}
      </div>
      {templates.map((tpl) => (
        <TemplateCard key={tpl.id} template={tpl} onNavigate={navigate} />
      ))}
      <CreateTemplateExamModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}

function TemplateCard({
  template: tpl,
  onNavigate,
}: {
  template: TemplateWithUsage;
  onNavigate: (path: string) => void;
}) {
  const hasLectures = tpl.used_lectures.length > 0;

  return (
    <div className={styles.card}>
      {/* ── 카드 헤더: 템플릿 정체성 ── */}
      <div className={styles.cardHeader}>
        <div className={styles.cardIcon}>
          <FileText size={20} />
        </div>
        <div className={styles.cardMeta}>
          <div className={styles.cardTitle}>{tpl.title || "제목 없음"}</div>
          <div className={styles.cardSub}>
            {tpl.subject && <span className={styles.subjectBadge}>{tpl.subject}</span>}
            {tpl.last_used_date && (
              <span className={styles.dateMeta}>
                최근 사용 {formatDate(tpl.last_used_date)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── 연결 강의 ── */}
      <div className={styles.lectureSection}>
        <div className={styles.lectureSectionLabel}>
          적용 중인 강의
          {hasLectures && (
            <span className={styles.lectureCount}>{tpl.used_lectures.length}</span>
          )}
        </div>

        {hasLectures ? (
          <div className={styles.lectureList}>
            {tpl.used_lectures.map((lec) => (
              <button
                key={lec.lecture_id}
                type="button"
                className={styles.lectureChip}
                onClick={() => onNavigate(`/admin/lectures/${lec.lecture_id}`)}
                title={`${lec.lecture_title} — 클릭하여 강의로 이동`}
              >
                <span
                  className={styles.chipDot}
                  style={{
                    background: lec.color || "var(--color-brand-primary)",
                  }}
                />
                <span className={styles.chipLabel}>
                  {lec.chip_label || lec.lecture_title.slice(0, 2)}
                </span>
                <span className={styles.chipTitle}>{lec.lecture_title}</span>
                {lec.last_used_date && (
                  <span className={styles.chipDate}>
                    {formatDate(lec.last_used_date)}
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.noLectures}>
            아직 이 템플릿을 사용하는 강의가 없습니다
          </div>
        )}
      </div>
    </div>
  );
}
