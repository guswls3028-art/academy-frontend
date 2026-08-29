import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchStudents, studentAccountStateLabel, type ClientStudent } from "@admin/domains/students/api/students.api";
import {
  directVideoAccessErrorMessage,
  fetchDirectVideoEntitlements,
  grantDirectVideoEntitlement,
  revokeDirectVideoEntitlement,
  type DirectVideoEntitlement,
} from "@admin/domains/videos/api/directVideoAccess.api";
import { adminVideoQueryKeys } from "@admin/domains/videos/queryKeys";
import { Badge, Button, EmptyState } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm/useConfirm";
import { feedback } from "@/shared/ui/feedback/feedback";

function entitlementState(entitlement: DirectVideoEntitlement) {
  if (entitlement.state === "ACTIVE") {
    return { label: "사용 중", tone: "success" as const };
  }
  if (entitlement.state === "INELIGIBLE") {
    return { label: "수강 상태 우선", tone: "warning" as const };
  }
  return { label: "회수됨", tone: "neutral" as const };
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function studentSummary(student: ClientStudent): string {
  const details = [student.school, student.grade ? `${student.grade}학년` : null].filter(Boolean);
  return details.length ? details.join(" · ") : "학교 정보 없음";
}

export default function DirectVideoAccessTab({ videoId }: { videoId: number }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<ClientStudent | null>(null);
  const [reason, setReason] = useState("");
  const [revokeReasons, setRevokeReasons] = useState<Record<number, string>>({});

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const historyQuery = useQuery({
    queryKey: adminVideoQueryKeys.directEntitlements(videoId),
    queryFn: () => fetchDirectVideoEntitlements(videoId),
    staleTime: 5_000,
    retry: 1,
  });
  const history = useMemo(() => historyQuery.data ?? [], [historyQuery.data]);

  const studentQuery = useQuery({
    queryKey: adminVideoQueryKeys.directStudentSearch(debouncedSearch),
    queryFn: () => fetchStudents(debouncedSearch, {}, "name", 1, false),
    enabled: debouncedSearch.length >= 2,
    staleTime: 30_000,
    retry: 1,
  });
  const students = studentQuery.data?.data.slice(0, 30) ?? [];

  const selectedHistory = useMemo(
    () => history.filter((item) => item.student_id === selectedStudent?.id),
    [history, selectedStudent?.id],
  );
  const selectedHasCurrent = selectedHistory.some((item) => item.state !== "REVOKED" && item.revoked_at == null);
  const selectedWasRevoked = selectedHistory.some((item) => item.revoked_at != null);
  const selectedAccountActive = selectedStudent?.accountState === "ACTIVE";
  const grantDisabledReason = !selectedStudent
    ? "학생을 먼저 선택해 주세요."
    : !selectedAccountActive
      ? "로그인 가능한 학생 계정만 권한을 받을 수 있습니다."
      : selectedHasCurrent
        ? "현재 권한 또는 수강 우선 이력이 있어 새 권한을 열 수 없습니다."
        : reason.trim().length < 2
          ? "권한을 여는 사유를 2자 이상 입력해 주세요."
          : null;

  const grantMutation = useMutation({
    mutationFn: () => grantDirectVideoEntitlement({
      student_id: selectedStudent!.id,
      video_id: videoId,
      reason: reason.trim(),
      confirmed_regrant: selectedWasRevoked,
    }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: adminVideoQueryKeys.directEntitlements(videoId) });
      setReason("");
      feedback.success(result.created ? "이 영상 1개에 대한 권한을 열었습니다." : "이미 같은 권한이 열려 있습니다.");
    },
    onError: (error) => feedback.error(directVideoAccessErrorMessage(error)),
  });

  const revokeMutation = useMutation({
    mutationFn: ({ entitlementId, revokeReason }: { entitlementId: number; revokeReason: string }) => (
      revokeDirectVideoEntitlement(entitlementId, revokeReason)
    ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminVideoQueryKeys.directEntitlements(videoId) });
      feedback.success("개별 영상 권한을 회수했습니다.");
    },
    onError: (error) => feedback.error(directVideoAccessErrorMessage(error)),
  });

  const requestGrant = async () => {
    if (!selectedStudent || grantDisabledReason) return;
    const approved = await confirm({
      title: selectedWasRevoked ? "개별 영상 권한 다시 승인" : "개별 영상 권한 승인",
      message: "수강 등록 없이 이 영상 1개만 열립니다. 수강 명단·출결·수납·성적·학습 진도는 만들지 않습니다.",
      confirmText: selectedWasRevoked ? "새 권한 다시 승인" : "영상 1개 열기",
      review: {
        eyebrow: "최종 확인",
        items: [
          { label: "학생", value: selectedStudent.displayName || selectedStudent.name },
          { label: "허용 범위", value: "현재 영상 1개 · 무료 복습" },
          { label: "수강 등록", value: "생성하지 않음", tone: "warning" },
          { label: "사유", value: reason.trim() },
        ],
        note: selectedWasRevoked
          ? "이전에 회수된 이력은 보존되고 새 감사 이력이 생성됩니다."
          : "같은 강의의 다른 영상은 열리지 않습니다.",
      },
    });
    if (approved) grantMutation.mutate();
  };

  const requestRevoke = async (entitlement: DirectVideoEntitlement) => {
    const revokeReason = (revokeReasons[entitlement.id] ?? "").trim();
    if (revokeReason.length < 2) return;
    const approved = await confirm({
      title: "개별 영상 권한 회수",
      message: "다음 권한 확인부터 영상이 닫힙니다. 이미 발급된 재생 주소는 짧은 만료 시간까지만 남을 수 있습니다.",
      confirmText: "권한 회수",
      danger: true,
      review: {
        eyebrow: "회수 대상",
        items: [
          { label: "학생", value: entitlement.student_name },
          { label: "영상", value: entitlement.video_title },
          { label: "회수 사유", value: revokeReason, tone: "warning" },
        ],
      },
    });
    if (approved) revokeMutation.mutate({ entitlementId: entitlement.id, revokeReason });
  };

  return (
    <section className="direct-video-access" aria-label="수강 등록 없이 영상만">
      <div className="direct-video-access__notice">
        <strong>예외 권한</strong>
        <span>학생을 강의에 등록하지 않고 현재 영상 1개만 엽니다. 일반적인 요청은 기존 수강 등록을 사용해 주세요.</span>
      </div>

      <div className="direct-video-access__grid">
        <div className="direct-video-access__panel">
          <div className="direct-video-access__panel-head">
            <div>
              <h3>학생 찾기</h3>
              <p>이름 두 글자 이상으로 현재 학원 학생만 검색합니다.</p>
            </div>
          </div>
          <label className="direct-video-access__field">
            <span>학생 이름</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="예: 김학생"
              aria-label="개별 영상 권한 학생 검색"
            />
          </label>
          <div className="direct-video-access__student-list" aria-live="polite">
            {debouncedSearch.length < 2 ? (
              <div className="direct-video-access__placeholder">이름을 두 글자 이상 입력해 주세요.</div>
            ) : studentQuery.isLoading ? (
              <div className="direct-video-access__placeholder">학생을 찾는 중…</div>
            ) : studentQuery.isError ? (
              <EmptyState
                scope="modal"
                tone="error"
                title="학생 검색에 실패했습니다"
                actions={<Button intent="secondary" size="sm" onClick={() => void studentQuery.refetch()}>다시 시도</Button>}
              />
            ) : students.length === 0 ? (
              <div className="direct-video-access__placeholder">검색 결과가 없습니다.</div>
            ) : students.map((student) => {
              const selected = selectedStudent?.id === student.id;
              return (
                <button
                  key={student.id}
                  type="button"
                  className="direct-video-access__student"
                  data-selected={selected ? "true" : "false"}
                  onClick={() => setSelectedStudent(student)}
                  aria-pressed={selected}
                >
                  <span>
                    <strong>{student.displayName || student.name}</strong>
                    <small>{studentSummary(student)}</small>
                  </span>
                  <Badge
                    variant="soft"
                    tone={student.accountState === "ACTIVE" ? "success" : "warning"}
                  >
                    {studentAccountStateLabel(student.accountState)}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>

        <div className="direct-video-access__panel">
          <div className="direct-video-access__panel-head">
            <div>
              <h3>영상 1개 승인</h3>
              <p>수강·출결·수납·성적·진도 데이터는 만들지 않습니다.</p>
            </div>
          </div>
          {selectedStudent ? (
            <div className="direct-video-access__selection">
              <div>
                <span>선택한 학생</span>
                <strong>{selectedStudent.displayName || selectedStudent.name}</strong>
                <small>{studentSummary(selectedStudent)} · {studentAccountStateLabel(selectedStudent.accountState)}</small>
              </div>
              <Button intent="ghost" size="sm" onClick={() => setSelectedStudent(null)}>선택 해제</Button>
            </div>
          ) : (
            <div className="direct-video-access__selection direct-video-access__selection--empty">
              왼쪽에서 학생을 선택해 주세요.
            </div>
          )}
          <label className="direct-video-access__field direct-video-access__field--grow">
            <span>승인 사유 <em>필수</em></span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="왜 수강 등록 없이 이 영상만 열어야 하는지 남겨 주세요."
              maxLength={2000}
            />
          </label>
          {selectedWasRevoked && !selectedHasCurrent && (
            <p className="direct-video-access__regrant-note">이전에 회수한 이력이 있어 새 감사 이력으로 다시 승인합니다.</p>
          )}
          <div className="direct-video-access__grant-footer">
            <span>{grantDisabledReason ?? "최종 확인 후 이 영상 1개만 열립니다."}</span>
            <Button
              intent="primary"
              disabled={Boolean(grantDisabledReason) || grantMutation.isPending}
              onClick={() => void requestGrant()}
            >
              {grantMutation.isPending ? "승인 중…" : selectedWasRevoked ? "새 권한 다시 승인" : "영상 1개 열기"}
            </Button>
          </div>
        </div>
      </div>

      <div className="direct-video-access__history">
        <div className="direct-video-access__panel-head">
          <div>
            <h3>현재 권한과 감사 이력</h3>
            <p>현재 영상에 한정된 승인·회수 기록입니다.</p>
          </div>
          {historyQuery.isFetching && <span className="direct-video-access__sync">동기화 중…</span>}
        </div>
        {historyQuery.isLoading ? (
          <div className="direct-video-access__placeholder">권한 이력을 불러오는 중…</div>
        ) : historyQuery.isError ? (
          <EmptyState
            scope="modal"
            tone="error"
            title="권한 이력을 불러오지 못했습니다"
            actions={<Button intent="secondary" size="sm" onClick={() => void historyQuery.refetch()}>다시 시도</Button>}
          />
        ) : history.length === 0 ? (
          <div className="direct-video-access__placeholder">아직 개별 영상 권한 이력이 없습니다.</div>
        ) : (
          <div className="direct-video-access__history-list">
            {history.map((entitlement) => {
              const state = entitlementState(entitlement);
              const revokeReason = revokeReasons[entitlement.id] ?? "";
              return (
                <article key={entitlement.id} className="direct-video-access__history-row">
                  <div className="direct-video-access__history-main">
                    <div>
                      <strong>{entitlement.student_name}</strong>
                      <Badge variant="soft" tone={state.tone}>{state.label}</Badge>
                    </div>
                    <p>{entitlement.reason}</p>
                    <small>승인 {formatDate(entitlement.granted_at)}{entitlement.revoked_at ? ` · 회수 ${formatDate(entitlement.revoked_at)}` : ""}</small>
                  </div>
                  {entitlement.revoked_at == null ? (
                    <div className="direct-video-access__revoke">
                      <input
                        value={revokeReason}
                        onChange={(event) => setRevokeReasons((current) => ({
                          ...current,
                          [entitlement.id]: event.target.value,
                        }))}
                        placeholder="회수 사유"
                        aria-label={`${entitlement.student_name} 회수 사유`}
                        maxLength={2000}
                      />
                      <Button
                        intent="danger"
                        size="sm"
                        disabled={revokeReason.trim().length < 2 || revokeMutation.isPending}
                        onClick={() => void requestRevoke(entitlement)}
                      >
                        회수
                      </Button>
                    </div>
                  ) : entitlement.revoke_reason ? (
                    <p className="direct-video-access__revoke-record">회수 사유: {entitlement.revoke_reason}</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
