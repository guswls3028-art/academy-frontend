// PATH: src/app_admin/domains/sessions/layout/SessionLayout.tsx
// 구조: students 도메인과 동일 — DomainLayout > Outlet (페이지가 콘텐츠 전담)
import { useMemo } from "react";
import { Outlet, useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { Button, EmptyState } from "@/shared/ui/ds";
import { DomainLayout } from "@/shared/ui/layout";
import { formatSessionBlockLabel } from "@/shared/ui/session-block";
import { useLectureSessionParams } from "@/shared/hooks/useLectureSessionParams";
import { useSectionMode } from "@/shared/hooks/useSectionMode";
import { adminSessionQueryKeys } from "./queryKeys";
import { fetchSessionSchedules, sessionSchedulesKey } from "@/shared/api/contracts/sessionSchedules";
import SessionAttendanceSummary from "./components/SessionAttendanceSummary";
import summaryStyles from "./components/SessionAttendanceSummary.module.css";
import SessionScheduleStrip from "./components/SessionScheduleStrip";
import { CompactSessionScheduleCard } from "./components/SessionScheduleControls";

export default function SessionLayout() {
  const { lectureId, sessionId } = useLectureSessionParams();
  const { sectionMode } = useSectionMode();
  const location = useLocation();
  const scheduleScope = new URLSearchParams(location.search).get("schedule");
  const { data: session, isLoading, isError, refetch } = useQuery({
    queryKey: adminSessionQueryKeys.sessionDetail(sessionId),
    queryFn: async () =>
      (await api.get(`/lectures/sessions/${sessionId}/`)).data,
    enabled: !!lectureId && !!sessionId,
  });

  const scheduleQuery = useQuery({
    queryKey: sessionSchedulesKey(sessionId ?? 0),
    queryFn: () => fetchSessionSchedules(sessionId!),
    enabled: !!lectureId && !!sessionId && !!session && !isError,
    retry: false,
  });

  const { data: lecture } = useQuery({
    queryKey: adminSessionQueryKeys.lecture(lectureId),
    queryFn: async () =>
      (await api.get(`/lectures/lectures/${lectureId}/`)).data,
    enabled: !!lectureId,
  });

  const base =
    lectureId && sessionId
      ? `/workspace/lectures/${lectureId}/sessions/${sessionId}`
      : "";
  const isScoresRoute = base
    ? location.pathname === `${base}/scores` || location.pathname.startsWith(`${base}/scores/`)
    : false;

  const tabs = useMemo(() => {
    if (!base) return [];
    const items = [
      { key: "attendance", label: "출결", path: `${base}/attendance` },
      { key: "scores", label: "성적", path: `${base}/scores` },
      { key: "exams", label: "시험", path: `${base}/exams` },
      { key: "assignments", label: "과제", path: `${base}/assignments` },
      {
        key: "notice",
        label: "공지·게시판",
        path: `${base}/notice?scope=session&lectureId=${lectureId}&sessionId=${sessionId}`,
      },
      { key: "videos", label: "영상", path: `${base}/videos` },
    ];
    // P7: CLINIC 세션에서는 정규 클리닉 탭 불필요 (순환 방지)
    if (sectionMode && session?.section_type !== "CLINIC") {
      items.push({ key: "clinic", label: "정규 클리닉", path: `${base}/clinic` });
    }
    const schedule = new URLSearchParams(location.search).get("schedule");
    return items.map(item => {
      const [path, search] = item.path.split("?");
      const params = new URLSearchParams(search);
      if (schedule !== null) params.set("schedule", schedule);
      return { ...item, path: `${path}${params.size ? `?${params}` : ""}`, activePaths: [path] };
    });
  }, [base, lectureId, sectionMode, session?.section_type, sessionId, location.search]);

  const parentCrumbs = [
    { label: "강의 목록", to: "/workspace/lectures" },
    ...(lectureId ? [{ label: lecture?.title ?? lecture?.name ?? "강의 상세", to: `/workspace/lectures/${lectureId}` }] : []),
  ];
  if (!lectureId || !sessionId || isError || isLoading || !session) {
    const invalid = !lectureId || !sessionId;
    const failed = invalid || isError || (!isLoading && !session);
    return (
      <DomainLayout title="차시" breadcrumbs={parentCrumbs}>
        <EmptyState scope="panel" tone={failed ? "error" : "loading"}
          title={invalid ? "차시 주소를 확인해 주세요" : failed ? "차시를 불러오지 못했습니다" : "차시를 불러오는 중입니다"}
          description={failed ? "상위 강의에서 차시를 다시 선택할 수 있습니다." : undefined}
          actions={!invalid && failed ? <Button intent="secondary" onClick={() => void refetch()}>다시 시도</Button> : undefined}
        />
      </DomainLayout>
    );
  }

  const lectureTitle = lecture?.title ?? lecture?.name ?? "강의";
  const sectionLabel = sectionMode && session.section_label
    ? `${session.section_label}반`
    : null;
  const sectionType = sectionMode && session.section_label
    ? (session.section_type === "CLINIC" ? "클리닉" : "수업")
    : null;
  const sectionSuffix = sectionLabel
    ? ` (${sectionType ? sectionType + " " : ""}${sectionLabel})`
    : "";
  const sessionTitle = formatSessionBlockLabel(session);
  const sessionHeading = sessionTitle + sectionSuffix;
  const selectedSchedule = scheduleQuery.data?.schedules.find(schedule => String(schedule.id) === scheduleScope);
  const scheduleDescription = scheduleScope === null
    ? scheduleQuery.data?.schedules.length ? `수업일 ${scheduleQuery.data.schedules.length}개` : session.date
    : scheduleScope === "0" ? "수업일 미배정"
    : scheduleQuery.isPending ? "수업일 확인 중…"
    : scheduleQuery.isError || !selectedSchedule ? "수업일 확인 필요"
    : `${selectedSchedule.date} · ${selectedSchedule.label}`;
  const isVideoDetail = location.pathname.startsWith(`${base}/videos/`);
  const breadcrumbs = [
    { label: "강의", to: "/workspace/lectures" },
    { label: lectureTitle, to: `/workspace/lectures/${lectureId}` },
    { label: sessionHeading },
  ];

  return (
    <DomainLayout
      title={sessionHeading}
      description={[scheduleDescription, sectionLabel].filter(Boolean).join(" · ") || undefined}
      breadcrumbs={breadcrumbs}
      tabs={tabs}
      density={isScoresRoute ? "compact" : "default"}
      headerActions={<SessionAttendanceSummary sessionId={sessionId} />}
      className={summaryStyles.sessionDomainLayout}
    >
      <SessionScheduleStrip key={sessionId} sessionId={sessionId} lectureId={lectureId} sessionDate={session.date ?? ""} sessionTitle={sessionTitle} sessionOrder={session.order} query={scheduleQuery} shared={!isScoresRoute && !location.pathname.endsWith("/attendance")}>
        {isVideoDetail && <CompactSessionScheduleCard />}
        <Outlet />
      </SessionScheduleStrip>
    </DomainLayout>
  );
}
