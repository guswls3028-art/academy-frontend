// PATH: src/features/videos/components/features/video-detail/modals/PermissionModal.tsx

import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import api from "@/shared/api/axios";
import { Button } from "@/shared/ui/ds";

import PermissionHeader from "../../video-permission/components/PermissionHeader";
import PermissionTable from "../../video-permission/components/PermissionTable";
import PermissionSidePanel from "../../video-permission/components/PermissionSidePanel";

import VideoAchievementTab from "../../video-analytics/VideoAchievementTab";
import VideoLogTab from "../../video-analytics/VideoLogTab";

import type { PermissionModalProps, TabKey } from "../../video-permission/permission.types";

import "../../video-permission/permission-modal.css";

/* ================= component ================= */

export default function PermissionModal({
  videoId,
  open,
  onClose,
  focusEnrollmentId,
  onChangeFocusEnrollmentId,
  initialTab = "permission",
}: PermissionModalProps) {
  const qc = useQueryClient();

  const [tab, setTab] = useState<TabKey>(initialTab);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [focusEnrollment, setFocusEnrollment] = useState<number | null>(null);

  /* focus + initialTab sync */
  useEffect(() => {
    if (!open) return;
    if (focusEnrollmentId !== undefined) setFocusEnrollment(focusEnrollmentId ?? null);
    setTab(initialTab);
  }, [open, focusEnrollmentId, initialTab]);

  const setFocusBoth = (v: number | null) => {
    setFocusEnrollment(v);
    onChangeFocusEnrollmentId?.(v);
  };

  const switchTab = (next: TabKey) => {
    setTab(next);
    if (next !== "permission") {
      setSelected([]);
    }
  };

  /* ================= query ================= */

  const { data, isFetching } = useQuery({
    queryKey: ["video", videoId, "stats"],
    queryFn: async () => {
      const res = await api.get(`/media/videos/${videoId}/stats/`);
      return res.data;
    },
    enabled: open && !!videoId && tab === "permission",
    staleTime: 5000,
    retry: 1,
  });

  const studentsRaw = data?.students ?? [];

  /* ================= LEFT TABLE DATA ================= */

  const students = useMemo(() => {
    let list = studentsRaw;

    if (focusEnrollment) {
      list = list.filter((s: any) => s.enrollment === focusEnrollment);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((s: any) =>
        String(s.student_name || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [studentsRaw, focusEnrollment, search]);

  const toggle = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    const ids = students.map((s: any) => s.enrollment);
    if (!ids.length) return;
    setSelected(selected.length === ids.length ? [] : ids);
  };

  /* ================= RIGHT PANEL DATA ================= */

  const selectedStudents = useMemo(() => {
    if (!selected.length) return [];
    const set = new Set(selected);
    return [...studentsRaw]
      .filter((s: any) => set.has(s.enrollment))
      .sort((a: any, b: any) =>
        String(a.student_name || "").localeCompare(String(b.student_name || ""))
      );
  }, [studentsRaw, selected]);

  const mutate = useMutation({
    mutationFn: async (ruleOrAccessMode: string) => {
      // Support both legacy 'rule' and new 'access_mode'
      const isAccessMode = ["FREE_REVIEW", "PROCTORED_CLASS", "BLOCKED"].includes(ruleOrAccessMode);
      
      const payload: any = {
        video_id: videoId,
        enrollments: selected,
      };
      
      if (isAccessMode) {
        payload.access_mode = ruleOrAccessMode;
      } else {
        // Legacy rule support
        payload.rule = ruleOrAccessMode;
      }
      
      await api.post(`/media/video-permissions/bulk-set/`, payload);
    },
    onSuccess: async () => {
      setSelected([]);
      await qc.invalidateQueries({ queryKey: ["video", videoId, "stats"] });
    },
  });

  if (!open) return null;

  const totalCount = students.length;

  return (
    <div className="permission-modal-overlay">
      <div className="permission-modal">
        {/* HEADER */}
        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">시청 권한 관리</div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                권한 설정 / 성취도 / 시청 로그
              </div>
            </div>

            <Button type="button" intent="ghost" size="sm" onClick={onClose}>
              닫기
            </Button>
          </div>

          <div className="mt-3">
            <PermissionHeader
              tab={tab}
              onChangeTab={switchTab}
              onClose={onClose}
              isFetching={!!isFetching}
              focusEnrollment={focusEnrollment}
              onClearFocus={() => setFocusBoth(null)}
            />
          </div>
        </div>

        {/* BODY */}
        <div className="permission-modal-body">
          <div className="permission-modal-surface">
            {tab === "permission" ? (
              <div className="h-full flex gap-4 min-h-0">
                {/* LEFT */}
                <div className="permission-left">
                  {/* SEARCH BAR ONLY */}
                  <div className="permission-header flex items-center gap-3">
                    <input
                      className="h-8 rounded border px-3 text-sm w-[220px]"
                      placeholder="이름 검색"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />

                    <div className="ml-auto text-sm text-[var(--text-secondary)]">
                      전체 {totalCount}명
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-hidden">
                    <PermissionTable
                      students={students}
                      selected={selected}
                      toggle={toggle}
                      toggleAll={toggleAll}
                    />
                  </div>
                </div>

                {/* RIGHT */}
                <PermissionSidePanel
                  selectedStudents={selectedStudents}
                  selectedCount={selected.length}
                  pending={mutate.isPending}
                  onApply={(rule) => mutate.mutate(rule)}
                  onClear={() => setSelected([])}
                  onRemoveOne={(enrollment) =>
                    setSelected((prev) => prev.filter((x) => x !== enrollment))
                  }
                />
              </div>
            ) : tab === "achievement" ? (
              <VideoAchievementTab videoId={videoId} onSelectStudent={(id) => setFocusBoth(id)} />
            ) : (
              <VideoLogTab videoId={videoId} onClickRiskStudent={(id) => setFocusBoth(id)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
