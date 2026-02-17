// PATH: src/features/profile/account/pages/ProfileAccountPage.tsx
// 설정 > 내 정보 — 조회·수정 단일 카드, 프리미엄 UX

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiKey, FiLogOut } from "react-icons/fi";

import { fetchMe, updateProfile } from "../../api/profile.api";
import useAuth from "@/features/auth/hooks/useAuth";

import ProfileInfoCard from "../components/ProfileInfoCard";
import ChangePasswordModal from "../components/ChangePasswordModal";

import { EmptyState, Panel } from "@/shared/ui/ds";

export default function ProfileAccountPage() {
  const qc = useQueryClient();
  const { clearAuth } = useAuth();

  const meQ = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
  });

  const updateMut = useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pwOpen, setPwOpen] = useState(false);

  useEffect(() => {
    if (meQ.data) {
      setName(meQ.data.name ?? "");
      setPhone(meQ.data.phone ?? "");
    }
  }, [meQ.data]);

  const dirty = useMemo(
    () =>
      name !== (meQ.data?.name ?? "") || phone !== (meQ.data?.phone ?? ""),
    [name, phone, meQ.data]
  );

  const save = async () => {
    await updateMut.mutateAsync({
      name: name.trim() || undefined,
      phone: phone.trim() || undefined,
    });
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
        name={name}
        phone={phone}
        onChangeName={setName}
        onChangePhone={setPhone}
        onSave={save}
        saving={updateMut.isPending}
        dirty={dirty}
        onPasswordClick={() => setPwOpen(true)}
        onLogout={clearAuth}
      />
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </>
  );
}
