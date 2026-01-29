// src/features/profile/components/ProfileEditCard.tsx
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/shared/ui/card";
import { useMe, useUpdateProfile } from "../hooks/useProfile";

export default function ProfileEditCard() {
  const { data: me, isLoading, isError, refetch } = useMe();
  const { mutateAsync, isPending } = useUpdateProfile();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (me) {
      setName(me.name ?? "");
      setPhone(me.phone ?? "");
    }
  }, [me]);

  const save = async () => {
    setMsg("");
    try {
      await mutateAsync({
        name: name.trim() ? name.trim() : undefined,
        phone: phone.trim() ? phone.trim() : undefined,
      });
      setMsg("저장 완료");
      setTimeout(() => setMsg(""), 1200);
      await refetch();
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || "저장 실패");
    }
  };

  return (
    <Card>
      <CardHeader title="계정 정보" />
      <CardBody className="space-y-3 text-sm">
        {isLoading && <div className="text-[var(--text-muted)]">불러오는 중...</div>}
        {isError && (
          <div className="text-red-400">
            내 정보를 불러오지 못했습니다.
          </div>
        )}

        {me && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-[var(--text-muted)]">아이디</div>
                <div className="mt-1 font-medium">{me.username}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)]">권한</div>
                <div className="mt-1 font-medium">{me.is_staff ? "관리자" : "일반"}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-xs text-[var(--text-muted)]">이름</div>
                <input
                  className="w-full rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] px-2 py-1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름"
                />
              </div>

              <div className="space-y-1">
                <div className="text-xs text-[var(--text-muted)]">전화번호</div>
                <input
                  className="w-full rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] px-2 py-1"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-0000-0000"
                />
              </div>
            </div>

            {msg && (
              <div className={msg === "저장 완료" ? "text-[var(--color-primary)]" : "text-red-400"}>
                {msg}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={save}
                disabled={isPending}
                className="rounded bg-[var(--color-primary)] px-3 py-1 text-sm text-white disabled:opacity-60"
              >
                {isPending ? "저장중..." : "저장"}
              </button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
