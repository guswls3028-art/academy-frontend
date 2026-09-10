// PATH: src/app_admin/domains/staff/pages/HomePage/StaffCreateModal.tsx
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  AdminModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  MODAL_WIDTH,
} from "@/shared/ui/modal";
import { ActionButton } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import { staffQueryKeys } from "../../queryKeys";
import {
  createStaff,
  type StaffPosition,
} from "../../api/staff.api";
import { STAFF_POSITION_OPTIONS } from "../../utils/staffIdentity";
import styles from "./StaffCreateModal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

type PermissionRole = "TEACHER" | "ASSISTANT";

export default function StaffCreateModal({ open, onClose }: Props) {
  const qc = useQueryClient();

  const [form, setForm] = useState({
    username: "",
    password: "",
    name: "",
    phone: "",
    position: "ASSISTANT" as StaffPosition,
    permission_role: "ASSISTANT" as PermissionRole,
  });

  const createM = useMutation({
    mutationFn: async () => {
      return createStaff({
        username: form.username,
        password: form.password,
        name: form.name,
        phone: form.phone,
        role: form.permission_role,
        position: form.position,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: staffQueryKeys.staffs });
      feedback.success("직원이 생성되었습니다.");
      onClose();
      setForm({
        username: "",
        password: "",
        name: "",
        phone: "",
        position: "ASSISTANT",
        permission_role: "ASSISTANT",
      });
    },
    onError: (e: unknown) => {
      feedback.error(extractApiError(e, "직원 생성에 실패했습니다."));
    },
  });

  // 모달 열릴 때 폼 초기화
  useEffect(() => {
    if (open) {
      setForm({
        username: "",
        password: "",
        name: "",
        phone: "",
        position: "ASSISTANT",
        permission_role: "ASSISTANT",
      });
    }
  }, [open]);

  const invalidUsername = !String(form.username || "").trim();
  const invalidPassword = !String(form.password || "").trim() || String(form.password || "").trim().length < 4;
  const invalidName = !String(form.name || "").trim();

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      type="action"
      width={MODAL_WIDTH.form}
      noMinimize
      closeDisabled={createM.isPending}
      onEnterConfirm={!createM.isPending && !invalidUsername && !invalidPassword && !invalidName ? () => createM.mutate() : undefined}
    >
      <ModalHeader
        title="직원 추가"
        description="직위와 계정 권한을 분리해 등록합니다. 직위는 화면 표시용이며 권한을 자동으로 바꾸지 않습니다."
        type="action"
      />

      <ModalBody>
        <div className={`modal-scroll-body ${styles.form}`}>
          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <strong>기본 정보</strong>
              <span>직원 명부와 로그인에 사용합니다.</span>
            </div>
            <div className={styles.twoColumn}>
              <Field id="staff-create-name" label="이름 *">
                <input
                  id="staff-create-name"
                  className="ds-input"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  data-required="true"
                  data-invalid={invalidName ? "true" : "false"}
                  autoFocus
                  autoComplete="name"
                />
              </Field>
              <Field id="staff-create-phone" label="전화번호">
                <input
                  id="staff-create-phone"
                  type="tel"
                  className="ds-input"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="01012345678"
                  autoComplete="tel"
                />
              </Field>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <strong>직위</strong>
              <span>명부와 상세 화면에 보이는 조직상의 호칭입니다.</span>
            </div>
            <div className={styles.positionGrid} role="radiogroup" aria-label="직위 선택">
              {STAFF_POSITION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={form.position === option.value}
                  className={styles.positionOption}
                  data-selected={form.position === option.value ? "true" : "false"}
                  onClick={() => setForm((previous) => ({ ...previous, position: option.value }))}
                >
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <strong>계정과 권한</strong>
              <span>수업 배정과 민감한 직원 정보 접근 범위를 정합니다.</span>
            </div>
            <div className={styles.twoColumn}>
              <Field id="staff-create-username" label="로그인 아이디 *">
                <input
                  id="staff-create-username"
                  className="ds-input"
                  value={form.username}
                  onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                  data-required="true"
                  data-invalid={invalidUsername ? "true" : "false"}
                  autoComplete="username"
                />
              </Field>
              <Field id="staff-create-password" label="초기 비밀번호 * (4자 이상)">
                <input
                  id="staff-create-password"
                  type="password"
                  className="ds-input"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  data-required="true"
                  data-invalid={invalidPassword ? "true" : "false"}
                  autoComplete="new-password"
                />
              </Field>
            </div>
            <div className={styles.accountRoleGrid} role="radiogroup" aria-label="계정 유형 선택">
              <button
                type="button"
                role="radio"
                aria-checked={form.permission_role === "ASSISTANT"}
                className={styles.accountRoleOption}
                data-selected={form.permission_role === "ASSISTANT" ? "true" : "false"}
                onClick={() => setForm((previous) => ({ ...previous, permission_role: "ASSISTANT" }))}
              >
                <strong>직원 계정</strong>
                <span>일반 업무·본인 출퇴근 사용</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={form.permission_role === "TEACHER"}
                className={styles.accountRoleOption}
                data-selected={form.permission_role === "TEACHER" ? "true" : "false"}
                onClick={() => setForm((previous) => ({ ...previous, permission_role: "TEACHER" }))}
              >
                <strong>강사 계정</strong>
                <span>강의 담당자로 배정 가능</span>
              </button>
            </div>
          </section>
        </div>
      </ModalBody>

      <ModalFooter
        right={
          <>
            <ActionButton
              action="close"
              onClick={onClose}
              disabled={createM.isPending}
            />
            <ActionButton
              action="create"
              loading={createM.isPending}
              onClick={() => {
                if (invalidUsername || invalidPassword || invalidName) {
                  feedback.warning("필수 항목을 모두 입력하세요.");
                  return;
                }
                createM.mutate();
              }}
            >
              등록
            </ActionButton>
          </>
        }
      />
    </AdminModal>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      {children}
    </div>
  );
}
