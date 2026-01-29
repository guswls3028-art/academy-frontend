// PATH: src/features/profile/components/ProfileCard.tsx
import { Card, CardHeader, CardBody } from "@/shared/ui/card";
import useAuth from "@/features/auth/hooks/useAuth";

export default function ProfileCard() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <Card className="max-w-[520px] shadow-md">
      <CardHeader title="내 정보" />
      <CardBody className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
        <Info label="아이디" value={user.username} />
        <Info label="권한" value={user.is_staff ? "관리자" : "일반 사용자"} />
        <Info label="이름" value={user.name || "-"} />
        <Info label="전화번호" value={user.phone || "-"} />
      </CardBody>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--bg-surface)] px-4 py-3">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
