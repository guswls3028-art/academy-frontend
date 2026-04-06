// PATH: src/features/storage/pages/StudentInventoryPage.tsx
// 학생 인벤토리 관리 탭 페이지

import { useParams } from "react-router-dom";
import StudentInventoryManage from "../components/StudentInventoryManage";

export default function StudentInventoryPage() {
  const { studentPs } = useParams<{ studentPs?: string }>();

  return (
    <StudentInventoryManage
      initialStudentPs={studentPs ?? undefined}
    />
  );
}
