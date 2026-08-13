/**
 * PATH: src/features/results/components/AdminExamResultsTable.tsx
 *
 * ✅ AdminExamResultsTable (Backend Contract Aligned)
 *
 * 변경 요약:
 * - 석차(등수) 컬럼 추가
 * - 점수 내림차순 기본 정렬
 * - 백분위 표시
 */

import { useMemo, useState } from "react";
import { AdminExamResultRow } from "../types/results.types";
import { deriveFrontResultStatus } from "../utils/deriveFrontResultStatus";
import FrontResultStatusBadge from "./FrontResultStatusBadge";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { Badge, type BadgeTone } from "@/shared/ui/ds";
import { useTenantLabels } from "@/shared/hooks/useTenantLabels";
import {
  deriveAchievement,
  achievementLabel,
  achievementTone,
} from "@/shared/scoring/achievement";
import { compareKoreanText, compareNullableNumbers } from "@/shared/utils/dataOrdering";

function toBadgeTone(t: ReturnType<typeof achievementTone>): BadgeTone {
  return t === "warn" ? "warning" : t;
}

type ResultSort = "rank" | "ranking_score" | "final_score" | "student_name";
type ResultStatusFilter = "all" | "done" | "waiting" | "working" | "failed";

export default function AdminExamResultsTable({
  rows,
  onSelectEnrollment,
}: {
  rows: AdminExamResultRow[];
  onSelectEnrollment: (id: number) => void;
}) {
  const tenantLabels = useTenantLabels();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ResultSort>("rank");
  const [statusFilter, setStatusFilter] = useState<ResultStatusFilter>("all");
  const sorted = useMemo(
    () => {
      const keyword = search.trim().toLocaleLowerCase("ko-KR");
      const visible = rows.filter((row) => {
        if (keyword && !row.student_name.toLocaleLowerCase("ko-KR").includes(keyword)) {
          return false;
        }
        const status = deriveFrontResultStatus(row);
        if (statusFilter === "done" && status !== "done") return false;
        if (statusFilter === "waiting" && status !== "waiting") return false;
        if (statusFilter === "working" && !["processing", "partial_done"].includes(status)) return false;
        if (statusFilter === "failed" && status !== "failed") return false;
        return true;
      });

      return visible.sort((a, b) => {
        let compared = 0;
        if (sort === "rank") {
          compared = compareNullableNumbers(a.rank, b.rank, "asc")
            || compareNullableNumbers(a.ranking_score, b.ranking_score, "desc");
        } else if (sort === "ranking_score") {
          compared = compareNullableNumbers(a.ranking_score, b.ranking_score, "desc");
        } else if (sort === "final_score") {
          compared = compareNullableNumbers(a.final_score, b.final_score, "desc");
        } else {
          compared = compareKoreanText(a.student_name, b.student_name);
        }
        return compared
          || compareKoreanText(a.student_name, b.student_name)
          || a.enrollment_id - b.enrollment_id;
      });
    },
    [rows, search, sort, statusFilter],
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="search"
          className="ds-input col-span-2 h-9 min-w-0 text-sm"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="학생 이름 검색"
          aria-label="시험 결과 학생 검색"
        />
        <select
          className="ds-input h-9 min-w-0 text-sm"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as ResultStatusFilter)}
          aria-label="시험 결과 상태 필터"
        >
          <option value="all">상태 전체</option>
          <option value="done">완료</option>
          <option value="waiting">미제출</option>
          <option value="working">채점중·미채점</option>
          <option value="failed">실패</option>
        </select>
        <select
          className="ds-input h-9 min-w-0 text-sm"
          value={sort}
          onChange={(event) => setSort(event.target.value as ResultSort)}
          aria-label="시험 결과 정렬"
        >
          <option value="rank">등수순</option>
          <option value="ranking_score">1차점수 높은순</option>
          <option value="final_score">최종점수 높은순</option>
          <option value="student_name">이름 가나다순</option>
        </select>
      </div>
      <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <span>결과 {sorted.length}명</span>
        <span>등수는 1차점수 기준</span>
      </div>
      <div className="overflow-hidden border-y border-[var(--border-divider)] sm:hidden">
        {sorted.map((r) => {
          const frontStatus = deriveFrontResultStatus(r);
          const achievement = deriveAchievement(r);
          const rankingScore = r.ranking_score ?? r.final_score;
          const hasDifferentFinalScore = (
            typeof r.ranking_score === "number"
            && typeof r.final_score === "number"
            && r.ranking_score !== r.final_score
          );

          return (
            <button
              key={r.enrollment_id}
              type="button"
              className="grid min-h-16 w-full grid-cols-[42px_minmax(0,1fr)_52px] items-center gap-x-2 gap-y-1 border-b border-[var(--border-divider)] px-1 py-2.5 text-left last:border-b-0 hover:bg-[var(--color-bg-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-border-focus)]"
              onClick={() => onSelectEnrollment(r.enrollment_id)}
            >
              <span className="row-span-2 text-center text-sm font-bold">
                {r.rank != null ? (
                  <>
                    {r.rank}
                    <span className="text-[10px] font-normal text-[var(--color-text-muted)]">
                      /{r.cohort_size}
                    </span>
                  </>
                ) : (
                  <span className="text-[var(--color-text-muted)]">—</span>
                )}
              </span>
              <StudentNameWithLectureChip
                name={r.student_name}
                lectures={r.lecture_title ? [{ lectureName: r.lecture_title, color: r.lecture_color, chipLabel: r.lecture_chip_label }] : undefined}
                profilePhotoUrl={r.profile_photo_url}
                avatarSize={24}
                clinicHighlight={r.name_highlight_clinic_target}
                examNotSubmittedCount={r.exam_not_submitted_count}
                density="compact"
              />
              <span className="whitespace-nowrap text-right text-sm font-semibold">
                {typeof rankingScore === "number" ? rankingScore : "—"}
                {hasDifferentFinalScore && (
                  <span className="block text-[10px] font-normal text-[var(--color-text-muted)]">
                    최종 {r.final_score}
                  </span>
                )}
              </span>
              <span className="col-span-2 col-start-2 flex min-w-0 flex-wrap items-center gap-1.5">
                <FrontResultStatusBadge status={frontStatus} />
                {r.is_provisional && (
                  <Badge variant="solid" tone="warning" size="xs" title="채점 미확정 — 임시 점수">
                    임시
                  </Badge>
                )}
                {achievement && (
                  <Badge variant="solid" tone={toBadgeTone(achievementTone(achievement))}>
                    {achievementLabel(achievement, { pass: tenantLabels.pass, fail: tenantLabels.fail })}
                  </Badge>
                )}
              </span>
            </button>
          );
        })}
        {sorted.length === 0 && (
          <div className="py-6 text-center text-sm text-[var(--color-text-muted)]">
            검색·필터 조건에 맞는 학생이 없습니다.
          </div>
        )}
      </div>
      <div className="ds-table-wrap hidden sm:block">
        <table className="ds-table w-full text-sm">
        <thead>
          <tr>
            {/* eslint-disable-next-line no-restricted-syntax */}
            <th style={{ textAlign: "center", width: 62 }}>등수</th>
            {/* eslint-disable-next-line no-restricted-syntax */}
            <th style={{ textAlign: "left" }}>학생</th>
            <th>1차점수</th>
            <th>상태</th>
            <th>{tenantLabels.pass}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const frontStatus = deriveFrontResultStatus(r);
            const achievement = deriveAchievement(r);
            const rankingScore = r.ranking_score ?? r.final_score;
            const hasDifferentFinalScore = (
              typeof r.ranking_score === "number"
              && typeof r.final_score === "number"
              && r.ranking_score !== r.final_score
            );

            return (
              <tr
                key={r.enrollment_id}
                className="cursor-pointer"
                onClick={() => onSelectEnrollment(r.enrollment_id)}
              >
                {/* eslint-disable-next-line no-restricted-syntax */}
                <td style={{ textAlign: "center", fontWeight: 700, fontSize: 13 }}>
                  {r.rank != null ? (
                    <span
                      title={
                        r.cohort_size != null
                          ? `${r.cohort_size}명 중 ${r.rank}등 · 1차 점수 기준`
                          : "1차 점수 기준"
                      }
                    >
                      {r.rank}
                      <span
                        // eslint-disable-next-line no-restricted-syntax
                        style={{
                          fontSize: 11,
                          fontWeight: 400,
                          color: "var(--color-text-muted)",
                          marginLeft: 2,
                        }}
                      >
                        /{r.cohort_size}
                      </span>
                    </span>
                  ) : (
                    // eslint-disable-next-line no-restricted-syntax
                    <span style={{ color: "var(--color-text-muted)" }}>—</span>
                  )}
                </td>

                {/* eslint-disable-next-line no-restricted-syntax */}
                <td style={{ textAlign: "left" }}>
                  <StudentNameWithLectureChip
                    name={r.student_name}
                    lectures={r.lecture_title ? [{ lectureName: r.lecture_title, color: r.lecture_color, chipLabel: r.lecture_chip_label }] : undefined}
                    profilePhotoUrl={r.profile_photo_url}
                    avatarSize={24}
                    clinicHighlight={r.name_highlight_clinic_target}
                    examNotSubmittedCount={r.exam_not_submitted_count}
                  />
                </td>

                {/* eslint-disable-next-line no-restricted-syntax */}
                <td style={{ fontWeight: 600 }}>
                  <span
                    className="inline-flex items-center gap-1.5"
                    title={hasDifferentFinalScore ? `1차 ${r.ranking_score}점 · 최종 ${r.final_score}점` : "등수 산정 점수"}
                  >
                    <span>
                      {typeof rankingScore === "number" ? rankingScore : "—"}
                      {hasDifferentFinalScore && (
                        <span className="block text-[10px] font-normal text-[var(--color-text-muted)]">
                          최종 {r.final_score}
                        </span>
                      )}
                    </span>
                    {r.is_provisional && (
                      <Badge
                        variant="solid"
                        tone="warning"
                        size="xs"
                        title="채점 미확정 — 임시 점수"
                      >
                        임시
                      </Badge>
                    )}
                  </span>
                </td>

                <td>
                  <FrontResultStatusBadge status={frontStatus} />
                </td>

                <td>
                  {achievement ? (
                    <Badge
                      variant="solid"
                      tone={toBadgeTone(achievementTone(achievement))}
                      title={
                        achievement === "REMEDIATED"
                          ? "1차 불합격 후 클리닉 재시험/수동 해소로 통과"
                          : undefined
                      }
                    >
                      {achievementLabel(achievement, { pass: tenantLabels.pass, fail: tenantLabels.fail })}
                    </Badge>
                  ) : (
                    // eslint-disable-next-line no-restricted-syntax
                    <span style={{ color: "var(--color-text-muted)" }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-[var(--color-text-muted)]">
                검색·필터 조건에 맞는 학생이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
