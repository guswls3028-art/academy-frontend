// PATH: src/app_admin/domains/profile/account/pages/ProfileAccountPage.tsx
// 설정 > 내 정보 — 섹션형 프리미엄 SaaS 레이아웃

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchMe, updateProfile } from "../../api/profile.api";
import { adminProfileQueryKeys } from "../../queryKeys";
import useAuth from "@/auth/hooks/useAuth";
import { logout } from "@/auth/api/auth.api";
import { feedback } from "@/shared/ui/feedback/feedback";

import ProfileInfoCard from "../components/ProfileInfoCard";
import ChangePasswordModal from "../components/ChangePasswordModal";
import TenantInfoCard from "../components/TenantInfoCard";

import styles from "./ProfileAccountPage.module.css";

export default function ProfileAccountPage() {
  const qc = useQueryClient();
  const { clearAuth } = useAuth();

  const meQ = useQuery({
    queryKey: adminProfileQueryKeys.me,
    queryFn: fetchMe,
  });

  const updateMut = useMutation({
    mutationFn: async (payload: {
      name?: string;
      phone?: string;
    }) => {
      if (payload.name !== undefined || payload.phone !== undefined) {
        await updateProfile({
          name: payload.name?.trim() || undefined,
          phone: payload.phone?.trim() || undefined,
        });
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: adminProfileQueryKeys.me });
    },
    onError: () => {
      feedback.error("프로필 저장에 실패했습니다.");
    },
  });

  const [pwOpen, setPwOpen] = useState(false);

  const save = async (payload: {
    name?: string;
    phone?: string;
  }) => {
    await updateMut.mutateAsync(payload);
  };

  if (meQ.isLoading) {
    return (
      <div className={styles.root}>
        <div className={styles.loading}>불러오는 중…</div>
      </div>
    );
  }

  if (meQ.isError) {
    return (
      <div className={styles.root}>
        <div className={styles.error}>내 정보를 불러올 수 없습니다</div>
      </div>
    );
  }

  if (!meQ.data) return null;

  return (
    <>
      <div className={styles.root} data-page="account">
        <section className={styles.section} aria-labelledby="account-profile-heading">
          <p id="account-profile-heading" className={styles.sectionEyebrow}>계정</p>
          <div className={styles.sectionContent}>
            <ProfileInfoCard
              me={meQ.data}
              onSave={save}
              saving={updateMut.isPending}
              onPasswordClick={() => setPwOpen(true)}
              onLogout={clearAuth}
            />
          </div>
        </section>

        {meQ.data?.tenantRole === "owner" && (
          <section className={styles.section} aria-labelledby="account-tenant-heading">
            <p id="account-tenant-heading" className={styles.sectionEyebrow}>학원</p>
            <div className={styles.sectionContent}>
              <TenantInfoCard canEdit={true} />
            </div>
          </section>
        )}

      </div>
      <ChangePasswordModal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        onSuccess={() => {
          feedback.success("비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해 주세요.");
          logout();
        }}
      />
    </>
  );
}
