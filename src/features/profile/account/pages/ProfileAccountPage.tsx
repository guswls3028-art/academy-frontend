// PATH: src/features/profile/account/pages/ProfileAccountPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiKey, FiLogOut, FiUser, FiShield } from "react-icons/fi";

import { fetchMe, updateProfile } from "../../api/profile.api";
import useAuth from "@/features/auth/hooks/useAuth";

import AccountInfoList from "../components/ProfileInfoCard";
import ChangePasswordModal from "../components/ChangePasswordModal";

import { Button, EmptyState, Panel, Section } from "@/shared/ui/ds";

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
      <div className="flex flex-col gap-[var(--space-6)]">
        {/* 빠른 액션 */}
        <Section>
          <Panel variant="subtle">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div
                  style={{
                    fontSize: "var(--text-md)",
                    fontWeight: "var(--font-title)",
                    color: "var(--color-text-primary)",
                  }}
                >
                  빠른 액션
                </div>
                <div
                  className="mt-1"
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-muted)",
                    fontWeight: "var(--font-meta)",
                  }}
                >
                  계정 보안 및 세션 관리
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  intent="secondary"
                  size="md"
                  onClick={() => setPwOpen(true)}
                  className="inline-flex items-center gap-2"
                >
                  <FiKey size={14} />
                  비밀번호 변경
                </Button>

                <Button
                  type="button"
                  intent="danger"
                  size="md"
                  onClick={clearAuth}
                  className="inline-flex items-center gap-2"
                >
                  <FiLogOut size={14} />
                  로그아웃
                </Button>
              </div>
            </div>
          </Panel>
        </Section>

        {/* 계정 정보 */}
        <Section>
          {meQ.isLoading && (
            <div
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-muted)",
                padding: "var(--space-8)",
                textAlign: "center",
              }}
            >
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
      </div>

      <ChangePasswordModal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
      />
    </>
  );
}
