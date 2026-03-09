/**
 * PATH: src/features/dashboard/pages/DashboardPage.tsx
 * Dashboard — 학원 운영 현황 · 섹션형 레이아웃 (SSOT: patterns/section.css)
 * 모달은 클릭 시에만 로드 (초기 청크 경량화)
 */
import { useState, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchCommunityQuestions } from "@/features/community/api/community.api";
import { fetchExams } from "@/features/exams/api/exams";
import { fetchLectures } from "@/features/lectures/api/sessions";
import { useMessagingInfo } from "@/features/messages/hooks/useMessagingInfo";
import { fetchStudents } from "@/features/students/api/students";
import { Button } from "@/shared/ui/ds";
import { DomainLayout } from "@/shared/ui/layout";
import ClinicRemoconIcon from "../components/ClinicRemoconIcon";
import DashboardShortcutWidget from "../components/DashboardShortcutWidget";
import DashboardWidget from "../components/DashboardWidget";

const ClinicPasscardModal = lazy(() => import("@/features/clinic/components/ClinicPasscardModal"));
const ChargeCreditsModal = lazy(() => import("@/features/messages/components/ChargeCreditsModal"));

export default function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = (searchParams.get("search") ?? "").trim();
  const [chargeModalOpen, setChargeModalOpen] = useState(false);
  const [clinicPasscardModalOpen, setClinicPasscardModalOpen] = useState(false);

  const { data: messagingInfo } = useMessagingInfo();
  const { data: questions = [] } = useQuery({
    queryKey: ["dashboard-pending-questions"],
    queryFn: () => fetchCommunityQuestions(null),
    staleTime: 60 * 1000,
  });
  const { data: lectures = [] } = useQuery({
    queryKey: ["dashboard-lectures"],
    queryFn: () => fetchLectures({ is_active: true }),
    staleTime: 60 * 1000,
  });
  const { data: exams = [] } = useQuery({
    queryKey: ["dashboard-exams"],
    queryFn: () => fetchExams(),
    staleTime: 60 * 1000,
  });

  const { data: searchStudents, isLoading: searchStudentsLoading } = useQuery({
    queryKey: ["global-search-students", searchQuery],
    queryFn: () => fetchStudents(searchQuery, {}, "", 1, false),
    enabled: searchQuery.length >= 1,
  });

  const { data: searchLectures, isLoading: searchLecturesLoading } = useQuery({
    queryKey: ["global-search-lectures", searchQuery],
    queryFn: () => fetchLectures({ search: searchQuery }),
    enabled: searchQuery.length >= 1,
  });

  const pendingQnaCount = questions.filter((q) => !q.is_answered).length;
  const activeExams = exams.filter((e) => e.is_active);
  const hasSearch = searchQuery.length >= 1;

  return (
    <DomainLayout
      title="대시보드"
      description="학원 운영 현황을 한눈에 확인하세요."
    >
      <div className="flex flex-col gap-6" style={{ padding: 0 }}>
        {hasSearch && (
          <DashboardWidget
            title={`검색 결과 — "${searchQuery}"`}
            description="학생·강의 통합 검색"
          >
            <div className="ds-section__grid ds-section__grid--wide">
              <SearchResultBlock
                title="학생"
                loading={searchStudentsLoading}
                items={
                  searchStudents?.data?.slice(0, 5).map((s) => ({
                    label: s.name,
                    sub: (s.psNumber || s.school) || undefined,
                    to: `/admin/students/${s.id}`,
                  })) ?? []
                }
                emptyMessage="학생 검색 결과 없음"
                viewAllTo={
                  searchStudents && searchStudents.data.length > 0
                    ? `/admin/students/home?search=${encodeURIComponent(searchQuery)}`
                    : undefined
                }
                viewAllLabel={`학생 ${searchStudents?.count ?? 0}명`}
                onNavigate={(to) => navigate(to)}
              />
              <SearchResultBlock
                title="강의"
                loading={searchLecturesLoading}
                items={
                  searchLectures?.slice(0, 5).map((l) => ({
                    label: l.title || l.name,
                    sub: l.subject ?? undefined,
                    to: `/admin/lectures/${l.id}`,
                  })) ?? []
                }
                emptyMessage="강의 검색 결과 없음"
                viewAllTo={
                  searchLectures && searchLectures.length > 0
                    ? `/admin/lectures?search=${encodeURIComponent(searchQuery)}`
                    : undefined
                }
                viewAllLabel={`강의 ${searchLectures?.length ?? 0}개`}
                onNavigate={(to) => navigate(to)}
              />
            </div>
          </DashboardWidget>
        )}

        <DashboardWidget
          title="바로가기"
          description="자주 쓰는 메뉴와 클리닉 패스카드 설정"
        >
          <div className="ds-section__grid">
            <DashboardShortcutWidget
              icon={<ClinicRemoconIcon />}
              label="클리닉 리모컨"
              subLabel="패스카드 배경색 설정"
              onClick={() => setClinicPasscardModalOpen(true)}
              data-testid="dashboard-shortcut-clinic-remocon"
            />
            <DashboardShortcutWidget
              icon={<NavIcon d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 8a7 7 0 0 1 14 0" />}
              label="학생 관리"
              onClick={() => navigate("/admin/students/home")}
            />
            <DashboardShortcutWidget
              icon={<NavIcon d="M4 4h16v12H4zM8 20h8" />}
              label="강의 목록"
              onClick={() => navigate("/admin/lectures")}
            />
            <DashboardShortcutWidget
              icon={<NavIcon d="M7 3h10v18H7zM9 7h6M9 11h6M9 15h4" />}
              label="시험"
              onClick={() => navigate("/admin/exams")}
            />
            <DashboardShortcutWidget
              icon={<NavIcon d="M4 18h16M6 15V9M12 15V5M18 15v-7" />}
              label="성적"
              onClick={() => navigate("/admin/results")}
            />
            <DashboardShortcutWidget
              icon={<NavIcon d="M3 6h14v12H3zM17 10l4-2v8l-4-2z" />}
              label="영상"
              onClick={() => navigate("/admin/videos")}
            />
            <DashboardShortcutWidget
              icon={<NavIcon d="M4 4h16v12H7l-3 3z" />}
              label="게시판 · 공지"
              subLabel="공지사항·게시판"
              onClick={() => navigate("/admin/community/notice")}
            />
          </div>
        </DashboardWidget>

        <DashboardWidget
          title="미처리 일감"
          description="빠르게 처리할 항목"
        >
          <div className="ds-section__grid">
            <TodoRow
              label="미답변 질의"
              value={`${pendingQnaCount}건`}
              onClick={() => navigate("/admin/community/qna")}
            />
            <TodoRow
              label="채점 · 성적"
              value="보기"
              onClick={() => navigate("/admin/results")}
            />
            <TodoRow
              label="시험 운영"
              value={`${activeExams.length}건`}
              onClick={() => navigate("/admin/exams")}
            />
            <TodoRow
              label="영상 관리"
              value="보기"
              onClick={() => navigate("/admin/videos")}
            />
          </div>
        </DashboardWidget>

        <DashboardWidget
          title="알림톡"
          description="잔액 및 충전"
        >
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <div className="ds-section__kpi-label">현재 잔액</div>
              <div className="ds-section__kpi-value" style={{ marginTop: 6 }}>
                {messagingInfo
                  ? `${Number(messagingInfo.credit_balance).toLocaleString()}원`
                  : "—"}
              </div>
            </div>
            <Button size="sm" intent="primary" onClick={() => setChargeModalOpen(true)}>
              충전하기
            </Button>
          </div>
        </DashboardWidget>

        <DashboardWidget
          title="요약 지표"
          description="운영 현황"
        >
          <div className="ds-section__kpi-list">
            <KpiRow label="운영 강의" value={`${lectures.length}개`} />
            <KpiRow label="운영 중 시험" value={`${activeExams.length}건`} />
            <KpiRow label="미답변 질의" value={`${pendingQnaCount}건`} />
          </div>
        </DashboardWidget>
      </div>

      <Suspense fallback={null}>
        <ChargeCreditsModal
          open={chargeModalOpen}
          onClose={() => setChargeModalOpen(false)}
        />
      </Suspense>

      <Suspense fallback={null}>
        <ClinicPasscardModal
          open={clinicPasscardModalOpen}
          onClose={() => setClinicPasscardModalOpen(false)}
        />
      </Suspense>
    </DomainLayout>
  );
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchResultBlock({
  title,
  loading,
  items,
  emptyMessage,
  viewAllTo,
  viewAllLabel,
  onNavigate,
}: {
  title: string;
  loading: boolean;
  items: { label: string; sub?: string; to: string }[];
  emptyMessage: string;
  viewAllTo?: string;
  viewAllLabel?: string;
  onNavigate: (to: string) => void;
}) {
  return (
    <div className="ds-section__body">
      <div className="ds-section__title" style={{ marginBottom: 8 }}>
        {title}
      </div>
      {loading ? (
        <div className="ds-section__empty">검색 중…</div>
      ) : items.length === 0 ? (
        <div className="ds-section__empty">{emptyMessage}</div>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <button
                key={item.to + item.label}
                type="button"
                onClick={() => onNavigate(item.to)}
                className="ds-section__item"
              >
                <div className="ds-section__item-content">
                  <span className="ds-section__item-label">{item.label}</span>
                  {item.sub && (
                    <span className="ds-section__item-meta">{item.sub}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
          {viewAllTo && viewAllLabel && (
            <Button
              type="button"
              intent="ghost"
              size="sm"
              className="mt-2"
              onClick={() => onNavigate(viewAllTo)}
            >
              {viewAllLabel} 보기
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function TodoRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="ds-section__item">
      <div className="ds-section__item-content">
        <span className="ds-section__item-label">{label}</span>
      </div>
      <span className="ds-section__item-value">{value}</span>
    </button>
  );
}

function KpiRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="ds-section__kpi-row">
      <span className="ds-section__kpi-label">{label}</span>
      <span className="ds-section__kpi-value">{value}</span>
    </div>
  );
}
