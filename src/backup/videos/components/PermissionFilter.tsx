import { useState } from "react";

interface Props {
  filters: any;
  setFilters: (f: any) => void;
  onClose: () => void;
}

const GRADES = ["초1", "초2", "초3", "초4", "초5", "초6", "중1", "중2", "중3", "고1", "고2", "고3"];

export default function PermissionFilter({ filters, setFilters, onClose }: Props) {
  const [local, setLocal] = useState<any>({
    grade: filters.grade || [],
    school: filters.school || "",
    has_phone: filters.has_phone ?? "",
    tags: filters.tags || "",
    online_only: filters.online_only ?? false,
  });

  const apply = () => {
    setFilters({
      ...filters,
      ...local,
    });
    onClose();
  };

  const reset = () => {
    setLocal({
      grade: [],
      school: "",
      has_phone: "",
      tags: "",
      online_only: false,
    });
    setFilters({});
    onClose();
  };

  const toggleGrade = (g: string) => {
    setLocal((prev: any) => ({
      ...prev,
      grade: prev.grade.includes(g)
        ? prev.grade.filter((x: string) => x !== g)
        : [...prev.grade, g],
    }));
  };

  return (
    <div className="permission-modal-overlay">
      <div className="permission-modal !w-[520px]">
        <div className="text-lg font-bold mb-4">필터</div>

        {/* ONLINE */}
        <label className="flex items-center gap-2 mb-4 text-sm">
          <input
            type="checkbox"
            checked={local.online_only}
            onChange={(e) => setLocal({ ...local, online_only: e.target.checked })}
          />
          영상(ONLINE) 학생만 보기
        </label>

        {/* GRADE */}
        <div className="mb-4">
          <div className="text-sm font-semibold mb-2">학년</div>
          <div className="flex flex-wrap gap-2">
            {GRADES.map((g) => (
              <button
                key={g}
                onClick={() => toggleGrade(g)}
                className={`px-3 py-1 text-xs rounded border ${
                  local.grade.includes(g) ? "bg-blue-500 text-white" : "bg-white"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* SCHOOL */}
        <div className="mb-4">
          <div className="text-sm font-semibold mb-2">학교</div>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="학교명 검색"
            value={local.school}
            onChange={(e) => setLocal({ ...local, school: e.target.value })}
          />
        </div>

        {/* PHONE */}
        <div className="mb-4">
          <div className="text-sm font-semibold mb-2">전화번호</div>
          <select
            className="w-full border rounded px-3 py-2 text-sm"
            value={local.has_phone}
            onChange={(e) => setLocal({ ...local, has_phone: e.target.value })}
          >
            <option value="">전체</option>
            <option value="yes">있음</option>
            <option value="no">없음</option>
          </select>
        </div>

        {/* TAGS (확장 포인트) */}
        <div className="mb-6">
          <div className="text-sm font-semibold mb-2">태그</div>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="예: 위험, 관리대상 (CSV/AI 연계용)"
            value={local.tags}
            onChange={(e) => setLocal({ ...local, tags: e.target.value })}
          />
        </div>

        {/* ACTIONS */}
        <div className="flex gap-2 justify-end">
          <button className="px-4 py-2 border rounded bg-white" onClick={reset}>
            초기화
          </button>
          <button className="px-4 py-2 rounded bg-blue-600 text-white" onClick={apply}>
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
