// PATH: src/app_teacher/domains/profile/pages/DesktopOnlyPage.tsx
// 모바일에서 정적 고급 업무를 찾아 canonical PC 화면으로 진입하는 허브
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import useAuth from "@/auth/hooks/useAuth";
import { setPreferFullWorkspace } from "@/core/router/MobileWorkspaceRedirect";
import { staffClockQueryKeys } from "@/features/staff-clock/queryKeys";
import { useFeesEnabled } from "@/shared/hooks/useFeesEnabled";
import { fetchStaffMe } from "@/shared/staff/api";
import { ICON } from "@/shared/ui/ds";
import { BackButton, Card } from "@teacher/shared/ui/Card";
import {
  Award,
  BookOpen,
  ChevronRight,
  ClipboardList,
  FileText,
  FolderPlus,
  Globe,
  Monitor,
  Search,
  Settings,
  Users,
  Video,
  Wrench,
} from "@teacher/shared/ui/Icons";

import styles from "./DesktopOnlyPage.module.css";

type FeatureCategory = "resources" | "learning" | "communication" | "operations";
type FeatureAccess = "workspace" | "tenantAdmin" | "owner" | "payrollManager" | "feesAdmin";

type DesktopFeature = {
  icon: ReactNode;
  title: string;
  desc: string;
  path: string;
  category: FeatureCategory;
  access: FeatureAccess;
  keywords: string[];
};

const CATEGORIES: Array<{ key: "all" | FeatureCategory; label: string }> = [
  { key: "all", label: "전체" },
  { key: "resources", label: "자료·저장소" },
  { key: "learning", label: "학습 운영" },
  { key: "communication", label: "소통·홈페이지" },
  { key: "operations", label: "관리·도구" },
];

const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  resources: "자료·저장소",
  learning: "학습 운영",
  communication: "소통·홈페이지",
  operations: "관리·도구",
};

const ACCESS_LABELS: Record<FeatureAccess, string | null> = {
  workspace: null,
  tenantAdmin: "관리자",
  owner: "대표원장",
  payrollManager: "급여 관리자",
  feesAdmin: "수납 관리자",
};

const FEATURES: DesktopFeature[] = [
  {
    icon: <FolderPlus size={ICON.md} />,
    title: "매치업 (OCR)",
    desc: "문제 이미지 영역을 지정하고 문항을 매칭합니다.",
    path: "/workspace/storage/matchup",
    category: "resources",
    access: "workspace",
    keywords: ["문제", "이미지", "OCR"],
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
    title: "삭제 학생",
    desc: "삭제된 학생 기록을 조회합니다.",
    path: "/workspace/students/deleted",
    category: "learning",
    access: "workspace",
    keywords: ["학생", "삭제", "복구"],
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
    title: "성적 트리",
    desc: "강의와 시험 구조로 성적을 탐색합니다.",
    path: "/workspace/results/tree",
    category: "learning",
    access: "workspace",
    keywords: ["성적", "시험", "점수"],
  },
  {
    icon: <Video size={ICON.md} />,
    title: "영상 트리",
    desc: "강의와 차시 구조로 영상을 탐색합니다.",
    path: "/workspace/videos/tree",
    category: "learning",
    access: "workspace",
    keywords: ["영상", "강의", "차시"],
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
    title: "기능 플래그",
    desc: "학원 운영 모드와 고급 기능을 설정합니다.",
    path: "/workspace/developer/flags",
    category: "operations",
    access: "owner",
    keywords: ["운영", "설정", "플래그"],
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

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, " ");
}

