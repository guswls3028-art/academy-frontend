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

  const toggle = (enrollmentId: number) => {
    setSelected((prev) => (prev.includes(enrollmentId) ? prev.filter((x) => x !== enrollmentId) : [...prev, enrollmentId]));
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
      const isAccessMode = ["FREE_REVIEW", "PROCTORED_CLASS", "BLOCKED"].includes(ruleOrAccessMode);

      const payload: any = {
        video_id: videoId,
        enrollments: selected,
      };

      if (isAccessMode) {
        payload.access_mode = ruleOrAccessMode;
      } else {
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
        <div className="permission-modal-header">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2
                className="text-[var(--text-lg,16px)] font-semibold text-[var(--color-text-primary)]"
                style={{ fontSize: "var(--text-lg, 16px)" }}
              >
                시청 권한 관리
              </h2>
              <p
                className="mt-0.5 text-[var(--color-text-muted)]"
                style={{ fontSize: "var(--text-xs, 11px)" }}
              >
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

                    <div
                      className="ml-auto text-[var(--color-text-secondary)]"
                      style={{ fontSize: "var(--text-sm, 12px)" }}
                    >
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
