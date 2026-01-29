// PATH: src/features/profile/components/ChangePasswordModal.tsx
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/shared/ui/card";
import { useChangePassword } from "../hooks/useProfile";

export default function ChangePasswordModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { mutateAsync, isPending } = useChangePassword();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!open) {
      setOldPw("");
      setNewPw("");
      setMsg("");
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!oldPw || !newPw) return setMsg("모든 항목을 입력하세요.");
    await mutateAsync({ old_password: oldPw, new_password: newPw });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-[420px]">
        <Card className="flex max-h-[90vh] flex-col overflow-hidden">
          <CardHeader title="비밀번호 변경" />

          <CardBody className="flex-1 space-y-3">
            <input
              type="password"
              className="form-input"
              placeholder="현재 비밀번호"
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
            />
            <input
              type="password"
              className="form-input"
              placeholder="새 비밀번호"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
            {msg && <div className="text-sm text-red-400">{msg}</div>}
          </CardBody>

          <div className="border-t px-4 py-3 flex justify-end gap-2">
            <button className="btn-secondary" onClick={onClose}>
              취소
            </button>
            <button
              className="btn-primary"
              onClick={submit}
              disabled={isPending}
            >
              변경
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
