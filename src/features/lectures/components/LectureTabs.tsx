// src/features/lectures/components/LectureTabs.tsx
import { NavLink, useParams } from "react-router-dom";

export default function LectureTabs() {
  const { lectureId } = useParams<{ lectureId: string }>();
  if (!lectureId) return null;

  const tabs = [
    { key: "students", label: "수강생", to: `/admin/lectures/${lectureId}` },
    { key: "materials", label: "자료실", to: `/admin/lectures/${lectureId}/materials` },
    { key: "board", label: "게시판", to: `/admin/lectures/${lectureId}/board` },
    { key: "ddays", label: "디데이", to: `/admin/lectures/${lectureId}/ddays` },
    { key: "attendance", label: "출결", to: `/admin/lectures/${lectureId}/attendance` },
    { key: "report", label: "리포트", to: `/admin/lectures/${lectureId}/report` },
  ];

  return (
    <div
      className="
        rounded-t-2xl
        border border-b-0 border-[var(--border-divider)]
        bg-[var(--bg-surface)]
        px-4 pt-4
      "
    >
      <div className="flex gap-2 border-b border-[var(--border-divider)]">
        {tabs.map((tab) => (
          <NavLink
            key={tab.key}
            to={tab.to}
            end={tab.key === "students"}
            className={({ isActive }) =>
              [
                "relative px-4 py-2 text-sm font-semibold rounded-t-lg",
                "transition-all duration-200",
                isActive
                  ? "bg-[var(--bg-surface)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              ].join(" ")
            }
          >
            {({ isActive }) => (
              <>
                {tab.label}
                {isActive && (
                  <span
                    className="
                      absolute left-0 right-0 -bottom-[1px]
                      h-[2px]
                      bg-[var(--color-primary)]
                      rounded-full
                    "
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