export default function DesktopOnlyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const feesEnabled = useFeesEnabled();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | FeatureCategory>("all");

  const role = user?.tenantRole ?? null;
  const hasWorkspaceAccess = Boolean(
    user?.is_staff
    && (user.is_superuser || role === "owner" || role === "admin" || role === "teacher" || role === "staff"),
  );
  const isTenantAdmin = hasWorkspaceAccess
    && (role === "owner" || role === "admin" || Boolean(user?.is_superuser));
  const isOwner = hasWorkspaceAccess && role === "owner";
  const { data: staffMe } = useQuery({
    queryKey: staffClockQueryKeys.me,
    queryFn: fetchStaffMe,
    enabled: hasWorkspaceAccess,
  });
  const isPayrollManager = hasWorkspaceAccess && Boolean(staffMe?.is_payroll_manager);

  const visibleFeatures = useMemo(() => FEATURES.filter((feature) => {
    if (!hasWorkspaceAccess) return false;
    if (feature.access === "tenantAdmin" && !isTenantAdmin) return false;
    if (feature.access === "owner" && !isOwner) return false;
    if (feature.access === "payrollManager" && !isPayrollManager) return false;
    if (feature.access === "feesAdmin" && (!feesEnabled || !isTenantAdmin)) return false;
    return true;
  }), [feesEnabled, hasWorkspaceAccess, isOwner, isPayrollManager, isTenantAdmin]);

  const normalizedQuery = normalizeSearch(query);
  const filteredFeatures = useMemo(() => visibleFeatures.filter((feature) => {
    if (category !== "all" && feature.category !== category) return false;
    if (!normalizedQuery) return true;
    return normalizeSearch([
      feature.title,
      feature.desc,
      CATEGORY_LABELS[feature.category],
      ...feature.keywords,
    ].join(" ")).includes(normalizedQuery);
  }), [category, normalizedQuery, visibleFeatures]);

  const groupedFeatures = CATEGORIES
    .filter((item): item is { key: FeatureCategory; label: string } => item.key !== "all")
    .map((item) => ({
      ...item,
      features: filteredFeatures.filter((feature) => feature.category === item.key),
    }))
    .filter((group) => group.features.length > 0);

  const openFullWorkspace = (path = "/workspace") => {
    setPreferFullWorkspace(true);
    navigate(path);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <BackButton onClick={() => navigate(-1)} />
        <div className={styles.headingGroup}>
          <h1 className={styles.title}>PC 버전</h1>
          <p className={styles.eyebrow}>전체 업무 바로가기</p>
        </div>
      </div>

      <Card className={styles.leadCard}>
        <div className={styles.leadIcon} aria-hidden>
          <Monitor size={ICON.lg} />
        </div>
        <div className={styles.leadBody}>
          <p className={styles.leadTitle}>모바일에서도 필요한 PC 업무를 바로 여세요</p>
          <p className={styles.leadText}>
            같은 권한과 데이터를 사용하는 PC 화면으로 이동합니다. 메뉴의 모바일 버전 버튼으로 언제든 돌아올 수 있어요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openFullWorkspace()}
          className={styles.primaryButton}
        >
          <Monitor size={ICON.sm} /> PC 버전 홈
        </button>
      </Card>

      {hasWorkspaceAccess ? (
        <>
          <div className={styles.finder}>
            <label className={styles.searchField}>
              <Search size={ICON.sm} aria-hidden />
              <span className={styles.srOnly}>전체 기능 검색</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="기능 또는 업무 검색"
                aria-label="전체 기능 검색"
              />
            </label>
            <div className={styles.categoryList} role="group" aria-label="기능 카테고리">
              {CATEGORIES.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={item.key === category ? styles.categoryActive : styles.categoryButton}
                  aria-pressed={item.key === category}
                  onClick={() => setCategory(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <p className={styles.resultSummary} aria-live="polite">
            사용할 수 있는 기능 {filteredFeatures.length}개
          </p>

          {groupedFeatures.length > 0 ? (
            <div className={styles.groups}>
              {groupedFeatures.map((group) => (
                <section key={group.key} className={styles.group} aria-labelledby={`feature-${group.key}`}>
                  <div className={styles.groupHeading}>
                    <h2 id={`feature-${group.key}`}>{group.label}</h2>
                    <span>{group.features.length}</span>
                  </div>
                  <div className={styles.featureGrid}>
                    {group.features.map((feature) => {
                      const accessLabel = ACCESS_LABELS[feature.access];
                      return (
                        <button
                          key={feature.path}
                          type="button"
                          onClick={() => openFullWorkspace(feature.path)}
                          className={styles.featureButton}
                        >
                          <span className={styles.featureIcon}>{feature.icon}</span>
                          <span className={styles.featureBody}>
                            <span className={styles.featureTitleRow}>
                              <span className={styles.featureTitle}>{feature.title}</span>
                              {accessLabel && <span className={styles.accessBadge}>{accessLabel}</span>}
                            </span>
                            <span className={styles.featureDesc}>{feature.desc}</span>
                          </span>
                          <ChevronRight size={ICON.sm} className={styles.chevron} />
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState} role="status">
              <Search size={ICON.lg} aria-hidden />
              <strong>검색 결과가 없어요</strong>
              <span>다른 검색어를 입력하거나 전체 카테고리를 선택해 주세요.</span>
              <button type="button" onClick={() => { setQuery(""); setCategory("all"); }}>
                검색 초기화
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={styles.emptyState} role="status">
          <Settings size={ICON.lg} aria-hidden />
          <strong>사용할 수 있는 PC 기능이 없어요</strong>
          <span>현재 계정의 학원 역할과 권한을 확인해 주세요.</span>
        </div>
      )}
    </div>
  );
}
