import { dawonQueryKeys } from "./queryKeys";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useLocation } from "react-router";
import api from "@/shared/api/axios";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { resolveTenantCodeString } from "@/shared/tenant";
import { Badge, Button } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import styles from "./DawonTeacherAlerts.module.css";

const definitions = {
  absence_streak: { label: "연속 결석", unit: "회 이상" },
  homework_missing: { label: "과제 누적 미제출", unit: "건 이상" },
  exam_drop: { label: "시험 점수 하락", unit: "%p 이상" },
  recent_exam_drop: { label: "직전 3회 평균 대비 하락", unit: "%p 이상" },
  top_reference_gap: { label: "반 상위 평균 대비 부족", unit: "%p 이상" },
  exam_rise: { label: "시험 점수 상승", unit: "%p 이상" },
  homework_drop: { label: "과제 점수 하락", unit: "%p 이상" },
  video_watch: { label: "배정 영상 시청 부족", unit: "% 미만" },
} as const;

type Rule = keyof typeof definitions;
type Settings = Record<Rule, { enabled: boolean; threshold: number }>;
type AlertFeed = {
  rules: Settings;
  alerts: Array<{
    rule: Rule;
    student_id: number;
    student_name: string;
    lecture_id: number;
    lecture_title: string;
    value: number;
    detail: string;
  }>;
  lectures: { id: number; title: string }[];
  followups: {kind: string; day: string; student:string;course:string}[];
  unavailable: Rule[];
};

const maxThreshold = (rule: Rule) => rule === "absence_streak" || rule === "homework_missing" ? 30 : 100;
const endpoint = "/students/teacher-alerts/";
const ruleKeys = Object.keys(definitions) as Rule[];

