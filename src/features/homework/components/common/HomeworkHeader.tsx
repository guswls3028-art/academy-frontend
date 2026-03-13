// PATH: src/features/homework/components/common/HomeworkHeader.tsx
/**
 * HomeworkHeader — 시험 ExamHeader와 동일: 제목, 상태 배지, 템플릿 저장(regular만), 진행/종료는 좌측 패널에서.
 */

import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { feedback } from "@/shared/ui/feedback/feedback";
import { saveHomeworkAsTemplate, updateAdminHomework } from "../../api/adminHomework";
import { FiSave, FiChevronDown } from "react-icons/fi";
import type { HomeworkSummary } from "../../types";
import "../../../exams/components/common/ExamHeader.css";

type Props = {
  homework: HomeworkSummary;
  sessionId?: number | null;
};

export default function HomeworkHeader({ homework, sessionId }: Props) {
  const qc = useQueryClient();
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const templateDropdownRef = useRef<HTMLDivElement>(null);

  const isDraft = homework.status === "DRAFT";
  const isOpen = homework.status === "OPEN";
  const isClosed = homework.status === "CLOSED";
  const isRegular = (homework.homework_type ?? "regular") === "regular";
  const canSaveAsTemplate = isRegular && !homework.template_homework_id;
  const hasTemplate = isRegular && !!homework.template_homework_id;

  const saveAsTemplateMut = useMutation({
    mutationFn: () => saveHomeworkAsTemplate(homework.id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-homework", homework.id] });
      setTemplateModalOpen(false);
      feedback.success("템플릿으로 저장했습니다.");
    },
    onError: (e: any) => {
      feedback.error(e?.response?.data?.detail ?? "템플릿 저장에 실패했습니다.");
    },
  });

  const statusMut = useMutation({
    mutationFn: (status: "OPEN" | "CLOSED") => updateAdminHomework(homework.id, { status }),
    onSuccess: async (_, status) => {
      await qc.invalidateQueries({ queryKey: ["admin-homework", homework.id] });
      if (sessionId != null) {
        await qc.invalidateQueries({ queryKey: ["session-homeworks", sessionId] });
        await qc.invalidateQueries({ queryKey: ["session-scores", sessionId] });
      }
      feedback.success(status === "OPEN" ? "진행 중으로 변경했습니다." : "과제를 종료했습니다.");
    },
    onError: (e: any) => {
      feedback.error(e?.response?.data?.detail ?? "상태 변경에 실패했습니다.");
    },
  });

  const handleCloseHomework = () => {
    if (!window.confirm("과제를 종료하시겠습니까? 종료 이후엔 제출이 불가합니다.")) return;
    statusMut.mutate("CLOSED");
  };

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

  const statusLabel = isDraft ? "초안" : isOpen ? "진행 중" : isClosed ? "마감" : homework.status;
  const statusTone = isOpen ? "success" : isClosed ? "danger" : "neutral";

  const bannerClass = isOpen
    ? "rounded-lg border-l-4 border-l-[var(--color-success)] pl-3 py-2"
    : isClosed
      ? "rounded-lg border-l-4 border-l-[var(--color-border-divider)] pl-3 py-2"
      : "";
  const bannerBg = isOpen
    ? { background: "color-mix(in srgb, var(--color-success) 12%, var(--color-bg-surface))" }
    : isClosed
      ? { background: "color-mix(in srgb, var(--color-border-divider) 12%, var(--color-bg-surface))", opacity: 0.75 }
      : undefined;

  return (
    <div className={`space-y-2 ${bannerClass}`} style={bannerBg}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className={`text-lg font-semibold text-[var(--text-primary)] ${isClosed ? "line-through opacity-65" : ""}`}>
            {homework.title}
          </h2>
          <span className="ds-status-badge" data-tone={statusTone}>{statusLabel}</span>
        </div>

        <div className="flex items-center gap-2">
          {canSaveAsTemplate && (
            <Button
              type="button"
              intent="secondary"
              size="xl"
              onClick={() => setTemplateModalOpen(true)}
              disabled={saveAsTemplateMut.isPending}
              className="flex items-center gap-2"
            >
              <FiSave className="shrink-0" size={22} aria-hidden />
              템플릿으로 저장
            </Button>
          )}
          {hasTemplate && (
            <div className="relative" ref={templateDropdownRef}>
              <Button
                type="button"
                intent="secondary"
                size="xl"
                onClick={() => setTemplateDropdownOpen((v) => !v)}
                className="flex items-center gap-2"
                aria-expanded={templateDropdownOpen}
                aria-haspopup="true"
              >
                템플릿으로 저장됨
                <FiChevronDown className="shrink-0" size={20} aria-hidden />
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
                      feedback.info("과제 추가 시 불러오기에서 템플릿 목록을 확인할 수 있습니다.");
                    }}
                  >
                    템플릿 관리
                  </button>
                </div>
              )}
            </div>
          )}

          {isDraft && (
            <Button
              type="button"
              intent="primary"
              size="xl"
              onClick={() => statusMut.mutate("OPEN")}
              disabled={statusMut.isPending}
              className="min-w-[140px]"
            >
              {statusMut.isPending ? "처리 중…" : "진행"}
            </Button>
          )}
          {isOpen && (
            <Button
              type="button"
              intent="danger"
              size="xl"
              onClick={handleCloseHomework}
              disabled={statusMut.isPending}
              className="min-w-[140px]"
            >
              {statusMut.isPending ? "처리 중…" : "종료하기"}
            </Button>
          )}
        </div>
      </div>

      {canSaveAsTemplate && (
        <p className="text-sm text-[var(--text-muted)]">
          과제를 템플릿으로 저장하면 다른 강의에서 동일 과제를 불러와 사용할 수 있고, 서로 다른 강의의 통계를 합산해 볼 수 있습니다.
        </p>
      )}

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

      <div className="text-sm text-[var(--color-text-muted)]">
        ※ 과제의 <b>성적 입력 · 판정</b>은 <b>세션 &gt; 성적</b> 메뉴에서
        진행합니다.
      </div>
    </div>
  );
}
