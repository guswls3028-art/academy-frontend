import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw, Save } from "lucide-react";

import {
  defaultStudentGradeReportLayout,
  fetchStudentGradeReportLayout,
  updateStudentGradeReportLayout,
  type StudentGradeReportLayout,
  type StudentGradeReportSectionId,
} from "@/shared/api/contracts/studentGradeReportLayout";
import { accountQueryKeys } from "@/shared/api/queryKeys/account";
import { Button, ICON } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";

import styles from "./StudentGradeReportLayoutEditor.module.css";

const SECTION_COPY: Record<StudentGradeReportSectionId, { label: string; description: string }> = {
  score_trend: {
    label: "회차별 성적 추이",
    description: "시험별 점수·등수·상위 비율의 누적 변화",
  },
  score_comparison: {
    label: "성적 비교",
    description: "평균 득점률, 통과율, 전체 평균 비교 그래프",
  },
  lecture_average: {
    label: "강좌별 평균",
    description: "수강 중인 강좌별 평균 득점률",
  },
  improvement_priority: {
    label: "보완 우선순위",
    description: "반복 오답 문항과 최근 성적 해석 문구",
  },
  exam_summary: {
    label: "시험 성적 요약",
    description: "평균, 합격률, 시험 수, 평균 등수",
  },
  rank_position: {
    label: "내 위치 분석",
    description: "상·중·하위권 횟수와 최고·보완 필요 시험",
  },
  weakest_lecture: {
    label: "약점 강좌",
    description: "평균 득점률이 낮은 강좌 안내",
  },
  homework_summary: {
    label: "과제 현황",
    description: "채점 완료, 평균 득점률, 합격률",
  },
};

function sameLayout(a: StudentGradeReportLayout, b: StudentGradeReportLayout): boolean {
  return JSON.stringify(a.sections) === JSON.stringify(b.sections);
}

export default function StudentGradeReportLayoutEditor() {
  const queryClient = useQueryClient();
  const layoutQuery = useQuery({
    queryKey: accountQueryKeys.studentGradeReportLayout,
    queryFn: fetchStudentGradeReportLayout,
  });
  const [draft, setDraft] = useState<StudentGradeReportLayout>(defaultStudentGradeReportLayout);

  useEffect(() => {
    if (layoutQuery.data) setDraft(layoutQuery.data);
  }, [layoutQuery.data]);

  const saveMutation = useMutation({
    mutationFn: updateStudentGradeReportLayout,
    onSuccess: (saved) => {
      queryClient.setQueryData(accountQueryKeys.studentGradeReportLayout, saved);
      setDraft(saved);
      feedback.success("학생 성적표 구성을 저장했습니다.");
    },
    onError: () => feedback.error("학생 성적표 구성을 저장하지 못했습니다."),
  });

  const visibleCount = draft.sections.filter((section) => section.visible).length;
  const hasVisibleSection = visibleCount > 0;
  const isDirty = layoutQuery.data ? !sameLayout(draft, layoutQuery.data) : false;
  const visibleSections = useMemo(
    () => draft.sections.filter((section) => section.visible),
    [draft.sections],
  );

  const toggle = (id: StudentGradeReportSectionId) => {
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section) => (
        section.id === id ? { ...section, visible: !section.visible } : section
      )),
    }));
  };

  const move = (index: number, delta: -1 | 1) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= draft.sections.length) return;
    setDraft((current) => {
      const sections = [...current.sections];
      [sections[index], sections[nextIndex]] = [sections[nextIndex], sections[index]];
      return { ...current, sections };
    });
  };

  if (layoutQuery.isLoading) {
    return <div className={styles.state} role="status">성적표 구성을 불러오는 중…</div>;
  }

  if (layoutQuery.isError) {
    return (
      <div className={styles.state} role="alert">
        <span>성적표 구성을 불러오지 못했습니다.</span>
        <Button size="sm" intent="secondary" onClick={() => layoutQuery.refetch()}>다시 시도</Button>
      </div>
    );
  }

  return (
    <section className={styles.editor} aria-labelledby="student-grade-layout-title">
      <div className={styles.heading}>
        <div>
          <h2 id="student-grade-layout-title">학생 성적표 구성</h2>
          <p>학생·학부모의 성장 그래프에 보일 정보와 순서를 정합니다.</p>
        </div>
        <span className={styles.count}>{visibleCount}/{draft.sections.length}개 표시</span>
      </div>

      <div className={styles.workspace}>
        <div className={styles.sectionList} aria-label="성적표 섹션 순서">
          {draft.sections.map((section, index) => {
            const copy = SECTION_COPY[section.id];
            return (
              <div className={styles.sectionRow} data-visible={section.visible} key={section.id}>
                <span className={styles.order} aria-hidden>{String(index + 1).padStart(2, "0")}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={section.visible}
                  aria-label={`${copy.label} ${section.visible ? "숨기기" : "표시하기"}`}
                  className={styles.visibilityButton}
                  onClick={() => toggle(section.id)}
                >
                  {section.visible ? <Eye size={ICON.xs} /> : <EyeOff size={ICON.xs} />}
                </button>
                <div className={styles.sectionCopy}>
                  <strong>{copy.label}</strong>
                  <span>{copy.description}</span>
                </div>
                <div className={styles.orderButtons}>
                  <Button
                    iconOnly
                    intent="ghost"
                    size="sm"
                    leftIcon={<ArrowUp size={ICON.xs} />}
                    aria-label={`${copy.label} 위로 이동`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  />
                  <Button
                    iconOnly
                    intent="ghost"
                    size="sm"
                    leftIcon={<ArrowDown size={ICON.xs} />}
                    aria-label={`${copy.label} 아래로 이동`}
                    disabled={index === draft.sections.length - 1}
                    onClick={() => move(index, 1)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <aside className={styles.preview} aria-label="학생 화면 미리보기">
          <div className={styles.previewTop}>
            <span>학생 화면</span>
            <strong>성장 그래프</strong>
          </div>
          <div className={styles.previewSections}>
            {visibleSections.map((section, index) => (
              <div key={section.id} className={styles.previewSection}>
                <span>{index + 1}</span>
                {SECTION_COPY[section.id].label}
              </div>
            ))}
            {!hasVisibleSection && (
              <div className={styles.previewEmpty}>표시할 섹션을 선택해 주세요.</div>
            )}
          </div>
        </aside>
      </div>

      {!hasVisibleSection && (
        <p className={styles.validation} role="alert">학생에게 표시할 섹션을 하나 이상 선택해 주세요.</p>
      )}

      <div className={styles.actions}>
        <Button
          size="sm"
          intent="ghost"
          leftIcon={<RotateCcw size={ICON.xs} />}
          disabled={saveMutation.isPending}
          onClick={() => setDraft(defaultStudentGradeReportLayout())}
        >
          기본 구성으로 되돌리기
        </Button>
        <Button
          size="sm"
          intent="primary"
          leftIcon={<Save size={ICON.xs} />}
          loading={saveMutation.isPending}
          disabled={!isDirty || !hasVisibleSection}
          onClick={() => saveMutation.mutate(draft)}
        >
          구성 저장
        </Button>
      </div>
    </section>
  );
}
