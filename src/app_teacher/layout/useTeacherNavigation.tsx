import { useMemo, type ReactNode } from "react";
import useAuth from "@/auth/hooks/useAuth";
import { useFeesEnabled } from "@/shared/hooks/useFeesEnabled";
import { PUBLIC_UPDATES_URL } from "@/shared/constants/origins";
import { ICON } from "@/shared/ui/ds";
import { useTeacherPendingCounts } from "@teacher/shared/hooks/useTeacherPendingCounts";
import {
  Activity,
  Award,
  Bell,
  BookOpen,
  Bug,
  Calendar,
  Clock,
  FileText,
  FolderPlus,
  Globe,
  Home,
  Info,
  MessageSquare,
  Monitor,
  Send,
  Settings,
  User,
  Users,
  Video,
  Wrench,
  ClipboardList,
} from "@teacher/shared/ui/Icons";

export type TeacherNavigationItem = {
  label: string;
  path?: string;
  href?: string;
  icon: ReactNode;
  badge?: number;
  keywords?: string[];
};

export type TeacherNavigationGroup = {
  title: string;
  items: TeacherNavigationItem[];
};

export function useTeacherNavigation() {
  const { user } = useAuth();
  const { counts } = useTeacherPendingCounts();
  const feesEnabled = useFeesEnabled();
  const isOwnerOrAdmin = user?.tenantRole === "owner" || user?.tenantRole === "admin";
  const recentSubmissions = counts?.recentSubmissions;
  const totalNotifications = counts?.total;

  const groups = useMemo<TeacherNavigationGroup[]>(
    () => [
      {
        title: "오늘 업무",
        items: [
          { label: "대시보드", path: "/workspace/mobile", icon: <Home size={ICON.md} />, keywords: ["홈", "오늘", "처리할 일"] },
          { label: "알림 센터", path: "/workspace/mobile/notifications", icon: <Bell size={ICON.md} />, badge: totalNotifications, keywords: ["알림", "대기 업무"] },
          { label: "커뮤니티", path: "/workspace/mobile/comms", icon: <MessageSquare size={ICON.md} />, badge: totalNotifications, keywords: ["질문", "Q&A", "공지"] },
          { label: "제출함", path: "/workspace/mobile/submissions", icon: <Send size={ICON.md} />, badge: recentSubmissions, keywords: ["과제", "채점", "제출"] },
        ],
      },
      {
        title: "수업 운영",
        items: [
          { label: "학생", path: "/workspace/mobile/students", icon: <Users size={ICON.md} />, keywords: ["원생", "학부모", "명단"] },
          { label: "강의", path: "/workspace/mobile/classes", icon: <BookOpen size={ICON.md} />, keywords: ["수업", "차시", "출결"] },
          { label: "시험", path: "/workspace/mobile/exams", icon: <ClipboardList size={ICON.md} />, keywords: ["시험지", "응시", "채점"] },
          { label: "성적", path: "/workspace/mobile/results", icon: <Award size={ICON.md} />, keywords: ["점수", "성적표", "결과"] },
          { label: "영상", path: "/workspace/mobile/videos", icon: <Video size={ICON.md} />, keywords: ["동영상", "수업 영상"] },
          { label: "클리닉", path: "/workspace/mobile/clinic", icon: <Activity size={ICON.md} />, keywords: ["예약", "보충", "등원"] },
          { label: "클리닉 보고서", path: "/workspace/mobile/clinic/reports", icon: <Calendar size={ICON.md} />, keywords: ["주간", "리포트"] },
        ],
      },
      {
        title: "자료·메시지",
        items: [
          { label: "상담 메모", path: "/workspace/mobile/counseling", icon: <FileText size={ICON.md} />, keywords: ["상담", "기록"] },
          { label: "발송 내역", path: "/workspace/mobile/message-log", icon: <Send size={ICON.md} />, keywords: ["알림톡", "문자", "메시지"] },
          { label: "템플릿 저장", path: "/workspace/mobile/message-templates", icon: <FileText size={ICON.md} />, keywords: ["알림톡", "메시지 양식"] },
          { label: "시험 템플릿", path: "/workspace/mobile/exams/templates", icon: <FileText size={ICON.md} />, keywords: ["시험 양식"] },
          { label: "시험 묶음", path: "/workspace/mobile/exams/bundles", icon: <FolderPlus size={ICON.md} />, keywords: ["시험 세트", "번들"] },
          { label: "자료 저장소", path: "/workspace/mobile/storage", icon: <FolderPlus size={ICON.md} />, keywords: ["파일", "문서", "시험지"] },
          { label: "학생 인벤토리", path: "/workspace/mobile/storage/inventory", icon: <Users size={ICON.md} />, keywords: ["학생 자료", "보관"] },
          ...(isOwnerOrAdmin ? [{ label: "메시지 설정", path: "/workspace/mobile/messaging-settings", icon: <Settings size={ICON.md} />, keywords: ["알림톡", "발송 설정"] }] : []),
        ],
      },
      {
        title: isOwnerOrAdmin ? "관리자 전용" : "내 계정",
        items: [
          ...(isOwnerOrAdmin && feesEnabled
            ? [
                { label: "수납", path: "/workspace/mobile/fees", icon: <Award size={ICON.md} />, keywords: ["결제", "미납", "영수증"] },
                { label: "청구서", path: "/workspace/mobile/fees/invoices", icon: <FileText size={ICON.md} />, keywords: ["수납", "결제"] },
              ]
            : []),
          ...(isOwnerOrAdmin ? [{ label: "직원 관리", path: "/workspace/mobile/staff", icon: <Users size={ICON.md} />, keywords: ["강사", "조교", "계정"] }] : []),
          { label: "근태 / 지출", path: "/workspace/mobile/my-records", icon: <Clock size={ICON.md} />, keywords: ["출퇴근", "비용"] },
          { label: "프로필", path: "/workspace/mobile/profile", icon: <User size={ICON.md} />, keywords: ["내 정보", "비밀번호"] },
          ...(isOwnerOrAdmin ? [{ label: "결제 / 구독", path: "/workspace/mobile/billing", icon: <Award size={ICON.md} />, keywords: ["요금", "플랜"] }] : []),
          ...(isOwnerOrAdmin ? [{ label: "학원 정보", path: "/workspace/mobile/settings/organization", icon: <Settings size={ICON.md} />, keywords: ["학원 설정", "사업자"] }] : []),
          { label: "테마", path: "/workspace/mobile/settings/appearance", icon: <Settings size={ICON.md} />, keywords: ["화면", "색상", "모양"] },
          { label: "설정", path: "/workspace/mobile/settings", icon: <Settings size={ICON.md} />, keywords: ["환경", "계정"] },
        ],
      },
      {
        title: "지원",
        items: [
          { label: "사용 가이드", path: "/workspace/mobile/guide", icon: <Info size={ICON.md} />, keywords: ["도움말", "사용법", "매뉴얼"] },
          { label: "학원 홈페이지", path: "/landing", icon: <Globe size={ICON.md} /> },
          { label: "도구", path: "/workspace/mobile/tools", icon: <Wrench size={ICON.md} />, keywords: ["AI", "풀이", "리포트"] },
          { label: "PC에서 처리하는 기능", path: "/workspace/mobile/desktop-only", icon: <Monitor size={ICON.md} />, keywords: ["통합 업무", "데스크톱"] },
          { label: "업데이트 소식", href: PUBLIC_UPDATES_URL, icon: <FileText size={ICON.md} /> },
          { label: "버그 제보", path: "/workspace/mobile/developer/bug", icon: <Bug size={ICON.md} />, keywords: ["문제 신고", "오류"] },
          { label: "피드백", path: "/workspace/mobile/developer/feedback", icon: <MessageSquare size={ICON.md} />, keywords: ["의견", "제안"] },
        ],
      },
    ],
    [feesEnabled, isOwnerOrAdmin, recentSubmissions, totalNotifications],
  );

  return { groups, isOwnerOrAdmin };
}
