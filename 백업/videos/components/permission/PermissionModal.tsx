// src/features/videos/components/permission/PermissionModal.tsx

import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import api from "@/shared/api/axios";
import PermissionFilter from "../PermissionFilter";
import VideoAchievementTab from "../VideoAchievementTab";
import VideoLogTab from "../VideoLogTab";

import PermissionHeader from "./PermissionHeader";
import PermissionTable from "./PermissionTable";
import PermissionSidePanel from "./PermissionSidePanel";

import { PermissionModalProps, TabKey } from "./permission.types";

import "./css/permission-modal.css";

export default function PermissionModal({
  videoId,
  open,
  onClose,
  focusEnrollmentId,
  onChangeFocusEnrollmentId,
}: PermissionModalProps) {
  const qc = useQueryClient();

  const [tab, setTab] = useState<TabKey>("permission");
  const [filters, setFilters] = useState<any>({});
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [focusEnrollment, setFocusEnrollment] = useState<number | null>(null);

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
    if (next !== "permission") {
      setSelected([]);
      setShowFilter(false);
    }
  };

  const statsQueryKey = useMemo(
    () => ["video", videoId, "stats", filters],
    [videoId, filters]
  );

  const { data, isFetching } = useQuery({
    queryKey: statsQueryKey,
    queryFn: async () => {
      const res = await api.get(`/media/videos/${videoId}/stats/`, {
        params: { ...filters },
      });
      return res.data;
    },
    enabled: open && !!videoId && tab === "permission",
    staleTime: 5000,
  });

  const studentsRaw = data?.students ?? [];

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
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    const ids = students.map((s: any) => s.enrollment);
    if (ids.length === 0) return;
    setSelected(
      selected.length === ids.length ? [] : ids
    );
  };

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
      await qc.invalidateQueries({ queryKey: ["video", videoId, "stats"] });
      await qc.invalidateQueries({ queryKey: ["video", videoId, "events"] });
      await qc.invalidateQueries({ queryKey: ["video", videoId, "events-risk"] });
      await qc.invalidateQueries({
        queryKey: ["video", videoId, "achievement"],
      });
    },
  });

  if (!open) return null;

  const totalCount = data?.total_filtered ?? studentsRaw.length;

  return (
    <div className="permission-modal-overlay">
      <div className="permission-modal flex flex-col !p-0">
        <PermissionHeader
          tab={tab}
          onChangeTab={switchTab}
          onClose={onClose}
          isFetching={!!isFetching}
          focusEnrollment={focusEnrollment}
          onClearFocus={() => setFocusBoth(null)}
        />

        <div className="flex-1 overflow-hidden p-4">
          {tab === "permission" ? (
            <div className="h-full flex gap-4">
              <div className="permission-left">
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

                  <div className="text-sm text-gray-600">
                    전체 {totalCount}명
                  </div>
                </div>

                <PermissionTable
                  students={students}
                  selected={selected}
                  toggle={toggle}
                  toggleAll={toggleAll}
                />
              </div>

              <PermissionSidePanel
                selectedCount={selected.length}
                pending={mutate.isPending}
                onApply={(rule) => mutate.mutate(rule)}
                onClear={() => setSelected([])}
              />

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
            <VideoAchievementTab
              videoId={videoId}
              onSelectStudent={(id) => setFocusBoth(id)}
            />
          ) : (
            <VideoLogTab
              videoId={videoId}
              onClickRiskStudent={(id) => setFocusBoth(id)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
