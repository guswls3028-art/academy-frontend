import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import useAuth from "@/auth/hooks/useAuth";
import { useFeesEnabled } from "@/shared/hooks/useFeesEnabled";
import { fetchStaffMe } from "@/shared/staff/api";
import { staffWorkQueryKeys } from "@/shared/staff/queryKeys";
import { ICON } from "@/shared/ui/ds";
import { Award, BookOpen, ClipboardList, FileText, FolderPlus, Globe, Settings, Users, Video, Wrench } from "lucide-react";

export type FeatureCategory = "resources" | "learning" | "communication" | "operations";
type FeatureAccess = "workspace" | "tenantAdmin" | "owner" | "payrollManager" | "feesAdmin";

export type DesktopFeature = {
  icon: ReactNode;
  title: string;
  desc: string;
  path: string;
  category: FeatureCategory;
  access: FeatureAccess;
  keywords: string[];
};

export const WORKSPACE_FEATURE_CATEGORIES: Array<{ key: "all" | FeatureCategory; label: string }> = [
  { key: "all", label: "전체" },
  { key: "resources", label: "자료·저장소" },
  { key: "learning", label: "학습 운영" },
  { key: "communication", label: "소통·홈페이지" },
  { key: "operations", label: "관리·도구" },
];

export const WORKSPACE_FEATURE_CATEGORY_LABELS: Record<FeatureCategory, string> = {
  resources: "자료·저장소",
  learning: "학습 운영",
  communication: "소통·홈페이지",
  operations: "관리·도구",
};

export const WORKSPACE_FEATURE_ACCESS_LABELS: Record<FeatureAccess, string | null> = {
  workspace: null,
  tenantAdmin: "관리자",
  owner: "대표원장",
  payrollManager: "급여 관리자",
  feesAdmin: "수납 관리자",
};

const FEATURES: DesktopFeature[] = [
  {
    icon: <FolderPlus size={ICON.md} />,
    title: "매치업 분석",
    desc: "문제 이미지 영역을 지정하고 문항을 매칭합니다.",
    path: "/workspace/storage/matchup",
    category: "resources",
    access: "workspace",
    keywords: ["문제", "이미지", "OCR", "매치업 OCR"],
  },
  {
    icon: <FolderPlus size={ICON.md} />,
    title: "자료실 전체",
    desc: "폴더와 파일을 한 화면에서 관리합니다.",
    path: "/workspace/storage/files",
    category: "resources",
    access: "workspace",
    keywords: ["파일", "저장소", "문서"],
  },
  {
    icon: <Award size={ICON.md} />,
    title: "적중 보고서",
    desc: "시험 적중 현황과 근거 자료를 확인합니다.",
    path: "/workspace/storage/hit-reports",
    category: "resources",
    access: "workspace",
    keywords: ["시험", "적중", "보고서"],
  },
  {
    icon: <FileText size={ICON.md} />,
    title: "문제 매칭 제안",
    desc: "검토가 필요한 자동 매칭 제안을 확인합니다.",
    path: "/workspace/storage/proposals",
    category: "resources",
    access: "workspace",
    keywords: ["매칭", "제안", "검토"],
  },
  {
    icon: <BookOpen size={ICON.md} />,
    title: "교재 시트",
    desc: "교재별 문항 시트와 원본 자료를 엽니다.",
    path: "/workspace/materials/sheets",
    category: "resources",
    access: "workspace",
    keywords: ["교재", "시트", "원본"],
  },
  {
    icon: <Users size={ICON.md} />,
    title: "학생 등록 요청",
    desc: "확인 대기 중인 학생 등록 요청을 처리합니다.",
    path: "/workspace/students/requests",
    category: "learning",
    access: "workspace",
    keywords: ["학생", "가입", "등록"],
  },
  {
    icon: <Users size={ICON.md} />,
    title: "삭제 학생 복원",
    desc: "삭제된 학생 기록을 조회합니다.",
    path: "/workspace/students/deleted",
    category: "learning",
    access: "workspace",
    keywords: ["학생", "삭제", "복구", "복원", "휴지통"],
  },
  {
    icon: <BookOpen size={ICON.md} />,
    title: "지난 강의",
    desc: "종료된 강의와 수업 기록을 확인합니다.",
    path: "/workspace/lectures/past",
    category: "learning",
    access: "workspace",
    keywords: ["강의", "종료", "수업"],
  },
  {
    icon: <Award size={ICON.md} />,
    title: "수납 템플릿",
    desc: "수강료와 교재비 비목을 관리합니다.",
    path: "/workspace/fees/templates",
    category: "learning",
    access: "feesAdmin",
    keywords: ["수납", "비목", "결제"],
  },
  {
    icon: <ClipboardList size={ICON.md} />,
    title: "강의별 성적 조회",
    desc: "강의와 시험 구조로 성적을 탐색합니다.",
    path: "/workspace/results/tree",
    category: "learning",
    access: "workspace",
    keywords: ["성적", "시험", "점수", "성적 트리"],
  },
  {
    icon: <Video size={ICON.md} />,
    title: "강의별 영상 관리",
    desc: "강의와 차시 구조로 영상을 탐색합니다.",
    path: "/workspace/videos/tree",
    category: "learning",
    access: "workspace",
    keywords: ["영상", "강의", "차시", "영상 트리"],
  },
  {
    icon: <FileText size={ICON.md} />,
    title: "Q&A 수신함",
    desc: "학생 질문과 답변 상태를 확인합니다.",
    path: "/workspace/community/qna",
    category: "communication",
    access: "workspace",
    keywords: ["질문", "답변", "커뮤니티"],
  },
  {
    icon: <Globe size={ICON.md} />,
    title: "공개 홈페이지 문의",
    desc: "외부 홈페이지에서 들어온 문의를 확인합니다.",
    path: "/workspace/landing-public/inbox",
    category: "communication",
    access: "tenantAdmin",
    keywords: ["홈페이지", "문의", "수신함"],
  },
  {
    icon: <Globe size={ICON.md} />,
    title: "홈페이지 편집",
    desc: "학원 홈페이지의 섹션과 이미지를 편집합니다.",
    path: "/workspace/settings/landing",
    category: "communication",
    access: "tenantAdmin",
    keywords: ["랜딩", "디자인", "학원"],
  },
  {
    icon: <FileText size={ICON.md} />,
    title: "상담 수신함",
    desc: "홈페이지 상담 신청을 확인합니다.",
    path: "/workspace/settings/consult",
    category: "communication",
    access: "tenantAdmin",
    keywords: ["상담", "신청", "문의"],
  },
  {
    icon: <Settings size={ICON.md} />,
    title: "학원 기능 설정",
    desc: "학원 운영 모드와 고급 기능을 설정합니다.",
    path: "/workspace/developer/flags",
    category: "operations",
    access: "owner",
    keywords: ["운영", "설정", "플래그", "기능 플래그"],
  },
  {
    icon: <Users size={ICON.md} />,
    title: "직원 급여 운영",
    desc: "직원 근태와 급여 정산 업무를 엽니다.",
    path: "/workspace/staff/attendance",
    category: "operations",
    access: "payrollManager",
    keywords: ["직원", "급여", "근태"],
  },
  {
    icon: <Users size={ICON.md} />,
    title: "확정 급여·정산 내역",
    desc: "월 마감된 급여의 공제 전후 금액과 승인 환급을 확인합니다.",
    path: "/workspace/staff/payroll-snapshot",
    category: "operations",
    access: "payrollManager",
    keywords: ["월급", "시급", "급여 계산", "금여", "세전", "세후", "3.3", "급여 정산"],
  },
  {
    icon: <Users size={ICON.md} />,
    title: "내 근태 기록",
    desc: "내 출퇴근 기록과 근무 시간을 확인합니다.",
    path: "/workspace/profile/attendance",
    category: "operations",
    access: "workspace",
    keywords: ["출퇴근", "근무", "시간"],
  },
  {
    icon: <Wrench size={ICON.md} />,
    title: "PPT 만들기",
    desc: "수업용 문제 PPT를 생성합니다.",
    path: "/workspace/tools/ppt",
    category: "operations",
    access: "workspace",
    keywords: ["도구", "발표", "문제"],
  },
  {
    icon: <Wrench size={ICON.md} />,
    title: "OMR 만들기",
    desc: "시험용 OMR 양식을 생성합니다.",
    path: "/workspace/tools/omr",
    category: "operations",
    access: "workspace",
    keywords: ["도구", "시험", "답안지"],
  },
  {
    icon: <Wrench size={ICON.md} />,
    title: "문제 스튜디오",
    desc: "문제를 구성하고 편집하는 작업실을 엽니다.",
    path: "/workspace/tools/problem-studio",
    category: "operations",
    access: "workspace",
    keywords: ["도구", "문제", "편집"],
  },
  {
    icon: <Wrench size={ICON.md} />,
    title: "문제 검토 보고서",
    desc: "문항 검토 보고서를 작성하고 내보냅니다.",
    path: "/workspace/tools/problem-review",
    category: "operations",
    access: "workspace",
    keywords: ["도구", "문제", "보고서"],
  },
];

