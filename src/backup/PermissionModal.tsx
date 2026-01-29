// src/features/videos/components/PermissionModal.tsx

import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import api from "@/shared/api/axios";
import PermissionFilter from "../src/features/videos/components/PermissionFilter";
import VideoAchievementTab from "../src/features/videos/components/VideoAchievementTab";
import VideoLogTab from "../src/features/videos/components/VideoLogTab";

import "./css/permission-modal.css";

/* ===================== LABEL MAPS ===================== */

const ATT_LABELS: Record<string, string> = {
  PRESENT: "출석",
  LATE: "지각",
  ONLINE: "영상",
  SUPPLEMENT: "보강",
  EARLY_LEAVE: "조퇴",
  ABSENT: "결석",
  RUNAWAY: "출튀",
  MATERIAL: "자료",
  INACTIVE: "부재",
  SECESSION: "탈퇴",
};

const ATT_COLORS: Record<string, string> = {
  PRESENT: "bg-blue-500",
  LATE: "bg-yellow-500",
  ONLINE: "bg-purple-500",
  SUPPLEMENT: "bg-teal-500",
  EARLY_LEAVE: "bg-orange-500",
  ABSENT: "bg-red-500",
  RUNAWAY: "bg-red-600",
  MATERIAL: "bg-cyan-600",
  INACTIVE: "bg-gray-500",
  SECESSION: "bg-gray-400",
};

const RULE_LABELS: Record<string, string> = {
  free: "무제한",
  once: "1회 제한",
  blocked: "제한",
};

const RULE_COLORS: Record<string, string> = {
  free: "bg-green-500",
  once: "bg-blue-500",
  blocked: "bg-red-500",
};

/* ===================== TYPES ===================== */

interface Props {
  videoId: number;
  open: boolean;
  onClose: () => void;

  // ✅ NEW: 외부에서 특정 학생 focus 주입
  focusEnrollmentId?: number | null;
  onChangeFocusEnrollmentId?: (v: number | null) => void;
}

type TabKey = "permission" | "achievement" | "log";

/* ===================== COMPONENT ===================== */

