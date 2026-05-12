/**
 * 성적 통계 랜딩 publish modal (Phase #13, 2026-05-12)
 *
 * 학원장 1버튼 publish — 시험 1개 × 전체 수강생 익명 석차+점수 → 랜딩 자동 노출.
 *
 * 입력:
 *   - 제목 (학원장 자유)
 *   - 익명 모드: initial(박○○) / phone_last4(박○○ 1234) / pseudonym(학생A 학생B)
 *   - 종료 날짜 (선택) — 외부 상세 노출 종료 날짜. 학원장은 영구 열람
 *
 * backend: POST /landing-public/showcase/publish/
 */
/* eslint-disable no-restricted-syntax */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import AdminModal from "@/shared/ui/modal/AdminModal";
import ModalHeader from "@/shared/ui/modal/ModalHeader";
import ModalBody from "@/shared/ui/modal/ModalBody";
import ModalFooter from "@/shared/ui/modal/ModalFooter";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { MODAL_WIDTH } from "@/shared/ui/modal/constants";

import {
  publishExamShowcase,
  type ShowcaseAnonymization,
} from "@/landing/api/publicCommunity";

type Props = {
  open: boolean;
  onClose: () => void;
  examId: number;
  examTitle: string;
  onPublished?: (showcaseId: number) => void;
};

const ANONYMIZATION_OPTIONS: Array<{ v: ShowcaseAnonymization; label: string; example: string; desc: string }> = [
  {
    v: "initial",
    label: "성+동그라미",
    example: "박○○",
    desc: "이름 첫 글자만 노출. 가장 보수적 (추천)",
  },
  {
    v: "phone_last4",
    label: "이름+전번 뒷자리",
    example: "박○○ (1234)",
    desc: "본인 확인용. 학부모가 자녀 식별 가능",
  },
  {
    v: "pseudonym",
    label: "익명 ID",
    example: "학생A · 학생B",
    desc: "이름 완전 가림. 통계만 강조",
  },
];

export default function ShowcasePublishModal({ open, onClose, examId, examTitle, onPublished }: Props) {
  const [title, setTitle] = useState(examTitle);
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<ShowcaseAnonymization>("initial");
  const [publishedUntil, setPublishedUntil] = useState<string>("");

  const publishMut = useMutation({
    mutationFn: () => publishExamShowcase({
      exam_id: examId,
      title: title.trim() || examTitle,
      description: description.trim() || undefined,
      anonymization_mode: mode,
      published_until: publishedUntil || null,
    }),
    onSuccess: (data) => {
      feedback.success(`성적 통계가 랜딩에 게시되었어요 (${data.summary.count}명)`);
      onPublished?.(data.id);
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || "게시 실패. 잠시 후 다시 시도해주세요.";
      feedback.error(msg);
    },
  });

  if (!open) return null;

  return (
    <AdminModal open onClose={onClose} type="action" width={MODAL_WIDTH.md}>
      <ModalHeader
        type="action"
        title="랜딩에 성적 통계 게시"
        description="학원 홈페이지에 이 시험의 익명 석차·점수를 자동 노출합니다."
      />
      <ModalBody>
        <div className="modal-scroll-body space-y-4">
          {/* 안내 */}
          <div className="rounded-lg border border-[color-mix(in_srgb,var(--color-brand-primary)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-brand-primary)_6%,var(--color-bg-surface))] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
            💡 학생 이름은 마스킹되어 외부 학부모도 안심하고 볼 수 있습니다. 게시 후에도 학원장은 영구 열람 가능합니다.
          </div>

          {/* 제목 */}
          <div className="modal-form-group">
            <label className="modal-section-label">제목</label>
            <input
              className="ds-input w-full"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={examTitle}
              autoFocus
              maxLength={200}
            />
          </div>

          {/* 설명 (선택) */}
          <div className="modal-form-group">
            <label className="modal-section-label">설명 (선택)</label>
            <input
              className="ds-input w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예) 2025년 1학기 중간고사 — 고1 통합과학 결과"
              maxLength={300}
            />
          </div>

          {/* 익명 모드 */}
          <div className="modal-form-group">
            <label className="modal-section-label">학생 이름 표시 방식</label>
            <div className="flex flex-col gap-2">
              {ANONYMIZATION_OPTIONS.map((opt) => {
                const on = opt.v === mode;
                return (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setMode(opt.v)}
                    data-testid={`showcase-anon-${opt.v}`}
                    className="text-left transition-colors"
                    style={{
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: `1px solid ${on ? "var(--color-brand-primary)" : "var(--color-border-divider)"}`,
                      background: on ? "color-mix(in srgb, var(--color-brand-primary) 8%, var(--color-bg-surface))" : "var(--color-bg-surface)",
                      cursor: "pointer",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-bold" style={{ color: on ? "var(--color-brand-primary)" : "var(--color-text-primary)" }}>
                        {opt.label}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
                        예: {opt.example}
                      </span>
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                      {opt.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 종료 날짜 */}
          <div className="modal-form-group">
            <label className="modal-section-label">외부 상세 노출 종료 날짜 (선택)</label>
            <input
              type="date"
              className="ds-input w-full"
              value={publishedUntil}
              onChange={(e) => setPublishedUntil(e.target.value)}
              data-testid="showcase-published-until"
            />
            <p className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>
              종료 후 외부에는 통계 요약만 노출되고 상세 석차는 가립니다. 학원장은 영구 열람 가능합니다.
            </p>
          </div>
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <>
            <Button intent="secondary" size="lg" onClick={onClose} disabled={publishMut.isPending}>
              취소
            </Button>
            <Button
              intent="primary"
              size="lg"
              onClick={() => publishMut.mutate()}
              disabled={publishMut.isPending || !title.trim()}
              data-testid="showcase-publish-submit"
            >
              {publishMut.isPending ? "게시 중…" : "랜딩에 게시"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
