// PATH: src/features/lectures/components/LectureTabs.tsx
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/shared/ui/ds";

export default function LectureTabs() {
  const navigate = useNavigate();
  const location = useLocation();
  const { lectureId } = useParams<{ lectureId: string }>();
  if (!lectureId) return null;

  const base = `/admin/lectures/${lectureId}`;

  const activeKey = location.pathname.includes("/materials")
    ? "materials"
    : location.pathname.includes("/board")
    ? "board"
    : location.pathname.includes("/ddays")
    ? "ddays"
    : location.pathname.includes("/attendance")
    ? "attendance"
    : location.pathname.includes("/report")
    ? "report"
    : "students";

  const tabs = [
    { key: "students", label: "수강생", to: base },
    { key: "materials", label: "자료실", to: `${base}/materials` },
    { key: "board", label: "게시판", to: `${base}/board` },
    { key: "ddays", label: "디데이", to: `${base}/ddays` },
    { key: "attendance", label: "출결", to: `${base}/attendance` },
    { key: "report", label: "리포트", to: `${base}/report` },
  ];

  return (
    <div className="ds-tabs flex gap-2">
      {tabs.map((t) => (
        <Button
          key={t.key}
          type="button"
          intent={activeKey === t.key ? "primary" : "ghost"}
          size="sm"
          className="ds-tab text-[15px] font-semibold"
          onClick={() => navigate(t.to)}
        >
          {t.label}
        </Button>
      ))}
    </div>
  );
}