export default function PermissionModal({
  videoId,
  open,
  onClose,
  focusEnrollmentId,
  onChangeFocusEnrollmentId,
}: Props) {
  const qc = useQueryClient();

  const [tab, setTab] = useState<TabKey>("permission");

  const [filters, setFilters] = useState<any>({});
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<number[]>([]);
  const [showFilter, setShowFilter] = useState(false);

  // ✅ 내부 focus state (외부 주입 가능)
  const [focusEnrollment, setFocusEnrollment] = useState<number | null>(null);

  // 외부 → 내부 동기화
  useEffect(() => {
    if (!open) return;
    if (focusEnrollmentId === undefined) return;
    setFocusEnrollment(focusEnrollmentId ?? null);
  }, [open, focusEnrollmentId]);

  const setFocusBoth = (v: number | null) => {
    setFocusEnrollment(v);
    onChangeFocusEnrollmentId?.(v);
  };

  const switchTab = (next: TabKey) => {
    setTab(next);

    // 실무 UX: 탭 전환 시 불필요 상태 최소화
    if (next !== "permission") {
      setSelected([]);
      setShowFilter(false);
    }
  };

  const focusStudentInPermission = (enrollmentId: number) => {
    setFocusBoth(enrollmentId);
    setSelected([]); // 안전
    switchTab("permission");
  };

  /* ===================== FETCH (permission 탭에서만) ===================== */

  const statsQueryKey = useMemo(
    () => ["video", videoId, "stats", filters],
    [videoId, filters]
  );

  const { data, isFetching } = useQuery({
    queryKey: statsQueryKey,
    queryFn: async () => {
      const res = await api.get(`/media/videos/${videoId}/stats/`, {
        params: {
          ...filters,
        },
      });
      return res.data;
    },
    enabled: open && !!videoId && tab === "permission",
    staleTime: 5000,
  });

  const studentsRaw = data?.students ?? [];

  // ✅ 검색/포커스 필터는 프론트에서 처리 (stats pagination 미지원이므로)
  const students = useMemo(() => {
    let list = studentsRaw;

    if (focusEnrollment) {
      list = list.filter((s: any) => s.enrollment === focusEnrollment);
    }

    const q = (search || "").trim().toLowerCase();
    if (q) {
      list = list.filter((s: any) =>
        String(s.student_name || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [studentsRaw, focusEnrollment, search]);

  /* ===================== SELECTION ===================== */

  const toggle = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    const ids = students.map((s: any) => s.enrollment);
    if (ids.length === 0) return;

    if (selected.length === ids.length) setSelected([]);
    else setSelected(ids);
  };

  /* ===================== MUTATION ===================== */

  const mutate = useMutation({
    mutationFn: async (rule: string) => {
      await api.post(`/media/video-permissions/bulk-set/`, {
        video: videoId,
        enrollments: selected,
        rule,
      });
    },
    onSuccess: async () => {
      setSelected([]);

      // ✅ 권한 변경 즉시 반영
      await qc.invalidateQueries({ queryKey: ["video", videoId, "stats"] });
      await qc.invalidateQueries({ queryKey: ["video", videoId, "events"] });
      await qc.invalidateQueries({ queryKey: ["video", videoId, "events-risk"] });
      await qc.invalidateQueries({ queryKey: ["video", videoId, "achievement"] });
    },
  });

  if (!open) return null;

  const totalCount = data?.total_filtered ?? studentsRaw.length;

  return (
    <div className="permission-modal-overlay">
      <div className="permission-modal flex flex-col !p-0">
        {/* TOP BAR */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <button
              className={`text-sm px-3 py-1 rounded border ${
                tab === "permission" ? "bg-white font-semibold" : "bg-gray-100"
              }`}
              onClick={() => switchTab("permission")}
            >
              권한 설정
            </button>
            <button
              className={`text-sm px-3 py-1 rounded border ${
                tab === "achievement" ? "bg-white font-semibold" : "bg-gray-100"
              }`}
              onClick={() => switchTab("achievement")}
            >
              학습 성취도
            </button>
            <button
              className={`text-sm px-3 py-1 rounded border ${
                tab === "log" ? "bg-white font-semibold" : "bg-gray-100"
              }`}
              onClick={() => switchTab("log")}
            >
              시청 로그
            </button>

            {tab === "permission" && (
              <span className="text-xs text-gray-500 ml-2">
                {isFetching ? "동기화 중..." : "최신"}
              </span>
            )}

            {focusEnrollment && tab === "permission" && (
              <button
                className="ml-2 text-xs px-2 py-1 border rounded bg-white"
                onClick={() => setFocusBoth(null)}
              >
                학생 필터 해제
              </button>
            )}
          </div>

          <button onClick={onClose} className="text-xs px-3 py-1 border rounded bg-white">
            닫기
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-hidden p-4">
          {tab === "permission" ? (
            <div className="h-full flex gap-4">
              {/* LEFT */}
              <div className="permission-left">
                {/* HEADER */}
                <div className="permission-header">
                  <div className="flex items-center gap-2">
                    <button
                      className="text-xs px-3 py-1 border rounded bg-white"
                      onClick={() => setShowFilter(true)}
                    >
                      필터
                    </button>

                    <input
                      className="border rounded px-3 py-1 text-sm w-[240px]"
                      placeholder="이름 검색"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <div className="text-sm text-gray-600">전체 {totalCount}명</div>
                </div>

                {/* TABLE HEADER */}
                <div className="permission-table-header">
                  <div className="permission-checkbox">
                    <input
                      type="checkbox"
                      checked={students.length > 0 && selected.length === students.length}
                      onChange={toggleAll}
                    />
                  </div>

                  <div className="w-[130px]">이름</div>
                  <div className="w-[90px] text-center">출석</div>
                  <div className="w-[90px] text-center">권한</div>
                  <div className="w-[150px]">학부모 번호</div>
                  <div className="w-[150px]">학생 번호</div>
                  <div className="w-[140px]">학교</div>
                  <div className="w-[60px] text-center">학년</div>
                </div>

                {/* TABLE BODY */}
                <div className="flex-1 overflow-auto">
                  {students.map((s: any) => {
                    const selectedRow = selected.includes(s.enrollment);

                    return (
                      <div
                        key={s.enrollment}
                        className={`permission-row ${selectedRow ? "permission-row-selected" : ""}`}
                        onClick={() => toggle(s.enrollment)}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="permission-checkbox" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedRow}
                            onChange={() => toggle(s.enrollment)}
                          />
                        </div>

                        <div className="permission-name">{s.student_name}</div>

                        <div className="w-[90px] flex justify-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] text-white ${
                              ATT_COLORS[s.attendance_status] || "bg-gray-400"
                            }`}
                          >
                            {ATT_LABELS[s.attendance_status] || "-"}
                          </span>
                        </div>

                        <div className="w-[90px] flex justify-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] text-white ${
                              RULE_COLORS[s.effective_rule] || "bg-gray-400"
                            }`}
                          >
                            {RULE_LABELS[s.effective_rule] || "-"}
                          </span>
                        </div>

                        <div className="w-[150px] permission-text-xs">{s.parent_phone || "-"}</div>
                        <div className="w-[150px] permission-text-xs">{s.student_phone || "-"}</div>
                        <div className="w-[140px] permission-text-xs">{s.school || "-"}</div>
                        <div className="w-[60px] text-center text-xs">{s.grade || "-"}</div>
                      </div>
                    );
                  })}

                  {students.length === 0 && (
                    <div className="p-6 text-sm text-gray-500">표시할 학생이 없습니다.</div>
                  )}
                </div>
              </div>

              {/* RIGHT */}
              <div className="permission-right">
                <div className="permission-right-header">선택 목록 ({selected.length})</div>

                <div className="permission-right-actions">
                  {(["free", "once", "blocked"] as const).map((type) => (
                    <button
                      key={type}
                      disabled={selected.length === 0 || mutate.isPending}
                      onClick={() => mutate.mutate(type)}
                      className={`h-12 w-full text-sm font-bold text-white rounded ${
                        RULE_COLORS[type]
                      } ${mutate.isPending ? "opacity-70" : ""}`}
                    >
                      {RULE_LABELS[type]} ({selected.length})
                    </button>
                  ))}

                  <button
                    disabled={selected.length === 0}
                    onClick={() => setSelected([])}
                    className="w-full h-10 border rounded bg-white text-sm"
                  >
                    선택 해제
                  </button>
                </div>
              </div>

              {/* FILTER MODAL */}
              {showFilter && (
                <PermissionFilter
                  filters={filters}
                  setFilters={(f) => {
                    setFilters(f);
                    setSelected([]);
                  }}
                  onClose={() => setShowFilter(false)}
                />
              )}
            </div>
          ) : tab === "achievement" ? (
            <div className="h-full">
              <VideoAchievementTab
                videoId={videoId}
                onSelectStudent={(enrollmentId) => focusStudentInPermission(enrollmentId)}
              />
            </div>
          ) : (
            <div className="h-full">
              <VideoLogTab
                videoId={videoId}
                onClickRiskStudent={(enrollmentId) => focusStudentInPermission(enrollmentId)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
