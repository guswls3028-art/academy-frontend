// PATH: src/features/profile/account/pages/ProfileAccountPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiKey, FiLogOut } from "react-icons/fi";

import { fetchMe, updateProfile } from "../../api/profile.api";
import useAuth from "@/features/auth/hooks/useAuth";

import AccountHeader from "../components/AccountHeader";
import AccountInfoList from "../components/ProfileInfoCard";
import ChangePasswordModal from "../components/ChangePasswordModal";

import { Section, Panel, EmptyState } from "@/shared/ui/ds";

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

  const dirty = useMemo(() => {
    return (
      name !== (meQ.data?.name ?? "") ||
      phone !== (meQ.data?.phone ?? "")
    );
  }, [name, phone, meQ.data]);

  const save = async () => {
    await updateMut.mutateAsync({
      name: name.trim() || undefined,
      phone: phone.trim() || undefined,
    });
  };

  return (
    <>
      <AccountHeader />

      <Section>
        <Panel>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-semibold hover:bg-[var(--bg-surface-soft)]"
              onClick={() => setPwOpen(true)}
            >
              <FiKey size={14} />
              비밀번호 변경
            </button>

            <button
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-4 py-2 text-sm font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger)]/20"
              onClick={clearAuth}
            >
              <FiLogOut size={14} />
              로그아웃
            </button>
          </div>
        </Panel>
      </Section>

      <Section>
        {meQ.isLoading && (
          <div className="text-sm text-[var(--text-muted)]">
            불러오는 중...
          </div>
        )}

        {meQ.isError && (
          <EmptyState title="내 정보 조회 실패" />
        )}

        {meQ.data && (
          <AccountInfoList
            me={meQ.data}
            name={name}
            phone={phone}
            onChangeName={setName}
            onChangePhone={setPhone}
            onSave={save}
            saving={updateMut.isPending}
            dirty={dirty}
          />
        )}
      </Section>

      <ChangePasswordModal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
      />
    </>
  );
}
