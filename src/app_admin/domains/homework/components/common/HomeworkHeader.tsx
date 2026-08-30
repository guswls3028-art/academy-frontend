// PATH: src/app_admin/domains/homework/components/common/HomeworkHeader.tsx
/**
 * HomeworkHeader — 시험 ExamHeader와 동일: 제목, 템플릿 저장(regular만).
 */

import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { feedback } from "@/shared/ui/feedback/feedback";
import { saveHomeworkAsTemplate } from "../../api/adminHomework";
import { FiArrowRight, FiSave, FiChevronDown } from "react-icons/fi";
import type { HomeworkSummary } from "../../types";
import { QUERY_KEYS } from "../../queryKeys";
import "@/shared/ui/assessment/AssessmentDetailHeader.css";

type Props = {
  homework: HomeworkSummary;
  sessionId?: number | null;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
};

export default function HomeworkHeader({ homework, primaryAction }: Props) {
  const qc = useQueryClient();
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const templateDropdownRef = useRef<HTMLDivElement>(null);

  const isRegular = (homework.homework_type ?? "regular") === "regular";
  const canSaveAsTemplate = isRegular && !homework.template_homework_id;
  const hasTemplate = isRegular && !!homework.template_homework_id;

  const saveAsTemplateMut = useMutation({
    mutationFn: () => saveHomeworkAsTemplate(homework.id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN_HOMEWORK(homework.id) });
      setTemplateModalOpen(false);
      feedback.success("템플릿으로 저장했습니다.");
    },
    onError: (e: unknown) => {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      feedback.error(detail ?? "템플릿 저장에 실패했습니다.");
    },
  });

  useEffect(() => {
    if (!templateDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (templateDropdownRef.current && !templateDropdownRef.current.contains(e.target as Node)) {
        setTemplateDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [templateDropdownOpen]);

  return (
    <header className="assessment-detail-header assessment-detail-header--homework">
      <div className="assessment-detail-header__top">
        <div className="assessment-detail-header__copy">
          <p className="assessment-detail-header__eyebrow">과제 운영</p>
          <h2 className="assessment-detail-header__title">{homework.title}</h2>
          <p className="assessment-detail-header__desc">
            과제 설정과 제출 검수를 이어서 관리합니다. 성적 입력·판정은 세션 &gt; 성적에서 진행합니다.
          </p>
        </div>

        <div className="assessment-detail-header__actions">
          {canSaveAsTemplate && (
            <Button
              type="button"
              intent="secondary"
              size="sm"
              onClick={() => setTemplateModalOpen(true)}
              disabled={saveAsTemplateMut.isPending}
              className="assessment-template-button"
            >
              <FiSave className="shrink-0" size={16} aria-hidden />
              템플릿으로 저장
            </Button>
          )}
          {hasTemplate && (
            <div className="relative" ref={templateDropdownRef}>
              <Button
                type="button"
                intent="secondary"
                size="sm"
                onClick={() => setTemplateDropdownOpen((v) => !v)}
                className="assessment-template-button"
                aria-expanded={templateDropdownOpen}
                aria-haspopup="true"
              >
                템플릿으로 저장됨
                <FiChevronDown className="shrink-0" size={20} aria-hidden />
              </Button>
              {templateDropdownOpen && (
                <div
                  className="assessment-template-dropdown absolute right-0 top-full z-10 mt-1 min-w-[160px] rounded-md border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] py-1 shadow-lg"
                  role="menu"
                >
                  <button
                    type="button"
                    className="assessment-template-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setTemplateDropdownOpen(false);
                      feedback.info("과제 추가 시 불러오기에서 템플릿 목록을 확인할 수 있습니다.");
                    }}
                  >
                    템플릿 관리
                  </button>
                </div>
              )}
            </div>
          )}
          {primaryAction && (
            <Button
              type="button"
              intent="primary"
              size="md"
              onClick={primaryAction.onClick}
              className="assessment-primary-action"
              data-testid="assessment-primary-action"
              rightIcon={<FiArrowRight size={ICON_FOR_BUTTON.sm} />}
            >
              {primaryAction.label}
            </Button>
          )}
        </div>
      </div>

      <AdminModal
        open={templateModalOpen}
        onClose={() => !saveAsTemplateMut.isPending && setTemplateModalOpen(false)}
        type="action"
        width={MODAL_WIDTH.md}
      >
        <ModalHeader type="action" title="템플릿으로 저장" />
        <ModalBody>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            템플릿으로 저장하면 다른 강의·차시에서도 동일한 과제를 불러와 사용할 수 있습니다.
            여러 강의의 통계를 합산해 볼 수 있습니다. 템플릿으로 저장하시겠습니까?
          </p>
        </ModalBody>
        <ModalFooter
          left={null}
          right={
            <>
              <Button intent="secondary" size="xl" onClick={() => setTemplateModalOpen(false)}>
                취소
              </Button>
              <Button
                intent="primary"
                size="xl"
                onClick={() => saveAsTemplateMut.mutate()}
                disabled={saveAsTemplateMut.isPending}
                loading={saveAsTemplateMut.isPending}
              >
                저장
              </Button>
            </>
          }
        />
      </AdminModal>
    </header>
  );
}
