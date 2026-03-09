// PATH: src/features/profile/account/pages/ProfileAccountPage.tsx
// 설정 > 내 정보 — 섹션형 프리미엄 SaaS 레이아웃

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchMe, updateProfile, changePassword } from "../../api/profile.api";
import useAuth from "@/features/auth/hooks/useAuth";

import ProfileInfoCard from "../components/ProfileInfoCard";
import ChangePasswordModal from "../components/ChangePasswordModal";
import SenderNumberCard from "../components/SenderNumberCard";
import TenantInfoCard from "../components/TenantInfoCard";

import styles from "./ProfileAccountPage.module.css";

export default function ProfileAccountPage() {
  const qc = useQueryClient();
  const { clearAuth } = useAuth();

  const meQ = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
  });

  const updateMut = useMutation({
    mutationFn: async (payload: {
      name?: string;
      phone?: string;
      currentPassword?: string;
      newPassword?: string;
    }) => {
      if (payload.name !== undefined || payload.phone !== undefined) {
        await updateProfile({
          name: payload.name?.trim() || undefined,
          phone: payload.phone?.trim() || undefined,
        });
      }
      if (payload.currentPassword && payload.newPassword) {
        await changePassword({
          old_password: payload.currentPassword,
          new_password: payload.newPassword,
        });
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const [pwOpen, setPwOpen] = useState(false);

  const save = async (payload: {
    name?: string;
    phone?: string;
    currentPassword?: string;
    newPassword?: string;
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

        <section className={styles.section} aria-labelledby="account-tenant-heading">
          <p id="account-tenant-heading" className={styles.sectionEyebrow}>학원</p>
          <div className={styles.sectionContent}>
            <TenantInfoCard canEdit={meQ.data?.tenantRole === "owner"} />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="account-sender-heading">
          <p id="account-sender-heading" className={styles.sectionEyebrow}>메시지</p>
          <div className={styles.sectionContent}>
            <SenderNumberCard />
          </div>
        </section>
      </div>
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </>
  );
}
