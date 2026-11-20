import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router";
import { displayUsername, fetchMe } from "@admin/domains/profile/api/profile.api";
import { accountQueryKeys } from "@/shared/api/queryKeys/account";
import AppearanceSettings from "@/shared/theme/AppearanceSettings";
import { DomainLayout } from "@/shared/ui/domain";
import { Button } from "@/shared/ui/ds";
import { dawonStaffPreviewRole } from "./staffPreview";

const tabs = [
  {key: "profile", label: "내 프로필", path: "/workspace/settings/profile"},
  {key: "appearance", label: "화면 설정", path: "/workspace/settings/appearance"},
];

export default function DawonStaffSettings() {
  const role = dawonStaffPreviewRole();
  const {pathname} = useLocation();
  const me = useQuery({queryKey: accountQueryKeys.me, queryFn: fetchMe});
  return <DomainLayout title="설정" tabs={tabs}>
    {pathname.endsWith("/appearance") ? <AppearanceSettings /> : <section className="grid gap-4 max-w-xl">
      {me.isPending ? <p role="status">프로필을 불러오는 중입니다.</p> : me.isError ? <p role="alert">프로필을 불러오지 못했습니다. <Button onClick={() => void me.refetch()}>다시 시도</Button></p> :
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3"><dt>이름</dt><dd>{me.data.name || "미등록"}</dd>
          <dt>계정</dt><dd>{displayUsername(me.data.username)}</dd><dt>역할</dt><dd>{role === "teacher" ? "선생님" : "관리자"}</dd></dl>}
      {role === "teacher" && <Link to="/workspace/teacher-alerts" className="ds-btn w-fit">학습 알림 기준 관리</Link>}
    </section>}
  </DomainLayout>;
}
