// PATH: src/app_teacher/domains/today/pages/TodayPage.tsx
// 오늘 홈 — 데스크톱 대시보드 대응: 퀵 액션 + 미처리 건수 + KPI + 수업 카드
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { useAdminNotificationCounts } from "@admin/domains/admin-notifications/useAdminNotificationCounts";
import {
  Users, BookOpen, ClipboardList, Video, MessageSquare, Bell, Activity, FileText,
} from "@teacher/shared/ui/Icons";
import { KpiCard, Card, SectionTitle } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { fetchTodaySessions } from "../api";
import SessionCard from "../components/SessionCard";
import api from "@/shared/api/axios";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function TodayPage() {
  const today = todayISO();
  const navigate = useNavigate();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["today-sessions", today],
    queryFn: () => fetchTodaySessions(today),
    staleTime: 60_000,
  });

  const { counts } = useAdminNotificationCounts();

  // KPI 데이터
  const { data: kpiData } = useQuery({
    queryKey: ["teacher-kpi"],
    queryFn: async () => {
      const [lecturesRes, examsRes] = await Promise.all([
        api.get("/lectures/lectures/", { params: { is_active: true, page_size: 1 } }),
        api.get("/exams/", { params: { page_size: 1 } }),
      ]);
      return {
        activeLectures: lecturesRes.data?.count ?? 0,
        totalExams: examsRes.data?.count ?? 0,
      };
    },
    staleTime: 120_000,
  });

  const dateStr = new Date().toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div className="flex flex-col gap-3">
      {/* 바로가기 (Quick shortcuts) */}
      <SectionTitle>바로가기</SectionTitle>
      <div className="grid grid-cols-4 gap-2">
        <ShortcutBtn icon={<Users size={20} />} label="학생" onClick={() => navigate("/teacher/students")} />
        <ShortcutBtn icon={<BookOpen size={20} />} label="강의" onClick={() => navigate("/teacher/classes")} />
        <ShortcutBtn icon={<ClipboardList size={20} />} label="시험" onClick={() => navigate("/teacher/exams")} />
        <ShortcutBtn icon={<Video size={20} />} label="영상" onClick={() => navigate("/teacher/videos")} />
        <ShortcutBtn icon={<MessageSquare size={20} />} label="커뮤니티" onClick={() => navigate("/teacher/comms")} />
        <ShortcutBtn icon={<Activity size={20} />} label="클리닉" onClick={() => navigate("/teacher/clinic")} />
        <ShortcutBtn icon={<FileText size={20} />} label="상담" onClick={() => navigate("/teacher/counseling")} />
        <ShortcutBtn icon={<Bell size={20} />} label="알림" onClick={() => navigate("/teacher/notifications")} />
      </div>

      {/* 미처리 일감 */}
      {counts && counts.total > 0 && (
        <>
          <SectionTitle>미처리 일감</SectionTitle>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {counts.qnaPending > 0 && (
              <PendingRow
                label="미답변 질문"
                count={counts.qnaPending}
                onClick={() => navigate("/teacher/comms")}
              />
            )}
            {counts.registrationRequestsPending > 0 && (
              <PendingRow
                label="가입 신청"
                count={counts.registrationRequestsPending}
                onClick={() => navigate("/teacher/comms")}
              />
            )}
            {counts.recentSubmissions > 0 && (
              <PendingRow
                label="처리 대기 제출"
                count={counts.recentSubmissions}
                onClick={() => navigate("/teacher/exams")}
              />
            )}
            {counts.clinicPending > 0 && (
              <PendingRow
                label="클리닉 예약"
                count={counts.clinicPending}
                onClick={() => navigate("/teacher/clinic")}
              />
            )}
          </Card>
        </>
      )}

      {/* 요약 지표 (KPI) */}
      <SectionTitle>요약</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <KpiCard
          label="오늘 수업"
          value={sessions?.length ?? 0}
          color="var(--tc-primary)"
        />
        <KpiCard
          label="운영 강의"
          value={kpiData?.activeLectures ?? "-"}
        />
        <KpiCard
          label="총 시험"
          value={kpiData?.totalExams ?? "-"}
        />
      </div>

      {/* 오늘 수업 */}
      <SectionTitle right={
        <span className="text-xs font-normal" style={{ color: "var(--tc-text-muted)" }}>
          {dateStr}
        </span>
      }>
        오늘의 수업
      </SectionTitle>

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : sessions && sessions.length > 0 ? (
        <div className="flex flex-col gap-3">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      ) : (
        <EmptyState scope="panel" tone="empty" title="오늘 예정된 수업이 없습니다" />
      )}
    </div>
  );
}

function ShortcutBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 py-3 rounded-xl cursor-pointer"
      style={{
        background: "var(--tc-surface)",
        border: "1px solid var(--tc-border)",
        color: "var(--tc-text-secondary)",
      }}
    >
      <span style={{ color: "var(--tc-primary)" }}>{icon}</span>
      <span className="text-[11px] font-semibold">{label}</span>
    </button>
  );
}

function PendingRow({
  label,
  count,
  onClick,
}: {
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex justify-between items-center w-full text-left cursor-pointer"
      style={{
        padding: "var(--tc-space-3) var(--tc-space-4)",
        background: "none",
        border: "none",
        borderBottom: "1px solid var(--tc-border)",
      }}
    >
      <span className="text-sm" style={{ color: "var(--tc-text)" }}>{label}</span>
      <Badge tone="danger" pill>{count}건</Badge>
    </button>
  );
}
