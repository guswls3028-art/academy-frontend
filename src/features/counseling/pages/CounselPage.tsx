// PATH: src/features/counseling/pages/CounselPage.tsx
import { DomainLayout } from "@/shared/ui/layout";

export default function CounselPage() {
  return (
    <DomainLayout title="상담" description="상담·코칭 관리를 한 화면에서.">
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-2">상담</h1>
        <p className="text-gray-600 text-sm">
          상담 기록, 일정, 상담 폼 만들기 기능이 여기에 추가될 예정입니다.
        </p>
      </div>
    </DomainLayout>
  );
}
