import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Exam } from "../../types";
import { saveExamAsTemplate, updateAdminExam } from "../../api/adminExam";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { FiSave, FiChevronDown } from "react-icons/fi";
import "./ExamHeader.css";

/**
 * 시험 헤더: 제목, 상태 배지, 마감/진행 토글 버튼, 템플릿 저장(regular만).
 */
export default function ExamHeader({ exam }: { exam: Exam; sessionId?: number | null }) {
  const qc = useQueryClient();
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const templateDropdownRef = useRef<HTMLDivElement>(null);

  const isDraft = exam.status === "DRAFT";
  const isOpen = exam.status === "OPEN";
  const isClosed = exam.status === "CLOSED";
  const isRegular = exam.exam_type === "regular";
  const canSaveAsTemplate = isRegular && !exam.template_exam_id;
  const hasTemplate = isRegular && !!exam.template_exam_id;

  const statusMut = useMutation({
    mutationFn: (status: "OPEN" | "CLOSED") => updateAdminExam(exam.id, { status }),
    onSuccess: async (_, status) => {
      await qc.invalidateQueries({ queryKey: ["admin-exam", exam.id] });
      feedback.success(status === "OPEN" ? "진행 중으로 변경했습니다." : "마감 처리했습니다.");
    },
    onError: (e: any) => {
      feedback.error(e?.response?.data?.detail ?? "상태 변경에 실패했습니다.");
    },
  });

  const saveAsTemplateMut = useMutation({
    mutationFn: () => saveExamAsTemplate(exam.id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-exam", exam.id] });
      setTemplateModalOpen(false);
      setTemplateName("");
      feedback.success("템플릿으로 저장했습니다.");
    },
    onError: (e: any) => {
      feedback.error(e?.response?.data?.detail ?? "템플릿 저장에 실패했습니다.");
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

  const statusLabel = isDraft ? "초안" : isOpen ? "진행 중" : isClosed ? "마감" : exam.status;
  const statusTone = isOpen ? "success" : "neutral";

  const handleTemplateSaveConfirm = () => {
    saveAsTemplateMut.mutate();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{exam.title}</h2>
            <span className="ds-status-badge" data-tone={statusTone}>{statusLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canSaveAsTemplate && (
            <Button
              type="button"
              intent="secondary"
              size="md"
              onClick={() => setTemplateModalOpen(true)}
              disabled={saveAsTemplateMut.isPending}
              className="flex items-center gap-2"
            >
              <FiSave className="shrink-0" size={18} aria-hidden />
              템플릿으로 저장
            </Button>
          )}
          {hasTemplate && (
            <div className="relative" ref={templateDropdownRef}>
              <Button
                type="button"
                intent="secondary"
                size="md"
                onClick={() => setTemplateDropdownOpen((v) => !v)}
                className="flex items-center gap-2"
                aria-expanded={templateDropdownOpen}
                aria-haspopup="true"
              >
                템플릿으로 저장됨
                <FiChevronDown className="shrink-0" size={16} aria-hidden />
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
                    onClick={() => {
                      setTemplateDropdownOpen(false);
                      feedback.info("이 템플릿 삭제(연결 해제) 기능은 준비 중입니다.");
                    }}
                  >
                    이 템플릿 삭제
                  </button>
                </div>
              )}
            </div>
          )}

          {isRegular && (
            <Button
              type="button"
              intent={isOpen ? "secondary" : "primary"}
              size="lg"
              onClick={() => statusMut.mutate(isOpen ? "CLOSED" : "OPEN")}
              disabled={statusMut.isPending}
              className="min-w-[100px]"
            >
              {isOpen ? "마감" : "진행"}
            </Button>
          )}
        </div>
      </div>

      {canSaveAsTemplate && (
        <p className="text-sm text-[var(--text-muted)]">
          시험 템플릿으로 저장 시 다른 강의에서 동일한 시험을 응시할 수 있습니다.
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
              시험 문항, 정답, 커트라인 등이 그대로 복사됩니다. 템플릿으로 저장하시겠습니까?
            </p>
          </div>
        </ModalBody>
        <ModalFooter
          left={null}
          right={
            <>
              <Button intent="secondary" onClick={() => setTemplateModalOpen(false)}>
                취소
              </Button>
              <Button
                intent="primary"
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
   