function useAlerts(lecture: string, isDawon: boolean) {
  return useQuery({
    queryKey: dawonQueryKeys.lectureAlerts(lecture),
    enabled: isDawon,
    queryFn: async ({ signal }) => (await api.get<AlertFeed>(endpoint, { signal, params: lecture ? { lecture_id: lecture } : {} })).data,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function DawonLearningAlertsLink({ mobile = false }: { mobile?: boolean }) {
  const isDawon = resolveTenantCodeString() === "dawon";
  const feed = useAlerts("", isDawon);
  if (!isDawon) return null;
  const count = feed.data?.alerts.length ?? 0;
  return <Link className={styles.entry} to={mobile ? "/workspace/mobile/notifications/learning" : "/workspace/teacher-alerts"}>
    <strong>학습 알림</strong>
    {feed.isError ? <span>조회 오류</span> : count > 0 ? <Badge tone="warning">{count}건</Badge> : null}
  </Link>;
}

export default function DawonTeacherAlertsPage() {
  const mobile = useLocation().pathname.startsWith("/workspace/mobile");
  const isDawon = resolveTenantCodeString() === "dawon";
  const [lecture, setLecture] = useState("");
  const [draft, setDraft] = useState<Settings | null>(null);
  const client = useQueryClient();
  const feed = useAlerts(lecture, isDawon);
  const back = mobile ? "/workspace/mobile/notifications" : "/workspace/dashboard";
  const saved = useMutation({
    mutationFn: async (rules: Settings) => (await api.patch<AlertFeed>(endpoint, { rules })).data,
    onSuccess: (result) => {
      client.setQueryData(dawonQueryKeys.lectureAlerts(""), result);
      void client.invalidateQueries({ queryKey: dawonQueryKeys.alerts });
      setDraft(null);
    },
  });
  const update = (name: Rule, changes: Partial<Settings[Rule]>) => {
    setDraft((previous) => previous && { ...previous, [name]: { ...previous[name], ...changes } });
  };

  if (!isDawon) return <Navigate to={back} replace />;
  const valid = !!draft && ruleKeys.every((name) => {
    const value = draft[name].threshold;
    return Number.isInteger(value) && value >= 1 && value <= maxThreshold(name);
  });
  return <section className={styles.page}>
    <header className={styles.header}>
      <div><Link to={back}>돌아가기</Link><h1>학습 알림</h1></div>
      <Button intent="primary" disabled={!feed.data} onClick={() => {
        saved.reset();
        if (feed.data) setDraft(feed.data.rules);
      }}>알림 기준</Button>
    </header>
    <div className={styles.filters}>
      <label>강의 <select value={lecture} onChange={(event) => setLecture(event.target.value)}>
        <option value="">모든 담당 강의</option>
        {feed.data?.lectures.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select></label>
      <Button loading={feed.isFetching && !feed.isPending} onClick={() => void feed.refetch()}>새로고침</Button>
    </div>
    {feed.isPending ? <p role="status">학습 알림을 집계하고 있습니다.</p> : feed.isError
      ? <p role="alert">학습 알림을 불러오지 못했습니다. 위의 새로고침으로 다시 확인하세요.</p>
      : <>
        {feed.data.unavailable.length > 0 && <p>집계 준비 중 · {feed.data.unavailable.map((rule) => definitions[rule].label).join(", ")}</p>}
        {feed.data.alerts.length === 0 ? <p className={styles.surface}>설정한 기준에 해당하는 알림이 없습니다.</p>
          : <ul className={styles.list}>
            {feed.data.alerts.map((item) => <li className={styles.surface} key={`${item.rule}-${item.lecture_id}-${item.student_id}`}>
              <div>
                <Badge tone={item.rule === "exam_rise" ? "success" : "warning"}>{definitions[item.rule].label}</Badge>
                <strong>{item.student_name}</strong>
                <p>{item.detail}</p>
                <small>{item.lecture_title}</small>
              </div>
              <Link className={styles.entry} to={`${mobile ? "/workspace/mobile" : "/workspace"}/students/${item.student_id}`}>학생 기록</Link>
            </li>)}
          </ul>}
      </>}
    {!!feed.data?.followups?.length && <section aria-label="상담·클리닉 일정"><h2>상담·클리닉 일정</h2><ul>{feed.data.followups.map((row,i)=>
      <li key={i}>{row.day} · {row.student} · {row.course} · {row.kind === "counsel" ? "상담 예정" : "클리닉 예약"}</li>)}</ul></section>}
    {draft && <AdminModal open onClose={() => setDraft(null)} closeDisabled={saved.isPending} trapFocus noMinimize width={560}>
      <ModalHeader title="학습 알림 기준" description="확인할 항목과 기준값을 설정하세요." />
      <ModalBody>
        <div className={styles.rules}>
          {ruleKeys.map((key) => {
            const item = definitions[key];
            const rule = draft[key];
            const unavailable = feed.data?.unavailable.includes(key);
            return <div className={styles.rule} key={key}>
              <label><input type="checkbox" checked={rule.enabled} onChange={(event) => update(key, { enabled: event.target.checked })}
                disabled={unavailable || saved.isPending} /><strong>{item.label}</strong></label>
              {unavailable ? <span>집계 준비 중</span> : <label className={styles.threshold}>
                <input type="number" aria-label={`${item.label} 기준값`} min={1} max={maxThreshold(key)} step={1}
                  value={Number.isFinite(rule.threshold) ? rule.threshold : ""} onChange={(event) => update(key, { threshold: event.target.valueAsNumber })}
                  disabled={!rule.enabled || saved.isPending} />
                <span>{item.unit}</span>
              </label>}
            </div>;
          })}
        </div>
        {saved.isError && <p role="alert">{getApiErrorMessage(saved.error, "기준을 저장하지 못했습니다. 다시 시도해 주세요.")}</p>}
      </ModalBody>
      <ModalFooter right={<>
        <Button onClick={() => setDraft(null)} disabled={saved.isPending}>취소</Button>
        <Button intent="primary" loading={saved.isPending} disabled={!valid || saved.isPending} onClick={() => saved.mutate(draft)}>기준 저장</Button>
      </>} />
    </AdminModal>}
  </section>;
}
