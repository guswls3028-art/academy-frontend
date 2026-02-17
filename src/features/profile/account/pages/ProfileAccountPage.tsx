// PATH: src/features/profile/account/pages/ProfileAccountPage.tsx
// 설정 > 내 정보 — 명함 스타일, 수정 모달, 비밀번호/로그아웃 최하단

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchMe, updateProfile, changePassword } from "../../api/profile.api";
import useAuth from "@/features/auth/hooks/useAuth";

import ProfileInfoCard from "../components/ProfileInfoCard";
import ChangePasswordModal from "../components/ChangePasswordModal";
import SenderNumberCard from "../components/SenderNumberCard";

import { EmptyState, Panel } from "@/shared/ui/ds";

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
      <Panel variant="primary" title="내 정보" description="불러오는 중…">
        <div
          className="flex items-center justify-center rounded-xl py-12"
          style={{
            background: "var(--color-bg-surface-soft)",
            border: "1px dashed var(--color-border-divider)",
          }}
        >
          <span
            className="font-medium"
            style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}
          >
            불러오는 중…
          </span>
        </div>
      </Panel>
    );
  }

  if (meQ.isError) {
    return (
      <Panel variant="primary" title="내 정보">
        <EmptyState scope="panel" title="내 정보를 불러올 수 없습니다" />
      </Panel>
    );
  }

  if (!meQ.data) return null;

  return (
    <>
      <ProfileInfoCard
        me={meQ.data}
        onSave={save}
        saving={updateMut.isPending}
        onPasswordClick={() => setPwOpen(true)}
        onLogout={clearAuth}
      />
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </>
  );
}
