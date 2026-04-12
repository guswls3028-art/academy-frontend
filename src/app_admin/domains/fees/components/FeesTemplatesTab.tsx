// PATH: src/app_admin/domains/fees/components/FeesTemplatesTab.tsx
// 비목 관리 탭 — CRUD 테이블 + 모달

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, EmptyState } from "@/shared/ui/ds";
import { DomainTable } from "@/shared/ui/domain";
import AdminModal from "@/shared/ui/modal/AdminModal";
import { ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { MODAL_WIDTH } from "@/shared/ui/modal/constants";
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  fetchFeeTemplates,
  createFeeTemplate,
  updateFeeTemplate,
  deleteFeeTemplate,
  fetchLectureOptions,
  type FeeTemplate,
  type FeeType,
  type BillingCycle,
  type LectureOption,
} from "../api/fees.api";

function formatKRW(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}

const FEE_TYPE_OPTIONS: { value: FeeType; label: string }[] = [
  { value: "TUITION", label: "수강료" },
  { value: "TEXTBOOK", label: "교재비" },
  { value: "HANDOUT", label: "판서/프린트" },
  { value: "REGISTRATION", label: "등록비" },
  { value: "MATERIAL", label: "재료비" },
  { value: "OTHER", label: "기타" },
];

const CYCLE_OPTIONS: { value: BillingCycle; label: string }[] = [
  { value: "MONTHLY", label: "월납" },
  { value: "ONE_TIME", label: "일시납" },
];

type FormState = {
  name: string;
  fee_type: FeeType;
  billing_cycle: BillingCycle;
  amount: string;
  lecture: string;
  auto_assign: boolean;
  memo: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  fee_type: "TUITION",
  billing_cycle: "MONTHLY",
  amount: "",
  lecture: "",
  auto_assign: true,
  memo: "",
};