export function useWorkspaceFeatures() {
  const { user } = useAuth();
  const feesEnabled = useFeesEnabled();
  const role = user?.tenantRole ?? null;
  const hasWorkspaceAccess = Boolean(
    user?.is_staff
    && (user.is_superuser || role === "owner" || role === "admin" || role === "teacher" || role === "staff"),
  );
  const isTenantAdmin = hasWorkspaceAccess
    && (role === "owner" || role === "admin" || Boolean(user?.is_superuser));
  const isOwner = hasWorkspaceAccess && role === "owner";
  const staffQuery = useQuery({
    queryKey: staffWorkQueryKeys.identity,
    queryFn: fetchStaffMe,
    enabled: hasWorkspaceAccess,
  });
  const isPayrollManager = hasWorkspaceAccess && !staffQuery.isError && Boolean(staffQuery.data?.is_payroll_manager);

  const visibleFeatures = useMemo(() => FEATURES.filter((feature) => {
    if (!hasWorkspaceAccess) return false;
    // Match the existing storage route boundary: a general staff account must
    // not be sent to a different page by an advertised analysis/review action.
    const storageAdmin = role === "owner" || role === "admin";
    if (feature.path === "/workspace/storage/proposals" && !storageAdmin) return false;
    if (["/workspace/storage/matchup", "/workspace/storage/hit-reports"].includes(feature.path)
      && !storageAdmin && role !== "teacher") return false;
    if (feature.access === "tenantAdmin" && !isTenantAdmin) return false;
    if (feature.access === "owner" && !isOwner) return false;
    if (feature.access === "payrollManager" && !isPayrollManager) return false;
    if (feature.access === "feesAdmin" && (!feesEnabled || !isTenantAdmin)) return false;
    return true;
  }), [feesEnabled, hasWorkspaceAccess, isOwner, isPayrollManager, isTenantAdmin, role]);

  return {
    features: visibleFeatures,
    hasWorkspaceAccess,
    permissionStatus: staffQuery.isError ? "error" as const
      : hasWorkspaceAccess && staffQuery.isPending ? "loading" as const : undefined,
    retryPermissions: staffQuery.refetch,
  };
}
