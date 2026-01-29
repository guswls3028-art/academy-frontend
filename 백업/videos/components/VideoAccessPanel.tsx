// src/features/videos/components/VideoAccessPanel.tsx
// ⚠️ DEPRECATED: PermissionModal(통합)로 대체됨
// 유지 목적: 과거 단일 패널 테스트용. 새 UI는 PermissionModal 사용.

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";

type Rule = "free" | "once" | "blocked";

interface Props {
  videoId: number;
}

export default function VideoAccessPanel({ videoId }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  // ✅ 올바른 endpoint로 교체: /media/videos/:id/stats/
  const { data, isLoading } = useQuery({
    queryKey: ["video", videoId, "stats"],
    queryFn: async () => {
      const res = await api.get(`/media/videos/${videoId}/stats/`);
      return res.data;
    },
    enabled: !!videoId,
  });

  const students = data?.students ?? [];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return students.filter((s: any) =>
      (s.student_name || "").toLowerCase().includes(q)
    );
  }, [students, search]);

  // ✅ bulk-set 사용 (현재 실사용 엔드포인트)
  const mutation = useMutation({
    mutationFn: async (payload: { enrollments: number[]; rule: Rule }) => {
      await api.post("/media/video-permissions/bulk-set/", {
        video: videoId,
        enrollments: payload.enrollments,
        rule: payload.rule,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video", videoId, "stats"] });
    },
  });

  const setPermission = (enrollment: number, rule: Rule) => {
    mutation.mutate({ enrollments: [enrollment], rule });
  };

  const setAll = (rule: Rule) => {
    mutation.mutate({
      enrollments: filtered.map((s: any) => s.enrollment),
      rule,
    });
  };

  if (isLoading)
    return (
      <div className="w-[380px] border rounded p-4 text-sm bg-white">
        로딩중...
      </div>
    );

  return (
    <div className="w-[380px] shrink-0 border rounded p-4 bg-white text-sm space-y-3 h-fit sticky top-6">
      <div className="text-base font-semibold">시청 권한 관리(Deprecated)</div>

      <input
        className="w-full rounded border px-3 py-2 text-xs"
        placeholder="학생 이름 검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="flex gap-2 text-xs">
        <button className="px-2 py-1 rounded bg-gray-200" onClick={() => setAll("free")}>
          무제한
        </button>
        <button className="px-2 py-1 rounded bg-gray-200" onClick={() => setAll("once")}>
          1회 제한
        </button>
        <button className="px-2 py-1 rounded bg-gray-200" onClick={() => setAll("blocked")}>
          차단
        </button>
      </div>

      <div className="border rounded h-[500px] overflow-y-auto">
        {!filtered.length && (
          <div className="p-4 text-xs text-center text-gray-500">학생이 없습니다.</div>
        )}

        {filtered.map((s: any) => {
          const progress = Math.round((s.progress ?? 0) * 100);
          const rule = s.effective_rule as Rule;

          return (
            <div key={s.enrollment} className="border-b px-3 py-2 text-xs">
              <div className="font-medium">{s.student_name}</div>

              <div className="text-[10px] text-gray-500 mb-1">진도율: {progress}%</div>
              <div className="h-1.5 w-full bg-gray-200 rounded mb-1">
                <div className="h-full bg-blue-500" style={{ width: `${progress}%` }} />
              </div>

              <div className="flex gap-1">
                <button
                  onClick={() => setPermission(s.enrollment, "free")}
                  className={`px-2 py-1 rounded border ${
                    rule === "free"
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-white text-gray-600 border-gray-300"
                  }`}
                >
                  무제한
                </button>

                <button
                  onClick={() => setPermission(s.enrollment, "once")}
                  className={`px-2 py-1 rounded border ${
                    rule === "once"
                      ? "bg-yellow-500 text-white border-yellow-500"
                      : "bg-white text-gray-600 border-gray-300"
                  }`}
                >
                  1회
                </button>

                <button
                  onClick={() => setPermission(s.enrollment, "blocked")}
                  className={`px-2 py-1 rounded border ${
                    rule === "blocked"
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-white text-gray-600 border-gray-300"
                  }`}
                >
                  차단
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