export default function FeesTemplatesTab() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FeeTemplate | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data: lectures } = useQuery({
    queryKey: ["fees", "lecture-options"],
    queryFn: fetchLectureOptions,
    staleTime: 60_000,
  });

  const { data: templates, isLoading } = useQuery({
    queryKey: ["fees", "templates"],
    queryFn: () => fetchFeeTemplates(),
    staleTime: 10_000,
  });

  const createMut = useMutation({
    mutationFn: createFeeTemplate,
    onSuccess: () => {
      feedback.success("비목이 생성되었습니다");
      qc.invalidateQueries({ queryKey: ["fees", "templates"] });
      closeModal();
    },
    onError: (e: any) => feedback.error(e?.response?.data?.detail || e?.response?.data?.name?.[0] || "생성 실패"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FeeTemplate> }) => updateFeeTemplate(id, data),
    onSuccess: () => {
      feedback.success("비목이 수정되었습니다");
      qc.invalidateQueries({ queryKey: ["fees", "templates"] });
      closeModal();
    },
    onError: () => feedback.error("수정 실패"),
  });

  const deleteMut = useMutation({
    mutationFn: deleteFeeTemplate,
    onSuccess: () => {
      feedback.success("비목이 비활성화되었습니다");
      qc.invalidateQueries({ queryKey: ["fees", "templates"] });
    },
    onError: () => feedback.error("삭제 실패"),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(t: FeeTemplate) {
    setEditing(t);
    setForm({
      name: t.name,
      fee_type: t.fee_type,
      billing_cycle: t.billing_cycle,
      amount: String(t.amount),
      lecture: t.lecture ? String(t.lecture) : "",
      auto_assign: t.auto_assign,
      memo: t.memo,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  function handleSave() {
    const payload: any = {
      name: form.name,
      fee_type: form.fee_type,
      billing_cycle: form.billing_cycle,
      amount: Number(form.amount),
      lecture: form.lecture ? Number(form.lecture) : null,
      auto_assign: form.auto_assign,
      memo: form.memo,
    };

    if (!form.name.trim() || !form.amount || Number(form.amount) <= 0) {
      feedback.error("이름과 금액은 필수입니다");
      return;
    }

    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button intent="primary" onClick={openCreate}>비목 추가</Button>
      </div>

      {isLoading ? (
        <div style={{ padding: 24, color: "var(--color-text-muted)" }}>불러오는 중...</div>
      ) : !templates?.length ? (
        <EmptyState title="등록된 비목이 없습니다" description="'비목 추가' 버튼으로 수강료, 교재비 등을 등록하세요." />
      ) : (
        <DomainTable>
          <table className="ds-table">
            <thead>
              <tr>
                <th>비목 이름</th>
                <th>유형</th>
                <th>주기</th>
                <th style={{ textAlign: "right" }}>금액</th>
                <th>연결 강의</th>
                <th>자동할당</th>
                <th>상태</th>
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 500 }}>{t.name}</td>
                  <td>{t.fee_type_display}</td>
                  <td>{t.billing_cycle_display}</td>
                  <td style={{ textAlign: "right" }}>{formatKRW(t.amount)}</td>
                  <td>{t.lecture_title || "-"}</td>
                  <td style={{ fontSize: 13 }}>{t.auto_assign ? "자동" : "수동"}</td>
                  <td>
                    <span style={{
                      color: t.is_active ? "var(--color-success)" : "var(--color-text-muted)",
                      fontWeight: 500,
                      fontSize: 13,
                    }}>
                      {t.is_active ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Button size="sm" intent="ghost" onClick={() => openEdit(t)}>수정</Button>
                      {t.is_active && (
                        <Button
                          size="sm"
                          intent="ghost"
                          onClick={() => {
                            if (confirm(`'${t.name}'을(를) 비활성화하시겠습니까?`)) {
                              deleteMut.mutate(t.id);
                            }
                          }}
                        >
                          비활성
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DomainTable>
      )}

      {/* ===== Create/Edit Modal ===== */}
      <AdminModal open={modalOpen} onClose={closeModal} type="action" width={MODAL_WIDTH.form}>
        <ModalHeader title={editing ? "비목 수정" : "비목 추가"} type="action" />
        <ModalBody>
          <div className="modal-scroll-body">
            <div className="modal-form-group">
              <label className="modal-section-label">비목 이름 *</label>
              <input
                className="ds-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예: 수학 수강료, 영어 교재비"
                data-required
              />
            </div>
            <div className="modal-form-row--2">
              <div className="modal-form-group">
                <label className="modal-section-label">유형</label>
                <select
                  className="ds-select"
                  value={form.fee_type}
                  onChange={(e) => setForm({ ...form, fee_type: e.target.value as FeeType })}
                >
                  {FEE_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="modal-form-group">
                <label className="modal-section-label">청구 주기</label>
                <select
                  className="ds-select"
                  value={form.billing_cycle}
                  onChange={(e) => setForm({ ...form, billing_cycle: e.target.value as BillingCycle })}
                >
                  {CYCLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-form-group">
              <label className="modal-section-label">금액 (원) *</label>
              <input
                className="ds-input"
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="예: 300000"
                min={0}
                data-required
              />
            </div>
            <div className="modal-form-group">
              <label className="modal-section-label">연결 강의 (선택)</label>
              <select
                className="ds-select"
                value={form.lecture}
                onChange={(e) => setForm({ ...form, lecture: e.target.value })}
              >
                <option value="">연결 안 함 (독립 비목)</option>
                {lectures?.map((lec) => (
                  <option key={lec.id} value={String(lec.id)}>{lec.title}</option>
                ))}
              </select>
              <div className="modal-hint">
                강의에 연결하면 해당 강의 수강 등록 시 학생에게 자동으로 이 비목이 할당됩니다.
              </div>
              {form.lecture && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={form.auto_assign}
                    onChange={(e) => setForm({ ...form, auto_assign: e.target.checked })}
                  />
                  수강 등록 시 자동 할당
                  <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                    (해제하면 수동으로만 할당 가능)
                  </span>
                </label>
              )}
            </div>
            <div className="modal-form-group">
              <label className="modal-section-label">메모</label>
              <textarea
                className="ds-textarea"
                value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })}
                rows={2}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter
          right={
            <>
              <Button intent="secondary" onClick={closeModal}>취소</Button>
              <Button intent="primary" onClick={handleSave} disabled={isPending}>
                {isPending ? "저장 중..." : editing ? "수정" : "추가"}
              </Button>
            </>
          }
        />
      </AdminModal>
    </div>
  );
}
