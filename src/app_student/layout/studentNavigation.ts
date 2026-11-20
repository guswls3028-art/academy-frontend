import type { ComponentType, SVGProps } from "react";
import {
  IconBell,
  IconBoard,
  IconCalendar,
  IconClinic,
  IconClipboard,
  IconExam,
  IconFileText,
  IconFolder,
  IconGrade,
  IconNotice,
  IconPlay,
  IconSettings,
  IconUser,
} from "@student/shared/ui/icons/Icons";

type DrawerIcon = ComponentType<SVGProps<SVGSVGElement>>;

type NavGroup = {
  category: string;
  items: Array<{
    label: string;
    to: string;
    Icon: DrawerIcon;
  }>;
};

export const STUDENT_NAV_GROUPS: NavGroup[] = [
  {
    category: "학습",
    items: [
      { label: "영상", to: "/student/video", Icon: IconPlay },
      { label: "성적", to: "/student/grades", Icon: IconGrade },
      { label: "시험", to: "/student/exams", Icon: IconExam },
      { label: "과제", to: "/student/submit/assignment", Icon: IconClipboard },
    ],
  },
  {
    category: "클리닉",
    items: [
      { label: "클리닉", to: "/student/clinic", Icon: IconClinic },
      { label: "클리닉 패스카드", to: "/student/idcard", Icon: IconClinic },
    ],
  },
  {
    category: "학원",
    items: [
      { label: "일정", to: "/student/sessions", Icon: IconCalendar },
      { label: "공지사항", to: "/student/notices", Icon: IconNotice },
      { label: "커뮤니티", to: "/student/community", Icon: IconBoard },
      { label: "게시판", to: "/student/community?tab=board", Icon: IconBoard },
      { label: "자료실", to: "/student/community?tab=materials", Icon: IconFolder },
      { label: "출결 현황", to: "/student/attendance", Icon: IconClipboard },
    ],
  },
  {
    category: "나",
    items: [
      { label: "제출", to: "/student/submit", Icon: IconClipboard },
      { label: "내 인벤토리", to: "/student/inventory", Icon: IconFolder },
      { label: "알림", to: "/student/notifications", Icon: IconBell },
      { label: "프로필", to: "/student/profile", Icon: IconUser },
      { label: "설정", to: "/student/settings", Icon: IconSettings },
      { label: "사용 가이드", to: "/student/guide", Icon: IconFileText },
    ],
  },
];
