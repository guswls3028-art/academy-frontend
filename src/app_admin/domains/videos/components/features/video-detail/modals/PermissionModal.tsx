// PATH: src/app_admin/domains/videos/components/features/video-detail/modals/PermissionModal.tsx

import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { CloseButton } from "@/shared/ui/ds";

import PermissionHeader from "../../video-permission/components/PermissionHeader";
import PermissionTable from "../../video-permission/components/PermissionTable";
import PermissionSidePanel from "../../video-permission/components/PermissionSidePanel";

import VideoAchievementTab from "../../video-analytics/VideoAchievementTab";
import VideoLogTab from "../../video-analytics/VideoLogTab";

import type { AccessMode } from "@admin/domains/videos/types/access-mode";
import type { PermissionModalProps, PermissionStudent, TabKey } from "../../video-permission/permission.types";

import "../../video-permission/permission-modal.css";

interface PermissionStatsResponse {
  students?: PermissionStudent[];
}

interface BulkPermissionPayload {
  video_id: number;
  enrollments: number[];
  access_mode: AccessMode;
}

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

  const { data, isFetching } = useQuery<PermissionStatsResponse>({
    queryKey: ["video", videoId, "stats"],
    queryFn: async () => {
      const res = await api.get(`/media/videos/${videoId}/stats/`);
      return res.data as PermissionStatsResponse;
    },
    enabled: open && !!videoId && tab === "permission",
    staleTime: 5000,
    retry: 1,
  });

  const studentsRaw = useMemo(() => data?.students ?? [], [data?.students]);

  /* ================= LEFT TABLE DATA ================= */

  const students = useMemo(() => {
    let list = studentsRaw;

    if (focusEnrollment) {
      list = list.filter((s) => s.enrollment === focusEnrollment);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((s) =>
        String(s.student_name || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [studentsRaw, focusEnrollment, search]);

  const toggle = (enrollmentId: number) => {
    setSelected((prev) => (prev.includes(enrollmentId) ? prev.filter((x) => x !== enrollmentId) : [...prev, enrollmentId]));
  };

  const toggleAll = () => {
    const ids = students.map((s) => s.enrollment);
    if (!ids.length) return;
    setSelected(selected.length === ids.length ? [] : ids);
  };

  /* ================= RIGHT PANEL DATA ================= */

  const selectedStudents = useMemo(() => {
    if (!selected.length) return [];
    const set = new Set(selected);
    return [...studentsRaw]
      .filter((s) => set.has(s.enrollment))
      .sort((a, b) =>
        String(a.student_name || "").localeCompare(String(b.student_name || ""))
      );
  }, [studentsRaw, selected]);

  const mutate = useMutation({
    mutationFn: async (accessMode: AccessMode) => {
      const payload: BulkPermissionPayload = {
        video_id: videoId,
        enrollments: selected,
        access_mode: accessMode,
      };

      await api.post(`/media/video-permissions/bulk_set/`, payload);
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
        <div className="permission-modal-header">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="permission-title">
                시청 권한 관리
              </h2>
              <p className="permission-subtitle">
                권한 설정 · 성취도 · 시청 로그
              </p>
            </div>

            <CloseButton onClick={onClose} />
          </div>

          <div className="mt-3">
            <PermissionHeader
              tab={tab}
              onChangeTab={switchTab}
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
                  {/* SEARCH BAR */}
                  <div className="permission-header">
                    <input
                      className="permission-search"
                      placeholder="이름 검색"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />

                    <div className="permission-count">
                      전체 <strong>{totalCount}</strong>명
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
