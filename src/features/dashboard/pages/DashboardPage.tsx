/**
 * Dashboard — 학원 운영 현황 · 대치동 스타강사용 프리미엄 SaaS
 * Design SSOT: students 도메인 (DomainLayout, 플랫 패널, ds 변수)
 * - 헤더 검색창에서 Enter 시 ?search= 로 이동하면 여기서 통합 검색 결과 표시
 */

import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchCommunityQuestions } from "@/features/community/api/community.api";
import { useMessagingInfo } from "@/features/messages/hooks/useMessagingInfo";
import ChargeCreditsModal from "@/features/messages/components/ChargeCreditsModal";
import { fetchLectures } from "@/features/lectures/api/sessions";
import { fetchExams } from "@/features/exams/api/exams";
import { fetchStudents } from "@/features/students/api/students";
import { DomainLayout } from "@/shared/ui/layout";
import { Button, EmptyState } from "@/shared/ui/ds";

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: 700,
  color: "var(--color-text-secondary)",
  marginBottom: 12,
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = (searchParams.get("search") ?? "").trim();
  const [chargeModalOpen, setChargeModalOpen] = useState(false);

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
      <div className="flex flex-col gap-8" style={{ padding: 0 }}>
        {hasSearch && (
          <section>
            <div style={sectionTitleStyle}>검색 결과 — &quot;{searchQuery}&quot;</div>
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                padding: "var(--space-4)",
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-divider)",
                borderRadius: "var(--radius-xl)",
              }}
            >
              <SearchResultBlock
                title="학생"
                loading={searchStudentsLoading}
                items={
                  searchStudents?.data?.slice(0, 5).map((s) => ({
                    label: s.name,
                    sub: s.psNumber || s.school,
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
              />
              <SearchResultBlock
                title="강의"
                loading={searchLecturesLoading}
                items={
                  searchLectures?.slice(0, 5).map((l) => ({
                    label: l.title || l.name,
                    sub: l.subject,
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
              />
            </div>
          </section>
        )}

        {/* 미처리 일감 */}
        <section>
          <div style={sectionTitleStyle}>미처리 일감</div>
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
          >
            <TodoCard
              label="미답변 질의"
              value={pendingQnaCount}
              suffix="건"
              onClick={() => navigate("/admin/community/qna")}
            />
            <TodoCard
              label="채점 · 성적"
              value="보기"
              onClick={() => navigate("/admin/results")}
            />
            <TodoCard
              label="시험 운영"
              value={activeExams.length}
              suffix="건"
              onClick={() => navigate("/admin/exams")}
            />
            <TodoCard
              label="영상 관리"
              value="보기"
              onClick={() => navigate("/admin/videos")}
            />
            <TodoCard
              label="게시 관리"
              value="공지·게시판"
              onClick={() => navigate("/admin/community/admin")}
            />
          </div>
        </section>

        {/* 알림톡 */}
        <section>
          <div style={sectionTitleStyle}>알림톡</div>
          <div
            className="flex flex-wrap items-center gap-4"
            style={{
              padding: "var(--space-4)",
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border-divider)",
              borderRadius: "var(--radius-xl)",
              maxWidth: 320,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-muted)" }}>
                현재 잔액
              </div>
              <div style={{ marginTop: 6, fontSize: 24, fontWeight: 800, color: "var(--color-text-primary)" }}>
                {messagingInfo
                  ? `${Number(messagingInfo.credit_balance).toLocaleString()}원`
                  : "—"}
              </div>
            </div>
            <Button size="sm" intent="primary" onClick={() => setChargeModalOpen(true)}>
              충전하기
            </Button>
          </div>
        </section>

        {/* 요약 지표 */}
        <section>
          <div style={sectionTitleStyle}>요약 지표</div>
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
          >
            <KpiCard label="운영 강의" value={`${lectures.length}개`} />
            <KpiCard label="운영 중 시험" value={`${activeExams.length}건`} />
            <KpiCard label="미답변 질의" value={`${pendingQnaCount}건`} />
          </div>
        </section>

        {/* 빠른 이동 */}
        <section>
          <div style={sectionTitleStyle}>바로가기</div>
          <div className="flex flex-wrap gap-2">
            <Button intent="secondary" size="sm" onClick={() => navigate("/admin/students/home")}>
              학생 관리
            </Button>
            <Button intent="secondary" size="sm" onClick={() => navigate("/admin/lectures")}>
              강의 목록
            </Button>
            <Button intent="secondary" size="sm" onClick={() => navigate("/admin/exams")}>
              시험
            </Button>
            <Button intent="secondary" size="sm" onClick={() => navigate("/admin/results")}>
              성적
            </Button>
            <Button intent="secondary" size="sm" onClick={() => navigate("/admin/videos")}>
              영상
            </Button>
          </div>
        </section>
      </div>

      <ChargeCreditsModal
        open={chargeModalOpen}
        onClose={() => setChargeModalOpen(false)}
      />
    </DomainLayout>
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
    <div
      style={{
        padding: "var(--space-4)",
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border-divider)",
        borderRadius: "var(--radius-lg)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-secondary)", marginBottom: 8 }}>
        {title}
      </div>
      {loading ? (
        <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>검색 중…</div>
      ) : items.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{emptyMessage}</div>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <button
                key={item.to + item.label}
                type="button"
                onClick={() => onNavigate(item.to)}
                className="text-left cursor-pointer hover:bg-[var(--color-bg-surface-hover)] rounded px-2 py-2 -mx-2"
                style={{ fontSize: 14 }}
              >
                <div style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{item.label}</div>
                {item.sub && (
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{item.sub}</div>
                )}
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

function TodoCard({
  label,
  value,
  suffix,
  onClick,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  onClick: () => void;
}) {
  const display = typeof value === "number" ? `${value}${suffix ?? ""}` : value;
  return (
    <button
      type="button"
      onClick={onClick}
      className="ds-kpi text-left cursor-pointer transition-colors hover:bg-[var(--color-bg-surface-hover)] hover:border-[var(--color-border-strong)]"
      style={{
        border: "1px solid var(--color-border-divider)",
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-4)",
        background: "var(--color-bg-surface)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-muted)" }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: "var(--color-text-primary)" }}>
        {display}
      </div>
    </button>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "var(--space-4)",
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-divider)",
        borderRadius: "var(--radius-lg)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-muted)" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 18, fontWeight: 800, color: "var(--color-text-primary)" }}>
        {value}
      </div>
    </div>
  );
}
