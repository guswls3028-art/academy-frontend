import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Exam } from "../../types";
import { saveExamAsTemplate } from "../../api/adminExam";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { FiSave, FiChevronDown } from "react-icons/fi";
import "./ExamHeader.css";

/**
 * 시험 헤더: 제목 + 템플릿 저장(regular만).
 * 2026-05-13 학원장 결정: 시험 단위 status(OPEN/CLOSED) UI 폐기. 학생별 Achievement SSOT 통합.
 * → 진행 중/마감 뱃지 + 종료하기 버튼 + statusMut mutation 제거.
 */
export default function ExamHeader({ exam }: { exam: Exam; sessionId?: number | null }) {
  const qc = useQueryClient();
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const templateDropdownRef = useRef<HTMLDivElement>(null);

  const isRegular = exam.exam_type === "regular";
  const canSaveAsTemplate = isRegular && !exam.template_exam_id;
  const hasTemplate = isRegular && !!exam.template_exam_id;

  const saveAsTemplateMut = useMutation({
    mutationFn: () => saveExamAsTemplate(exam.id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-exam", exam.id] });
      setTemplateModalOpen(false);
      setTemplateName("");
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

  const handleTemplateSaveConfirm = () => {
    saveAsTemplateMut.mutate();
  };

  return (
    <div className="assessment-detail-header assessment-detail-header--exam space-y-2 rounded-lg border-l-4 pl-3 py-2 border-l-[var(--color-brand-primary)] bg-[color-mix(in_srgb,var(--color-brand-primary)_8%,var(--color-bg-surface))]">
      <div className="assessment-detail-header__top">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="assessment-detail-header__title text-lg font-semibold">{exam.title}</h2>
          </div>
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
              leftIcon={<FiSave size={ICON_FOR_BUTTON.sm} />}
            >
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
                aria-expanded={templateDropdownOpen}
                aria-haspopup="true"
                className="assessment-template-button"
                rightIcon={<FiChevronDown size={ICON_FOR_BUTTON.sm} />}
              >
                템플릿으로 저장됨
              </Button>
              {templateDropdownOpen && (
                <div
                  className="exam-header-template-dropdown absolute right-0 top-full z-10 mt-1 min-w-[160px] rounded-md border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] py-1 shadow-lg"
                  role="menu"
                >
                  <button
                    type="button"
                    className="exam-header-template-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setTemplateDropdownOpen(false);
                      feedback.info("템플릿 목록은 시험 추가 시 불러오기에서 확인할 수 있습니다.");
                    }}
                  >
                    템플릿 관리
                  </button>
                  <button
                    type="button"
                    className="exam-header-template-dropdown-item exam-header-template-dropdown-item--danger"
                    role="menuitem"
                    disabled
                    aria-disabled="true"
                    title="템플릿 연결 해제는 현재 시험 추가/불러오기 흐름에서 관리합니다."
                  >
                    템플릿 연결 해제
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 2026-05-13 학원장 결정: 시험 단위 종료하기 버튼 폐기.
              학생별 진행 상태는 성적탭 점수 셀 Achievement 가 SSOT. */}
        </div>
      </div>

      {canSaveAsTemplate && (
        <p className="assessment-detail-header__desc text-sm text-[var(--text-muted)]">
          시험을 템플릿으로 저장하면 다른 강의에서 동일 시험을 불러와 사용할 수 있고, 서로 다른 강의의 통계를 합산해 볼 수 있습니다.
        </p>
      )}

      {/* 템플릿 저장 모달 */}
      <AdminModal
        open={templateModalOpen}
        onClose={() => !saveAsTemplateMut.isPending && setTemplateModalOpen(false)}
        type="action"
        width={MODAL_WIDTH.md}
      >
        <ModalHeader type="action" title="템플릿으로 저장" />
        <ModalBody>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-[var(--color-text-primary)]">
                템플릿 이름
              </span>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="예: 중간고사 1차"
                className="ds-input w-full"
              />
            </label>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              템플릿으로 저장하면 다른 강의·차시에서도 동일한 시험을 불러와 응시할 수 있습니다.
              시험 문항, 정답, 커트라인 등이 그대로 복사되며, 여러 강의의 통계를 합산해 볼 수 있습니다. 템플릿으로 저장하시겠습니까?
            </p>
          </div>
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
                onClick={handleTemplateSaveConfirm}
                disabled={saveAsTemplateMut.isPending}
                loading={saveAsTemplateMut.isPending}
              >
                저장
              </Button>
            </>
          }
        />
      </AdminModal>

      {exam.description?.trim() && (
        <div className="text-sm text-muted whitespace-pre-wrap">
          {exam.description}
        </div>
      )}
    </div>
  );
}
